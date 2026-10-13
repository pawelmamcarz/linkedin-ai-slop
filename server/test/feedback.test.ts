import { it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { saveFeedback, pruneFeedback } from "../src/feedback.ts";
it("saves once, excludes credentials, enforces limits and removes expired records", () => {
  const dir = mkdtempSync(join(tmpdir(), "feedback-"));
  const env = { FEEDBACK_FILE: join(dir, "feedback.jsonl"), PRO_TOKENS: "test-secret" };
  const body = { submissionId: randomUUID(), assessment: "content-v1", badge: "uncertain", reason: "Wrong", excerpt: "<script>hi</script>" };
  try {
    assert.equal(saveFeedback(body, null, env, 1000).status, 401);
    assert.equal(saveFeedback(body, "test-secret", env, 1000).status, 201);
    assert.equal(saveFeedback(body, "test-secret", env, 1000).status, 200);
    assert.equal(readFileSync(env.FEEDBACK_FILE, "utf8").includes("test-secret"), false);
    assert.equal(saveFeedback({ ...body, submissionId: randomUUID(), reason: "" }, "test-secret", env, 1000).status, 400);
    for (let i = 0; i < 9; i++) assert.equal(saveFeedback({ ...body, submissionId: randomUUID() }, "test-secret", env, 1000).status, 201);
    assert.equal(saveFeedback({ ...body, submissionId: randomUUID() }, "test-secret", env, 1000).status, 429);
    pruneFeedback(env, 1000 + 31 * 86400000);
    assert.equal(readFileSync(env.FEEDBACK_FILE, "utf8"), "");
  } finally { rmSync(dir, { recursive: true }); }
});
it("fails closed on broken storage", () => {
  const dir = mkdtempSync(join(tmpdir(), "feedback-"));
  const env = { FEEDBACK_FILE: join(dir, "feedback.jsonl"), PRO_TOKENS: "test-secret" };
  writeFileSync(env.FEEDBACK_FILE, "broken");
  try {
    const response = saveFeedback({ submissionId: randomUUID(), assessment: "content-v1", badge: "concrete", reason: "Wrong" }, "test-secret", env);
    assert.equal(response.status, 503);
    assert.equal(readFileSync(env.FEEDBACK_FILE, "utf8"), "broken");
  } finally { rmSync(dir, { recursive: true }); }
});

it("rejects changed content under an existing submission ID without overwriting it", () => {
  const dir = mkdtempSync(join(tmpdir(), "feedback-conflict-"));
  const env = { FEEDBACK_FILE: join(dir, "feedback.jsonl"), PRO_TOKENS: "test-secret" };
  const body = { submissionId: randomUUID(), assessment: "content-v1", badge: "concrete", reason: "Original", excerpt: "User text" };
  try {
    assert.equal(saveFeedback(body, "test-secret", env).status, 201);
    const original = readFileSync(env.FEEDBACK_FILE, "utf8");
    for (const change of [{ reason: "Edited" }, { badge: "uncertain" }, { excerpt: "Edited excerpt" }, { excerpt: undefined }]) {
      const result = saveFeedback({ ...body, ...change }, "test-secret", env);
      assert.deepEqual(result, { status: 409, body: { error: "feedback_conflict" } });
      assert.equal(readFileSync(env.FEEDBACK_FILE, "utf8"), original);
    }
    assert.equal(saveFeedback({ ...body, reason: " Original " }, "test-secret", env).status, 200);
  } finally { rmSync(dir, { recursive: true }); }
});
