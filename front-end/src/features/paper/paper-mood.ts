/** Estados visuales de Paper para componer sus sprites 2D. */
export type PaperMood =
  | "idle"
  | "greeting"
  | "thinking"
  | "presenting"
  | "pointing"
  | "approving"
  | "surprised";

interface PaperMoodDefinition {
  /** Las reacciones breves vuelven a `idle`; los estados de trabajo persisten. */
  once: boolean;
  /** Descripción para lectores de pantalla. */
  description: string;
}

export const paperMoods: Record<PaperMood, PaperMoodDefinition> = {
  idle: { once: false, description: "atento" },
  greeting: { once: true, description: "saludando" },
  thinking: { once: false, description: "concentrado buscando datos" },
  presenting: { once: false, description: "presentando información" },
  pointing: { once: false, description: "señalando el resultado" },
  approving: { once: true, description: "aprobando" },
  surprised: { once: true, description: "sorprendido" },
};
