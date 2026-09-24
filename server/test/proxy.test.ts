import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { resetClient } from "../src/evaluate.ts";
import { resolveListenHost, startServer } from "../src/index.ts";
import { resetRateLimit } from "../src/rate-limit.ts";
import { resetVerdictCache } from "../src/verdict-cache.ts";
import { JEV_MODEL } from "../../jev/questions.ts";
import { DEFAULT_PROXY_URL } from "../../jev/thresholds.ts";

const originalFetch = globalThis.fetch;
const jevCalls: { url: string; body: Record<string, unknown>; authorization: string }[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("api.typesafe.ai")) {
    const headers = init?.headers;
    let authorization = "";
    if (headers instanceof Headers) authorization = headers.get("authorization") ?? "";
    else if (Array.isArray(headers)) {
      const row = headers.find(([key]) => key.toLowerCase() === "authorization");
      authorization = row?.[1] ?? "";
    } else if (headers) {
      const key = Object.keys(headers).find((name) => name.toLowerCase() === "authorization");
      authorization = key ? String(headers[key]) : "";
    }
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    jevCalls.push({ url, body, authorization });
    const slop = String((body.state as { post_text?: string })?.post_text ?? "").includes("humbled");
    return new Response(
      JSON.stringify({
        model: "jev-1.13.0",
        answers: {
          is_ai_slop: { type: "noul", noul: slop ? 0.93 : 0.08 },
          slop_intensity: { type: "score", score: slop ? 1.8 : 0.2, confidence: 0.8 },
          has_substance: { type: "noul", noul: slop ? 0.1 : 0.88 },
          voice: {
            type: "choice",
            choice: slop ? "ai_slop" : "human",
            confidence: 0.74,
            probabilities: slop
              ? { human: 0.05, mixed: 0.12, ai_slop: 0.83 }
              : { human: 0.81, mixed: 0.14, ai_slop: 0.05 },
          },
        },
        usage: { input_tokens: 20, output_tokens: 8 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  return originalFetch(input, init);
}) as typeof fetch;

process.env.TYPESAFE_API_KEY = "test-key-not-a-real-secret";

describe("proxy HTTP", { concurrency: false }, () => {
  let server: Server;
  let base: string;

  before(async () => {
    server = await startServer(0, "127.0.0.1");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    base = `http://127.0.0.1:${address.port}`;
  });

  it("GET /health zwraca model Jev i nie ujawnia klucza", async () => {
    const response = await fetch(`${base}/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.model, JEV_MODEL);
    assert.equal(body.endpoint, "https://api.typesafe.ai/v1/systemone");
    assert.equal(body.hasApiKey, true);
    assert.equal(body.defaultProxy, DEFAULT_PROXY_URL);
    assert.equal(JSON.stringify(body).includes("test-key"), false);
    assert.equal(typeof body.cache.entries, "number");
    assert.equal(typeof body.cache.hits, "number");
    assert.equal(typeof body.cache.misses, "number");
    assert.equal(body.cache.enabled, true);
    assert.equal(body.dailyIpCap, 0);
  });

  it("POST /evaluate woła System One i mapuje odznakę", async () => {
    const response = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.linkedin.com",
      },
      body: JSON.stringify({
        postId: "urn:li:activity:1",
        text: "Shipped the billing retry last Tuesday. Failure rate dropped from 4.1% to 0.6%.",
        author: "Ada",
        threshold: 0.65,
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://www.linkedin.com");
    assert.equal(body.badge, "human");
    assert.equal(body.labelPl, "Ludzki");
    assert.equal(body.model, "jev-1.13.0");
    assert.equal(jevCalls.length, 1);
    assert.equal(jevCalls[0].url, "https://api.typesafe.ai/v1/systemone");
    assert.equal(jevCalls[0].body.model, "jev-latest");
    assert.equal(jevCalls[0].authorization, "Bearer test-key-not-a-real-secret");
    const questions = jevCalls[0].body.questions as Record<string, { type: string }>;
    assert.deepEqual(Object.keys(questions).sort(), [
      "has_substance",
      "is_ai_slop",
      "slop_intensity",
      "voice",
    ]);
    assert.equal(questions.is_ai_slop.type, "noul");
    assert.equal(questions.slop_intensity.type, "score");
    assert.equal(questions.voice.type, "choice");
    const state = jevCalls[0].body.state as { post_text: string; author: string };
    assert.match(state.post_text, /billing retry/);
    assert.equal(state.author, "Ada");
  });

  it("odrzuca obcą origin w CORS", async () => {
    const response = await fetch(`${base}/health`, { headers: { Origin: "https://evil.example" } });
    assert.equal(response.headers.get("access-control-allow-origin"), "https://www.linkedin.com");
  });

  it("puszcza chrome-extension, safari-web-extension i GitHub Pages", async () => {
    const extension = await fetch(`${base}/health`, {
      headers: { Origin: "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef" },
    });
    assert.equal(
      extension.headers.get("access-control-allow-origin"),
      "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef",
    );
    const safari = await fetch(`${base}/health`, {
      headers: { Origin: "safari-web-extension://abcdefghijklmnopqrstuvwxyzabcdef" },
    });
    assert.equal(
      safari.headers.get("access-control-allow-origin"),
      "safari-web-extension://abcdefghijklmnopqrstuvwxyzabcdef",
    );
    const pages = await fetch(`${base}/health`, {
      headers: { Origin: "https://pawelmamcarz.github.io" },
    });
    assert.equal(pages.headers.get("access-control-allow-origin"), "https://pawelmamcarz.github.io");
  });

  it("POST /evaluate zwraca 429 po limicie na IP i nie woła Jev", async () => {
    const previous = process.env.EVALUATE_RATE_LIMIT;
    process.env.EVALUATE_RATE_LIMIT = "1";
    resetRateLimit();
    resetVerdictCache();
    const headers = {
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.50",
    };
    const payload = JSON.stringify({
      postId: "urn:li:activity:9",
      text: "Shipped the billing retry last Tuesday. Failure rate dropped from 4.1% to 0.6%.",
    });
    const before = jevCalls.length;
    const first = await fetch(`${base}/evaluate`, { method: "POST", headers, body: payload });
    const second = await fetch(`${base}/evaluate`, { method: "POST", headers, body: payload });
    const body = await second.json();
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(body.error, "rate_limited");
    assert.ok(second.headers.get("retry-after"));
    assert.equal(jevCalls.length, before + 1);
    if (previous === undefined) delete process.env.EVALUATE_RATE_LIMIT;
    else process.env.EVALUATE_RATE_LIMIT = previous;
    resetRateLimit();
  });

  it("bez HOST, z PORT, nasłuch jest 0.0.0.0", () => {
    assert.equal(resolveListenHost({}), "127.0.0.1");
    assert.equal(resolveListenHost({ PORT: "8080" }), "0.0.0.0");
    assert.equal(resolveListenHost({ PORT: "8080", HOST: "127.0.0.1" }), "127.0.0.1");
    assert.equal(resolveListenHost({ HOST: "0.0.0.0" }), "0.0.0.0");
  });

  it("zwraca 400 dla pustego tekstu i 503 bez klucza", async () => {
    const bad = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: "x", text: "krótki" }),
    });
    assert.equal(bad.status, 400);

    delete process.env.TYPESAFE_API_KEY;
    resetClient();
    const callsBeforeMissingKey = jevCalls.length;
    const missing = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId: "urn:li:activity:2",
        text: "I'm humbled and thrilled to announce that consistency is the ultimate leadership hack for everyone.",
      }),
    });
    const body = await missing.json();
    assert.equal(missing.status, 503);
    assert.equal(body.error, "missing_api_key");
    assert.equal(jevCalls.length, callsBeforeMissingKey);
    process.env.TYPESAFE_API_KEY = "test-key-not-a-real-secret";
    resetClient();
  });

  it("drugie identyczne POST /evaluate jest X-Cache HIT i nie woła Jev", async () => {
    const previousLimit = process.env.EVALUATE_RATE_LIMIT;
    process.env.EVALUATE_RATE_LIMIT = "0";
    resetRateLimit();
    resetVerdictCache();
    const headers = { "Content-Type": "application/json" };
    const text = "Shipped the billing retry last Tuesday. Failure rate dropped from 4.1% to 0.6%.";
    const firstBody = {
      postId: "urn:li:activity:cache-1",
      text,
      author: "Ada",
      threshold: 0.65,
    };
    const before = jevCalls.length;
    const first = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers,
      body: JSON.stringify(firstBody),
    });
    const firstJson = await first.json();
    const second = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        postId: "urn:li:activity:cache-2",
        text: `  Shipped   the billing retry last Tuesday.\nFailure rate dropped from 4.1% to 0.6%.  `,
        author: "Inny autor",
        threshold: 0.95,
      }),
    });
    const secondJson = await second.json();
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(first.headers.get("x-cache"), "MISS");
    assert.equal(second.headers.get("x-cache"), "HIT");
    assert.equal(jevCalls.length, before + 1);
    assert.equal(firstJson.badge, "human");
    assert.equal(firstJson.postId, "urn:li:activity:cache-1");
    assert.equal(firstJson.threshold, 0.65);
    assert.equal(secondJson.postId, "urn:li:activity:cache-2");
    assert.equal(secondJson.badge, "human");
    assert.equal(secondJson.labelPl, "Ludzki");
    assert.equal(secondJson.threshold, 0.95);
    assert.equal(JSON.stringify(secondJson).includes(text), false);

    const health = await fetch(`${base}/health`);
    const healthBody = await health.json();
    assert.equal(healthBody.cache.hits >= 1, true);
    assert.equal(healthBody.cache.misses >= 1, true);
    assert.equal(JSON.stringify(healthBody).includes("test-key"), false);

    if (previousLimit === undefined) delete process.env.EVALUATE_RATE_LIMIT;
    else process.env.EVALUATE_RATE_LIMIT = previousLimit;
    resetRateLimit();
  });

  it("EVALUATE_DAILY_IP_CAP blokuje kolejny unikalny post i nie woła Jev", async () => {
    const previousDaily = process.env.EVALUATE_DAILY_IP_CAP;
    const previousLimit = process.env.EVALUATE_RATE_LIMIT;
    process.env.EVALUATE_DAILY_IP_CAP = "1";
    process.env.EVALUATE_RATE_LIMIT = "0";
    resetRateLimit();
    resetVerdictCache();
    const headers = {
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.77",
    };
    const before = jevCalls.length;
    const first = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        postId: "urn:li:activity:day-1",
        text: "Hired two SDEs in Kraków last month. Both start Monday on the billing team.",
      }),
    });
    const second = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        postId: "urn:li:activity:day-2",
        text: "I'm humbled and thrilled to announce that consistency is the ultimate leadership hack for everyone.",
      }),
    });
    const body = await second.json();
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(body.error, "daily_limited");
    assert.equal(jevCalls.length, before + 1);
    if (previousDaily === undefined) delete process.env.EVALUATE_DAILY_IP_CAP;
    else process.env.EVALUATE_DAILY_IP_CAP = previousDaily;
    if (previousLimit === undefined) delete process.env.EVALUATE_RATE_LIMIT;
    else process.env.EVALUATE_RATE_LIMIT = previousLimit;
    resetRateLimit();
  });

  after(() => {
    globalThis.fetch = originalFetch;
    server?.close();
  });
});
