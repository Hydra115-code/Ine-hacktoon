"use client";

import { useEffect, useId, useRef, useState } from "react";

type TextSize = "default" | "large" | "larger";

interface AccessibilityPreferences {
  highContrast: boolean;
  reduceMotion: boolean;
  textSize: TextSize;
}

const STORAGE_KEY = "ine-explora-accessibility";
const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  highContrast: false,
  reduceMotion: false,
  textSize: "default",
};

function isTextSize(value: unknown): value is TextSize {
  return value === "default" || value === "large" || value === "larger";
}

function readPreferences(): AccessibilityPreferences {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(stored) as Partial<AccessibilityPreferences>;
    return {
      highContrast: parsed.highContrast === true,
      reduceMotion: parsed.reduceMotion === true,
      textSize: isTextSize(parsed.textSize) ? parsed.textSize : "default",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function applyPreferences(preferences: AccessibilityPreferences) {
  const root = document.documentElement;
  root.dataset.a11yText = preferences.textSize;
  root.dataset.a11yContrast = preferences.highContrast ? "high" : "standard";
  root.dataset.a11yMotion = preferences.reduceMotion ? "reduced" : "system";
}

function persistPreferences(preferences: AccessibilityPreferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Las preferencias siguen activas durante la sesión si el almacenamiento está bloqueado.
  }
}

const textSizeOptions: Array<{ label: string; value: TextSize; sample: string }> = [
  { label: "Normal", value: "default", sample: "A" },
  { label: "Grande", value: "large", sample: "A+" },
  { label: "Muy grande", value: "larger", sample: "A++" },
];

export function AccessibilityCenter() {
  const panelId = useId();
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const stored = readPreferences();
    setPreferences(stored);
    applyPreferences(stored);

    const syncPreferences = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = readPreferences();
      setPreferences(next);
      applyPreferences(next);
    };
    window.addEventListener("storage", syncPreferences);
    return () => window.removeEventListener("storage", syncPreferences);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOutside);
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("input")?.focus());
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, [isOpen]);

  const updatePreferences = (next: AccessibilityPreferences, message: string) => {
    setPreferences(next);
    applyPreferences(next);
    persistPreferences(next);
    setAnnouncement(message);
  };

  const resetPreferences = () => {
    updatePreferences(DEFAULT_PREFERENCES, "Se restablecieron los ajustes de accesibilidad.");
  };

  return (
    <div className="accessibility-center">
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-label="Abrir ajustes de accesibilidad"
        className="accessibility-center__trigger"
        onClick={() => setIsOpen((open) => !open)}
        ref={triggerRef}
        title="Accesibilidad"
        type="button"
      >
        <span aria-hidden="true">Aa</span>
      </button>

      {isOpen ? (
        <div
          aria-labelledby={titleId}
          className="accessibility-center__panel"
          id={panelId}
          ref={panelRef}
          role="dialog"
        >
          <header className="accessibility-center__header">
            <div>
              <span>Lectura y movimiento</span>
              <h2 id={titleId}>Accesibilidad</h2>
            </div>
            <button
              aria-label="Cerrar ajustes de accesibilidad"
              className="accessibility-center__close"
              onClick={() => {
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
              type="button"
            >×</button>
          </header>

          <fieldset className="accessibility-center__text-size">
            <legend>Tamaño del texto</legend>
            <div>
              {textSizeOptions.map((option) => (
                <label data-selected={preferences.textSize === option.value || undefined} key={option.value}>
                  <input
                    checked={preferences.textSize === option.value}
                    name="accessibility-text-size"
                    onChange={() => updatePreferences(
                      { ...preferences, textSize: option.value },
                      `Tamaño de texto: ${option.label}.`,
                    )}
                    type="radio"
                    value={option.value}
                  />
                  <strong aria-hidden="true">{option.sample}</strong>
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="accessibility-center__switches">
            <label>
              <span><strong>Alto contraste</strong><small>Refuerza texto, bordes y controles.</small></span>
              <input
                aria-label="Alto contraste"
                checked={preferences.highContrast}
                onChange={(event) => updatePreferences(
                  { ...preferences, highContrast: event.currentTarget.checked },
                  event.currentTarget.checked ? "Alto contraste activado." : "Alto contraste desactivado.",
                )}
                role="switch"
                type="checkbox"
              />
            </label>
            <label>
              <span><strong>Reducir movimiento</strong><small>Evita transiciones y animaciones.</small></span>
              <input
                aria-label="Reducir movimiento"
                checked={preferences.reduceMotion}
                onChange={(event) => updatePreferences(
                  { ...preferences, reduceMotion: event.currentTarget.checked },
                  event.currentTarget.checked ? "Movimiento reducido activado." : "Movimiento reducido desactivado.",
                )}
                role="switch"
                type="checkbox"
              />
            </label>
          </div>

          <button className="accessibility-center__reset" onClick={resetPreferences} type="button">
            Restablecer ajustes
          </button>
          <p aria-live="polite" className="sr-only">{announcement}</p>
        </div>
      ) : null}
    </div>
  );
}
