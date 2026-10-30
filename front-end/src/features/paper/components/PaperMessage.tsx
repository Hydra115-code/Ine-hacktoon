import type { PaperGuidePresentation } from "../types/paper-state";

interface PaperMessageProps {
  className?: string;
  presentation: PaperGuidePresentation;
  announce?: boolean;
}

export function PaperMessage({ className = "", presentation, announce = true }: PaperMessageProps) {
  return (
    <div
      className={`paper-message ${className}`.trim()}
      data-paper-state={presentation.state}
      aria-atomic={announce || undefined}
      aria-live={announce ? presentation.announcement : undefined}
    >
      <h2>{presentation.title}</h2>
      <p>{presentation.detail}</p>
      {presentation.tip ? <small>{presentation.tip}</small> : null}
    </div>
  );
}
