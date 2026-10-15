"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

interface PaperDialogueProps {
  message: string;
  label?: string;
  className?: string;
  onSpeakingChange?: (speaking: boolean) => void;
}

export function PaperDialogue({
  message,
  label = "Paper dice",
  className = "",
  onSpeakingChange,
}: PaperDialogueProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const words = useMemo(() => message.split(/\s+/), [message]);
  const [phase, setPhase] = useState<"thinking" | "typing" | "done">("done");
  const [visibleWordCount, setVisibleWordCount] = useState(words.length);
  const visibleMessage = words.slice(0, visibleWordCount).join(" ");

  useEffect(() => {
    if (reducedMotion) {
      setPhase("done");
      setVisibleWordCount(words.length);
      return;
    }

    setPhase("thinking");
    setVisibleWordCount(0);
    let interval = 0;
    const start = window.setTimeout(() => {
      setPhase("typing");
      let count = 0;
      interval = window.setInterval(() => {
        count += 1;
        setVisibleWordCount(count);
        if (count >= words.length) {
          window.clearInterval(interval);
          setPhase("done");
        }
      }, 62);
    }, 340);

    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [reducedMotion, words]);

  useEffect(() => {
    onSpeakingChange?.(phase !== "done");
  }, [onSpeakingChange, phase]);

  return (
    <div className={`paper-dialogue ${className}`} data-phase={phase} role="status" aria-live="polite">
      <small className="paper-dialogue__label">{label}</small>
      {phase === "thinking" ? (
        <span className="paper-dialogue__typing" aria-label="Paper está escribiendo">
          <i /><i /><i />
        </span>
      ) : (
        <p className="paper-dialogue__message" aria-label={message}>
          <span aria-hidden="true">{visibleMessage}</span>
          {phase === "typing" && <i className="paper-dialogue__caret" aria-hidden="true" />}
        </p>
      )}
    </div>
  );
}
