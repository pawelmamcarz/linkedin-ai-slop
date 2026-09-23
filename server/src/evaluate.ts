import { TypeSafeClient } from "@typesafe-ai/sdk";
import { JEV_MODEL, JEV_QUESTIONS, type JevPostState } from "../../jev/questions.ts";
import { DEFAULT_SLOP_THRESHOLD, MAX_TEXT_CHARS } from "../../jev/thresholds.ts";
import { mapAnswers, type EvaluateResult, type JevAnswers } from "./map-answers.ts";

export type EvaluateRequest = {
  postId: string;
  text: string;
  author?: string;
  threshold?: number;
};

let client: TypeSafeClient | null = null;

export function getClient(): TypeSafeClient {
  if (!client) {
    const apiKey = process.env.TYPESAFE_API_KEY?.trim();
    if (!apiKey) {
      throw new MissingApiKeyError();
    }
    client = new TypeSafeClient({
      apiKey,
      defaultModel: JEV_MODEL,
      timeout: 20_000,
    });
  }
  return client;
}

export function resetClient(): void {
  client = null;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("Brak TYPESAFE_API_KEY. Ustaw klucz w server/.env — nigdy w rozszerzeniu.");
    this.name = "MissingApiKeyError";
  }
}

export function buildState(input: EvaluateRequest): JevPostState {
  const text = input.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
  return {
    platform: "linkedin",
    author: input.author?.trim() ? input.author.trim().slice(0, 200) : null,
    post_text: text,
  };
}

export function buildSystemOnePayload(input: EvaluateRequest) {
  return {
    model: JEV_MODEL,
    state: buildState(input),
    questions: JEV_QUESTIONS,
  };
}

export async function evaluatePost(input: EvaluateRequest): Promise<EvaluateResult> {
  const threshold = clampThreshold(input.threshold);
  const payload = buildSystemOnePayload(input);
  const result = await getClient().systemOne({
    model: payload.model,
    state: payload.state,
    questions: payload.questions,
  });
  return mapAnswers(
    input.postId,
    result.model ?? JEV_MODEL,
    result.answers as JevAnswers,
    threshold,
  );
}

export function clampThreshold(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SLOP_THRESHOLD;
  return Math.min(0.95, Math.max(0.15, n));
}
