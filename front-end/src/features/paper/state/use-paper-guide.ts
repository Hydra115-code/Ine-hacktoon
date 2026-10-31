"use client";

import { useMemo } from "react";
import { useWorkspaceStore } from "../../workspace/state/workspace-store";
import { resolvePaperGuide } from "./paper-guide-state";
import type { PaperState } from "../types/paper-state";

interface UsePaperGuideOptions {
  overrideState?: PaperState;
}

export function usePaperGuide(options: UsePaperGuideOptions = {}) {
  const status = useWorkspaceStore((state) => state.experience.status);
  const { overrideState } = options;

  return useMemo(
    () => resolvePaperGuide(status, overrideState),
    [overrideState, status],
  );
}
