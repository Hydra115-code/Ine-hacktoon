import { z } from "zod";

export const semanticColorTokens = [
  "trend.increase",
  "trend.decrease",
  "evidence.neutral",
  "evidence.caution",
  "surface.primary",
  "surface.secondary",
  "surface.elevated",
  "text.primary",
  "text.secondary",
  "text.muted",
  "border.subtle",
  "border.strong",
  "status.success",
  "status.warning",
  "status.error",
  "status.info",
] as const;

export const semanticColorTokenSchema = z.enum(semanticColorTokens);

export type SemanticColorToken = z.infer<typeof semanticColorTokenSchema>;

export function resolveSemanticColor(input: unknown): string | null {
  const result = semanticColorTokenSchema.safeParse(input);

  if (!result.success) {
    return null;
  }

  return `var(--color-${result.data.replace(".", "-")})`;
}
