"use client";

import { useRouter } from "next/navigation";
import { OnboardingModal } from "@/features/onboarding/components/OnboardingModal";
import { PaperAvatar } from "@/features/paper/components/PaperAvatar";
import { PublicNav } from "@/features/workspace/components/PublicNav";
import { useWorkspaceStore } from "@/features/workspace/state/workspace-store";
import {
  VERIFIED_STORY_AUDIENCE,
  VERIFIED_STORY_CHAPTERS,
  VERIFIED_STORY_MESSAGE,
  type VerifiedStoryChapter,
} from "../verified-story-journey";

function ChapterIcon({ chapter }: { chapter: VerifiedStoryChapter["id"] }) {
  if (chapter === "time") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-6" /></svg>;
  }
  if (chapter === "territory") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 6 5-2 6 3 5-2v13l-5 2-6-3-5 2V6Zm5-2v13m6-10v13" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5" /></svg>;
}

export function VerifiedStoryPage() {
  const router = useRouter();
  const setDraft = useWorkspaceStore((state) => state.setDraft);

  const openChapter = (chapter: VerifiedStoryChapter) => {
    setDraft(chapter.prompt);
    router.push("/conversar");
  };

  return (
    <div className="verified-story-shell">
      <PublicNav />
      <OnboardingModal />
      <main className="verified-story" id="main-content" tabIndex={-1}>
        <section className="verified-story__hero" aria-labelledby="verified-story-title">
          <div className="verified-story__copy">
            <span className="verified-story__sticker">Historia guiada con datos públicos</span>
            <p className="verified-story__overline">Participación ciudadana · CCPC 2009–2024</p>
            <h1 id="verified-story-title">Una cifra abre la pregunta. La evidencia cuenta la historia.</h1>
            <p className="verified-story__message">{VERIFIED_STORY_MESSAGE}</p>
            <div className="verified-story__audience">
              <strong>Hecha para</strong>
              <span>{VERIFIED_STORY_AUDIENCE}</span>
            </div>
            <button className="verified-story__primary-action" type="button" onClick={() => openChapter(VERIFIED_STORY_CHAPTERS[0])}>
              Comenzar por la evolución <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="verified-story__paper" aria-label="Paper presenta el recorrido">
            <span className="verified-story__paper-label">Paper propone un recorrido</span>
            <PaperAvatar mood="presenting" size="hero" interactive={false} followPointer={false} />
            <p>Primero observamos. Después comparamos. Al final comprobamos de dónde salió cada dato.</p>
          </div>
        </section>

        <section className="verified-story__chapters" aria-labelledby="verified-story-chapters-title">
          <header>
            <p>RECORRIDO VERIFICABLE</p>
            <h2 id="verified-story-chapters-title">Tres maneras de leer la participación</h2>
            <span>Cada capítulo consulta el release oficial conectado; esta página no anticipa resultados.</span>
          </header>
          <ol>
            {VERIFIED_STORY_CHAPTERS.map((chapter, index) => (
              <li key={chapter.id}>
                <button type="button" onClick={() => openChapter(chapter)} aria-label={`${chapter.eyebrow}: ${chapter.title}`}>
                  <span className="verified-story__chapter-number" aria-hidden="true">0{index + 1}</span>
                  <span className="verified-story__chapter-icon"><ChapterIcon chapter={chapter.id} /></span>
                  <span className="verified-story__chapter-copy">
                    <small>{chapter.eyebrow}</small>
                    <strong>{chapter.title}</strong>
                    <span>{chapter.description}</span>
                  </span>
                  <span className="verified-story__chapter-arrow" aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="verified-story__promise" aria-labelledby="verified-story-promise-title">
          <div>
            <p>PROMESA DE LECTURA</p>
            <h2 id="verified-story-promise-title">Claridad antes que espectáculo</h2>
          </div>
          <ul>
            <li>Las cifras aparecen sólo después de consultar la fuente conectada.</li>
            <li>Las comparaciones conservan periodo, territorio, universo y evidencia.</li>
            <li>Paper distingue lo observado de lo que los datos no permiten concluir.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
