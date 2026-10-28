import { type GeminiApiClient, GeminiModelError } from "./gemini-api-client.js";

const THINKING_OPTIONS: Array<Record<string, unknown> | undefined> = [
  { thinkingBudget: 0 },
  { thinkingLevel: "low" },
  undefined,
];
const acceptedThinking = new Map<string, number>();

export async function askGeminiText(
  client: GeminiApiClient,
  body: Record<string, unknown>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    const content = await generateWithLightThinking(client, body, controller.signal);
    const text = content.parts
      .filter((part) => typeof part.text === "string" && (part as { thought?: unknown }).thought !== true)
      .map((part) => part.text)
      .join("")
      .trim();
    if (!text) throw new GeminiModelError("Gemini no devolvió texto");
    return text;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

async function generateWithLightThinking(client: GeminiApiClient, body: Record<string, unknown>, signal: AbortSignal) {
  for (let index = acceptedThinking.get(client.model) ?? 0; ; index += 1) {
    const thinking = THINKING_OPTIONS[index];
    try {
      const content = await client.generateContent(withThinking(body, thinking), signal);
      acceptedThinking.set(client.model, index);
      return content;
    } catch (error) {
      const rejected = error instanceof GeminiModelError && /HTTP 400\b/u.test(error.message);
      if (!rejected || thinking === undefined) throw error;
      acceptedThinking.set(client.model, index + 1);
    }
  }
}

function withThinking(body: Record<string, unknown>, thinking: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!thinking) return body;
  const generationConfig = (body.generationConfig ?? {}) as Record<string, unknown>;
  return { ...body, generationConfig: { ...generationConfig, thinkingConfig: thinking } };
}

export function parseGeminiJson(text: string): unknown {
  const unfenced = text.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  return JSON.parse(unfenced) as unknown;
}

export function geminiRequest(systemInstruction: string, userText: string, json: boolean): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };
}
