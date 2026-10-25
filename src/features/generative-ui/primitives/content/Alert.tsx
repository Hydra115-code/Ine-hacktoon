import type { AlertNode } from "../../schemas/content-node";
import { semanticStateClass } from "./content-classes";
import { cleanGeneratedCopy } from "./clean-generated-copy";

type AlertProps = Omit<AlertNode, "type">;

export function Alert({ title, message, semanticState = "status.info" }: AlertProps) {
  return (
    <div
      aria-live={semanticState === "status.error" ? "assertive" : "polite"}
      className={`ui-alert ${semanticStateClass(semanticState)}`}
      role={semanticState === "status.error" ? "alert" : "status"}
    >
      <span aria-hidden="true" className="ui-alert__signal" />
      <div>
        {title ? <p className="ui-alert__title">{cleanGeneratedCopy(title)}</p> : null}
        <p className="ui-alert__message">{cleanGeneratedCopy(message)}</p>
      </div>
    </div>
  );
}
