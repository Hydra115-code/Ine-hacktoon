"use client";

import { useId, useMemo, useState } from "react";
import { readDataField } from "../data-binding/resolver/read-data-field";
import type { DataValue } from "../data-binding/schemas/data-registry-schema";
import type { TableNode } from "../schemas/table-node";
import { buildTablePage, formatTableCell, tableStatus, type IndexedTableRow, type TableSortState } from "./table-model";
import { TablePagination } from "./TablePagination";
import { useInteractionEvent, useInteractionValue } from "../interactions/events/UIEventProvider";
import { localizeDisplayValue } from "../data-binding/formatting/format-data-value";
import { cleanGeneratedCopy } from "../primitives/content/clean-generated-copy";

const localizedColumnLabels: Readonly<Record<string, string>> = {
  recordtype: "Tipo de registro",
  indicator: "Indicador",
  municipality: "Municipio",
  state: "Entidad",
  description: "Descripción",
  category: "Categoría",
  value: "Valor",
  count: "Cantidad",
  date: "Fecha",
  status: "Estado",
};

function columnLabel(label: string) {
  const key = label.replace(/[\s_-]/gu, "").toLocaleLowerCase("es-MX");
  return cleanGeneratedCopy(localizedColumnLabels[key] ?? localizeDisplayValue(label));
}

interface TableProps {
  spec: TableNode;
  data?: DataValue[];
  locale?: string;
  currency?: string;
}

function rowSelectionKey(row: IndexedTableRow, field: string | undefined) {
  const value = field ? readDataField(row.data, field) : undefined;
  return typeof value === "string" || typeof value === "number"
    ? `${typeof value}:${value}`
    : `row:${row.sourceIndex}`;
}

export function Table({ spec, data, locale = "es-MX", currency = "MXN" }: TableProps) {
  const selectionName = useId();
  const selection = spec.selection;
  const emitSelection = useInteractionEvent(
    spec.id ?? "generated-table",
    selection?.event ?? "table.selection_changed",
  );
  const emitFilter = useInteractionEvent(spec.id ?? "generated-table", "table.filter.changed");
  const emitSort = useInteractionEvent(spec.id ?? "generated-table", "table.sort.changed");
  const clearTimelinePeriod = useInteractionEvent(spec.id ?? "generated-table", "timeline.period_selected");
  const selectedTimelinePeriod = useInteractionValue("timeline.period_selected");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TableSortState | undefined>(spec.sorting?.default);
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const periodColumn = useMemo(() => spec.columns.find((column) => /^(?:year|period|año|anio)$/iu.test(column.field)), [spec.columns]);
  const periodFilteredData = useMemo(() => {
    if (!data || !periodColumn || (typeof selectedTimelinePeriod !== "string" && typeof selectedTimelinePeriod !== "number")) return undefined;
    const selected = String(selectedTimelinePeriod);
    const matches = data.filter((row) => String(readDataField(row, periodColumn.field) ?? "") === selected);
    return matches.length > 0 ? matches : undefined;
  }, [data, periodColumn, selectedTimelinePeriod]);
  const model = useMemo(
    () => buildTablePage(periodFilteredData ?? data ?? [], spec, { query, sort, page }, { locale, currency }),
    [currency, data, locale, page, periodFilteredData, query, sort, spec],
  );
  const visibleSelectionKeys = selection
    ? model.rows.map((row) => rowSelectionKey(row, selection.rowIdField))
    : [];
  const allVisibleSelected = visibleSelectionKeys.length > 0
    && visibleSelectionKeys.every((key) => selectedRows.has(key));

  function changeSort(field: string) {
    setSort((current) => ({
      field,
      direction: current?.field === field && current.direction === "ascending"
        ? "descending"
        : "ascending",
    }));
    setPage(1);
    emitSort(field);
  }

  function toggleRow(key: string) {
    const next = selection?.mode === "single"
      ? (selectedRows.has(key) ? new Set<string>() : new Set([key]))
      : new Set(selectedRows);
    if (selection?.mode !== "single") {
      if (next.has(key)) next.delete(key);
      else next.add(key);
    }
    setSelectedRows(next);
    if (selection?.event && spec.id) {
      emitSelection(selection.mode === "single" ? (next.values().next().value ?? null) : [...next]);
    }
  }

  function toggleVisibleRows() {
    const next = new Set(selectedRows);
    if (allVisibleSelected) visibleSelectionKeys.forEach((key) => next.delete(key));
    else visibleSelectionKeys.forEach((key) => next.add(key));
    setSelectedRows(next);
    if (selection?.event && spec.id) emitSelection([...next]);
  }

  if (!data) {
    return <div className="ui-table__state" role="status">Datos no disponibles</div>;
  }

  return (
    <div className={`ui-table ui-table--${spec.density ?? "comfortable"}`} data-column-count={selection ? undefined : spec.columns.length}>
      {spec.filtering?.enabled || periodFilteredData ? (
        <div className="ui-table__toolbar">
          <div className="ui-table__active-filters">
            {selection ? <p aria-live="polite"><strong>{selectedRows.size}</strong> {selectedRows.size === 1 ? "fila seleccionada" : "filas seleccionadas"}</p> : null}
            {periodFilteredData ? (
              <button
                aria-label={`Mostrar todos los años; actualmente se muestra ${String(selectedTimelinePeriod)}`}
                className="ui-table__period-filter"
                type="button"
                onClick={() => {
                  setPage(1);
                  clearTimelinePeriod(null);
                }}
              >
                <span>Periodo: <strong>{String(selectedTimelinePeriod)}</strong></span>
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </div>
          {spec.filtering?.enabled ? (
            <label className="ui-table__search" htmlFor={`${selectionName}-filter`}>
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">Filtrar tabla</span>
              <input
                id={`${selectionName}-filter`}
                placeholder={cleanGeneratedCopy(spec.filtering.placeholder ?? "Filtrar resultados")}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                  emitFilter(event.target.value);
                }}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <div
        aria-label={`Tabla desplazable: ${cleanGeneratedCopy(spec.ariaLabel)}`}
        className="ui-table__viewport"
        role="region"
        tabIndex={0}
      >
        <table aria-label={cleanGeneratedCopy(spec.ariaLabel)}>
          {spec.caption ? <caption>{cleanGeneratedCopy(spec.caption)}</caption> : null}
          <thead className={spec.stickyHeader ? "ui-table__head--sticky" : undefined}>
            <tr>
              {selection ? (
                <th className="ui-table__selection" scope="col">
                  {selection.mode === "multiple" ? (
                    <label>
                      <span className="sr-only">Seleccionar filas visibles</span>
                      <input
                        checked={allVisibleSelected}
                        type="checkbox"
                        onChange={toggleVisibleRows}
                      />
                    </label>
                  ) : <span className="sr-only">Selección</span>}
                </th>
              ) : null}
              {spec.columns.map((column) => {
                const canSort = Boolean(spec.sorting?.enabled) && column.sortable !== false;
                const ariaSort = sort?.field === column.field ? sort.direction : undefined;

                return (
                  <th
                    aria-sort={ariaSort}
                    className={`ui-table__cell--${column.align ?? "start"}`}
                    key={column.field}
                    scope="col"
                  >
                    {canSort ? (
                      <button type="button" onClick={() => changeSort(column.field)}>
                        {columnLabel(column.label)}
                        <span aria-hidden="true">{ariaSort === "ascending" ? "↑" : ariaSort === "descending" ? "↓" : "↕"}</span>
                      </button>
                    ) : columnLabel(column.label)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => {
              const selectionKey = selection ? rowSelectionKey(row, selection.rowIdField) : "";
              return (
                <tr data-selected={selectedRows.has(selectionKey) || undefined} key={`row-${row.sourceIndex}`}>
                  {selection ? (
                    <td className="ui-table__selection">
                      <label>
                        <span className="sr-only">Seleccionar fila {row.sourceIndex + 1}</span>
                        <input
                          checked={selectedRows.has(selectionKey)}
                          name={selection.mode === "single" ? selectionName : undefined}
                          type={selection.mode === "single" ? "radio" : "checkbox"}
                          onChange={() => toggleRow(selectionKey)}
                        />
                      </label>
                    </td>
                  ) : null}
                  {spec.columns.map((column) => {
                    const displayValue = formatTableCell(row.data, column, { locale, currency });
                    const status = column.format === "status"
                      ? tableStatus(readDataField(row.data, column.field))
                      : undefined;
                    return (
                      <td className={`ui-table__cell--${column.align ?? "start"}`} key={column.field}>
                        {status ? <span className={`ui-table__status ui-table__status--${status}`}>{displayValue}</span> : displayValue}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {model.totalRows === 0 ? <p className="ui-table__empty" role="status">No hay resultados</p> : null}
      </div>

      <TablePagination
        page={model.page}
        totalPages={model.totalPages}
        totalRows={model.totalRows}
        onPageChange={setPage}
      />
    </div>
  );
}
