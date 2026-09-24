import type { IncomingMessage } from "node:http";

/** Ocen na IP w oknie. 0 wyłącza limit. */
export const DEFAULT_EVALUATE_RATE_LIMIT = 60;
export const DEFAULT_EVALUATE_RATE_WINDOW_MS = 60_000;

const buckets = new Map<string, number[]>();

export function evaluateRateConfig(env: NodeJS.ProcessEnv = process.env): {
  limit: number;
  windowMs: number;
} {
  const limitRaw = env.EVALUATE_RATE_LIMIT;
  const windowRaw = env.EVALUATE_RATE_WINDOW_MS;
  const limit = limitRaw === undefined || limitRaw.trim() === "" ? DEFAULT_EVALUATE_RATE_LIMIT : Number(limitRaw);
  const windowMs =
    windowRaw === undefined || windowRaw.trim() === "" ? DEFAULT_EVALUATE_RATE_WINDOW_MS : Number(windowRaw);
  return {
    limit: Number.isFinite(limit) ? limit : DEFAULT_EVALUATE_RATE_LIMIT,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : DEFAULT_EVALUATE_RATE_WINDOW_MS,
  };
}

/**
 * Railway dopisuje klienta w X-Forwarded-For. Bez tego socket to adres proxy
 * platformy i wszyscy dzielą jeden kubełek. TRUST_PROXY=0 ignoruje nagłówek
 * (gdy proces wisi wprost w sieci i nagłówek da się podrobić).
 */
export function clientIp(req: IncomingMessage, env: NodeJS.ProcessEnv = process.env): string {
  if (env.TRUST_PROXY !== "0") {
    const forwarded = req.headers["x-forwarded-for"];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = raw?.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  return req.socket.remoteAddress || "unknown";
}

export function resetRateLimit(): void {
  buckets.clear();
}

export function consumeEvaluateSlot(
  ip: string,
  now = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): { allowed: boolean; retryAfterSec: number; limit: number; windowMs: number } {
  const { limit, windowMs } = evaluateRateConfig(env);
  if (limit <= 0) {
    return { allowed: true, retryAfterSec: 0, limit, windowMs };
  }

  const recent = (buckets.get(ip) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    buckets.set(ip, recent);
    return { allowed: false, retryAfterSec, limit, windowMs };
  }

  recent.push(now);
  buckets.set(ip, recent);
  if (buckets.size > 10_000) {
    for (const [key, stamps] of buckets) {
      if (stamps.every((stamp) => now - stamp >= windowMs)) buckets.delete(key);
    }
  }
  return { allowed: true, retryAfterSec: 0, limit, windowMs };
}
