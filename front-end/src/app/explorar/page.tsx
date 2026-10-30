"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicNav } from "@/features/workspace/components/PublicNav";
import { OnboardingModal } from "@/features/onboarding/components/OnboardingModal";
import { PaperAvatar } from "@/features/paper/components/PaperAvatar";
import { PaperSays } from "@/features/paper/components/PaperSays";
import {
  MetricCard,
  ParticipationMap,
  ComparisonChart,
  GenderComparison,
  ElectionTimeline,
  SourceCard,
} from "@/features/civic-ui";
import { ELECTION_HISTORY, STATE_TURNOUT_DATA, type StateTurnout, type ElectionTurnout } from "@/features/civic-ui/civic-data-fixtures";
import { useWorkspaceStore } from "@/features/workspace/state/workspace-store";

export default function ExplorarMexicoPage() {
  const router = useRouter();
  const setDraft = useWorkspaceStore((s) => s.setDraft);
  const [selectedState, setSelectedState] = useState<StateTurnout>(
    STATE_TURNOUT_DATA.find((s) => s.code === "CDMX") ?? STATE_TURNOUT_DATA[0]
  );
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const selectedElection = ELECTION_HISTORY.find((election) => election.year === selectedYear) ?? ELECTION_HISTORY.at(-1)!;
  const regionalStates = STATE_TURNOUT_DATA.filter((state) => state.region === selectedState.region);

  const handleAskPaper = () => {
    const prompt = selectedYear === 2024
      ? `Analiza a detalle la participación en ${selectedState.name} en la elección federal de 2024, comparándola con su región (${selectedState.region}) y los grupos de edad con mayor abstención.`
      : `Analiza la participación de ${selectedState.name} en 2024 y ponla en contexto con la elección nacional de ${selectedYear}, comparándola con su región (${selectedState.region}).`;
    setDraft(prompt);
    router.push("/conversar");
  };

  const getCivicContext = (state: StateTurnout) => {
    if (state.turnout2024 >= 68) {
      return `${state.name} se posiciona como una de las entidades con mayor compromiso democrático de México, superando a la media nacional en más de 8 puntos porcentuales.`;
    }
    if (state.turnout2024 >= 60) {
      return `${state.name} se encuentra en línea con la tasa nacional de participación (60.9%), con fuerte concurrencia en zonas metropolitanas.`;
    }
    return `${state.name} presenta un área de oportunidad cívica importante, con tasas de abstención cercanas al 50%. La movilización de juventudes es determinante aquí.`;
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PublicNav />
      <OnboardingModal />

      <main id="main-content" tabIndex={-1} style={{ maxWidth: 1240, margin: "0 auto", padding: "var(--space-6) var(--space-4)", width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Cabecera de Experiencia 2 */}
        <section style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)" }}>
          <div style={{ maxWidth: 720 }}>
            <p style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: "var(--color-brand-primary)", margin: "0 0 0.3rem" }}>
              Experiencia 2 · Navegación territorial
            </p>
            <h1 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", margin: "0 0 var(--space-2)", lineHeight: 1.1 }}>
              Explorar México: Estado por estado
            </h1>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "1.05rem", margin: 0 }}>
              Recorre la serie nacional 2009–2024 y compara las entidades con datos territoriales disponibles para 2024.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <PaperAvatar mood="pointing" size="md" />
            <div style={{ maxWidth: 260 }}>
              <PaperSays title="Explora tu entidad" tip="Toca cualquier estado en el mapa para ver su comparativa.">
                Aquí ves las entidades disponibles en esta maqueta de datos.
              </PaperSays>
            </div>
          </div>
        </section>

        {/* Línea de tiempo de elecciones */}
        <section style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
          <ElectionTimeline
            selectedYear={selectedYear}
            onSelectYear={(el: ElectionTurnout) => setSelectedYear(el.year)}
          />
          <p style={{ margin: "var(--space-3) 0 0", color: "var(--color-text-secondary)", fontSize: "0.9rem" }} aria-live="polite">
            <strong>{selectedElection.year} · {selectedElection.type}:</strong> participación nacional de {selectedElection.turnout}% ({selectedElection.totalVotes} millones de votos). El mapa territorial permanece en 2024 porque esta maqueta no contiene series estatales para todos los años.
          </p>
        </section>

        {/* Fila principal: Mapa territorial + Tarjeta del Estado Seleccionado */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "var(--space-5)" }}>
          <div>
            <ParticipationMap
              selectedStateCode={selectedState.code}
              onSelectState={(s) => setSelectedState(s)}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {/* Tarjeta del Estado */}
            <div style={{ background: "var(--color-surface-elevated)", border: "2px solid var(--color-brand-primary)", borderRadius: "var(--radius-md)", padding: "var(--space-5)", boxShadow: "var(--shadow-paper)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-2)" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-brand-primary)", fontWeight: 700 }}>
                    Entidad seleccionada · Región {selectedState.region}
                  </span>
                  <h2 style={{ fontSize: "1.8rem", margin: "0.2rem 0 0" }}>{selectedState.name}</h2>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--space-3)", margin: "var(--space-4) 0" }}>
                <MetricCard
                  label="Participación 2024"
                  value={selectedState.turnout2024}
                  delta={selectedState.delta}
                  deltaLabel="vs 2018"
                  highlight={true}
                />
                <MetricCard
                  label="Tasa de abstención"
                  value={(100 - selectedState.turnout2024).toFixed(1)}
                  footnote="Margen por convocar"
                />
              </div>

              <p style={{ fontSize: "0.95rem", color: "var(--color-text-secondary)", lineHeight: 1.5, margin: "0 0 var(--space-4)" }}>
                {getCivicContext(selectedState)}
              </p>

              <button
                type="button"
                onClick={handleAskPaper}
                style={{
                  width: "100%",
                  background: "var(--color-brand-primary)",
                  color: "var(--color-text-on-brand)",
                  border: "none",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                }}
              >
                <span>Pregúntale a Paper sobre {selectedState.name}</span>
                <span>➔</span>
              </button>
            </div>

            {/* Comparación y género de apoyo */}
            <ComparisonChart
              data={regionalStates}
              selectedCode={selectedState.code}
              onSelectState={(code) => {
                const found = STATE_TURNOUT_DATA.find((s) => s.code === code);
                if (found) setSelectedState(found);
              }}
              title={`Región ${selectedState.region} · participación 2024`}
            />
          </div>
        </section>

        {/* Sección de apoyo por género */}
        <section>
          <GenderComparison />
        </section>

        {/* Fuente oficial */}
        <section>
          <SourceCard />
        </section>
      </main>
    </div>
  );
}
