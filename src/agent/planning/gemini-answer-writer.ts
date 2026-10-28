import { logger } from "../../config/logger.js";
import { isCivicResponseSafe } from "../security/civic-scope-policy.js";
import { type GeminiApiClient, GeminiModelError } from "../model/gemini-api-client.js";
import { askGeminiText, geminiRequest } from "../model/gemini-quick-request.js";

export interface CivicAnswerWriter {
  rewrite(question: string, verifiedAnswer: string, signal?: AbortSignal): Promise<string>;
}

const MAX_ANSWER_LENGTH = 1_200;

export class GeminiAnswerWriter implements CivicAnswerWriter {
  private minimalThinkingSupported = true;

  constructor(
    private readonly client: GeminiApiClient,
    private readonly timeoutMs: number,
  ) {}

  async rewrite(question: string, verifiedAnswer: string, signal?: AbortSignal): Promise<string> {
    try {
      const text = await this.ask(
        geminiRequest(WRITER_INSTRUCTION, `Pregunta: ${question.slice(0, 600)}\nRespuesta verificada: ${verifiedAnswer}`, false),
        signal,
      );
      const rewritten = text.replace(/\s+/gu, " ").trim();
      if (rewritten.length > MAX_ANSWER_LENGTH || !keepsOnlyVerifiedNumbers(rewritten, verifiedAnswer) || !isCivicResponseSafe(rewritten)) {
        throw new Error("La redacción agregó o cambió cifras");
      }
      return rewritten;
    } catch (error) {
      if (signal?.aborted) throw error;
      logger.warn("Gemini no redactó a tiempo o cambió cifras; se usa la respuesta verificada", {
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return verifiedAnswer;
    }
  }

  private async ask(body: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    if (this.minimalThinkingSupported) {
      try {
        return await askGeminiText(this.client, withMinimalThinking(body), this.timeoutMs, signal);
      } catch (error) {
        if (!(error instanceof GeminiModelError) || !/HTTP 400\b/u.test(error.message)) throw error;
        this.minimalThinkingSupported = false;
      }
    }
    return askGeminiText(this.client, body, this.timeoutMs, signal);
  }
}

function withMinimalThinking(body: Record<string, unknown>): Record<string, unknown> {
  const generationConfig = (body.generationConfig ?? {}) as Record<string, unknown>;
  return { ...body, generationConfig: { ...generationConfig, thinkingConfig: { thinkingLevel: "minimal" } } };
}

function numbersIn(text: string): string[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/gu)].map((match) => match[0].replaceAll(",", ""));
}

function keepsOnlyVerifiedNumbers(rewritten: string, verified: string): boolean {
  const allowed = new Set(numbersIn(verified));
  return numbersIn(rewritten).every((value) => allowed.has(value));
}

const WRITER_INSTRUCTION = [
  "Eres Paper, un asistente ciudadano que explica datos públicos de participación electoral del INE.",
  "Reescribe la respuesta verificada en español claro y cercano, en máximo tres oraciones.",
  "Conserva exactamente las cifras, porcentajes, años, territorios y los pares «X de Y»; no agregues datos, causas, opiniones ni recomendaciones de voto.",
  "No digas que son personas concretas: son conteos agregados. Devuelve sólo el texto, sin formato.",
].join(" ");
