import { it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../src/index.ts";
import { issueTrial } from "../src/trial-tokens.ts";
import { resetClient } from "../src/evaluate.ts";
it("activates only valid evaluate, persists HTTP access, and bounds private feedback", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-http-"));
  const old = { ...process.env };
  Object.assign(process.env, { TRIAL_TOKEN_FILE: join(dir, "trial.json"), FEEDBACK_FILE: join(dir, "feedback.jsonl"), TYPESAFE_API_KEY: "test-key", EVALUATE_RATE_LIMIT: "0", PRO_RATE_LIMIT: "0", PRO_DAILY_CAP: "0", LOG_TOKEN_USAGE: "0" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => String(input).includes("api.typesafe.ai") ? new Response(JSON.stringify({ model: "test", answers: { has_substance: { type: "noul", noul: 0.9 }, low_information: { type: "noul", noul: 0.1 } } }), { headers: { "Content-Type": "application/json" } }) : originalFetch(input, init)) as typeof fetch;
  resetClient();
  const server = await startServer(0, "127.0.0.1");
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const token = issueTrial("participant", process.env).token!;
  const headers = { "Content-Type": "application/json", "X-Pro-Token": token };
  const post = (path: string, body: unknown) => fetch(base + path, { method: "POST", headers, body: JSON.stringify(body) });
  try {
    assert.equal((await (await fetch(base + "/health", { headers })).json()).trial.status, "pending");
    assert.equal((await post("/evaluate", { postId: "x", text: {}, assessment: "content-v1" })).status, 400);
    assert.equal((await (await fetch(base + "/health", { headers })).json()).trial.status, "pending");
    const evaluated = await post("/evaluate", { postId: "x", text: "Shipped an importer with retry checkpoints", assessment: "content-v1" });
    assert.equal(evaluated.status, 200);
    assert.equal((await evaluated.json()).badge, "concrete");
    assert.equal((await (await fetch(base + "/health", { headers })).json()).trial.status, "active");
    const body = { submissionId: randomUUID(), assessment: "content-v1", badge: "concrete", reason: "Needs details" };
    assert.equal((await post("/feedback", body)).status, 201);
    assert.equal((await post("/feedback", body)).status, 200);
    assert.equal((await post("/feedback", { ...body, excerpt: "x".repeat(17000) })).status, 413);
    assert.equal(readFileSync(process.env.FEEDBACK_FILE!, "utf8").includes(token), false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    globalThis.fetch = originalFetch; process.env = old; resetClient(); rmSync(dir, { recursive: true });
  }
});
