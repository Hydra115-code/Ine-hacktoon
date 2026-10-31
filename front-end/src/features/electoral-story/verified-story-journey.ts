export interface VerifiedStoryChapter {
  id: "time" | "territory" | "evidence";
  eyebrow: string;
  title: string;
  description: string;
  prompt: string;
}

export const VERIFIED_STORY_MESSAGE =
  "La participación no es una sola cifra: cambia con el tiempo y entre territorios. Cada hallazgo debe poder comprobarse con datos oficiales del CCPC.";

export const VERIFIED_STORY_AUDIENCE =
  "Personas jóvenes y ciudadanía que desean entender la participación electoral sin conocimientos técnicos previos.";

export const VERIFIED_STORY_CHAPTERS = [
  {
    id: "time",
    eyebrow: "Capítulo 1 · El tiempo",
    title: "Descubre qué cambió",
    description: "Recorre las elecciones disponibles y distingue la tendencia observada de cualquier explicación posible.",
    prompt: "Cuenta una historia verificable sobre cómo cambió la participación ciudadana en Aguascalientes entre 2009 y 2024. Usa la visualización más clara, resalta el cambio observado más importante y deja visibles la tabla, la fuente, la metodología y sus limitaciones. No atribuyas causas que los datos no prueben.",
  },
  {
    id: "territory",
    eyebrow: "Capítulo 2 · El territorio",
    title: "Compara dónde cambia",
    description: "Explora diferencias entre entidades equivalentes dentro de la misma elección, sin convertirlas en un ranking de valor cívico.",
    prompt: "Muéstrame un mapa de la participación por entidad en 2024. Permite buscar y seleccionar estados, acompáñalo con una tabla verificable y conserva visibles la fuente, el universo y las advertencias metodológicas. Describe diferencias observadas sin juzgar a la ciudadanía ni inventar causas.",
  },
  {
    id: "evidence",
    eyebrow: "Capítulo 3 · La evidencia",
    title: "Comprueba lo que ves",
    description: "Contrasta una comparación concreta y revisa los registros, el universo y las precauciones necesarias para interpretarla.",
    prompt: "Compara la participación de Ciudad de México y Nuevo León en 2024. Explica el hallazgo en lenguaje ciudadano y deja visibles los valores utilizados, la fuente oficial, el universo, la metodología y las limitaciones de la comparación. No hagas afirmaciones causales.",
  },
] as const satisfies readonly VerifiedStoryChapter[];
