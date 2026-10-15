import { isCcpcYear } from './years.ts';
export const HEADER = ['AELEC', 'FELECCION', 'EDOCVE', 'EDONOM', 'MPIOCVE', 'MPIONOM', 'SECCION', 'TIPOSEC', 'DEF', 'DEL', 'SEXO', 'EDAD', 'LN', 'SV', 'NV', 'NS'];
export type Counts = { LN: number; SV: number; NV: number; NS: number };
export type Row = Counts & {
  entidad_clave: string; entidad: string; anio: number; sexo_codigo: number;
  sexo: string; grupo_edad: string; tipo_seccion: string;
};
export function integer(value: string, name: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`${name}: entero no negativo requerido (${value})`);
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`${name}: entero fuera del rango seguro`);
  return number;
}
export function ageGroup(age: number): string {
  if (!Number.isSafeInteger(age) || age < 18) throw new Error(`EDAD inválida: ${age}`);
  if (age < 20) return '18-19';
  if (age >= 100) return '100+';
  const start = Math.floor(age / 5) * 5;
  return `${start}-${start + 4}`;
}
export function counts(record: Record<string, string>): Counts {
  const result = Object.fromEntries(['LN', 'SV', 'NV', 'NS'].map(k => [k, integer(record[k], k)])) as Counts;
  const classified = result.SV + result.NV + result.NS;
  if (!Number.isSafeInteger(classified) || result.LN !== classified) throw new Error('LN no coincide con SV + NV + NS');
  return result;
}
export function addCounts(target: Counts, source: Counts): void {
  for (const field of ['LN', 'SV', 'NV', 'NS'] as const) {
    const sum = target[field] + source[field];
    if (!Number.isSafeInteger(sum)) throw new Error(`Suma ${field} fuera del rango seguro`);
    target[field] = sum;
  }
}
export const emptyCounts = (): Counts => ({ LN: 0, SV: 0, NV: 0, NS: 0 });
export function normalize(record: Record<string, string>, year: number): Row {
  if (!isCcpcYear(year)) throw new Error(`Año CCPC no documentado: ${year}`);
  if (integer(record.AELEC, 'AELEC') !== year) throw new Error(`AELEC distinto de ${year}`);
  const state = integer(record.EDOCVE, 'EDOCVE');
  if (state < 1 || state > 32 || !record.EDONOM.trim()) throw new Error('Entidad inválida');
  const sex = integer(record.SEXO, 'SEXO');
  const sexes: Record<number, string> = { 0: 'hombre', 1: 'mujer', 2: 'no_binario' };
  if (!(sex in sexes) || (year !== 2024 && sex === 2)) throw new Error(`SEXO no documentado para ${year}: ${sex}`);
  const types: Record<string, string> = { U: 'urbana', M: 'mixta', R: 'rural' };
  if (!Object.hasOwn(types, record.TIPOSEC)) throw new Error(`TIPOSEC no documentado: ${record.TIPOSEC}`);
  return {
    entidad_clave: String(state).padStart(2, '0'), entidad: record.EDONOM.trim(), anio: year,
    sexo_codigo: sex, sexo: sexes[sex], grupo_edad: ageGroup(integer(record.EDAD, 'EDAD')),
    tipo_seccion: types[record.TIPOSEC], ...counts(record)
  };
}
export function key(row: Row): string {
  return [row.anio, row.entidad_clave, row.sexo_codigo, row.grupo_edad, row.tipo_seccion].join('|');
}
export function metrics(count: Counts) {
  const denominator = count.SV + count.NV;
  return {
    participacion_pct: denominator === 0 ? null : 100 * count.SV / denominator,
    abstencion_pct: denominator === 0 ? null : 100 * count.NV / denominator,
    no_especificado_pct: count.LN === 0 ? null : 100 * count.NS / count.LN,
    denominador_participacion: denominator
  };
}
export function sortRows(rows: Row[]): Row[] {
  const types = ['urbana','mixta','rural'];
  return rows.sort((a, b) => a.anio - b.anio || Number(a.entidad_clave) - Number(b.entidad_clave) ||
    a.sexo_codigo - b.sexo_codigo || parseInt(a.grupo_edad) - parseInt(b.grupo_edad) || types.indexOf(a.tipo_seccion) - types.indexOf(b.tipo_seccion));
}
export function toCsv(rows: Row[]): string {
  const columns = ['entidad_clave','entidad','anio','sexo_codigo','sexo','grupo_edad','tipo_seccion','LN','SV','NV','NS','participacion_pct','abstencion_pct','no_especificado_pct','denominador_participacion'];
  const quote = (value: unknown) => {
    const text = value === null ? '' : typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(6) : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return columns.join(',') + '\n' + rows.map(row => {
    const value = { ...row, ...metrics(row) };
    return columns.map(column => quote(value[column as keyof typeof value])).join(',');
  }).join('\n') + '\n';
}
export function selectSample(rows: Row[]): Row[] {
  rows = sortRows([...rows]);
  const bands = new Set(['18-19', '20-24', '60-64', '100+']);
  const sample = new Map<string, Row>();
  const coverage = new Set<string>();
  for (const row of rows) {
    if (!bands.has(row.grupo_edad)) continue;
    const category = [row.anio, row.sexo_codigo, row.grupo_edad, row.tipo_seccion].join('|');
    if (!coverage.has(category)) { coverage.add(category); sample.set(key(row), row); }
  }
  for (const year of new Set(rows.map(row => row.anio))) {
    for (const predicate of [(row: Row) => row.NS > 0, (row: Row) => row.SV + row.NV === 0]) {
      const row = rows.find(row => row.anio === year && predicate(row));
      if (row) sample.set(key(row), row);
    }
  }
  return sortRows([...sample.values()]);
}
