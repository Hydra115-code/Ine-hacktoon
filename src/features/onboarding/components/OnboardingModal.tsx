"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PaperAvatar } from "../../paper/components/PaperAvatar";
import { PaperDialogue } from "../../paper/components/PaperDialogue";
import type { PaperMood } from "../../paper/paper-mood";
import { useWorkspaceStore } from "../../workspace/state/workspace-store";
import { MEXICAN_STATES, ONBOARDING_PROFILES } from "../onboarding-types";
import { useOnboardingStore } from "../useOnboardingStore";

const STEP_LABELS = ["Hola", "Tu mirada", "Tu territorio", "La interfaz", "Tu misión"];

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
  const setDraft = useWorkspaceStore((store) => store.setDraft);
  const profile = ONBOARDING_PROFILES.find((item) => item.id === state.profileId) ?? ONBOARDING_PROFILES[0];
  const guidance = PAPER_GUIDANCE[state.step];
  const paperMessage = state.step === 5
    ? `Ya te tengo una primera misión. Está pensada para ti, en ${state.selectedState}.`
    : guidance.message;
  const progress = `${(state.step / STEP_LABELS.length) * 100}%`;
  const mission = useMemo(
    () => `${profile.suggestedPrompt.replace(/[?]$/, "")} Enfoca el análisis en ${state.selectedState} y compáralo con el promedio nacional.`,
    [profile.suggestedPrompt, state.selectedState],
  );

  useEffect(() => state.hydrateOnboarding(), [state.hydrateOnboarding]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (state.isOpen && !dialog.open) dialog.showModal();
    if (!state.isOpen && dialog.open) dialog.close();
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
        <header className="onboarding-topbar">
          <div className="onboarding-wordmark"><strong>INE</strong><small>Explora con Paper</small></div>
          <button type="button" className="onboarding-close-btn" onClick={state.closeOnboarding}>
            Saltar por ahora <span aria-hidden="true">↗</span>
          </button>
        </header>

        <div
          className="onboarding-progress"
          role="progressbar"
          aria-label="Progreso del recorrido guiado por Paper"
          aria-valuemin={1}
          aria-valuemax={STEP_LABELS.length}
          aria-valuenow={state.step}
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
                <label htmlFor="onboarding-state">Quiero explorar</label>
                <div className="onboarding-state-control"><select id="onboarding-state" value={state.selectedState} onChange={(event) => state.setSelectedState(event.target.value)}>{MEXICAN_STATES.map((name) => <option key={name}>{name}</option>)}</select></div>
                <p className="onboarding-territory-count"><strong>32</strong> entidades listas para comparar.</p>
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
