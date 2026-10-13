import { it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { issueLifetimeToken, issueTeamTokens, resetProTokens, lifetimeSoldCount, revokeProToken, isValidProToken } from "../src/pro-tokens.ts";
it("preserves lifetime and team identities across restart and subscription revocation", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-"));
  const env = { PRO_TOKEN_FILE: join(dir, "tokens.json") };
  try {
    resetProTokens();
    const life = issueLifetimeToken("customer", env).token;
    const team = issueTeamTokens("customer", 2, env, "sub_1").tokens;
    resetProTokens();
    assert.equal(lifetimeSoldCount(env), 1);
    assert.equal(issueLifetimeToken("customer", env).token, life);
    assert.deepEqual(issueTeamTokens("customer", 2, env, "sub_1").tokens, team);
    revokeProToken("customer", env);
    assert.equal(isValidProToken(life, env), true);
    assert.equal(isValidProToken(team[0], env), false);
  } finally { resetProTokens(); rmSync(dir, { recursive: true }); }
});
it("never overwrites an unreadable token file", () => {
  const dir = mkdtempSync(join(tmpdir(), "tokens-"));
  const env = { PRO_TOKEN_FILE: join(dir, "tokens.json") };
  writeFileSync(env.PRO_TOKEN_FILE, "broken");
  try {
    resetProTokens();
    assert.throws(() => issueLifetimeToken("customer", env));
    assert.equal(readFileSync(env.PRO_TOKEN_FILE, "utf8"), "broken");
  } finally { resetProTokens(); rmSync(dir, { recursive: true }); }
});
