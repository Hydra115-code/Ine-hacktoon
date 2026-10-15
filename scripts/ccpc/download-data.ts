import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { link, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { validateCatalog, validateDownloadManifest, validateSource } from './validation.ts';
import { CCPC_YEARS, parseSelectedYear } from './years.ts';
import type { CcpcYear, SelectedYear } from './years.ts';

export type Source = {
  year: CcpcYear;
  url: string;
  filename: string;
  sha256: string;
  landing_url: string;
};

export type DownloadRecord = {
  year: CcpcYear;
  url: string;
  final_url: string | null;
  sha256: string;
  bytes: number;
  // A verified local ZIP does not prove when or where it was downloaded.
  downloaded_at: string | null;
  verified_at: string;
};

type DownloadManifest = { schema_version: 1; downloads: DownloadRecord[] };
type DownloadOptions = {
  sources: Source[];
  outputDir: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OFFICIAL_HOSTS = new Set(['ine.mx', 'www.ine.mx', 'portal.ine.mx']);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function assertOfficialUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !OFFICIAL_HOSTS.has(url.hostname)
      || url.username || url.password || url.port) {
    throw new Error(`La fuente debe usar HTTPS en un dominio oficial INE permitido: ${url.origin}`);
  }
  return url;
}

function isZipSignature(signature: Buffer): boolean {
  return signature.length === 4 && signature[0] === 0x50 && signature[1] === 0x4b
    && ((signature[2] === 3 && signature[3] === 4)
      || (signature[2] === 5 && signature[3] === 6)
      || (signature[2] === 7 && signature[3] === 8));
}

function makeVerifier() {
  const hash = createHash('sha256');
  let bytes = 0;
  let signature = Buffer.alloc(0);
  const stream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      hash.update(buffer);
      if (signature.length < 4) {
        signature = Buffer.concat([signature, buffer.subarray(0, 4 - signature.length)]);
        if (signature.length === 4 && !isZipSignature(signature)) {
          callback(new Error('La respuesta no tiene una firma ZIP válida; podría ser una página HTML.'));
          return;
        }
      }
      callback(null, buffer);
    },
    flush(callback) {
      callback(isZipSignature(signature) ? null : new Error('ZIP vacío o incompleto.'));
    },
  });
  return { stream, result: () => ({ sha256: hash.digest('hex'), bytes }) };
}

async function inspectLocalZip(path: string): Promise<{ sha256: string; bytes: number } | null> {
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error(`El destino no es un archivo: ${path}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const verifier = makeVerifier();
  await pipeline(createReadStream(path), verifier.stream, new Transform({
    transform(_chunk, _encoding, callback) { callback(); },
  }));
  return verifier.result();
}

async function fetchOfficial(url: string, fetchImpl: typeof fetch): Promise<{ response: Response; finalUrl: string }> {
  let current = assertOfficialUrl(url);
  for (let redirects = 0; redirects <= 10; redirects += 1) {
    const response = await fetchImpl(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30 * 60 * 1000),
      headers: { Accept: 'application/zip, application/octet-stream;q=0.9', 'User-Agent': 'CCPC-DATA01/1.0' },
    });
    // A stub may omit Response.url; native fetch supplies it.
    if (response.url) assertOfficialUrl(response.url);
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error(`Redirección sin Location en ${current.href}`);
      if (redirects === 10) throw new Error('Demasiadas redirecciones de la fuente INE.');
      current = assertOfficialUrl(new URL(location, current).href);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Descarga INE rechazada: HTTP ${response.status} para ${current.href}`);
    }
    if (!response.body) throw new Error(`La fuente INE no devolvió contenido: ${current.href}`);
    return { response, finalUrl: response.url || current.href };
  }
  throw new Error('No se pudo resolver la fuente INE.');
}

async function loadManifest(path: string): Promise<DownloadManifest> {
  try {
    return validateDownloadManifest(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { schema_version: 1, downloads: [] };
    throw error;
  }
}

async function saveManifest(path: string, manifest: DownloadManifest): Promise<void> {
  const temporary = `${path}.${randomUUID()}.part`;
  try {
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Downloads only catalogued official ZIPs; dependency injection keeps tests offline. */
export async function downloadData(options: DownloadOptions): Promise<DownloadRecord[]> {
  const { sources, outputDir, fetchImpl = fetch, now = () => new Date() } = options;
  const validatedSources = sources.map((source, index) => validateSource(source, `sources[${index}]`));
  const years = new Set<number>();
  const filenames = new Set<string>();
  const urls = new Set<string>();
  for (const source of validatedSources) {
    const filename = source.filename.toLowerCase();
    const url = assertOfficialUrl(source.url).href;
    if (years.has(source.year) || filenames.has(filename) || urls.has(url)) {
      throw new Error('Fuentes, URLs o nombres de ZIP duplicados.');
    }
    years.add(source.year);
    filenames.add(filename);
    urls.add(url);
  }
  await mkdir(outputDir, { recursive: true });
  const manifestPath = resolve(outputDir, 'downloads.json');
  const manifest = await loadManifest(manifestPath);
  const completed: DownloadRecord[] = [];

  for (const source of validatedSources) {
    const path = resolve(outputDir, source.filename);
    const expected = source.sha256.toLowerCase();
    const existing = await inspectLocalZip(path);
    const previous = manifest.downloads.find((item) => item.year === source.year
      && item.url === source.url && item.sha256.toLowerCase() === expected && item.bytes === existing?.bytes);
    let record: DownloadRecord;
    let created = false;
    if (existing) {
      if (existing.sha256 !== expected) {
        throw new Error(`El ZIP local ${source.year} tiene SHA-256 distinto. Se conserva; use otro --output o retire el archivo tras revisarlo.`);
      }
      record = {
        year: source.year, url: source.url, final_url: previous?.final_url ?? null,
        ...existing, downloaded_at: previous?.downloaded_at ?? null, verified_at: now().toISOString(),
      };
    } else {
      const temporary = `${path}.${randomUUID()}.part`;
      try {
        const { response, finalUrl } = await fetchOfficial(source.url, fetchImpl);
        const verifier = makeVerifier();
        await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
          verifier.stream, createWriteStream(temporary, { flags: 'wx' }));
        const verified = verifier.result();
        if (verified.sha256 !== expected) {
          throw new Error(`SHA-256 distinto para ${source.year}: esperado ${expected}, recibido ${verified.sha256}.`);
        }
        const timestamp = now().toISOString();
        record = {
          year: source.year, url: source.url, final_url: finalUrl,
          ...verified, downloaded_at: timestamp, verified_at: timestamp,
        };
        // Atomic creation without overwriting an existing ZIP, including concurrent runs.
        await link(temporary, path);
        created = true;
      } finally {
        await rm(temporary, { force: true });
      }
    }

    const updated: DownloadManifest = {
      schema_version: 1,
      downloads: [...manifest.downloads.filter((item) => item.year !== source.year), record]
        .sort((a, b) => a.year - b.year),
    };
    try {
      await saveManifest(manifestPath, updated);
    } catch (error) {
      if (created) await rm(path, { force: true });
      throw error;
    }
    manifest.downloads = updated.downloads;
    completed.push(record);
  }
  return completed;
}

export function parseArguments(args: string[]): { year: SelectedYear; outputDir: string; help: boolean } {
  let year: SelectedYear = 'all';
  let outputDir = resolve(REPO_ROOT, 'data/ccpc/raw');
  let help = false;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const normalizedFlag = flag === '-h' ? '--help' : flag;
    if (seen.has(normalizedFlag)) throw new Error(`Argumento duplicado: ${flag}`);
    seen.add(normalizedFlag);
    if (flag === '--help' || flag === '-h') help = true;
    else if (flag === '--year') {
      const value = args[++index];
      year = parseSelectedYear(value, '--year');
    } else if (flag === '--output') {
      const value = args[++index];
      if (!value || value.startsWith('--') || value === '-h') throw new Error('--output requiere una ruta.');
      outputDir = resolve(value);
    } else throw new Error(`Argumento desconocido: ${flag}`);
  }
  return { year, outputDir, help };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(`Uso: node scripts/ccpc/download-data.ts [--year ${CCPC_YEARS.join('|')}|all] [--output <directorio>]\n`
      + 'Descarga ZIPs oficiales del catálogo, verifica SHA-256 y guarda downloads.json.\n'
      + 'Valores por defecto: --year all; --output data/ccpc/raw (desde la raíz del módulo).');
    return;
  }
  const catalog = JSON.parse(await readFile(resolve(REPO_ROOT, 'data/ccpc/sources.json'), 'utf8'));
  const sources = validateCatalog(catalog, options.year);
  const results = await downloadData({ sources, outputDir: options.outputDir });
  for (const item of results) console.log(`${item.year}: ${item.bytes} bytes; SHA-256 ${item.sha256}; verificado ${item.verified_at}`);
  console.log(`Procedencia: ${resolve(options.outputDir, 'downloads.json')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
