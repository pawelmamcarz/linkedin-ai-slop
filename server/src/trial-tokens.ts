import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tokenDigest } from "./pro-tokens.ts";
import { writePrivateFile } from "./private-file.ts";
type Trial = { participantId: string; digest: string; activatedAt: number | null; expiresAt: number | null };
const DURATION = 14 * 24 * 60 * 60 * 1000;
function load(env: NodeJS.ProcessEnv): { path: string; rows: Trial[] } {
  const path = env.TRIAL_TOKEN_FILE?.trim();
  if (!path) throw new Error("TRIAL_TOKEN_FILE must name persistent private storage");
  const rows: Trial[] = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).tokens : [];
  if (!Array.isArray(rows) || rows.some((r) => !r.participantId || !/^[a-f0-9]{64}$/.test(r.digest) ||
    !(r.activatedAt === null && r.expiresAt === null || Number.isFinite(r.activatedAt) && r.expiresAt === r.activatedAt! + DURATION)) ||
    new Set(rows.map((r) => r.participantId)).size !== rows.length || new Set(rows.map((r) => r.digest)).size !== rows.length) throw new Error("Invalid trial registry");
  return { path, rows };
}
export function issueTrial(participantId: string, env: NodeJS.ProcessEnv = process.env): { token: string | null; created: boolean } {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(participantId)) throw new Error("Use an anonymous participant ID");
  const { path, rows } = load(env);
  if (rows.some((r) => r.participantId === participantId)) return { token: null, created: false };
  const token = `trial_${randomBytes(24).toString("hex")}`;
  rows.push({ participantId, digest: tokenDigest(token), activatedAt: null, expiresAt: null });
  writePrivateFile(path, JSON.stringify({ version: 1, tokens: rows }));
  return { token, created: true };
}
export function resolveTrial(token: string, options: { activate: boolean; now: number }, env: NodeJS.ProcessEnv = process.env): { status: "pending" | "active" | "expired" | "invalid"; expiresAt: number | null } {
  if (!token.startsWith("trial_") || !env.TRIAL_TOKEN_FILE) return { status: "invalid", expiresAt: null };
  const { path, rows } = load(env);
  const row = rows.find((r) => r.digest === tokenDigest(token));
  if (!row) return { status: "invalid", expiresAt: null };
  if (row.activatedAt === null && options.activate) {
    row.activatedAt = options.now;
    row.expiresAt = options.now + DURATION;
    writePrivateFile(path, JSON.stringify({ version: 1, tokens: rows }));
  }
  return { status: row.expiresAt === null ? "pending" : row.expiresAt <= options.now ? "expired" : "active", expiresAt: row.expiresAt };
}
