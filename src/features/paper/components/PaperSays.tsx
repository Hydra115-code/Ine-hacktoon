"use client";

import type { ReactNode } from "react";
import type { PaperMood } from "../paper-mood";

interface PaperSaysProps {
  title?: string;
  children: ReactNode;
  tip?: string;
  badge?: string;
  mood?: PaperMood;
  className?: string;
}

export function PaperSays({
  title,
  children,
  tip,
  badge = "Guía ciudadano",
  className = "",
}: PaperSaysProps) {
  return (
    <div className={`paper-says ${className}`} role="region" aria-label="Mensaje de Paper">
      <header className="paper-says__header">
        <span className="paper-says__author">
          Paper
        </span>
        {badge ? <span className="paper-says__badge">{badge}</span> : null}
      </header>

      {title ? <h3 className="paper-says__title">{title}</h3> : null}

      <div className="paper-says__text">{children}</div>

      {tip ? (
        <div className="paper-says__tip" role="note">
          <strong aria-hidden="true">Tip:</strong>
          <span>{tip}</span>
        </div>
      ) : null}
    </div>
  );
}
