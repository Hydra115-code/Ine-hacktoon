import type { FlexNode } from "../../schemas/layout-node";
import { variantClass, type LayoutPrimitiveProps } from "./layout-classes";

type FlexProps = LayoutPrimitiveProps & Pick<FlexNode, "direction" | "wrap" | "justify" | "align" | "gap">;

export function Flex({
  children,
  direction = "row",
  wrap = "wrap",
  justify = "start",
  align,
  gap = "md",
}: FlexProps) {
  const resolvedAlign = align ?? (direction === "column" ? "stretch" : "center");

  return (
    <div className={`ui-flex ${variantClass("ui-flex", "direction", direction)} ${variantClass("ui-flex", "wrap", wrap)} ${variantClass("ui", "justify", justify)} ${variantClass("ui", "align", resolvedAlign)} ${variantClass("ui", "gap", gap)}`}>
      {children}
    </div>
  );
}
