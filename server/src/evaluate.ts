import { TypeSafeClient } from "@typesafe-ai/sdk";
import { JEV_MODEL, JEV_QUESTIONS, type JevPostState } from "../../jev/questions.ts";
import { DEFAULT_SLOP_THRESHOLD } from "../../jev/thresholds.ts";
import { mapAnswers, type EvaluateResult, type JevAnswers } from "./map-answers.ts";
import { normalizePostText } from "./verdict-cache.ts";

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

export type EvaluateMeta = {
  result: EvaluateResult;
  answers: JevAnswers;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export function buildState(input: EvaluateRequest): JevPostState {
  const text = normalizePostText(input.text);
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

function finiteToken(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function evaluateWithMeta(input: EvaluateRequest): Promise<EvaluateMeta> {
  const threshold = clampThreshold(input.threshold);
  const payload = buildSystemOnePayload(input);
  const result = await getClient().systemOne({
    model: payload.model,
    state: payload.state,
    questions: payload.questions,
  });
  const answers = result.answers as JevAnswers;
  const model = result.model ?? JEV_MODEL;
  return {
    result: mapAnswers(input.postId, model, answers, threshold),
    answers,
    model,
    inputTokens: finiteToken(result.usage?.input_tokens),
    outputTokens: finiteToken(result.usage?.output_tokens),
  };
}

export async function evaluatePost(input: EvaluateRequest): Promise<EvaluateResult> {
  return (await evaluateWithMeta(input)).result;
}

export function clampThreshold(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SLOP_THRESHOLD;
  return Math.min(0.95, Math.max(0.15, n));
}
