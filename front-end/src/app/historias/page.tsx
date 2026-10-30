"use client";

import { useRouter } from "next/navigation";
import { PublicNav } from "@/features/workspace/components/PublicNav";
import { OnboardingModal } from "@/features/onboarding/components/OnboardingModal";
import { PaperAvatar } from "@/features/paper/components/PaperAvatar";
import { PaperSays } from "@/features/paper/components/PaperSays";
import {
  MetricCard,
  AgeDistribution,
  GenderComparison,
  TrendChart,
  InsightCard,
  SourceCard,
  SuggestedQuestions,
} from "@/features/civic-ui";
import { useWorkspaceStore } from "@/features/workspace/state/workspace-store";

export default function HistoriasPage() {
  const router = useRouter();
  const setDraft = useWorkspaceStore((s) => s.setDraft);

  const handleLaunchQuestion = (q: string) => {
    setDraft(q);
    router.push("/conversar");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PublicNav />
      <OnboardingModal />

      <main id="main-content" tabIndex={-1} style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-6) var(--space-4)", width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        {/* Encabezado Editorial */}
        <header style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
          <span style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: "var(--color-brand-primary)" }}>
            Historia de Datos Nº 1 · Narrativa Ciudadana
          </span>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)", margin: 0, lineHeight: 1.05 }}>
            La Paradoja de la Juventud: ¿Por qué vota (o no) mi generación?
          </h1>
          <p style={{ maxWidth: 680, fontSize: "1.15rem", color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>
            Un recorrido con Paper por los datos del Estudio Muestral del INE (2009–2024) para descubrir
            el poder decisivo que tienen las y los mexicanos de 18 a 29 y 30 a 40 años.
          </p>

          <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", background: "var(--color-surface-secondary)", padding: "0.3rem 0.8rem", borderRadius: "var(--radius-full)", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            <span>Lectura interactiva · 4 minutos</span>
            <span>•</span>
            <span>Datos validados CCPC</span>
          </div>
        </header>

        {/* Capítulo 1: El Primer Voto */}
        <section
          style={{
            background: "var(--color-surface-elevated)",
            border: "1.5px solid var(--color-border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "clamp(var(--space-5), 4vw, var(--space-8))",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
            boxShadow: "var(--shadow-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)" }}>
            <div style={{ maxWidth: 540 }}>
              <span style={{ fontSize: "1.2rem", color: "var(--color-brand-primary)" }}>Capítulo 1</span>
              <h2 style={{ fontSize: "1.8rem", margin: "0.3rem 0 var(--space-2)" }}>
                El entusiasmo del debut electoral (18–19 años)
              </h2>
              <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                Existe el mito popular de que la juventud &ldquo;no tiene interés en la política&rdquo;. Los datos oficiales
                demuestran lo contrario: en su primera elección federal, las y los jóvenes de 18 y 19 años
                acuden a las casillas en una proporción impresionante del <strong>64.2%</strong>, superando incluso
                la media nacional (60.9%).
              </p>
            </div>
            <PaperAvatar mood="approving" size="md" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
            <MetricCard
              label="Primer voto (18–19 años)"
              value="64.2"
              unit="%"
              delta={3.3}
              deltaLabel="arriba de la media nacional"
              highlight={true}
            />
            <InsightCard
              title="El valor del rito democrático"
              explanation="Obtener la credencial por primera vez genera un alto sentido de pertenencia y compromiso cívico en el primer proceso electoral."
              sourceContext="CCPC Federal 2024"
            />
          </div>
        </section>

        {/* Capítulo 2: La Paradoja de los 20s */}
        <section
          style={{
            background: "var(--color-surface-elevated)",
            border: "1.5px solid var(--color-border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "clamp(var(--space-5), 4vw, var(--space-8))",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
            boxShadow: "var(--shadow-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)" }}>
            <div style={{ maxWidth: 540 }}>
              <span style={{ fontSize: "1.2rem", color: "var(--color-brand-primary)" }}>Capítulo 2</span>
              <h2 style={{ fontSize: "1.8rem", margin: "0.3rem 0 var(--space-2)" }}>
                El abismo de los 20 a 29 años
              </h2>
              <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                Aquí reside el nudo del problema. Entre los 20 y los 29 años, la participación se desploma
                hasta el <strong>49.3%</strong>. Más de la mitad de las y los jóvenes de este rango se abstienen.
                ¿Por qué? Factores de movilidad universitaria, primer empleo, cambio de domicilio sin actualizar credencial
                y desencanto con las opciones electorales.
              </p>
            </div>
            <PaperAvatar mood="thinking" size="md" />
          </div>

          <AgeDistribution />

          <PaperSays
            title="¿Qué nos dice Paper?"
            tip="Si lográramos que el grupo de 20 a 29 años votara al mismo nivel que los de 18 (64%), se sumarían más de 4.2 millones de votos a la vida pública."
          >
            No es apatía innata: es una desconexión estructural con los canales de participación que debemos visibilizar.
          </PaperSays>
        </section>

        {/* Capítulo 3: Mujeres al Frente */}
        <section
          style={{
            background: "var(--color-surface-elevated)",
            border: "1.5px solid var(--color-border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "clamp(var(--space-5), 4vw, var(--space-8))",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
            boxShadow: "var(--shadow-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)" }}>
            <div style={{ maxWidth: 540 }}>
              <span style={{ fontSize: "1.2rem", color: "var(--color-brand-primary)" }}>Capítulo 3</span>
              <h2 style={{ fontSize: "1.8rem", margin: "0.3rem 0 var(--space-2)" }}>
                El liderazgo de las mujeres jóvenes
              </h2>
              <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                Un hallazgo contundente de las últimas cuatro elecciones federales: las mujeres no solo son la mayoría
                de la lista nominal, sino que participan a tasas significativamente mayores que los hombres en casi todas
                las edades, alcanzando brechas de hasta <strong>+10.3 puntos porcentuales</strong> en los 20s y 30s.
              </p>
            </div>
            <PaperAvatar mood="presenting" size="md" />
          </div>

          <GenderComparison />
        </section>

        {/* Capítulo 4: Evolución Histórica */}
        <section
          style={{
            background: "var(--color-surface-elevated)",
            border: "1.5px solid var(--color-border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "clamp(var(--space-5), 4vw, var(--space-8))",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
            boxShadow: "var(--shadow-subtle)",
          }}
        >
          <span style={{ fontSize: "1.2rem", color: "var(--color-brand-primary)" }}>Capítulo 4</span>
          <h2 style={{ fontSize: "1.8rem", margin: "0" }}>
            El ciclo 2009–2024: De las intermedias a las presidenciales
          </h2>
          <TrendChart />
        </section>

        {/* Conclusión y Llamado a la Acción con Paper */}
        <section
          style={{
            background: "linear-gradient(135deg, var(--color-surface-elevated), var(--color-surface-secondary))",
            border: "2px solid var(--color-brand-primary)",
            borderRadius: "var(--radius-lg)",
            padding: "clamp(var(--space-6), 5vw, var(--space-8))",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-4)",
            boxShadow: "var(--shadow-paper)",
          }}
        >
          <PaperAvatar mood="greeting" size="lg" />
          <h2 style={{ fontSize: "2rem", margin: 0 }}>
            ¿Qué historia quieres descubrir ahora?
          </h2>
          <p style={{ maxWidth: 600, color: "var(--color-text-secondary)", fontSize: "1.05rem", margin: 0 }}>
            Paper puede responder cualquier duda sobre estos datos en una conversación directa.
            Haz clic en una pregunta o escribe la tuya propia:
          </p>

          <SuggestedQuestions
            onSelectQuestion={handleLaunchQuestion}
            title=""
            questions={[
              "¿Por qué los jóvenes de 25 a 29 años se abstienen más en México?",
              "Compara la participación de mujeres vs hombres en mi estado",
              "¿Qué estados tienen la mayor participación de jóvenes menores de 30?",
              "Muestra la serie histórica de participación 2009–2024",
            ]}
          />
        </section>

        {/* Metodología y Fuentes Verificables */}
        <SourceCard />
      </main>
    </div>
  );
}
