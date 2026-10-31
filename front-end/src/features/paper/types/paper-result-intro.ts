export interface PaperResultIntroData {
  /** Una sola frase respaldada por la copia validada o una orientación neutral. */
  summary: string;
  /** Explica la composición real elegida por la interfaz, sin atribuir causalidad. */
  presentationReason: string;
  summaryKind: "observation" | "orientation";
  evidenceCount?: number;
  sourceLabel?: string;
}
