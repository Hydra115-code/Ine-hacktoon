/**
 * Estados de ánimo de Paper. Cada uno se traduce a un clip del modelo
 * `public/models/paper-guide.glb` y, opcionalmente, a una expresión de gafas
 * (morph targets compartidos: Happy, Focus, Surprised, Wink_L, Wink_R).
 */
export type PaperMood =
  | "idle"
  | "greeting"
  | "thinking"
  | "presenting"
  | "pointing"
  | "approving"
  | "surprised";

export type PaperClipName =
  | "Guide_Idle"
  | "Guide_Wave"
  | "Guide_Present"
  | "Guide_Point"
  | "Guide_Approve"
  | "Guide_Surprised";

export type PaperExpression = "Happy" | "Focus" | "Surprised";

interface PaperMoodDefinition {
  clip: PaperClipName;
  /** Los clips de reacción se reproducen una vez y vuelven a `idle`. */
  once: boolean;
  /** Expresión extra que se suma encima del clip (p. ej. concentración). */
  expression?: PaperExpression;
  /** Descripción para lectores de pantalla. */
  description: string;
}

export const paperMoods: Record<PaperMood, PaperMoodDefinition> = {
  idle: { clip: "Guide_Idle", once: false, description: "atento" },
  greeting: { clip: "Guide_Wave", once: true, expression: "Happy", description: "saludando" },
  thinking: { clip: "Guide_Idle", once: false, expression: "Focus", description: "concentrado buscando datos" },
  presenting: { clip: "Guide_Present", once: false, description: "presentando información" },
  pointing: { clip: "Guide_Point", once: false, description: "señalando el resultado" },
  approving: { clip: "Guide_Approve", once: true, expression: "Happy", description: "aprobando" },
  surprised: { clip: "Guide_Surprised", once: true, expression: "Surprised", description: "sorprendido" },
};

export const PAPER_MODEL_URL = "/models/paper-guide.glb";
