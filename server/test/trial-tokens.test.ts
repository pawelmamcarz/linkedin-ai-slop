import { it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { issueTrial, resolveTrial } from "../src/trial-tokens.ts";
it("starts on evaluation once, expires exactly at 14 days and persists without plaintext", () => {
  const dir = mkdtempSync(join(tmpdir(), "trial-"));
  const env = { TRIAL_TOKEN_FILE: join(dir, "trial.json") };
  try {
    const { token } = issueTrial("participant-1", env);
    assert.ok(token);
    assert.equal(issueTrial("participant-1", env).created, false);
    assert.equal(resolveTrial(token!, { now: 1000, activate: false }, env).status, "pending");
    assert.equal(resolveTrial(token!, { now: 1000, activate: true }, env).expiresAt, 1209601000);
    assert.equal(resolveTrial(token!, { now: 2000, activate: true }, env).expiresAt, 1209601000);
    assert.equal(resolveTrial(token!, { now: 1209601000, activate: true }, env).status, "expired");
    assert.equal(resolveTrial(token!, { now: 1209601000, activate: false }, env).expiresAt, 1209601000);
    assert.equal(resolveTrial("trial_wrong", { now: 1, activate: true }, env).status, "invalid");
    assert.equal(readFileSync(env.TRIAL_TOKEN_FILE, "utf8").includes(token!), false);
  } finally { rmSync(dir, { recursive: true }); }
});
it("refuses to mint trials without persistent storage", () => {
  assert.throws(() => issueTrial("participant", {}));
});
