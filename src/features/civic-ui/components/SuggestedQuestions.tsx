"use client";

interface SuggestedQuestionsProps {
  questions?: string[];
  onSelectQuestion?: (question: string) => void;
  title?: string;
}

const DEFAULT_QUESTIONS = [
  "¿Cómo participó la población de 18 a 29 años en 2024?",
  "Compara la participación de Nuevo León vs Ciudad de México",
  "¿Cuál ha sido la brecha histórica entre mujeres y hombres?",
];

export function SuggestedQuestions({
  questions = DEFAULT_QUESTIONS,
  onSelectQuestion,
  title = "Preguntas sugeridas para explorar con Paper",
}: SuggestedQuestionsProps) {
  return (
    <div className="civic-suggested-questions" role="region" aria-label={title}>
      {title ? (
        <span style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>
          {title}
        </span>
      ) : null}
      <div className="civic-suggested-chips">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            className="civic-question-chip"
            onClick={() => onSelectQuestion?.(q)}
          >
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
