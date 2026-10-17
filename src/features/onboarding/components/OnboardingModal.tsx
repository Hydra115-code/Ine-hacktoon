"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PaperAvatar } from "../../paper/components/PaperAvatar";
import { PaperDialogue } from "../../paper/components/PaperDialogue";
import type { PaperMood } from "../../paper/paper-mood";
import { CivicBrand } from "../../workspace/components/CivicBrand";
import { useWorkspaceStore } from "../../workspace/state/workspace-store";
import { MEXICAN_STATES, ONBOARDING_PROFILES } from "../onboarding-types";
import { useOnboardingStore } from "../useOnboardingStore";

const STEP_LABELS = ["Hola", "Tu mirada", "Tu territorio", "La interfaz", "Tu misión"];

function normalizeTerritorySearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("es-MX")
    .trim();
}

const PAPER_GUIDANCE: Record<number, { message: string; mood: PaperMood }> = {
  1: {
    message: "Hola, soy Paper. Yo pongo los datos en claro; tú pones la curiosidad.",
    mood: "greeting",
  },
  2: {
    message: "Cuéntame desde dónde miras. Así te propongo algo que sí te interese.",
    mood: "pointing",
  },
  3: {
    message: "¿Qué lugar quieres explorar primero? Yo preparo la comparación.",
    mood: "thinking",
  },
  4: {
    message: "Tú pregunta. Yo elijo la interfaz que mejor te lo explique.",
    mood: "presenting",
  },
  5: {
    message: "Ya te tengo una primera misión. Está pensada para ti y tu territorio.",
    mood: "approving",
  },
};

export function OnboardingModal() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const state = useOnboardingStore();
  const [paperSpeaking, setPaperSpeaking] = useState(false);
  const [stateQuery, setStateQuery] = useState("");
  const setDraft = useWorkspaceStore((store) => store.setDraft);
  const profile = ONBOARDING_PROFILES.find((item) => item.id === state.profileId) ?? ONBOARDING_PROFILES[0];
  const guidance = PAPER_GUIDANCE[state.step];
  const paperMessage = state.step === 5
    ? `Ya te tengo una primera misión. Está pensada para ti, en ${state.selectedState}.`
    : guidance.message;
  const completedSteps = state.step - 1;
  const progressStepCount = STEP_LABELS.length - 1;
  const progress = `${(completedSteps / progressStepCount) * 100}%`;
  const mission = useMemo(
    () => `${profile.suggestedPrompt.replace(/[?]$/, "")} Enfoca el análisis en ${state.selectedState} y compáralo con el promedio nacional.`,
    [profile.suggestedPrompt, state.selectedState],
  );
  const filteredStates = useMemo(() => {
    const query = normalizeTerritorySearch(stateQuery);
    if (!query) return MEXICAN_STATES;
    return MEXICAN_STATES.filter((name) => normalizeTerritorySearch(name).includes(query));
  }, [stateQuery]);

  useEffect(() => state.hydrateOnboarding(), [state.hydrateOnboarding]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (state.isOpen && !dialog.open) dialog.showModal();
    if (!state.isOpen && dialog.open) dialog.close();
  }, [state.isOpen]);

  useEffect(() => {
    if (!state.isOpen) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [state.isOpen]);

  useEffect(() => {
    if (state.isOpen) requestAnimationFrame(() => titleRef.current?.focus());
  }, [state.isOpen, state.step]);

  useEffect(() => {
    if (!state.isOpen) return;
    stageRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [state.isOpen, state.step]);

  const launchMission = () => {
    setDraft(mission);
    state.completeOnboarding();
    router.push("/conversar");
  };

  if (!state.isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="onboarding-dialog"
      aria-labelledby="onboarding-step-title"
      onCancel={(event) => {
        event.preventDefault();
        state.closeOnboarding();
      }}
    >
      <div className="onboarding-experience" data-step={state.step} data-paper-speaking={paperSpeaking}>
        <header className="workspace-header onboarding-topbar">
          <div className="workspace-header__identity">
            <Link href="/" className="workspace-header__brand-link" aria-label="Ir al inicio de INE Explora">
              <CivicBrand />
            </Link>
            <span className="workspace-header__divider" aria-hidden="true" />
            <span className="workspace-header__product">Recorrido con Paper</span>
          </div>
          <button type="button" className="onboarding-close-btn" onClick={state.closeOnboarding}>
            Saltar por ahora <span aria-hidden="true">↗</span>
          </button>
        </header>

        <div
          className="onboarding-progress"
          role="progressbar"
          aria-label="Progreso del recorrido guiado por Paper"
          aria-valuemin={0}
          aria-valuemax={progressStepCount}
          aria-valuenow={completedSteps}
        >
          <div className="onboarding-progress__track"><span style={{ width: progress }} /></div>
        </div>

        <main ref={stageRef} className="onboarding-stage">
          <aside className="onboarding-paper" aria-label="Paper te guía">
            <PaperAvatar mood={guidance.mood} size="hero" interactive={false} />
            <PaperDialogue
              key={paperMessage}
              className="onboarding-paper__speech"
              message={paperMessage}
              onSpeakingChange={setPaperSpeaking}
            />
          </aside>

          <section className="onboarding-screen" key={state.step}>
            {state.step === 1 && (
              <div className="onboarding-screen__inner">
                <span className="onboarding-kicker">Tu guía para explorar la participación ciudadana</span>
                <h2 id="onboarding-step-title" ref={titleRef} tabIndex={-1}>Hola, soy Paper.<br /><em>Hagamos visibles los datos.</em></h2>
                <p className="onboarding-lead">Convierto los estudios oficiales del INE en comparaciones, mapas e historias que puedes entender y verificar.</p>
                <div className="onboarding-principles"><span>Oficial</span><span>Claro</span><span>Explorable</span></div>
              </div>
            )}

            {state.step === 2 && (
              <div className="onboarding-screen__inner">
                <span className="onboarding-kicker">Una experiencia que empieza contigo</span>
                <h2 id="onboarding-step-title" ref={titleRef} tabIndex={-1}>¿Desde dónde quieres mirar?</h2>
                <p className="onboarding-lead">No es un registro. Solo me ayuda a elegir mejores ejemplos.</p>
                <div className="onboarding-profiles-grid" role="radiogroup" aria-label="Elige tu perspectiva">
                  {ONBOARDING_PROFILES.map((item) => (
                    <button key={item.id} type="button" role="radio" aria-checked={state.profileId === item.id} data-selected={state.profileId === item.id} onClick={() => state.selectProfile(item.id)}>
                      <strong>{item.label}</strong><small>{item.tagline}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {state.step === 3 && (
              <div className="onboarding-screen__inner onboarding-screen__inner--territory">
                <span className="onboarding-kicker">Del país a tu comunidad</span>
                <h2 id="onboarding-step-title" ref={titleRef} tabIndex={-1}>Elige un territorio.</h2>
                <p className="onboarding-lead">Lo usaré como referencia frente al promedio nacional.</p>
                <label htmlFor="onboarding-state-search">Busca y elige una entidad</label>
                <div className="onboarding-state-control">
                  <div className="onboarding-state-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      id="onboarding-state-search"
                      type="search"
                      value={stateQuery}
                      placeholder="Escribe el nombre del estado"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-controls="onboarding-state-options"
                      aria-expanded={filteredStates.length > 0}
                      onChange={(event) => setStateQuery(event.target.value)}
                    />
                  </div>
                  <div id="onboarding-state-options" className="onboarding-state-options" role="listbox" aria-label="Entidades federativas">
                    {filteredStates.map((name) => {
                      const selected = state.selectedState === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          role="option"
                          className={filteredStates.length === 1 ? "onboarding-state-option--only" : undefined}
                          aria-selected={selected}
                          data-selected={selected}
                          onClick={() => state.setSelectedState(name)}
                        >
                          <span>{name}</span>
                          {selected ? <span aria-hidden="true">✓</span> : null}
                        </button>
                      );
                    })}
                    {filteredStates.length === 0 ? (
                      <p role="status">No encontramos una entidad con ese nombre.</p>
                    ) : null}
                  </div>
                </div>
                <p className="onboarding-territory-count" aria-live="polite">
                  <strong>{state.selectedState}</strong>
                  {stateQuery
                    ? `${filteredStates.length} ${filteredStates.length === 1 ? "coincidencia" : "coincidencias"}`
                    : "Entidad seleccionada · 32 disponibles"}
                </p>
              </div>
            )}

            {state.step === 4 && (
              <div className="onboarding-screen__inner">
                <span className="onboarding-kicker">Una pregunta, una interfaz generativa</span>
                <h2 id="onboarding-step-title" ref={titleRef} tabIndex={-1}>No eliges secciones.<br /><em>La UI se adapta.</em></h2>
                <p className="onboarding-lead">Escribe lo que quieres entender. Paper consulta la evidencia y presenta únicamente la interfaz y los datos necesarios para responder.</p>
                <div className="onboarding-genui">
                  <span>Tu pregunta</span><b aria-hidden="true">→</b><span>Paper investiga</span><b aria-hidden="true">→</b><strong>La respuesta toma forma</strong>
                </div>
              </div>
            )}

            {state.step === 5 && (
              <div className="onboarding-screen__inner">
                <span className="onboarding-kicker">Una primera pregunta preparada para ti</span>
                <h2 id="onboarding-step-title" ref={titleRef} tabIndex={-1}>Tu primera pregunta ya tiene rumbo.</h2>
                <div className="onboarding-mission"><small>TU TERRITORIO · {state.selectedState.toUpperCase()}</small><p>&ldquo;{mission}&rdquo;</p><footer><span>{profile.label}</span><span>Fuente oficial INE</span></footer></div>
              </div>
            )}
          </section>
        </main>

        <footer className="onboarding-footer">
          <p>Los datos no cambian; cambia la forma de mirarlos.</p>
          <div>
            {state.step > 1 && <button type="button" className="onboarding-btn-secondary" onClick={state.prevStep}>← Atrás</button>}
            {state.step < 5 ? (
              <button type="button" className="onboarding-btn-primary" onClick={state.nextStep}>{state.step === 1 ? "Empezar" : "Continuar"} →</button>
            ) : (
              <button type="button" className="onboarding-btn-primary" onClick={launchMission}>Explorar con Paper →</button>
            )}
          </div>
        </footer>
      </div>
    </dialog>
  );
}
