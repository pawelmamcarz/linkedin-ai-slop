import { createHash } from "node:crypto";
import { MAX_TEXT_CHARS } from "../../jev/thresholds.ts";
import { mapAnswers, type EvaluateResult, type JevAnswers } from "./map-answers.ts";

/**
 * Pamięć podręczna werdyktów publicznego proxy.
 *
 * Klucz: SHA-256 znormalizowanego tekstu (trim, zbite białe znaki, obcięcie do
 * MAX_TEXT_CHARS). Autor i postId nie wchodzą do klucza. Próg jest nakładany
 * przy odczycie, więc trafienie nie woła TypeSafe.
 *
 * Zmienne:
 * - VERDICT_CACHE=0 wyłącza cache (domyślnie włączony)
 * - VERDICT_CACHE_TTL_MS czas życia wpisu w ms (domyślnie 12 h)
 * - VERDICT_CACHE_MAX maksymalna liczba wpisów (domyślnie 2000); nadmiar usuwa najstarsze
 * - LOG_TOKEN_USAGE=0 wyłącza log zużycia tokenów (domyślnie włączony, =1 też włącza)
 *
 * Log nie zawiera treści posta ani klucza API.
 */

export const DEFAULT_VERDICT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const DEFAULT_VERDICT_CACHE_MAX = 2000;

export type CachedVerdict = {
  model: string;
  answers: JevAnswers;
  inputTokens: number | null;
  outputTokens: number | null;
  expiresAt: number;
};

type CacheConfig = {
  enabled: boolean;
  ttlMs: number;
  max: number;
};

const entries = new Map<string, CachedVerdict>();
const stats = { hits: 0, misses: 0 };

export function normalizePostText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}

export function verdictCacheKey(text: string): string {
  return createHash("sha256").update(normalizePostText(text)).digest("hex");
}

export function verdictCacheConfig(env: NodeJS.ProcessEnv = process.env): CacheConfig {
  const disabled = env.VERDICT_CACHE?.trim() === "0";
  const ttlRaw = env.VERDICT_CACHE_TTL_MS?.trim();
  const maxRaw = env.VERDICT_CACHE_MAX?.trim();
  const ttlParsed = ttlRaw ? Number(ttlRaw) : DEFAULT_VERDICT_CACHE_TTL_MS;
  const maxParsed = maxRaw ? Number(maxRaw) : DEFAULT_VERDICT_CACHE_MAX;
  const ttlMs = Number.isFinite(ttlParsed) && ttlParsed > 0 ? ttlParsed : DEFAULT_VERDICT_CACHE_TTL_MS;
  const max = Number.isFinite(maxParsed) && maxParsed > 0 ? Math.floor(maxParsed) : DEFAULT_VERDICT_CACHE_MAX;
  return { enabled: !disabled && ttlMs > 0 && max > 0, ttlMs, max };
}

export function resetVerdictCache(): void {
  entries.clear();
  stats.hits = 0;
  stats.misses = 0;
}

export function verdictCacheStats(env: NodeJS.ProcessEnv = process.env): {
  enabled: boolean;
  entries: number;
  max: number;
  ttlMs: number;
  hits: number;
  misses: number;
  hitRate: number | null;
} {
  const config = verdictCacheConfig(env);
  const total = stats.hits + stats.misses;
  return {
    enabled: config.enabled,
    entries: entries.size,
    max: config.max,
    ttlMs: config.ttlMs,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: total === 0 ? null : Math.round((stats.hits / total) * 1000) / 1000,
  };
}

export function readVerdict(text: string, now = Date.now(), env: NodeJS.ProcessEnv = process.env): CachedVerdict | null {
  const config = verdictCacheConfig(env);
  if (!config.enabled) {
    stats.misses += 1;
    return null;
  }
  const key = verdictCacheKey(text);
  const hit = entries.get(key);
  if (!hit) {
    stats.misses += 1;
    return null;
  }
  if (hit.expiresAt <= now) {
    entries.delete(key);
    stats.misses += 1;
    return null;
  }
  entries.delete(key);
  entries.set(key, hit);
  stats.hits += 1;
  return hit;
}

export function storeVerdict(
  text: string,
  value: Omit<CachedVerdict, "expiresAt">,
  now = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): void {
  const config = verdictCacheConfig(env);
  if (!config.enabled) return;
  const key = verdictCacheKey(text);
  entries.delete(key);
  entries.set(key, { ...value, expiresAt: now + config.ttlMs });
  while (entries.size > config.max) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

export function verdictFromCache(
  postId: string,
  cached: CachedVerdict,
  threshold: number,
): EvaluateResult {
  return mapAnswers(postId, cached.model, cached.answers, threshold);
}

export function tokenLogEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LOG_TOKEN_USAGE?.trim() !== "0";
}

/** Structured log for Railway. Never includes post text or API keys. */
export function logTokenUsage(fields: {
  cache: "HIT" | "MISS";
  inputTokens: number | null;
  outputTokens: number | null;
  model: string;
  textChars: number;
}): void {
  if (!tokenLogEnabled()) return;
  console.log(
    JSON.stringify({
      event: "evaluate",
      cache: fields.cache,
      input_tokens: fields.inputTokens,
      output_tokens: fields.outputTokens,
      model: fields.model,
      text_chars: fields.textChars,
    }),
  );
}
