"use client";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  footnote?: string;
  highlight?: boolean;
}

export function MetricCard({
  label,
  value,
  unit = "%",
  delta,
  deltaLabel,
  footnote,
  highlight = false,
}: MetricCardProps) {
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  return (
    <div className="civic-metric-card" data-highlight={highlight} role="region" aria-label={label}>
      <header className="civic-metric-card__header">
        <span className="civic-metric-card__label">{label}</span>
        {delta !== undefined && (
          <span
            className="civic-metric-card__delta"
            data-direction={isPositive ? "positive" : isNegative ? "negative" : "neutral"}
          >
            {isPositive ? "↑ +" : isNegative ? "↓ " : ""}
            {delta}% {deltaLabel ? <small>({deltaLabel})</small> : null}
          </span>
        )}
      </header>

      <div className="civic-metric-card__value">
        {value}
        {unit ? <small style={{ fontSize: "0.55em", marginLeft: "0.15em", color: "var(--color-text-secondary)" }}>{unit}</small> : null}
      </div>

      {footnote ? <p className="civic-metric-card__footnote">{footnote}</p> : null}
    </div>
  );
}
