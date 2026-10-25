"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { MexicoChoroplethNode } from "@ine/contracts";
import type { DataValue } from "../../data-binding/schemas/data-registry-schema";
import { useInteractionEvent } from "../../interactions/events/UIEventProvider";
import mexicoMapAsset from "../../geography/mexico-states.paths.json" with { type: "json" };
import { formatCivicValue, isDataRecord, readCivicLabel, readCivicNumber } from "./civic-data";
import { cleanGeneratedCopy } from "../content/clean-generated-copy";

interface MexicoChoroplethProps {
  data?: DataValue[];
  locale?: string;
  spec: MexicoChoroplethNode;
}

interface MapDatum {
  code: string;
  name: string;
  value: number;
  numerator?: number;
  denominator?: number;
  period?: string;
}

const BIN_COUNT = 5;
const ZOOM_LEVELS = [1, 1.25, 1.5] as const;

function normalizeEntityCode(value: string | undefined) {
  if (!value) return undefined;
  const digits = value.trim().replace(/\D/gu, "");
  return digits.length > 0 && digits.length <= 2 ? digits.padStart(2, "0") : undefined;
}

function binForValue(value: number, minimum: number, maximum: number) {
  if (minimum === maximum) return Math.floor(BIN_COUNT / 2);
  return Math.min(BIN_COUNT - 1, Math.floor((value - minimum) / (maximum - minimum) * BIN_COUNT));
}

export function MexicoChoropleth({ data, locale = "es-MX", spec }: MexicoChoroplethProps) {
  const titleId = useId();
  const descriptionId = useId();
  const searchListId = useId();
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const emitSelection = useInteractionEvent(spec.id, spec.selectionEvent);
  const [activeCode, setActiveCode] = useState<string>();
  const [search, setSearch] = useState("");
  const [zoomIndex, setZoomIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<number | "missing">();

  const parsedRows = useMemo(() => (data ?? []).flatMap((item): MapDatum[] => {
    if (!isDataRecord(item)) return [];
    const code = normalizeEntityCode(readCivicLabel(item, spec.entityCodeField));
    const name = readCivicLabel(item, spec.entityNameField);
    const value = readCivicNumber(item, spec.valueField);
    if (!code || !name || value === undefined) return [];
    return [{
      code,
      name,
      value,
      numerator: spec.numeratorField ? readCivicNumber(item, spec.numeratorField) : undefined,
      denominator: spec.denominatorField ? readCivicNumber(item, spec.denominatorField) : undefined,
      period: spec.periodField ? readCivicLabel(item, spec.periodField) : undefined,
    }];
  }), [data, spec]);

  const rowsByCode = useMemo(() => new Map(parsedRows.map((row) => [row.code, row])), [parsedRows]);
  const values = parsedRows.map((row) => row.value);
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const maximum = values.length > 0 ? Math.max(...values) : 0;
  const activeRow = activeCode ? rowsByCode.get(activeCode) : undefined;
  const activeGeometry = mexicoMapAsset.states.find((state) => state.code === activeCode);
  const renderedStates = useMemo(() => [...mexicoMapAsset.states].sort((left, right) =>
    Number(left.code === activeCode) - Number(right.code === activeCode)), [activeCode]);
  const zoom = ZOOM_LEVELS[zoomIndex];
  const missingCount = mexicoMapAsset.states.length - rowsByCode.size;
  const visibleStateCodes = useMemo(() => new Set(mexicoMapAsset.states.flatMap((state) => {
    const row = rowsByCode.get(state.code);
    if (activeFilter === undefined) return [state.code];
    if (activeFilter === "missing") return row ? [] : [state.code];
    return row && binForValue(row.value, minimum, maximum) === activeFilter ? [state.code] : [];
  })), [activeFilter, maximum, minimum, rowsByCode]);
  const legendRanges = Array.from({ length: BIN_COUNT }, (_, index) => {
    const step = maximum === minimum ? 0 : (maximum - minimum) / BIN_COUNT;
    return {
      index,
      start: minimum + step * index,
      end: index === BIN_COUNT - 1 ? maximum : minimum + step * (index + 1),
    };
  });

  const selectEntity = (code: string, focus = false) => {
    setActiveCode(code);
    emitSelection(code);
    if (focus) requestAnimationFrame(() => pathRefs.current.get(code)?.focus());
  };

  const toggleFilter = (filter: number | "missing") => {
    setActiveFilter((current) => current === filter ? undefined : filter);
    setActiveCode(undefined);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    const normalized = value.trim().toLocaleLowerCase("es-MX");
    const match = mexicoMapAsset.states.find((state) =>
      state.name.toLocaleLowerCase("es-MX") === normalized
      || state.abbreviation.toLocaleLowerCase("es-MX") === normalized
      || state.code === normalizeEntityCode(value),
    );
    if (match) {
      setActiveFilter(undefined);
      selectEntity(match.code, true);
    }
  };

  const handlePathKeyDown = (event: KeyboardEvent<SVGPathElement>, code: string) => {
    const currentIndex = mexicoMapAsset.states.findIndex((state) => state.code === code);
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectEntity(code);
      return;
    }
    const step = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
    if (step !== 0) {
      event.preventDefault();
      const nextIndex = (currentIndex + step + mexicoMapAsset.states.length) % mexicoMapAsset.states.length;
      selectEntity(mexicoMapAsset.states[nextIndex].code, true);
    }
  };

  if (parsedRows.length === 0) {
    return <div className="ui-civic-state" role="status">No hay información por entidad para mostrar el mapa.</div>;
  }

  return (
    <section aria-label={cleanGeneratedCopy(spec.ariaLabel)} className="ui-mexico-map">
      <header className="ui-civic-component__header">
        <span className="ui-civic-component__eyebrow">Mapa de México</span>
        <h3 id={titleId}>{cleanGeneratedCopy(spec.title)}</h3>
        {spec.valueLabel ? <p id={descriptionId}>{cleanGeneratedCopy(spec.valueLabel)}</p> : null}
      </header>

      <div className="ui-mexico-map__toolbar">
        <label>
          <span>Buscar entidad</span>
          <input
            list={searchListId}
            onChange={(event) => handleSearch(event.currentTarget.value)}
            placeholder="Ej. Aguascalientes"
            type="search"
            value={search}
          />
        </label>
        <datalist id={searchListId}>
          {mexicoMapAsset.states.map((state) => <option key={state.code} value={state.name}>{state.code}</option>)}
        </datalist>
        <div aria-label="Controles de acercamiento" className="ui-mexico-map__zoom" role="group">
          <button disabled={zoomIndex === ZOOM_LEVELS.length - 1} onClick={() => setZoomIndex((current) => Math.min(current + 1, ZOOM_LEVELS.length - 1))} type="button">+<span className="sr-only">Acercar mapa</span></button>
          <button disabled={zoomIndex === 0} onClick={() => setZoomIndex((current) => Math.max(current - 1, 0))} type="button">−<span className="sr-only">Alejar mapa</span></button>
          <button disabled={zoomIndex === 0} onClick={() => setZoomIndex(0)} type="button">Restablecer</button>
        </div>
      </div>

      <div className="ui-mexico-map__body">
        <div className="ui-mexico-map__canvas">
          <svg
            aria-describedby={spec.valueLabel ? descriptionId : undefined}
            aria-labelledby={titleId}
            className="ui-mexico-map__svg"
            role="img"
            viewBox={mexicoMapAsset.viewBox}
          >
            <g style={{ transform: `translate(480px, 300px) scale(${zoom}) translate(-480px, -300px)`, transformOrigin: "center" }}>
              {renderedStates.map((state) => {
                const row = rowsByCode.get(state.code);
                const rowBin = row ? binForValue(row.value, minimum, maximum) : undefined;
                const isActive = state.code === activeCode;
                const label = row
                  ? `${state.name}: ${formatCivicValue(row.value, spec.format, spec.unit, locale)}`
                  : `${state.name}: sin dato`;
                return (
                  <path
                    aria-label={label}
                    aria-pressed={isActive}
                    className="ui-mexico-map__state"
                    data-bin={rowBin}
                    data-filtered-out={!visibleStateCodes.has(state.code) || undefined}
                    data-missing={!row || undefined}
                    data-selected={isActive || undefined}
                    d={state.path}
                    fillRule="evenodd"
                    key={state.code}
                    onBlur={() => undefined}
                    onClick={() => selectEntity(state.code)}
                    onFocus={() => setActiveCode(state.code)}
                    onKeyDown={(event) => handlePathKeyDown(event, state.code)}
                    onMouseEnter={() => setActiveCode(state.code)}
                    ref={(element) => {
                      if (element) pathRefs.current.set(state.code, element);
                      else pathRefs.current.delete(state.code);
                    }}
                    role="button"
                    tabIndex={0}
                  />
                );
              })}
            </g>
          </svg>
          <p className="ui-mexico-map__keyboard-hint">Usa Tab para entrar al mapa y las flechas para recorrer las entidades.</p>
        </div>

        <aside aria-live="polite" className="ui-mexico-map__detail">
          <span>{activeGeometry?.code ?? "—"}</span>
          <h4>{activeGeometry?.name ?? "Selecciona una entidad"}</h4>
          {activeRow ? (
            <>
              <strong>{formatCivicValue(activeRow.value, spec.format, spec.unit, locale)}</strong>
              {activeRow.period ? <p>Periodo: {activeRow.period}</p> : null}
              {activeRow.numerator !== undefined ? <p>Cantidad observada: {formatCivicValue(activeRow.numerator, "number", undefined, locale)}</p> : null}
              {activeRow.denominator !== undefined ? <p>Total de referencia: {formatCivicValue(activeRow.denominator, "number", undefined, locale)}</p> : null}
            </>
          ) : <p>{activeGeometry ? "No hay un valor disponible para esta entidad." : "Puedes usar el buscador o seleccionar una entidad en el mapa."}</p>}
        </aside>
      </div>

      <div aria-label={`Filtrar escala desde ${formatCivicValue(minimum, spec.format, spec.unit, locale)} hasta ${formatCivicValue(maximum, spec.format, spec.unit, locale)}`} className="ui-mexico-map__legend">
        <span>Menor</span>
        {legendRanges.map((range) => (
          <button
            aria-label={`Filtrar de ${formatCivicValue(range.start, spec.format, spec.unit, locale)} a ${formatCivicValue(range.end, spec.format, spec.unit, locale)}`}
            aria-pressed={activeFilter === range.index}
            data-bin={range.index}
            key={range.index}
            onClick={() => toggleFilter(range.index)}
            title={`${formatCivicValue(range.start, spec.format, spec.unit, locale)} – ${formatCivicValue(range.end, spec.format, spec.unit, locale)}`}
            type="button"
          ><span className="sr-only">Rango {range.index + 1}</span></button>
        ))}
        <span>Mayor</span>
        <button
          aria-label="Filtrar entidades sin dato"
          aria-pressed={activeFilter === "missing"}
          className="ui-mexico-map__legend-missing"
          disabled={missingCount === 0}
          onClick={() => toggleFilter("missing")}
          type="button"
        ><i aria-hidden="true" /> Sin dato</button>
      </div>
      <div aria-live="polite" className="ui-mexico-map__filter-status">
        <span>{activeFilter === undefined ? "Mostrando las 32 entidades" : `Mostrando ${visibleStateCodes.size} entidades del filtro seleccionado`}</span>
        {activeFilter !== undefined ? <button onClick={() => setActiveFilter(undefined)} type="button">Quitar filtro</button> : null}
      </div>

      <details className="ui-mexico-map__table-alternative">
        <summary>Ver los datos del mapa en tabla</summary>
        <div tabIndex={0}>
          <table>
            <caption>{cleanGeneratedCopy(spec.title)}. Los mismos datos en una tabla.</caption>
            <thead><tr><th scope="col">Clave</th><th scope="col">Entidad</th><th scope="col">{cleanGeneratedCopy(spec.valueLabel ?? "Valor")}</th></tr></thead>
            <tbody>
              {mexicoMapAsset.states.map((state) => {
                const row = rowsByCode.get(state.code);
                return visibleStateCodes.has(state.code)
                  ? <tr data-selected={state.code === activeCode || undefined} key={state.code}><td>{state.code}</td><th scope="row"><button onClick={() => selectEntity(state.code, true)} type="button">{state.name}</button></th><td>{row ? formatCivicValue(row.value, spec.format, spec.unit, locale) : "Sin dato"}</td></tr>
                  : null;
              })}
            </tbody>
          </table>
        </div>
      </details>

      <p className="ui-civic-component__notice">Mapa base: {mexicoMapAsset.source}. Los valores provienen de la fuente indicada en esta vista.</p>
    </section>
  );
}
