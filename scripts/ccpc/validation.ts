import { basename, isAbsolute } from 'node:path';
import { assertOfficialUrl } from './download-data.ts';
import type { DownloadRecord, Source } from './download-data.ts';
import { CCPC_YEARS, isCcpcYear, parseSelectedYear } from './years.ts';
import type { CcpcYear, SelectedYear } from './years.ts';

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name}: objeto requerido.`);
  }
  return value as Record<string, unknown>;
}

function year(value: unknown, name: string): CcpcYear {
  if (!isCcpcYear(value)) throw new Error(`${name}: año entero debe ser ${CCPC_YEARS.join(', ')}.`);
  return value;
}

function officialUrl(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${name}: URL requerida.`);
  assertOfficialUrl(value);
  return value;
}

function checksum(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`${name}: SHA-256 de 64 caracteres hexadecimales requerido.`);
  }
  return value.toLowerCase();
}

function safeFilename(value: unknown): string {
  if (typeof value !== 'string' || !value || isAbsolute(value) || basename(value) !== value
      || /[\u0000-\u001f<>:"/\\|?*]/.test(value) || !/\.zip$/i.test(value)
      || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(value)) {
    throw new Error('filename: nombre de ZIP inseguro.');
  }
  return value;
}

function isoTimestamp(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name}: fecha ISO con zona horaria explícita requerida.`);
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) throw new Error(`${name}: fecha ISO con zona horaria explícita requerida.`);
  const [y, month, day, hour, minute, second] = parts.slice(1, 7).map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(y, month - 1, day);
  calendar.setUTCHours(hour, minute, second, 0);
  const zone = parts[8];
  const validZone = zone === 'Z' || (Number(zone.slice(1, 3)) <= 23 && Number(zone.slice(4, 6)) <= 59);
  if (calendar.getUTCFullYear() !== y || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day
      || calendar.getUTCHours() !== hour || calendar.getUTCMinutes() !== minute || calendar.getUTCSeconds() !== second
      || !validZone || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${name}: fecha ISO inválida.`);
  }
  return value;
}

export function validateSource(input: unknown, name = 'source'): Source {
  const source = object(input, name);
  return {
    year: year(source.year, `${name}.year`),
    filename: safeFilename(source.filename),
    url: officialUrl(source.url, `${name}.url`),
    landing_url: officialUrl(source.landing_url, `${name}.landing_url`),
    sha256: checksum(source.sha256, `${name}.sha256`),
  };
}

/** Always validate the six catalogued cuts before selecting a single year. */
export function validateCatalog(input: unknown, selectedYear: SelectedYear): Source[] {
  const selected = parseSelectedYear(selectedYear);
  const catalog = object(input, 'Catálogo');
  if (catalog.schema_version !== 1 || !Array.isArray(catalog.sources) || catalog.sources.length !== CCPC_YEARS.length) {
    throw new Error(`Catálogo schema_version 1 requiere exactamente las seis fuentes de ${CCPC_YEARS.join(', ')}.`);
  }
  const sources = catalog.sources.map((value, index) => validateSource(value, `sources[${index}]`));
  if (new Set(sources.map(source => source.year)).size !== CCPC_YEARS.length
      || new Set(sources.map(source => source.filename.toLowerCase())).size !== CCPC_YEARS.length
      || new Set(sources.map(source => assertOfficialUrl(source.url).href)).size !== CCPC_YEARS.length) {
    throw new Error('Catálogo contiene años, URLs o nombres de ZIP duplicados.');
  }
  return sources.filter(source => selected === 'all' || String(source.year) === selected);
}

/** Validate every provenance record, including records outside the selected cut. */
export function validateDownloadManifest(input: unknown): { schema_version: 1; downloads: DownloadRecord[] } {
  const manifest = object(input, 'Procedencia de descarga');
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.downloads)) {
    throw new Error('Procedencia requiere schema_version 1 y downloads como arreglo.');
  }
  const records = manifest.downloads.map((value, index): DownloadRecord => {
    const record = object(value, `downloads[${index}]`);
    if (typeof record.bytes !== 'number' || !Number.isSafeInteger(record.bytes) || record.bytes < 4) {
      throw new Error(`downloads[${index}].bytes: entero seguro de al menos 4 requerido.`);
    }
    return {
      year: year(record.year, 'download.year'),
      url: officialUrl(record.url, 'download.url'),
      final_url: record.final_url === null ? null : officialUrl(record.final_url, 'download.final_url'),
      sha256: checksum(record.sha256, 'download.sha256'),
      bytes: record.bytes,
      downloaded_at: record.downloaded_at === null ? null : isoTimestamp(record.downloaded_at, 'download.downloaded_at'),
      verified_at: isoTimestamp(record.verified_at, 'download.verified_at'),
    };
  });
  if (new Set(records.map(record => record.year)).size !== records.length) {
    throw new Error('Procedencia contiene registros de año duplicados.');
  }
  return { schema_version: 1, downloads: records };
}

/** An acquisition matches the exact year, source URL, checksum and local byte count. */
export function validateAcquisition(input: unknown, source: Source, bytes: number): DownloadRecord | null {
  if (!Number.isSafeInteger(bytes) || bytes < 4) throw new Error('Tamaño del ZIP local inválido.');
  const { downloads: records } = validateDownloadManifest(input);
  return records.find(record => record.year === source.year && record.url === source.url
    && record.sha256 === source.sha256.toLowerCase() && record.bytes === bytes) ?? null;
}
