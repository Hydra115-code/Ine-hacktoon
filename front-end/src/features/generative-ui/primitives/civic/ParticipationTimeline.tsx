"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { ParticipationTimelineNode } from "@ine/contracts";
import type { DataValue } from "../../data-binding/schemas/data-registry-schema";
import { formatCivicValue, isDataRecord, percentagePointScale, readCivicLabel, readCivicNumber } from "./civic-data";
import { useInteractionEvent, useInteractionValue } from "../../interactions/events/UIEventProvider";
import { cleanGeneratedCopy } from "../content/clean-generated-copy";
import { Visualization } from "../../visualization/Visualization";
import type { VisualizationNode } from "../../schemas/visualization-node";

interface ParticipationTimelineProps {
  data?: DataValue[];
  locale?: string;
  spec: ParticipationTimelineNode;
}

export function ParticipationTimeline({ data, locale = "es-MX", spec }: ParticipationTimelineProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const items = useMemo(() => (data ?? []).flatMap((item) => {
    if (!isDataRecord(item)) return [];
    const period = readCivicLabel(item, spec.periodField);
    const value = readCivicNumber(item, spec.valueField);
    return period !== undefined && value !== undefined ? [{ period, value, record: item }] : [];
  }).sort((a, b) => a.period.localeCompare(b.period, locale, { numeric: true })), [data, locale, spec.periodField, spec.valueField]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const emitPeriodChange = useInteractionEvent(spec.id ?? "participation-timeline", spec.selectionEvent);
  const sharedPeriod = useInteractionValue(spec.selectionEvent);
  const sharedIndex = typeof sharedPeriod === "string" || typeof sharedPeriod === "number"
    ? items.findIndex((item) => item.period === String(sharedPeriod))
    : -1;
  const safeIndex = sharedPeriod === null
    ? -1
    : sharedIndex >= 0
      ? sharedIndex
      : Math.min(selectedIndex, Math.max(items.length - 1, 0));
  const selectedItem = safeIndex >= 0 ? items[safeIndex] : undefined;
  const previousItem = safeIndex > 0 ? items[safeIndex - 1] : undefined;
  const differenceScale = percentagePointScale(items.map((item) => item.value), spec.format);
  const selectedDifference = selectedItem && previousItem
    ? (selectedItem.value - previousItem.value) * differenceScale
    : undefined;
  const selectedChart = useMemo(() => {
    if (!selectedItem) return undefined;
    const voted = readCivicNumber(selectedItem.record, "voted") ?? readCivicNumber(selectedItem.record, "totalVotes");
    const didNotVote = readCivicNumber(selectedItem.record, "didNotVote");

    if (voted !== undefined && didNotVote !== undefined) {
      return {
        data: [
          { category: "Votaron", value: voted },
          { category: "No votaron", value: didNotVote },
        ],
        spec: {
          type: "visualization",
          id: `timeline-${selectedItem.period}-composition`,
          ariaLabel: `Composición de participación en ${selectedItem.period}`,
          description: `Distribución con los conteos observados de personas que votaron y no votaron en ${selectedItem.period}.`,
          mark: "donut",
          dataBinding: "timeline.selectedPeriod",
          encoding: {
            group: { field: "category", type: "nominal", label: "Condición" },
            value: { field: "value", type: "quantitative", label: "Personas", format: "number" },
          },
          legend: { show: true, position: "bottom" },
          height: "sm",
        } satisfies VisualizationNode,
      };
    }

    const comparisonRows = previousItem
      ? [
          { period: previousItem.period, value: previousItem.value },
          { period: selectedItem.period, value: selectedItem.value },
        ]
      : [{ period: selectedItem.period, value: selectedItem.value }];
    return {
      data: comparisonRows,
      spec: {
        type: "visualization",
        id: `timeline-${selectedItem.period}-comparison`,
        ariaLabel: previousItem
          ? `Comparación de ${selectedItem.period} con ${previousItem.period}`
          : `Participación observada en ${selectedItem.period}`,
        description: previousItem
          ? `Contraste entre el periodo seleccionado y el periodo anterior disponible.`
          : `Valor del primer periodo disponible.`,
        mark: "bar",
        dataBinding: "timeline.selectedPeriod",
        encoding: {
          x: { field: "period", type: "ordinal", label: "Periodo" },
          y: { field: "value", type: "quantitative", label: spec.valueLabel ?? "Participación", format: spec.format },
        },
        legend: { show: false },
        height: "sm",
      } satisfies VisualizationNode,
    };
  }, [previousItem, selectedItem, spec.format, spec.valueLabel]);
  const omittedItems = (data?.length ?? 0) - items.length;

  if (items.length === 0) {
    return <div className="ui-civic-state" role="status">No hay periodos disponibles para construir la evolución.</div>;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowRight"
          ? (index + 1) % items.length
          : (index - 1 + items.length) % items.length;
    setSelectedIndex(nextIndex);
    emitPeriodChange(items[nextIndex]?.period);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <section aria-label={cleanGeneratedCopy(spec.ariaLabel)} className="ui-participation-timeline">
      <header className="ui-civic-component__header">
        <span className="ui-civic-component__eyebrow">Evolución</span>
        <h3>{cleanGeneratedCopy(spec.title)}</h3>
        {spec.valueLabel ? <p>{cleanGeneratedCopy(spec.valueLabel)}</p> : null}
      </header>
      <div aria-label={cleanGeneratedCopy(spec.ariaLabel)} className="ui-participation-timeline__rail" role="radiogroup">
        {items.map((item, index) => {
          const selected = index === safeIndex;
          const previousValue = index > 0 ? items[index - 1]?.value : undefined;
          const difference = previousValue === undefined
            ? undefined
            : (item.value - previousValue) * differenceScale;
          return (
            <button
              aria-checked={selected}
              className="ui-participation-timeline__point"
              data-selected={selected || undefined}
              key={`${item.period}-${index}`}
              ref={(element) => { buttonRefs.current[index] = element; }}
              role="radio"
              tabIndex={selected || (safeIndex < 0 && index === 0) ? 0 : -1}
              type="button"
              onClick={() => {
                setSelectedIndex(index);
                emitPeriodChange(item.period);
              }}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span className="ui-participation-timeline__period">{item.period}</span>
              <strong>{formatCivicValue(item.value, spec.format, spec.unit, locale)}</strong>
              <span className="ui-participation-timeline__change" data-direction={difference === undefined ? "neutral" : difference >= 0 ? "increase" : "decrease"}>
                {difference === undefined ? "Punto de partida" : `${difference >= 0 ? "▲ +" : "▼ "}${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(difference)} pp`}
              </span>
            </button>
          );
        })}
      </div>
      {selectedItem ? (
        <aside aria-live="polite" className="ui-participation-timeline__detail">
          <div className="ui-participation-timeline__detail-copy">
            <span>Periodo seleccionado</span>
            <h4>{selectedItem.period}</h4>
            <strong>{formatCivicValue(selectedItem.value, spec.format, spec.unit, locale)}</strong>
            <p>
              {selectedDifference === undefined || !previousItem
                ? "Es el primer periodo disponible y funciona como punto de partida para la comparación."
                : `${selectedDifference >= 0 ? "Aumentó" : "Disminuyó"} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.abs(selectedDifference))} ${spec.format === "percent" || spec.unit === "%" ? "puntos porcentuales" : "unidades"} frente a ${previousItem.period}.`}
            </p>
          </div>
          {selectedChart ? <Visualization data={selectedChart.data} spec={selectedChart.spec} /> : null}
        </aside>
      ) : (
        <p className="ui-participation-timeline__all-periods" role="status">Se muestran todos los periodos disponibles.</p>
      )}
      {omittedItems > 0 ? <p className="ui-civic-component__notice">Algunos periodos no tienen información suficiente y no aparecen en la gráfica.</p> : null}
    </section>
  );
}
