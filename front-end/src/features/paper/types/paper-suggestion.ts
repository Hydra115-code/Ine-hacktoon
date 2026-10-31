export type PaperSuggestionFocus = "territory" | "period" | "evidence" | "presentation" | "population";

export interface PaperSuggestion {
  id: string;
  label: string;
  title: string;
  description: string;
  prompt: string;
  focus: PaperSuggestionFocus;
}
