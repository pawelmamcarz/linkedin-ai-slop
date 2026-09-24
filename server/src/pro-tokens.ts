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

export function issueProToken(customerId: string, env: NodeJS.ProcessEnv = process.env): { token: string; created: boolean } {
  loadIssued(env);
  const existing = issuedByCustomer.get(customerId);
  if (existing?.status === "active") return { token: existing.token, created: false };
  const token = `pro_${randomBytes(24).toString("hex")}`;
  issuedByCustomer.set(customerId, {
    customerId,
    token,
    digest: tokenDigest(token),
    status: "active",
  });
  persistIssued(env);
  return { token, created: true };
}

export function revokeProToken(customerId: string, env: NodeJS.ProcessEnv = process.env): boolean {
  loadIssued(env);
  const existing = issuedByCustomer.get(customerId);
  if (!existing || existing.status === "revoked") return false;
  existing.status = "revoked";
  issuedByCustomer.set(customerId, existing);
  persistIssued(env);
  return true;
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
