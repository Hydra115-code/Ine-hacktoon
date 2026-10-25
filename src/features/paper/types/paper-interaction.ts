import type { PaperMood } from "../paper-mood.js";

export type PaperInteractionKind =
  | "territory.selected"
  | "period.changed"
  | "chart.removed"
  | "table.filtered"
  | "table.sorted"
  | "methodology.opened"
  | "view.restored";

export interface PaperInteractionReaction {
  kind: PaperInteractionKind;
  message: string;
  mood: PaperMood;
}
