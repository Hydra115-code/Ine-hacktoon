import type { PaperInteractionReaction } from "../types/paper-interaction";

interface PaperReactionProps {
  reaction: PaperInteractionReaction;
  onDismiss: () => void;
}

export function PaperReaction({ reaction, onDismiss }: PaperReactionProps) {
  return (
    <aside
      className="canvas-paper-reaction"
      data-reaction-kind={reaction.kind}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span>Paper observa</span>
      <p>{reaction.message}</p>
      <button type="button" onClick={onDismiss} aria-label="Cerrar comentario de Paper">×</button>
    </aside>
  );
}
