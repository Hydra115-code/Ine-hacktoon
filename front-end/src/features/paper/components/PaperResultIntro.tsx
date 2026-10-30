"use client";

import type { PaperResultIntroData } from "../types/paper-result-intro";
import { PaperAvatar } from "./PaperAvatar";

interface PaperResultIntroProps {
  intro: PaperResultIntroData;
  announce?: boolean;
}

export function PaperResultIntro({ intro, announce = true }: PaperResultIntroProps) {
  return (
    <aside
      className="paper-result-intro"
      data-summary-kind={intro.summaryKind}
      aria-label="Introducción de Paper al resultado"
      aria-live={announce ? "polite" : undefined}
      aria-atomic={announce || undefined}
    >
      <div className="paper-result-intro__avatar" aria-hidden="true">
        <PaperAvatar mood="approving" size="sm" interactive={false} followPointer={false} />
      </div>
      <div className="paper-result-intro__copy">
        <span>{intro.summaryKind === "observation" ? "Lectura de los datos" : "Guía para leer la vista"}</span>
        <p className="paper-result-intro__summary">{intro.summary}</p>
        <p className="paper-result-intro__reason">{intro.presentationReason}</p>
        {intro.evidenceCount || intro.sourceLabel ? (
          <footer>
            {intro.evidenceCount ? <span>{intro.evidenceCount} {intro.evidenceCount === 1 ? "elemento verificable" : "elementos verificables"}</span> : null}
            {intro.sourceLabel ? <span>{intro.sourceLabel}</span> : null}
          </footer>
        ) : null}
      </div>
    </aside>
  );
}
