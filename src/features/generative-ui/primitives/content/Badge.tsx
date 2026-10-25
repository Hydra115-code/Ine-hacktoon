import type { BadgeNode } from "../../schemas/content-node";
import { semanticStateClass } from "./content-classes";
import { cleanGeneratedCopy } from "./clean-generated-copy";

type BadgeProps = Omit<BadgeNode, "type">;

export function Badge({ label, semanticState = "evidence.neutral", emphasis = "soft" }: BadgeProps) {
  return <span className={`ui-badge ui-badge--${emphasis} ${semanticStateClass(semanticState)}`}>{cleanGeneratedCopy(label)}</span>;
}
