import type { ExperienceStatus as WorkspaceStatus } from "../../workspace/state/experience-state-machine.ts";
import { paperCopy } from "../copy/paper-copy.ts";
import type { PaperGuidePresentation, PaperState } from "../types/paper-state.ts";

const workspaceToPaperState: Readonly<Record<WorkspaceStatus, PaperState>> = {
  empty: "idle",
  submitting: "understanding",
  retrieving_data: "consulting",
  generating_ui: "building",
  ready: "explaining",
  updating: "building",
  awaiting_confirmation: "suggesting",
  executing_action: "building",
  partial: "recovering",
  error: "recovering",
  cancelled: "recovering",
};

export function paperStateForWorkspaceStatus(status: WorkspaceStatus): PaperState {
  return workspaceToPaperState[status];
}

export function resolvePaperGuide(
  status: WorkspaceStatus,
  overrideState?: PaperState,
): PaperGuidePresentation {
  const state = overrideState ?? paperStateForWorkspaceStatus(status);
  return {
    state,
    ...paperCopy[state],
    announcement: state === "recovering" ? "assertive" : "polite",
  };
}
