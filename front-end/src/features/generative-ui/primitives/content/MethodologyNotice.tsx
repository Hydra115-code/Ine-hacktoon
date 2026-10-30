"use client";

import { useInteractionEvent } from "../../interactions/events/UIEventProvider";
import { cleanGeneratedCopy } from "./clean-generated-copy";

interface MethodologyNoticeProps {
  children: string;
  caveats?: readonly string[];
  id?: string;
  title?: string;
}

export function MethodologyNotice({ children, caveats = [], id = "methodology", title = "Cómo se calculó" }: MethodologyNoticeProps) {
  const emitOpened = useInteractionEvent(id, "methodology.opened");
  return (
    <details
      className="ui-evidence-notice ui-evidence-notice--methodology"
      onToggle={(event) => {
        if (event.currentTarget.open) emitOpened(true);
      }}
    >
      <summary>{cleanGeneratedCopy(title)}</summary>
      <p>{cleanGeneratedCopy(children)}</p>
      {caveats.length > 0 ? (
        <ul aria-label="Advertencias metodológicas">
          {caveats.map((caveat) => <li key={caveat}>{cleanGeneratedCopy(caveat)}</li>)}
        </ul>
      ) : null}
    </details>
  );
}
