import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { IncomingMessage } from "node:http";

export type Tier = "demo" | "pro";

type IssuedToken = {
  customerId: string;
  token: string;
  digest: string;
  status: "active" | "revoked";
  kind?: "subscription" | "lifetime";
  plan?: string;
  seat?: number;
  subscriptionId?: string;
};

const issuedByCustomer = new Map<string, IssuedToken>();
let loadedFile = "";

export function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function digestsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** PRO_TOKENS: plain tokens or sha256:<hex>, comma-separated. Plain values are hashed at read. */
export function configuredDigests(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.PRO_TOKENS ?? "";
  const digests: string[] = [];
  for (const part of raw.split(",")) {
    const item = part.trim();
    if (!item) continue;
    if (item.toLowerCase().startsWith("sha256:")) {
      const hex = item.slice(7).trim().toLowerCase();
      if (/^[0-9a-f]{64}$/.test(hex)) digests.push(hex);
      continue;
    }
    digests.push(tokenDigest(item));
  }
  return digests;
}

function tokenFile(env: NodeJS.ProcessEnv): string {
  return env.PRO_TOKEN_FILE?.trim() ?? "";
}

export function resetProTokens(): void {
  issuedByCustomer.clear();
  loadedFile = "";
}

function loadIssued(env: NodeJS.ProcessEnv): void {
  const path = tokenFile(env);
  if (!path || path === loadedFile) return;
  loadedFile = path;
  issuedByCustomer.clear();
  if (!existsSync(path)) return;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { tokens?: IssuedToken[] };
    for (const row of parsed.tokens ?? []) {
      if (!row?.customerId || !row.token || !row.digest) continue;
      issuedByCustomer.set(row.customerId, {
        customerId: row.customerId,
        token: row.token,
        digest: row.digest,
        status: row.status === "revoked" ? "revoked" : "active",
      });
    }
  } catch (error) {
    console.error("[proxy] pro_token_file_unreadable", error instanceof Error ? error.name : "error");
  }
}

function persistIssued(env: NodeJS.ProcessEnv): void {
  const path = tokenFile(env);
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  const tokens = [...issuedByCustomer.values()];
  writeFileSync(path, JSON.stringify({ tokens }, null, 2));
  loadedFile = path;
}

export function issuedTokenForCustomer(customerId: string, env: NodeJS.ProcessEnv = process.env): string | null {
  loadIssued(env);
  const row = issuedByCustomer.get(customerId);
  if (!row || row.status !== "active") return null;
  return row.token;
}

function mintToken(customerId: string, extra: Partial<IssuedToken> = {}): IssuedToken {
  const token = `pro_${randomBytes(24).toString("hex")}`;
  return {
    customerId,
    token,
    digest: tokenDigest(token),
    status: "active",
    ...extra,
  };
}

export function issueProToken(customerId: string, env: NodeJS.ProcessEnv = process.env): { token: string; created: boolean } {
  loadIssued(env);
  const existing = issuedByCustomer.get(customerId);
  if (existing?.status === "active") return { token: existing.token, created: false };
  const row = mintToken(customerId, { kind: "subscription", plan: existing?.plan ?? "pro" });
  issuedByCustomer.set(customerId, row);
  persistIssued(env);
  return { token: row.token, created: true };
}

/** One-time Lifetime Pro. Not revoked by subscription events. */
export function issueLifetimeToken(customerId: string, env: NodeJS.ProcessEnv = process.env): { token: string; created: boolean } {
  loadIssued(env);
  const key = `${customerId}#lifetime`;
  const existing = issuedByCustomer.get(key);
  if (existing?.status === "active") return { token: existing.token, created: false };
  const row = mintToken(customerId, { kind: "lifetime", plan: "lifetime" });
  issuedByCustomer.set(key, row);
  persistIssued(env);
  return { token: row.token, created: true };
}

export function lifetimeSoldCount(env: NodeJS.ProcessEnv = process.env): number {
  loadIssued(env);
  let sold = 0;
  for (const row of issuedByCustomer.values()) {
    if (row.kind === "lifetime" || row.plan === "lifetime") sold += 1;
  }
  return sold;
}

/** Ten (or TEAM_SEATS) distinct Pro tokens for one Stripe customer. Idempotent. */
export function issueTeamTokens(
  customerId: string,
  seats: number,
  env: NodeJS.ProcessEnv = process.env,
  subscriptionId?: string,
): { tokens: string[]; created: boolean } {
  loadIssued(env);
  const count = Math.max(1, Math.floor(seats));
  const existing = [...issuedByCustomer.entries()].filter(([, row]) => row.customerId === customerId && row.plan === "team");
  const active = existing.filter(([, row]) => row.status === "active");
  if (active.length >= count) {
    return { tokens: active.slice(0, count).map(([, row]) => row.token), created: false };
  }
  let created = false;
  const chosen: IssuedToken[] = active.map(([, row]) => row);
  for (const [key, row] of existing) {
    if (chosen.length >= count) break;
    if (row.status !== "revoked") continue;
    row.status = "active";
    if (subscriptionId) row.subscriptionId = subscriptionId;
    issuedByCustomer.set(key, row);
    chosen.push(row);
    created = true;
  }
  let seat = existing.reduce((max, [, row]) => Math.max(max, row.seat ?? 0), 0);
  while (chosen.length < count) {
    seat += 1;
    const row = mintToken(customerId, {
      kind: "subscription",
      plan: "team",
      seat,
      subscriptionId,
    });
    issuedByCustomer.set(`${customerId}#team:${seat}`, row);
    chosen.push(row);
    created = true;
  }
  if (created) persistIssued(env);
  return { tokens: chosen.map((row) => row.token), created };
}

export function activeTokensForCustomer(customerId: string, env: NodeJS.ProcessEnv = process.env): string[] {
  loadIssued(env);
  const tokens: string[] = [];
  for (const row of issuedByCustomer.values()) {
    if (row.customerId === customerId && row.status === "active") tokens.push(row.token);
  }
  return tokens;
}

export function revokeProToken(customerId: string, env: NodeJS.ProcessEnv = process.env): boolean {
  loadIssued(env);
  let changed = false;
  for (const [key, row] of issuedByCustomer) {
    if (row.customerId !== customerId) continue;
    if (row.kind === "lifetime" || row.plan === "lifetime") continue;
    if (row.status === "revoked") continue;
    row.status = "revoked";
    issuedByCustomer.set(key, row);
    changed = true;
  }
  if (changed) persistIssued(env);
  return changed;
}

export function isValidProToken(token: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const presented = token.trim();
  if (!presented) return false;
  const digest = tokenDigest(presented);
  for (const configured of configuredDigests(env)) {
    if (digestsEqual(digest, configured)) return true;
  }
  loadIssued(env);
  for (const row of issuedByCustomer.values()) {
    if (row.status === "active" && digestsEqual(digest, row.digest)) return true;
  }
  return false;
}

export function readPresentedToken(req: IncomingMessage): string | null {
  const header = req.headers["x-pro-token"];
  const direct = (Array.isArray(header) ? header[0] : header)?.trim();
  if (direct) return direct;
  const authorization = req.headers.authorization;
  const value = (Array.isArray(authorization) ? authorization[0] : authorization)?.trim() ?? "";
  const match = /^Bearer\s+(\S+)/i.exec(value);
  return match?.[1] ?? null;
}

export function resolveTier(token: string | null, env: NodeJS.ProcessEnv = process.env): Tier | "invalid" {
  if (!token) return "demo";
  return isValidProToken(token, env) ? "pro" : "invalid";
}
