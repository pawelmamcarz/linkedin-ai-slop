import type { IncomingMessage } from "node:http";

/** Ocen na IP w oknie. 0 wyłącza limit. */
export const DEFAULT_EVALUATE_RATE_LIMIT = 60;
export const DEFAULT_EVALUATE_RATE_WINDOW_MS = 60_000;

const buckets = new Map<string, number[]>();
const dailyBuckets = new Map<string, { day: string; count: number }>();

/** 0 = brak dobowego limitu. Publiczny hamulec to 60/min oraz cache werdyktów. */
export function dailyIpCap(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.EVALUATE_DAILY_IP_CAP?.trim();
  if (!raw) return 0;
  const cap = Number(raw);
  return Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 0;
}

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
  dailyBuckets.clear();
}

export function consumeDailySlot(
  ip: string,
  now = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): { allowed: boolean; cap: number; retryAfterSec: number } {
  const cap = dailyIpCap(env);
  if (cap <= 0) return { allowed: true, cap, retryAfterSec: 0 };

  const day = new Date(now).toISOString().slice(0, 10);
  const row = dailyBuckets.get(ip);
  const count = row && row.day === day ? row.count : 0;
  if (count >= cap) {
    const end = Date.parse(`${day}T00:00:00.000Z`) + 86_400_000;
    const retryAfterSec = Math.max(1, Math.ceil((end - now) / 1000));
    return { allowed: false, cap, retryAfterSec };
  }
  dailyBuckets.set(ip, { day, count: count + 1 });
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
