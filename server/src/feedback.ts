import { existsSync, readFileSync } from "node:fs";
import { isValidProToken, tokenDigest } from "./pro-tokens.ts";
import { resolveTrial } from "./trial-tokens.ts";
import { writePrivateFile } from "./private-file.ts";
const RETENTION = 30 * 86400000;
type Feedback = { submissionId: string; assessment: "content-v1"; badge: string; reason: string; excerpt?: string; createdAt: number };
const limits = new Map<string, { start: number; count: number }>();
function validate(value: unknown): Omit<Feedback, "createdAt"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.submissionId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.submissionId)
    || v.assessment !== "content-v1" || !["concrete", "low_information", "uncertain"].includes(String(v.badge))
    || typeof v.reason !== "string" || !v.reason.trim() || v.reason.length > 1000
    || (v.excerpt !== undefined && (typeof v.excerpt !== "string" || v.excerpt.length > 6000))) return null;
  return { submissionId: v.submissionId, assessment: "content-v1", badge: String(v.badge), reason: v.reason.trim(), ...(v.excerpt ? { excerpt: String(v.excerpt) } : {}) };
}
function load(path: string): Feedback[] {
  if (!existsSync(path)) return [];
  const rows = readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  if (rows.some((r) => !validate(r) || !Number.isFinite(r.createdAt))) throw new Error("Invalid feedback storage");
  return rows;
}
function persist(path: string, rows: Feedback[]) { writePrivateFile(path, rows.map((r) => JSON.stringify(r) + "\n").join("")); }
export function pruneFeedback(env: NodeJS.ProcessEnv = process.env, now = Date.now()): void {
  const path = env.FEEDBACK_FILE?.trim();
  if (!path || !existsSync(path)) return;
  const rows = load(path);
  const keep = rows.filter((r) => r.createdAt > now - RETENTION);
  if (keep.length !== rows.length) persist(path, keep);
}
export function saveFeedback(value: unknown, token: string | null, env: NodeJS.ProcessEnv = process.env, now = Date.now()): { status: number; body: Record<string, unknown> } {
  const fail = (status: number, error: string) => ({ status, body: { error } });
  try {
    const trial = token?.startsWith("trial_") ? resolveTrial(token, { now, activate: false }, env) : null;
    const allowed = token && (trial ? trial.status === "pending" || trial.status === "active" || trial.status === "expired" && trial.expiresAt! > now - RETENTION : isValidProToken(token, env));
    if (!allowed) return fail(401, "unauthorized");
    const data = validate(value);
    if (!data) return fail(400, "invalid_feedback");
    const path = env.FEEDBACK_FILE?.trim();
    if (!path) return fail(503, "feedback_unavailable");
    const rows = load(path).filter((r) => r.createdAt > now - RETENTION);
    if (rows.some((r) => r.submissionId === data.submissionId)) return { status: 200, body: { saved: true } };
    const key = path + tokenDigest(token!);
    for (const [k, v] of limits) if (v.start + 3600000 <= now) limits.delete(k);
    const limit = limits.get(key) ?? { start: now, count: 0 };
    if (limit.count >= 10) return fail(429, "feedback_rate_limited");
    // Synchronous atomic replacement serializes writes within the single pilot process.
    persist(path, [...rows, { ...data, createdAt: now }]);
    limits.set(key, { start: limit.start, count: limit.count + 1 });
    return { status: 201, body: { saved: true } };
  } catch { return fail(503, "feedback_unavailable"); }
}
