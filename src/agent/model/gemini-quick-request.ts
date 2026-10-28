import { type GeminiApiClient, GeminiModelError } from "./gemini-api-client.js";

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
    const content = await client.generateContent(body, controller.signal);
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
