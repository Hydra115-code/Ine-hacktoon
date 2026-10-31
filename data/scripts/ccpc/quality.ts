import { Transform } from 'node:stream';
import { HEADER } from './model.ts';

export type MissingColumn = {
  empty: number;
  whitespace_only: number;
  missing_token: number;
  total_missing: number;
};
export type MissingProfile = { rows: number; columns: Record<string, MissingColumn> };

const MISSING_TOKENS = new Set(['NULL', 'N/A', 'NA', 'NAN', 'NONE', 'S/D', '-']);

export function createMissingProfile(): MissingProfile {
  return {
    rows: 0,
    columns: Object.fromEntries(HEADER.map(column => [column, {
      empty: 0, whitespace_only: 0, missing_token: 0, total_missing: 0
    }]))
  };
}

export function observeMissing(profile: MissingProfile, record: Record<string, string>): void {
  profile.rows++;
  for (const column of HEADER) {
    const value = record[column] ?? '';
    const summary = profile.columns[column];
    if (value === '') summary.empty++;
    else if (value.trim() === '') summary.whitespace_only++;
    else if (MISSING_TOKENS.has(value.trim().toUpperCase())) summary.missing_token++;
    else continue;
    summary.total_missing++;
  }
}

export function mergeMissing(target: MissingProfile, source: MissingProfile): void {
  target.rows += source.rows;
  for (const column of HEADER) {
    const destination = target.columns[column];
    const incoming = source.columns[column];
    destination.empty += incoming.empty;
    destination.whitespace_only += incoming.whitespace_only;
    destination.missing_token += incoming.missing_token;
    destination.total_missing += incoming.total_missing;
  }
}

export type NameProfile = {
  rows: number;
  leading_trailing_whitespace: number;
  entity_names: Record<string, Record<string, number>>;
};
export type EntityNameComparison = {
  evaluated: boolean;
  compared_years: number[];
  changes: Array<{ entidad_clave: string; names_by_year: Record<string, string[]> }>;
  within_year_conflicts: Array<{ year: number; entidad_clave: string; names: string[] }>;
};

export function createNameProfile(): NameProfile {
  return { rows: 0, leading_trailing_whitespace: 0, entity_names: Object.create(null) };
}

export function observeEntityName(profile: NameProfile, clave: string, rawName: string): void {
  profile.rows++;
  if (rawName.trim() !== rawName) profile.leading_trailing_whitespace++;
  const names = profile.entity_names[clave] ??= Object.create(null);
  names[rawName] = (names[rawName] ?? 0) + 1;
}

const compareKeys = (a: string, b: string): number =>
  Number(a) - Number(b) || (a < b ? -1 : a > b ? 1 : 0);

export function compareEntityNames(profiles: Array<{ year: number; names: NameProfile }>): EntityNameComparison {
  const byYear = new Map<number, Map<string, Set<string>>>();
  const allKeys = new Set<string>();
  for (const { year, names } of profiles) {
    const yearNames = byYear.get(year) ?? new Map<string, Set<string>>();
    byYear.set(year, yearNames);
    for (const [clave, rawNames] of Object.entries(names.entity_names)) {
      allKeys.add(clave);
      const inventory = yearNames.get(clave) ?? new Set<string>();
      yearNames.set(clave, inventory);
      for (const rawName of Object.keys(rawNames)) inventory.add(rawName);
    }
  }
  const compared_years = [...byYear.keys()].sort((a, b) => a - b);
  const evaluated = compared_years.length >= 2;
  const orderedKeys = [...allKeys].sort(compareKeys);
  const within_year_conflicts: EntityNameComparison['within_year_conflicts'] = [];
  for (const year of compared_years) {
    for (const entidad_clave of orderedKeys) {
      const names = [...(byYear.get(year)?.get(entidad_clave) ?? [])].sort();
      if (names.length > 1) within_year_conflicts.push({ year, entidad_clave, names });
    }
  }
  const changes: EntityNameComparison['changes'] = [];
  if (evaluated) {
    for (const entidad_clave of orderedKeys) {
      const names_by_year: Record<string, string[]> = {};
      for (const year of compared_years) {
        names_by_year[String(year)] = [...(byYear.get(year)?.get(entidad_clave) ?? [])].sort();
      }
      const inventories = Object.values(names_by_year).map(names => JSON.stringify(names));
      if (inventories.some(inventory => inventory !== inventories[0])) changes.push({ entidad_clave, names_by_year });
    }
  }
  return { evaluated, compared_years, changes, within_year_conflicts };
}

export type EncodingSummary = {
  encoding: 'UTF-8';
  valid_utf8: true;
  bom: boolean;
  bytes: number;
  line_endings: { lf: number; crlf: number; cr: number };
};

export function createEncodingProbe(): { stream: Transform; result: () => EncodingSummary } {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const prefix: number[] = [];
  const lineEndings = { lf: 0, crlf: 0, cr: 0 };
  let bytes = 0;
  let pendingCR = false;
  let complete = false;
  const stream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try {
        decoder.decode(chunk, { stream: true });
        bytes += chunk.length;
        for (const byte of chunk) {
          if (prefix.length < 3) prefix.push(byte);
          if (pendingCR) {
            pendingCR = false;
            if (byte === 10) { lineEndings.crlf++; continue; }
            lineEndings.cr++;
          }
          if (byte === 13) pendingCR = true;
          else if (byte === 10) lineEndings.lf++;
        }
        callback(null, chunk);
      } catch (error) {
        callback(new Error('CSV con bytes UTF-8 inválidos', { cause: error }));
      }
    },
    flush(callback) {
      try {
        decoder.decode();
        if (pendingCR) { lineEndings.cr++; pendingCR = false; }
        complete = true;
        callback();
      } catch (error) {
        callback(new Error('CSV con secuencia UTF-8 incompleta al final', { cause: error }));
      }
    }
  });
  return {
    stream,
    result() {
      if (!complete) throw new Error('La verificación UTF-8 requiere finalizar correctamente el flujo');
      return {
        encoding: 'UTF-8', valid_utf8: true,
        bom: prefix.length === 3 && prefix[0] === 0xef && prefix[1] === 0xbb && prefix[2] === 0xbf,
        bytes, line_endings: { ...lineEndings }
      };
    }
  };
}
