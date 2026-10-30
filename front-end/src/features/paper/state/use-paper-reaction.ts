"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalUIEvent } from "../../generative-ui/interactions/events/local-ui-event";
import { buildPaperInteractionReaction } from "../interactions/build-paper-interaction-reaction";
import type { PaperInteractionReaction } from "../types/paper-interaction";

const REACTION_DURATION_MS = 4_600;

export function usePaperReaction() {
  const [reaction, setReaction] = useState<PaperInteractionReaction | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const dismissReaction = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setReaction(null);
  }, []);

  const showReaction = useCallback((next: PaperInteractionReaction | null) => {
    if (!next) return;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    setReaction(next);
    timeoutRef.current = window.setTimeout(() => {
      setReaction(null);
      timeoutRef.current = null;
    }, REACTION_DURATION_MS);
  }, []);

  const observeUIEvent = useCallback((event: LocalUIEvent) => {
    showReaction(buildPaperInteractionReaction(event));
  }, [showReaction]);

  useEffect(() => dismissReaction, [dismissReaction]);

  return { dismissReaction, observeUIEvent, reaction, showReaction };
}
