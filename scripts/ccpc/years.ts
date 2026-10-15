export const CCPC_YEARS = [2009, 2012, 2015, 2018, 2021, 2024] as const;

export type CcpcYear = typeof CCPC_YEARS[number];
export type SelectedYear = 'all' | `${CcpcYear}`;

export function isCcpcYear(value: unknown): value is CcpcYear {
  return typeof value === 'number' && Number.isInteger(value)
    && (CCPC_YEARS as readonly number[]).includes(value);
}

export function parseSelectedYear(value: unknown, name = 'Año solicitado'): SelectedYear {
  if (value === 'all' || (typeof value === 'string' && CCPC_YEARS.some(year => String(year) === value))) {
    return value as SelectedYear;
  }
  throw new Error(`${name}: admite ${CCPC_YEARS.join(', ')} o all.`);
}
