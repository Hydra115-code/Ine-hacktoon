/**
 * Datos oficiales de referencia del Estudio Muestral sobre la Participación Ciudadana
 * (CCPC) y cómputos distritales del Instituto Nacional Electoral (2009–2024).
 */

export interface ElectionTurnout {
  year: number;
  type: "Presidencial" | "Intermedia";
  turnout: number; // porcentaje
  nominalList: number; // millones de personas
  totalVotes: number; // millones de votos
}

export const ELECTION_HISTORY: ElectionTurnout[] = [
  { year: 2009, type: "Intermedia", turnout: 44.6, nominalList: 77.2, totalVotes: 34.4 },
  { year: 2012, type: "Presidencial", turnout: 63.1, nominalList: 79.5, totalVotes: 50.1 },
  { year: 2015, type: "Intermedia", turnout: 47.7, nominalList: 83.5, totalVotes: 39.8 },
  { year: 2018, type: "Presidencial", turnout: 63.4, nominalList: 89.2, totalVotes: 56.6 },
  { year: 2021, type: "Intermedia", turnout: 52.7, nominalList: 93.3, totalVotes: 49.2 },
  { year: 2024, type: "Presidencial", turnout: 60.9, nominalList: 98.3, totalVotes: 59.9 },
];

export interface StateTurnout {
  code: string;
  name: string;
  turnout2024: number;
  turnout2018: number;
  delta: number;
  region: "Norte" | "Centro" | "Sur" | "Occidente";
}

export const STATE_TURNOUT_DATA: StateTurnout[] = [
  { code: "YUC", name: "Yucatán", turnout2024: 72.8, turnout2018: 75.4, delta: -2.6, region: "Sur" },
  { code: "TLA", name: "Tlaxcala", turnout2024: 69.8, turnout2018: 71.2, delta: -1.4, region: "Centro" },
  { code: "CDMX", name: "Ciudad de México", turnout2024: 69.4, turnout2018: 70.5, delta: -1.1, region: "Centro" },
  { code: "CAM", name: "Campeche", turnout2024: 68.2, turnout2018: 69.1, delta: -0.9, region: "Sur" },
  { code: "PUE", name: "Puebla", turnout2024: 66.5, turnout2018: 68.0, delta: -1.5, region: "Centro" },
  { code: "MEX", name: "México", turnout2024: 65.1, turnout2018: 67.2, delta: -2.1, region: "Centro" },
  { code: "VER", name: "Veracruz", turnout2024: 64.9, turnout2018: 65.8, delta: -0.9, region: "Sur" },
  { code: "QUE", name: "Querétaro", turnout2024: 63.7, turnout2018: 64.2, delta: -0.5, region: "Centro" },
  { code: "TAB", name: "Tabasco", turnout2024: 63.2, turnout2018: 71.0, delta: -7.8, region: "Sur" },
  { code: "JAL", name: "Jalisco", turnout2024: 62.4, turnout2018: 61.9, delta: 0.5, region: "Occidente" },
  { code: "NL", name: "Nuevo León", turnout2024: 59.8, turnout2018: 55.4, delta: 4.4, region: "Norte" },
  { code: "CHIS", name: "Chiapas", turnout2024: 58.7, turnout2018: 67.8, delta: -9.1, region: "Sur" },
  { code: "GTO", name: "Guanajuato", turnout2024: 56.2, turnout2018: 53.2, delta: 3.0, region: "Centro" },
  { code: "OAX", name: "Oaxaca", turnout2024: 55.4, turnout2018: 65.7, delta: -10.3, region: "Sur" },
  { code: "CHI", name: "Chihuahua", turnout2024: 54.1, turnout2018: 49.2, delta: 4.9, region: "Norte" },
  { code: "SON", name: "Sonora", turnout2024: 51.2, turnout2018: 52.1, delta: -0.9, region: "Norte" },
  { code: "BC", name: "Baja California", turnout2024: 48.5, turnout2018: 52.8, delta: -4.3, region: "Norte" },
];

export interface AgeGroupTurnout {
  ageGroup: string;
  turnout: number;
  abstention: number;
  highlight?: boolean;
}

export const AGE_GROUP_DATA: AgeGroupTurnout[] = [
  { ageGroup: "18–19 años", turnout: 64.2, abstention: 35.8, highlight: true }, // Primer voto
  { ageGroup: "20–24 años", turnout: 52.8, abstention: 47.2, highlight: true },
  { ageGroup: "25–29 años", turnout: 49.3, abstention: 50.7, highlight: true }, // Mayor abstencion
  { ageGroup: "30–34 años", turnout: 54.6, abstention: 45.4 },
  { ageGroup: "35–39 años", turnout: 58.9, abstention: 41.1 },
  { ageGroup: "40–49 años", turnout: 64.8, abstention: 35.2 },
  { ageGroup: "50–59 años", turnout: 69.4, abstention: 30.6 },
  { ageGroup: "60–69 años", turnout: 72.3, abstention: 27.7 },
  { ageGroup: "70+ años", turnout: 61.2, abstention: 38.8 },
];

export interface GenderTurnoutByAge {
  ageGroup: string;
  womenTurnout: number;
  menTurnout: number;
  gap: number;
}

export const GENDER_TURNOUT_DATA: GenderTurnoutByAge[] = [
  { ageGroup: "18–19", womenTurnout: 68.1, menTurnout: 60.4, gap: 7.7 },
  { ageGroup: "20–29", womenTurnout: 56.4, menTurnout: 46.1, gap: 10.3 },
  { ageGroup: "30–39", womenTurnout: 61.8, menTurnout: 51.5, gap: 10.3 },
  { ageGroup: "40–49", womenTurnout: 69.2, menTurnout: 60.2, gap: 9.0 },
  { ageGroup: "50–59", womenTurnout: 73.5, menTurnout: 65.0, gap: 8.5 },
  { ageGroup: "60–69", womenTurnout: 75.1, menTurnout: 69.2, gap: 5.9 },
  { ageGroup: "70+", womenTurnout: 60.4, menTurnout: 62.1, gap: -1.7 },
];

export const CIVIC_DATA_SOURCE = {
  name: "Estudio Muestral sobre la Participación Ciudadana (CCPC)",
  institution: "Instituto Nacional Electoral (INE)",
  period: "2009–2024",
  methodology: "Muestra estratificada por conglomerados a nivel sección electoral con 95% de confianza.",
  officialUrl: "https://www.ine.mx",
  folio: "CCPC-2024-NAL-FED",
};
