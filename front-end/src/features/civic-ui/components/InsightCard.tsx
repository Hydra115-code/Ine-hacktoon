"use client";

import { PaperAvatar } from "../../paper/components/PaperAvatar";

interface InsightCardProps {
  title: string;
  explanation: string;
  highlightStat?: string;
  sourceContext?: string;
}

export function InsightCard({
  title,
  explanation,
  highlightStat,
  sourceContext,
}: InsightCardProps) {
  return (
    <article className="civic-insight-card" role="article" aria-label={`Hallazgo cívico: ${title}`}>
      <div style={{ flexShrink: 0 }}>
        <PaperAvatar mood="pointing" size="sm" interactive={false} />
      </div>
      <div>
        <h4>{title}</h4>
        <p>{explanation}</p>
        {(highlightStat || sourceContext) && (
          <div style={{ marginTop: "var(--space-2)", display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            {highlightStat && (
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-brand-primary)" }}>
                {highlightStat}
              </span>
            )}
            {sourceContext && (
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                {sourceContext}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
