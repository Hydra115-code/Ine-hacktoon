import type { PaperMood } from "../paper-mood.ts";

export const paperStates = [
  "idle",
  "understanding",
  "consulting",
  "building",
  "explaining",
  "suggesting",
  "recovering",
] as const;

export type PaperState = (typeof paperStates)[number];

export interface PaperGuideCopy {
  title: string;
  detail: string;
  tip?: string;
  mood: PaperMood;
}

export interface PaperGuidePresentation extends PaperGuideCopy {
  state: PaperState;
  announcement: "polite" | "assertive";
}
