"use client";

import { CIVIC_DATA_SOURCE } from "../civic-data-fixtures";

interface SourceCardProps {
  name?: string;
  institution?: string;
  period?: string;
  methodology?: string;
  folio?: string;
  officialUrl?: string;
}

export function SourceCard({
  name = CIVIC_DATA_SOURCE.name,
  institution = CIVIC_DATA_SOURCE.institution,
  period = CIVIC_DATA_SOURCE.period,
  methodology = CIVIC_DATA_SOURCE.methodology,
  folio = CIVIC_DATA_SOURCE.folio,
  officialUrl = CIVIC_DATA_SOURCE.officialUrl,
}: SourceCardProps) {
  return (
    <aside className="civic-source-card" role="note" aria-label="Origen y metodología oficial">
      <div className="civic-source-card__title">
        {name} ({period})
      </div>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
        {methodology}
      </p>
      <div className="civic-source-card__meta">
        <span><strong>Institución:</strong> {institution}</span>
        <span><strong>Folio:</strong> <code>{folio}</code></span>
        {officialUrl && (
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-brand-primary)", textDecoration: "underline", fontWeight: 600 }}
          >
            Ver repositorio oficial ↗
          </a>
        )}
      </div>
    </aside>
  );
}
