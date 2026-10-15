export type OnboardingProfileId =
  | "first-voter"
  | "youth-20s"
  | "adult-30s"
  | "researcher";

export interface OnboardingProfile {
  id: OnboardingProfileId;
  label: string;
  tagline: string;
  description: string;
  suggestedPrompt: string;
}

export const ONBOARDING_PROFILES: OnboardingProfile[] = [
  {
    id: "first-voter",
    label: "Voto por primera vez (18–24 años)",
    tagline: "Quiero saber cómo influye mi voto",
    description: "Conoce por qué las juventudes son el bloque demográfico con más poder decisivo y qué pasó en 2024.",
    suggestedPrompt: "¿Cómo participó el grupo de 18 a 24 años en las elecciones federales de 2024 comparado con 2018?",
  },
  {
    id: "youth-20s",
    label: "Joven ciudadano (25–29 años)",
    tagline: "El reto del abstencionismo",
    description: "Explora la brecha histórica de participación de este grupo de edad y cómo revertirla.",
    suggestedPrompt: "¿Cuál fue el porcentaje de abstención del grupo de 25 a 29 años entre 2009 y 2024?",
  },
  {
    id: "adult-30s",
    label: "Ciudadanía activa (30 a 40+ años)",
    tagline: "El pilar de la concurrencia",
    description: "Analiza el comportamiento cívico consolidado y la paridad de participación entre mujeres y hombres.",
    suggestedPrompt: "¿Cómo se compara la participación de mujeres y hombres de 30 a 49 años a nivel nacional?",
  },
  {
    id: "researcher",
    label: "Docente, periodista o investigador",
    tagline: "Metodología y datos CCPC",
    description: "Acceso a series temporales 2009–2024, filtros territoriales y fuentes oficiales para análisis riguroso.",
    suggestedPrompt: "Muestra la evolución de participación electoral 2009–2024 por entidad federativa con sus fuentes CCPC.",
  },
];

export const MEXICAN_STATES = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas",
  "Chihuahua", "Ciudad de México", "Coahuila", "Colima", "Durango", "Guanajuato",
  "Guerrero", "Hidalgo", "Jalisco", "México", "Michoacán", "Morelos", "Nayarit",
  "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí",
  "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"
];
