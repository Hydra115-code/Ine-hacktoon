"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  buildContextFollowUp,
  requestedContextFields,
  type ContextField,
  USE_AVAILABLE_DATA_PROMPT,
  WHY_CONTEXT_PROMPT,
} from "../presentation/guidance-context";

const MEXICO_STATES = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero",
  "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla",
  "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas",
  "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
] as const;

const AGE_GROUPS = ["18–19", "20–24", "25–29", "30–34", "35–39", "40–49", "50–59", "60–69", "70+"] as const;
const SEX_OPTIONS = ["Mujeres", "Hombres", "No binaria", "Todos los grupos"] as const;
const ELECTION_YEARS = ["2009", "2012", "2015", "2018", "2021", "2024"] as const;

export function GuidanceContextForm({
  onFallback,
  onSubmit,
  request,
}: {
  onFallback?: () => void;
  onSubmit: (prompt: string) => Promise<void>;
  request: string;
}) {
  const fields = useMemo(() => requestedContextFields(request), [request]);
  const [values, setValues] = useState<Partial<Record<ContextField, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field: ContextField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (fields.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(buildContextFollowUp(values));
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendReply = async (prompt: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(prompt);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (fields.length === 0) {
    return (
      <div className="canvas-guidance__conversation canvas-guidance__conversation--standalone" aria-label="Formas de responder a Paper">
        <span>Puedes responder como prefieras:</span>
        <div>
          {onFallback ? <button disabled={isSubmitting} type="button" onClick={onFallback}>Responder con mis palabras</button> : null}
          <button disabled={isSubmitting} type="button" onClick={() => void sendReply(WHY_CONTEXT_PROMPT)}>¿Por qué lo necesitas?</button>
          <button disabled={isSubmitting} type="button" onClick={() => void sendReply(USE_AVAILABLE_DATA_PROMPT)}>Trabaja sólo con lo disponible</button>
        </div>
      </div>
    );
  }

  return (
    <form aria-label="Datos solicitados por Paper" className="canvas-guidance__form" onSubmit={submit}>
      <div className="canvas-guidance__fields">
        {fields.includes("territory") ? (
          <label>
            <span>1. Tu estado</span>
            <input list="paper-context-states" onChange={(event) => update("territory", event.currentTarget.value)} placeholder="Busca o escribe tu estado" required value={values.territory ?? ""} />
            <datalist id="paper-context-states">{MEXICO_STATES.map((state) => <option key={state} value={state} />)}</datalist>
          </label>
        ) : null}
        {fields.includes("age") ? (
          <label>
            <span>{fields.indexOf("age") + 1}. Tu grupo de edad</span>
            <select onChange={(event) => update("age", event.currentTarget.value)} required value={values.age ?? ""}>
              <option disabled value="">Selecciona un rango</option>
              {AGE_GROUPS.map((age) => <option key={age} value={age}>{age} años</option>)}
            </select>
          </label>
        ) : null}
        {fields.includes("sex") ? (
          <label>
            <span>{fields.indexOf("sex") + 1}. Tu sexo</span>
            <select onChange={(event) => update("sex", event.currentTarget.value)} required value={values.sex ?? ""}>
              <option disabled value="">Selecciona una opción</option>
              {SEX_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ) : null}
        {fields.includes("year") ? (
          <label>
            <span>{fields.indexOf("year") + 1}. La elección</span>
            <select onChange={(event) => update("year", event.currentTarget.value)} required value={values.year ?? ""}>
              <option disabled value="">Selecciona un año</option>
              {ELECTION_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <button className="canvas-guidance__reply" disabled={isSubmitting} type="submit">{isSubmitting ? "Consultando…" : "Usar estos datos →"}</button>
      <div className="canvas-guidance__conversation" aria-label="Otras formas de responder a Paper">
        <span>O responde como en cualquier conversación:</span>
        <div>
          {onFallback ? <button disabled={isSubmitting} type="button" onClick={onFallback}>Responder con mis palabras</button> : null}
          <button disabled={isSubmitting} type="button" onClick={() => void sendReply(WHY_CONTEXT_PROMPT)}>¿Por qué lo necesitas?</button>
          <button disabled={isSubmitting} type="button" onClick={() => void sendReply(USE_AVAILABLE_DATA_PROMPT)}>Trabaja sólo con lo disponible</button>
        </div>
      </div>
    </form>
  );
}
