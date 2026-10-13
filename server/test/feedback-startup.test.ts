import { it, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createProxyServer } from "../src/index.ts";
import { resetClient } from "../src/evaluate.ts";

for (const failure of ["invalid", "unreadable", "write"] as const) {
  it(`isolates ${failure} feedback retention failure from health, paid evaluation and billing`, async () => {
    const dir = fs.mkdtempSync(join(tmpdir(), "feedback-startup-"));
    const path = join(dir, "feedback.jsonl");
    const old = { ...process.env };
    const originalFetch = globalThis.fetch;
    const logs: unknown[][] = [];
    const logger = mock.method(console, "error", (...args: unknown[]) => logs.push(args));
    let server: Server | undefined;
    let rename: ReturnType<typeof mock.method> | undefined;
    const body = { submissionId: randomUUID(), assessment: "content-v1", badge: "concrete", reason: "private feedback text" };
    const content = failure === "write" ? JSON.stringify({ ...body, createdAt: 1 }) + "\n" : "invalid private feedback text";
    if (failure === "unreadable") fs.mkdirSync(path);
    else fs.writeFileSync(path, content, { mode: 0o600 });
    Object.assign(process.env, { FEEDBACK_FILE: path, PRO_TOKENS: "test-secret", TYPESAFE_API_KEY: "test-key", PRO_RATE_LIMIT: "0", PRO_DAILY_CAP: "0", LOG_TOKEN_USAGE: "0", STRIPE_SECRET_KEY: "sk_test_fake", TOKEN_FILE: join(dir, "tokens.json") });
    globalThis.fetch = (async (input: any, init?: any) => {
      if (String(input).includes("api.typesafe.ai")) return new Response(JSON.stringify({ model: "test", answers: { has_substance: { type: "noul", noul: 0.9 }, low_information: { type: "noul", noul: 0.1 } } }), { headers: { "Content-Type": "application/json" } });
      if (String(input).includes("api.stripe.com")) return new Response(JSON.stringify({ id: "cs_test", url: "https://checkout.stripe.com/c/pay/test" }), { headers: { "Content-Type": "application/json" } });
      return originalFetch(input, init);
    }) as typeof fetch;
    resetClient();
    try {
      if (failure === "write") {
        const originalRename = fs.renameSync;
        rename = mock.method(fs, "renameSync", (from: fs.PathLike, to: fs.PathLike) => {
          if (to === path) throw new Error("private feedback text test-secret");
          return originalRename(from, to);
        });
        syncBuiltinESMExports();
      }
      server = createProxyServer();
      rename?.mock.restore();
      syncBuiltinESMExports();
      await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(0, "127.0.0.1", resolve); });
      const base = `http://127.0.0.1:${(server.address() as any).port}`;
      const headers = { "Content-Type": "application/json", "X-Pro-Token": "test-secret" };
      const health = await fetch(base + "/health", { headers });
      assert.equal(health.status, 200);
      assert.equal((await health.json()).tier, "pro");
      const evaluation = await fetch(base + "/evaluate", { method: "POST", headers, body: JSON.stringify({ postId: failure, text: "Shipped an importer with retry checkpoints " + failure, assessment: "content-v1" }) });
      assert.equal(evaluation.status, 200);
      assert.equal((await evaluation.json()).badge, "concrete");
      assert.equal((await fetch(base + "/billing/offers")).status, 200);
      const checkout = await fetch(base + "/checkout/lifetime", { redirect: "manual" });
      assert.equal(checkout.status, 302);
      assert.equal(checkout.headers.get("location"), "https://checkout.stripe.com/c/pay/test");
      const feedback = await fetch(base + "/feedback", { method: "POST", headers, body: JSON.stringify(body) });
      assert.equal(feedback.status, 503);
      assert.deepEqual(await feedback.json(), { error: "feedback_unavailable" });
      assert.deepEqual(logs, [["[proxy] feedback_retention_failed"]]);
      if (failure === "unreadable") assert.equal(fs.statSync(path).isDirectory(), true);
      else assert.equal(fs.readFileSync(path, "utf8"), content);
      assert.deepEqual(fs.readdirSync(dir), ["feedback.jsonl"]);
    } finally {
      rename?.mock.restore(); syncBuiltinESMExports(); logger.mock.restore();
      if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
      else server?.emit("close");
      globalThis.fetch = originalFetch; process.env = old; resetClient(); fs.rmSync(dir, { recursive: true });
    }
  });
}
