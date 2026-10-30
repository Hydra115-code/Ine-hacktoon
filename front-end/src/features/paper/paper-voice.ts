import type { WorkspaceStatus } from "../workspace/types/workspace-status";
import { workspaceStatuses } from "../workspace/types/workspace-status";
import { resolvePaperGuide } from "./state/paper-guide-state";
import type { PaperGuideCopy } from "./types/paper-state";

/** @deprecated Usa `resolvePaperGuide` o `usePaperGuide`. */
export type PaperVoiceMessage = PaperGuideCopy;

/** Compatibilidad temporal para consumidores anteriores a P1. */
function buildLegacyStatusVoices(): Record<WorkspaceStatus, PaperGuideCopy> {
  const voices = {} as Record<WorkspaceStatus, PaperGuideCopy>;
  for (const status of workspaceStatuses) voices[status] = resolvePaperGuide(status);
  return voices;
}

export const paperStatusVoices = buildLegacyStatusVoices();

export const paperQuickTips = [
  "¿Sabías que en 2024 la participación nacional superó el 60%?",
  "Los jóvenes de 20 a 29 años históricamente tienen mayor margen de abstención.",
  "Las mujeres mexicanas han mantenido una tasa de participación mayor a los hombres en las últimas 4 elecciones federales.",
  "En las elecciones intermedias suele haber una baja de participación respecto a las presidenciales.",
];
