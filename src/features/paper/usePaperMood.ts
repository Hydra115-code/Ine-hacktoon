"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "../workspace/state/workspace-store";
import { resolvePaperGuide } from "./state/paper-guide-state";
import type { PaperMood } from "./paper-mood";

interface UsePaperMoodOptions {
  overrideMood?: PaperMood;
}

export function usePaperMood(options: UsePaperMoodOptions = {}) {
  const status = useWorkspaceStore((state) => state.experience.status);
  const [temporaryMood, setTemporaryMood] = useState<PaperMood | null>(null);

  // When status changes, clear any temporary mood
  useEffect(() => {
    setTemporaryMood(null);
  }, [status]);

  const defaultVoice = resolvePaperGuide(status);
  const activeMood: PaperMood = options.overrideMood ?? temporaryMood ?? defaultVoice.mood;

  const triggerMood = (mood: PaperMood, durationMs = 2400) => {
    setTemporaryMood(mood);
    if (durationMs > 0) {
      const timer = setTimeout(() => {
        setTemporaryMood((current) => (current === mood ? null : current));
      }, durationMs);
      return () => clearTimeout(timer);
    }
  };

  return {
    mood: activeMood,
    triggerMood,
    statusVoice: defaultVoice,
    status,
  };
}
