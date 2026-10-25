"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import type { DataValue } from "../data-binding/schemas/data-registry-schema";
import type { VisualizationNode } from "../schemas/visualization-node";
import {
  compileVisualizationOption,
  type VisualizationDataRow,
  type VisualizationTheme,
} from "./VisualizationCompiler";
import { VisualizationDataTable } from "./VisualizationDataTable";
import { cleanGeneratedCopy } from "../primitives/content/clean-generated-copy";

interface VisualizationProps {
  spec: VisualizationNode;
  data?: DataValue[];
}

const markLabels: Record<VisualizationNode["mark"], string> = {
  line: "Evolución",
  area: "Volumen",
  bar: "Comparación",
  "grouped-bar": "Comparación cruzada",
  "stacked-bar": "Composición",
  scatter: "Relación",
  donut: "Distribución",
  heatmap: "Intensidad territorial",
};

function isDataRow(value: DataValue): value is VisualizationDataRow {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readTheme(): VisualizationTheme {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim();

  return {
    palette: [
      token("--color-brand-primary"),
      token("--color-status-info"),
      token("--color-trend-increase"),
      token("--color-evidence-caution"),
      token("--color-trend-decrease"),
      token("--color-evidence-neutral"),
    ],
    text: token("--color-text-primary"),
    mutedText: token("--color-text-muted"),
    border: token("--color-border-subtle"),
    surface: token("--color-surface-primary"),
  };
}

export function Visualization({ spec, data }: VisualizationProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const rows = useMemo(() => data?.filter(isDataRow) ?? [], [data]);
  const accessibleTitle = cleanGeneratedCopy(spec.ariaLabel);
  const accessibleDescription = spec.description ? cleanGeneratedCopy(spec.description) : undefined;

  useEffect(() => {
    const element = chartRef.current;
    if (!element || rows.length === 0) return;

    let disposed = false;
    let chart: import("./echarts-runtime").ChartInstance | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let runtimePromise: Promise<typeof import("./echarts-runtime")> | undefined;

    const update = () => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      chart?.setOption(compileVisualizationOption(spec, rows, readTheme(), { reducedMotion }), true);
    };

    const resize = () => {
      if (disposed || element.clientWidth === 0 || element.clientHeight === 0) return;
      if (chart) {
        chart.resize();
        return;
      }

      runtimePromise ??= import("./echarts-runtime");
      void runtimePromise.then((echarts) => {
        if (disposed || chart || element.clientWidth === 0 || element.clientHeight === 0) return;
        chart = echarts.init(element, undefined, { renderer: "canvas" });
        update();
      });
    };

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(element);
    }
    const themeObserver = new MutationObserver(update);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    resize();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      themeObserver.disconnect();
      chart?.dispose();
    };
  }, [rows, spec]);

  if (!data) {
    return <div className="ui-visualization__state" role="status">Datos no disponibles</div>;
  }

  if (rows.length === 0) {
    return <div className="ui-visualization__state" role="status">No hay datos para visualizar</div>;
  }

  return (
    <figure className={`ui-visualization ui-visualization--${spec.height ?? "md"}`} data-mark={spec.mark}>
      <header className="ui-visualization__header">
        <span>{markLabels[spec.mark]}</span>
        <h3>{accessibleTitle}</h3>
        {accessibleDescription ? <p id={descriptionId}>{accessibleDescription}</p> : null}
      </header>
      <div
        aria-describedby={accessibleDescription ? descriptionId : undefined}
        aria-label={accessibleTitle}
        className="ui-visualization__chart"
        ref={chartRef}
        role="img"
      />
      <VisualizationDataTable rows={rows} spec={spec} />
    </figure>
  );
}
