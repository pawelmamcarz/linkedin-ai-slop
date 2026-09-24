import type { IncomingMessage } from "node:http";
import type { Tier } from "./pro-tokens.ts";

/** Ocen na IP w oknie. 0 wyłącza limit. */
export const DEFAULT_EVALUATE_RATE_LIMIT = 60;
export const DEFAULT_EVALUATE_RATE_WINDOW_MS = 60_000;
/** Dobowy hamulec publicznego demo, gdy DEMO_MODE=1 i brak EVALUATE_DAILY_IP_CAP. */
export const DEFAULT_DEMO_DAILY_IP_CAP = 200;
/** Pro: wyższe okno minutowe i dobowe niż anonimowe demo. 0 w env wyłącza dany hamulec. */
export const DEFAULT_PRO_RATE_LIMIT = 300;
export const DEFAULT_PRO_DAILY_CAP = 2000;

export function demoMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.DEMO_MODE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

const buckets = new Map<string, number[]>();
const dailyBuckets = new Map<string, { day: string; count: number }>();

/** 0 = brak dobowego limitu. Jawne EVALUATE_DAILY_IP_CAP wygrywa z DEMO_MODE. */
export function dailyIpCap(env: NodeJS.ProcessEnv = process.env, tier: Tier = "demo"): number {
  if (tier === "pro") {
    const raw = env.PRO_DAILY_CAP?.trim();
    if (raw === undefined || raw === "") return DEFAULT_PRO_DAILY_CAP;
    const cap = Number(raw);
    return Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 0;
  }
  const raw = env.EVALUATE_DAILY_IP_CAP?.trim();
  if (raw) {
    const cap = Number(raw);
    return Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 0;
  }
  if (demoMode(env)) return DEFAULT_DEMO_DAILY_IP_CAP;
  return 0;
}

export function evaluateRateConfig(
  env: NodeJS.ProcessEnv = process.env,
  tier: Tier = "demo",
): {
  limit: number;
  windowMs: number;
} {
  const windowRaw = tier === "pro" ? env.PRO_RATE_WINDOW_MS ?? env.EVALUATE_RATE_WINDOW_MS : env.EVALUATE_RATE_WINDOW_MS;
  const windowMs =
    windowRaw === undefined || windowRaw.trim() === "" ? DEFAULT_EVALUATE_RATE_WINDOW_MS : Number(windowRaw);
  const safeWindow = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : DEFAULT_EVALUATE_RATE_WINDOW_MS;
  if (tier === "pro") {
    const limitRaw = env.PRO_RATE_LIMIT;
    const limit = limitRaw === undefined || limitRaw.trim() === "" ? DEFAULT_PRO_RATE_LIMIT : Number(limitRaw);
    return {
      limit: Number.isFinite(limit) ? limit : DEFAULT_PRO_RATE_LIMIT,
      windowMs: safeWindow,
    };
  }
  const limitRaw = env.EVALUATE_RATE_LIMIT;
  const limit = limitRaw === undefined || limitRaw.trim() === "" ? DEFAULT_EVALUATE_RATE_LIMIT : Number(limitRaw);
  return {
    limit: Number.isFinite(limit) ? limit : DEFAULT_EVALUATE_RATE_LIMIT,
    windowMs: safeWindow,
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
  dailyBuckets.clear();
}

export function consumeDailySlot(
  ip: string,
  now = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
  tier: Tier = "demo",
): { allowed: boolean; cap: number; retryAfterSec: number } {
  const cap = dailyIpCap(env, tier);
  const bucket = `${tier}:${ip}`;
  if (cap <= 0) return { allowed: true, cap, retryAfterSec: 0 };

  const day = new Date(now).toISOString().slice(0, 10);
  const row = dailyBuckets.get(bucket);
  const count = row && row.day === day ? row.count : 0;
  if (count >= cap) {
    const end = Date.parse(`${day}T00:00:00.000Z`) + 86_400_000;
    const retryAfterSec = Math.max(1, Math.ceil((end - now) / 1000));
    return { allowed: false, cap, retryAfterSec };
  }
  dailyBuckets.set(bucket, { day, count: count + 1 });
  if (dailyBuckets.size > 10_000) {
    for (const [key, value] of dailyBuckets) {
      if (value.day !== day) dailyBuckets.delete(key);
    }
  }
  return { allowed: true, cap, retryAfterSec: 0 };
}

export function consumeEvaluateSlot(
  ip: string,
  now = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
  tier: Tier = "demo",
): { allowed: boolean; retryAfterSec: number; limit: number; windowMs: number } {
  const { limit, windowMs } = evaluateRateConfig(env, tier);
  const bucket = `${tier}:${ip}`;
  if (limit <= 0) {
    return { allowed: true, retryAfterSec: 0, limit, windowMs };
  }

  const recent = (buckets.get(bucket) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    buckets.set(bucket, recent);
    return { allowed: false, retryAfterSec, limit, windowMs };
  }

  recent.push(now);
  buckets.set(bucket, recent);
  if (buckets.size > 10_000) {
    for (const [key, stamps] of buckets) {
      if (stamps.every((stamp) => now - stamp >= windowMs)) buckets.delete(key);
    }
  }
  return { allowed: true, retryAfterSec: 0, limit, windowMs };
}
