"use client";

import { useId } from "react";
import type { PaperSuggestion } from "../types/paper-suggestion";
import { PaperAvatar } from "./PaperAvatar";

interface PaperSuggestionsProps {
  suggestions: readonly PaperSuggestion[];
  onSelect: (suggestion: PaperSuggestion) => void;
}

export function PaperSuggestions({ suggestions, onSelect }: PaperSuggestionsProps) {
  const titleId = useId();
  const descriptionId = useId();
  if (suggestions.length === 0) return null;

  return (
    <section className="paper-suggestions" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <header>
        <span className="paper-suggestions__avatar" aria-hidden="true">
          <PaperAvatar mood="pointing" size="sm" interactive={false} followPointer={false} />
        </span>
        <div>
          <span>Paper sugiere</span>
          <h3 id={titleId}>Puedes seguir explorando por aquí</h3>
        </div>
      </header>
      <ul>
        {suggestions.map((suggestion) => (
          <li key={suggestion.id}>
            <button type="button" onClick={() => onSelect(suggestion)}>
              <span>{suggestion.label}</span>
              <strong>{suggestion.title}</strong>
              <small>{suggestion.description}</small>
              <i aria-hidden="true">→</i>
            </button>
          </li>
        ))}
      </ul>
      <p id={descriptionId}>Paper prepara la pregunta; tú decides si la envías.</p>
    </section>
  );
}
