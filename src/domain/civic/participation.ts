/** Dominio CCPC: conteos enteros, tasas y unidades explícitas. Sin I/O. */
export const ALLOWED_YEARS = [2009, 2012, 2015, 2018, 2021, 2024] as const;
export const SEXES = ['hombre', 'mujer', 'no_binario'] as const;
export const SECTION_TYPES = ['urbana', 'mixta', 'rural'] as const;
export const AGE_GROUPS = [
  '18-19', '20-24', '25-29', '30-34', '35-39', '40-44',
  '45-49', '50-54', '55-59', '60-64', '65-69', '70-74',
  '75-79', '80-84', '85-89', '90-94', '95-99', '100+',
] as const;

export type Counts = {
  nominalList: number;
  voted: number;
  didNotVote: number;
  unspecified: number;
};

export type ParticipationDimensions = {
  entityCode: string;
  year: typeof ALLOWED_YEARS[number];
  sex: typeof SEXES[number];
  ageGroup: string;
  sectionType: typeof SECTION_TYPES[number];
};

export type ParticipationMetrics = {
  classified: number;
  participationRate: number | null;
  abstentionRate: number | null;
  unspecifiedRate: number | null;
  participationPct: number | null;
  abstentionPct: number | null;
  unspecifiedPct: number | null;
  ccpcParticipationPct: number | null;
  ccpcAbstentionPct: number | null;
};

export type ParticipationRecord = Counts & ParticipationDimensions & ParticipationMetrics & {
  entityName: string;
  sourceId: string;
  sourceRows: number;
};

export type ParticipationSource = {
  id: string;
  entityCode: string;
  year: typeof ALLOWED_YEARS[number];
  url: string;
  archiveSha256: string;
  member: string;
  memberSha256: string;
  dictionarySha256: string;
  downloadedAt: string | null;
  rawRows: number;
  totals: Counts;
};

export const METRIC_DEFINITIONS = {
  rateUnit: 'ratio',
  percentageUnit: 'percent',
  comparisonUnit: 'percentage_point',
  nominalDenominator: 'nominalList',
  ccpcDenominator: 'voted+didNotVote',
} as const;

export type ParticipationDataset = {
  schemaVersion: 'ccpc-participation/v1';
  scope: 'entity';
  kind: 'full' | 'sample';
  years: Array<typeof ALLOWED_YEARS[number]>;
  metricDefinitions: typeof METRIC_DEFINITIONS;
  sources: ParticipationSource[];
  records: ParticipationRecord[];
};

/** Código estable para que las CLI y consumidores detecten cada fallo. */
export class CivicParticipationError extends Error {
  readonly code: string;
  readonly path: string | undefined;

  constructor(code: string, message: string, path?: string) {
    super(`[${code}]${path ? ` ${path}:` : ''} ${message}`);
    this.name = 'CivicParticipationError';
    this.code = code;
    this.path = path;
  }
}

const COUNT_FIELDS = ['nominalList', 'voted', 'didNotVote', 'unspecified'] as const;

/** LN = SV + NV + NS; ninguna operación puede salir del rango entero seguro. */
export function validateCounts(counts: Counts): void {
  for (const field of COUNT_FIELDS) {
    const value = counts[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new CivicParticipationError('INVALID_COUNT', 'Se requiere un número finito.', field);
    }
    if (!Number.isInteger(value)) {
      throw new CivicParticipationError('NON_INTEGER_COUNT', 'Se requiere un entero.', field);
    }
    if (!Number.isSafeInteger(value)) {
      throw new CivicParticipationError('UNSAFE_COUNT', 'El entero excede el rango seguro.', field);
    }
    if (value < 0) {
      throw new CivicParticipationError('NEGATIVE_COUNT', 'El conteo no puede ser negativo.', field);
    }
  }

  for (const field of ['voted', 'didNotVote', 'unspecified'] as const) {
    if (counts[field] > counts.nominalList) {
      throw new CivicParticipationError('NUMERATOR_EXCEEDS_UNIVERSE', 'El conteo supera la lista nominal.', field);
    }
  }

  const classified = counts.voted + counts.didNotVote;
  const total = classified + counts.unspecified;
  if (!Number.isSafeInteger(classified) || !Number.isSafeInteger(total)) {
    throw new CivicParticipationError('COUNT_OVERFLOW', 'La suma de conteos excede el rango entero seguro.');
  }
  if (total !== counts.nominalList) {
    throw new CivicParticipationError('COUNT_PARTITION_MISMATCH', 'nominalList debe coincidir con voted + didNotVote + unspecified.');
  }
}

/**
 * Las tasas nominales usan LN. El indicador CCPC usa sólo SV + NV.
 * Un denominador cero representa una métrica no definida y produce null.
 * Se conservan todos los decimales de JavaScript, sin redondeo editorial.
 */
export function calculateMetrics(counts: Counts): ParticipationMetrics {
  validateCounts(counts);
  const classified = counts.voted + counts.didNotVote;
  const participationRate = counts.nominalList === 0 ? null : counts.voted / counts.nominalList;
  const abstentionRate = counts.nominalList === 0 ? null : counts.didNotVote / counts.nominalList;
  const unspecifiedRate = counts.nominalList === 0 ? null : counts.unspecified / counts.nominalList;
  return {
    classified,
    participationRate,
    abstentionRate,
    unspecifiedRate,
    participationPct: participationRate === null ? null : participationRate * 100,
    abstentionPct: abstentionRate === null ? null : abstentionRate * 100,
    unspecifiedPct: unspecifiedRate === null ? null : unspecifiedRate * 100,
    ccpcParticipationPct: classified === 0 ? null : (counts.voted / classified) * 100,
    ccpcAbstentionPct: classified === 0 ? null : (counts.didNotVote / classified) * 100,
  };
}

/** Conserva todas las edades de 100 o más en la categoría oficial abierta. */
export function ageGroup(age: number): typeof AGE_GROUPS[number] {
  if (!Number.isSafeInteger(age) || age < 18) {
    throw new CivicParticipationError('INVALID_AGE', 'EDAD debe ser un entero seguro de 18 o más.', 'EDAD');
  }
  if (age < 20) return '18-19';
  if (age >= 100) return '100+';
  const start = Math.floor(age / 5) * 5;
  return `${start}-${start + 4}` as typeof AGE_GROUPS[number];
}

/** La clave contiene sólo dimensiones, nunca valores o procedencia. */
export function participationKey(record: ParticipationDimensions): string {
  return [record.year, record.entityCode, record.sex, record.ageGroup, record.sectionType].join('|');
}

/** Orden total fijo; no depende de idioma, región ni implementación de Intl. */
export function compareParticipationRecords(a: ParticipationDimensions, b: ParticipationDimensions): number {
  return a.year - b.year || Number(a.entityCode) - Number(b.entityCode) ||
    SEXES.indexOf(a.sex) - SEXES.indexOf(b.sex) ||
    Number.parseInt(a.ageGroup, 10) - Number.parseInt(b.ageGroup, 10) ||
    SECTION_TYPES.indexOf(a.sectionType) - SECTION_TYPES.indexOf(b.sectionType);
}

function validatePercentage(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new CivicParticipationError('INVALID_PERCENTAGE', 'Se requiere un porcentaje finito entre 0 y 100.', name);
  }
}

/** 60 % frente a 50 % es una diferencia de 10 puntos porcentuales. */
export function percentagePointDifference(current: number, baseline: number): number {
  validatePercentage(current, 'current');
  validatePercentage(baseline, 'baseline');
  return current - baseline;
}

/** 60 % frente a 50 % es un cambio relativo del 20 %, no 20 puntos. */
export function relativePercentageChange(current: number, baseline: number): number | null {
  validatePercentage(current, 'current');
  validatePercentage(baseline, 'baseline');
  return baseline === 0 ? null : ((current - baseline) / baseline) * 100;
}

const ENTITY_NAMES: Record<number,Record<string,string>> = {
  "2009": {
    "10": "DURANGO",
    "11": "GUANAJUATO",
    "12": "GUERRERO",
    "13": "HIDALGO",
    "14": "JALISCO",
    "15": "MEXICO",
    "16": "MICHOACAN",
    "17": "MORELOS",
    "18": "NAYARIT",
    "19": "NUEVO LEON",
    "20": "OAXACA",
    "21": "PUEBLA",
    "22": "QUERETARO",
    "23": "QUINTANA ROO",
    "24": "SAN LUIS POTOSI",
    "25": "SINALOA",
    "26": "SONORA",
    "27": "TABASCO",
    "28": "TAMAULIPAS",
    "29": "TLAXCALA",
    "30": "VERACRUZ",
    "31": "YUCATAN",
    "32": "ZACATECAS",
    "01": "AGUASCALIENTES",
    "02": "BAJA CALIFORNIA",
    "03": "BAJA CALIFORNIA SUR",
    "04": "CAMPECHE",
    "09": "DISTRITO FEDERAL",
    "08": "CHIHUAHUA",
    "07": "CHIAPAS",
    "05": "COAHUILA",
    "06": "COLIMA"
  },
  "2012": {
    "10": "DURANGO",
    "11": "GUANAJUATO",
    "12": "GUERRERO",
    "13": "HIDALGO",
    "14": "JALISCO",
    "15": "MEXICO",
    "16": "MICHOACAN",
    "17": "MORELOS",
    "18": "NAYARIT",
    "19": "NUEVO LEON",
    "20": "OAXACA",
    "21": "PUEBLA",
    "22": "QUERETARO",
    "23": "QUINTANA ROO",
    "24": "SAN LUIS POTOSI",
    "25": "SINALOA",
    "26": "SONORA",
    "27": "TABASCO",
    "28": "TAMAULIPAS",
    "29": "TLAXCALA",
    "30": "VERACRUZ",
    "31": "YUCATAN",
    "32": "ZACATECAS",
    "01": "AGUASCALIENTES",
    "02": "BAJA CALIFORNIA",
    "03": "BAJA CALIFORNIA SUR",
    "04": "CAMPECHE",
    "09": "DISTRITO FEDERAL",
    "08": "CHIHUAHUA",
    "07": "CHIAPAS",
    "05": "COAHUILA",
    "06": "COLIMA"
  },
  "2015": {
    "10": "DURANGO",
    "11": "GUANAJUATO",
    "12": "GUERRERO",
    "13": "HIDALGO",
    "14": "JALISCO",
    "15": "MEXICO",
    "16": "MICHOACAN",
    "17": "MORELOS",
    "18": "NAYARIT",
    "19": "NUEVO LEON",
    "20": "OAXACA",
    "21": "PUEBLA",
    "22": "QUERETARO",
    "23": "QUINTANA ROO",
    "24": "SAN LUIS POTOSI",
    "25": "SINALOA",
    "26": "SONORA",
    "27": "TABASCO",
    "28": "TAMAULIPAS",
    "29": "TLAXCALA",
    "30": "VERACRUZ",
    "31": "YUCATAN",
    "32": "ZACATECAS",
    "01": "AGUASCALIENTES",
    "02": "BAJA CALIFORNIA",
    "03": "BAJA CALIFORNIA SUR",
    "04": "CAMPECHE",
    "09": "DISTRITO FEDERAL",
    "08": "CHIHUAHUA",
    "07": "CHIAPAS",
    "05": "COAHUILA",
    "06": "COLIMA"
  },
  "2018": {
    "10": "DURANGO",
    "11": "GUANAJUATO",
    "12": "GUERRERO",
    "13": "HIDALGO",
    "14": "JALISCO",
    "15": "MEXICO",
    "16": "MICHOACAN",
    "17": "MORELOS",
    "18": "NAYARIT",
    "19": "NUEVO LEON",
    "20": "OAXACA",
    "21": "PUEBLA",
    "22": "QUERETARO",
    "23": "QUINTANA ROO",
    "24": "SAN LUIS POTOSI",
    "25": "SINALOA",
    "26": "SONORA",
    "27": "TABASCO",
    "28": "TAMAULIPAS",
    "29": "TLAXCALA",
    "30": "VERACRUZ",
    "31": "YUCATAN",
    "32": "ZACATECAS",
    "01": "AGUASCALIENTES",
    "02": "BAJA CALIFORNIA",
    "03": "BAJA CALIFORNIA SUR",
    "04": "CAMPECHE",
    "09": "DISTRITO FEDERAL",
    "08": "CHIHUAHUA",
    "07": "CHIAPAS",
    "05": "COAHUILA",
    "06": "COLIMA"
  },
  "2021": {
    "10": "DURANGO",
    "11": "GUANAJUATO",
    "12": "GUERRERO",
    "13": "HIDALGO",
    "14": "JALISCO",
    "15": "MEXICO",
    "16": "MICHOACAN",
    "17": "MORELOS",
    "18": "NAYARIT",
    "19": "NUEVO LEON",
    "20": "OAXACA",
    "21": "PUEBLA",
    "22": "QUERETARO",
    "23": "QUINTANA ROO",
    "24": "SAN LUIS POTOSI",
    "25": "SINALOA",
    "26": "SONORA",
    "27": "TABASCO",
    "28": "TAMAULIPAS",
    "29": "TLAXCALA",
    "30": "VERACRUZ",
    "31": "YUCATAN",
    "32": "ZACATECAS",
    "01": "AGUASCALIENTES",
    "02": "BAJA CALIFORNIA",
    "03": "BAJA CALIFORNIA SUR",
    "04": "CAMPECHE",
    "09": "CIUDAD DE MEXICO",
    "08": "CHIHUAHUA",
    "07": "CHIAPAS",
    "05": "COAHUILA",
    "06": "COLIMA"
  },
  "2024": {
    "10": "DURANGO",
    "11": "GUANAJUATO",
    "12": "GUERRERO",
    "13": "HIDALGO",
    "14": "JALISCO",
    "15": "MEXICO",
    "16": "MICHOACAN",
    "17": "MORELOS",
    "18": "NAYARIT",
    "19": "NUEVO LEON",
    "20": "OAXACA",
    "21": "PUEBLA",
    "22": "QUERETARO",
    "23": "QUINTANA ROO",
    "24": "SAN LUIS POTOSI",
    "25": "SINALOA",
    "26": "SONORA",
    "27": "TABASCO",
    "28": "TAMAULIPAS",
    "29": "TLAXCALA",
    "30": "VERACRUZ",
    "31": "YUCATAN",
    "32": "ZACATECAS",
    "01": "AGUASCALIENTES",
    "02": "BAJA CALIFORNIA",
    "03": "BAJA CALIFORNIA SUR",
    "04": "CAMPECHE",
    "09": "CIUDAD DE MEXICO",
    "08": "CHIHUAHUA",
    "07": "CHIAPAS",
    "05": "COAHUILA",
    "06": "COLIMA"
  }
};

const SOURCE_MEMBERS: Record<number,Record<string,string>> = {
  "2009": {
    "01": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_ags.csv",
    "02": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_bc.csv",
    "03": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_bcs.csv",
    "04": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_camp.csv",
    "05": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_coah.csv",
    "06": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_col.csv",
    "07": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_chis.csv",
    "08": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_chih.csv",
    "09": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_cdmx.csv",
    "10": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_dgo.csv",
    "11": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_gto.csv",
    "12": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_gro.csv",
    "13": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_hgo.csv",
    "14": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_jal.csv",
    "15": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_mex.csv",
    "16": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_mich.csv",
    "17": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_mor.csv",
    "18": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_nay.csv",
    "19": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_nl.csv",
    "20": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_oax.csv",
    "21": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_pue.csv",
    "22": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_qro.csv",
    "23": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_qroo.csv",
    "24": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_slp.csv",
    "25": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_sin.csv",
    "26": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_son.csv",
    "27": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_tab.csv",
    "28": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_tamps.csv",
    "29": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_tlax.csv",
    "30": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_ver.csv",
    "31": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_yuc.csv",
    "32": "DatosAbiertos_DECEyEC_ConteosCensales2009/datosabiertos_deceyec_conteoscensales2009_zac.csv"
  },
  "2012": {
    "01": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_ags.csv",
    "02": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_bc.csv",
    "03": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_bcs.csv",
    "04": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_camp.csv",
    "05": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_coah.csv",
    "06": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_col.csv",
    "07": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_chis.csv",
    "08": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_chih.csv",
    "09": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_cdmx.csv",
    "10": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_dgo.csv",
    "11": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_gto.csv",
    "12": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_gro.csv",
    "13": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_hgo.csv",
    "14": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_jal.csv",
    "15": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_mex.csv",
    "16": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_mich.csv",
    "17": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_mor.csv",
    "18": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_nay.csv",
    "19": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_nl.csv",
    "20": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_oax.csv",
    "21": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_pue.csv",
    "22": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_qro.csv",
    "23": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_qroo.csv",
    "24": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_slp.csv",
    "25": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_sin.csv",
    "26": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_son.csv",
    "27": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_tab.csv",
    "28": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_tamps.csv",
    "29": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_tlax.csv",
    "30": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_ver.csv",
    "31": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_yuc.csv",
    "32": "DatosAbiertos_DECEyEC_ConteosCensales2012/datosabiertos_deceyec_conteoscensales2012_zac.csv"
  },
  "2015": {
    "01": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_ags.csv",
    "02": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_bc.csv",
    "03": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_bcs.csv",
    "04": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_camp.csv",
    "05": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_coah.csv",
    "06": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_col.csv",
    "07": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_chis.csv",
    "08": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_chih.csv",
    "09": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_cdmx.csv",
    "10": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_dgo.csv",
    "11": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_gto.csv",
    "12": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_gro.csv",
    "13": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_hgo.csv",
    "14": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_jal.csv",
    "15": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_mex.csv",
    "16": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_mich.csv",
    "17": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_mor.csv",
    "18": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_nay.csv",
    "19": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_nl.csv",
    "20": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_oax.csv",
    "21": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_pue.csv",
    "22": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_qro.csv",
    "23": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_qroo.csv",
    "24": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_slp.csv",
    "25": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_sin.csv",
    "26": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_son.csv",
    "27": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_tab.csv",
    "28": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_tamps.csv",
    "29": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_tlax.csv",
    "30": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_ver.csv",
    "31": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_yuc.csv",
    "32": "DatosAbiertos_DECEyEC_ConteosCensales2015/datosabiertos_deceyec_conteoscensales2015_zac.csv"
  },
  "2018": {
    "01": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_ags.csv",
    "02": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_bc.csv",
    "03": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_bcs.csv",
    "04": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_camp.csv",
    "05": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_coah.csv",
    "06": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_col.csv",
    "07": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_chis.csv",
    "08": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_chih.csv",
    "09": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_cdmx.csv",
    "10": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_dgo.csv",
    "11": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_gto.csv",
    "12": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_gro.csv",
    "13": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_hgo.csv",
    "14": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_jal.csv",
    "15": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_mex.csv",
    "16": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_mich.csv",
    "17": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_mor.csv",
    "18": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_nay.csv",
    "19": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_nl.csv",
    "20": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_oax.csv",
    "21": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_pue.csv",
    "22": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_qro.csv",
    "23": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_qroo.csv",
    "24": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_slp.csv",
    "25": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_sin.csv",
    "26": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_son.csv",
    "27": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_tab.csv",
    "28": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_tamps.csv",
    "29": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_tlax.csv",
    "30": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_ver.csv",
    "31": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_yuc.csv",
    "32": "DatosAbiertos_DECEyEC_ConteosCensales2018/datosabiertos_deceyec_conteoscensales2018_zac.csv"
  },
  "2021": {
    "01": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_ags.csv",
    "02": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_bc.csv",
    "03": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_bcs.csv",
    "04": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_camp.csv",
    "05": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_coah.csv",
    "06": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_col.csv",
    "07": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_chis.csv",
    "08": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_chih.csv",
    "09": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_cdmx.csv",
    "10": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_dgo.csv",
    "11": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_gto.csv",
    "12": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_gro.csv",
    "13": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_hgo.csv",
    "14": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_jal.csv",
    "15": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_mex.csv",
    "16": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_mich.csv",
    "17": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_mor.csv",
    "18": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_nay.csv",
    "19": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_nl.csv",
    "20": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_oax.csv",
    "21": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_pue.csv",
    "22": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_qro.csv",
    "23": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_qroo.csv",
    "24": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_slp.csv",
    "25": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_sin.csv",
    "26": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_son.csv",
    "27": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_tab.csv",
    "28": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_tamps.csv",
    "29": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_tlax.csv",
    "30": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_ver.csv",
    "31": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_yuc.csv",
    "32": "DatosAbiertos_DECEyEC_ConteosCensales2021/datosabiertos_deceyec_conteoscensales2021_zac.csv"
  },
  "2024": {
    "01": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_ags.csv",
    "02": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_bc.csv",
    "03": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_bcs.csv",
    "04": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_camp.csv",
    "05": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_coah.csv",
    "06": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_col.csv",
    "07": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_chis.csv",
    "08": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_chih.csv",
    "09": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_cdmx.csv",
    "10": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_dgo.csv",
    "11": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_gto.csv",
    "12": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_gro.csv",
    "13": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_hgo.csv",
    "14": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_jal.csv",
    "15": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_mex.csv",
    "16": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_mich.csv",
    "17": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_mor.csv",
    "18": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_nay.csv",
    "19": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_nl.csv",
    "20": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_oax.csv",
    "21": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_pue.csv",
    "22": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_qro.csv",
    "23": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_qroo.csv",
    "24": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_slp.csv",
    "25": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_sin.csv",
    "26": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_son.csv",
    "27": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_tab.csv",
    "28": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_tam.csv",
    "29": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_tlax.csv",
    "30": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_ver.csv",
    "31": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_yuc.csv",
    "32": "DatosAbiertos_DECEyEC_ConteosCensales2024/datosabiertos_deceyec_conteoscensales2024_zac.csv"
  }
};

export function entityNameForYear(year: number, entityCode: string): string {
  const name = ENTITY_NAMES[year]?.[entityCode];
  if (!name) throw new CivicParticipationError('INVALID_ENTITY','No existe la clave/año de entidad en los cortes documentados.');
  return name;
}
export function officialSourceUrl(year: number): string {
  if (!(ALLOWED_YEARS as readonly number[]).includes(year)) throw new CivicParticipationError('INVALID_YEAR','Año de fuente no permitido.');
  return `https://ine.mx/wp-content/uploads/${year === 2024 ? '2025/08' : '2022/04'}/DatosAbiertos_DECEyEC_ConteosCensales${year}.zip`;
}
export function officialSourceMember(year: number, entityCode: string): string {
  const member = SOURCE_MEMBERS[year]?.[entityCode];
  if (!member) throw new CivicParticipationError('INVALID_SOURCE_MEMBER','Miembro de origen no documentado para año y entidad.');
  return member;
}
export function sourceIdForEntity(year: number, entityCode: string): string {
  entityNameForYear(year,entityCode);
  return `${year}:${entityCode}`;
}
