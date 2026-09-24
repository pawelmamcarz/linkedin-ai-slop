import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createHmac } from "node:crypto";
import { resetClient } from "../src/evaluate.ts";
import { resolveListenHost, startServer } from "../src/index.ts";
import { issuedTokenForCustomer, resetProTokens, tokenDigest } from "../src/pro-tokens.ts";
import { DEFAULT_DEMO_DAILY_IP_CAP, resetRateLimit } from "../src/rate-limit.ts";
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

  it("puszcza chrome-extension, moz-extension, safari-web-extension i GitHub Pages", async () => {
    const extension = await fetch(`${base}/health`, {
      headers: { Origin: "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef" },
    });
    assert.equal(
      extension.headers.get("access-control-allow-origin"),
      "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef",
    );
    const firefox = await fetch(`${base}/health`, {
      headers: { Origin: "moz-extension://abcdefghijklmnopqrstuvwxyzabcdef" },
    });
    assert.equal(
      firefox.headers.get("access-control-allow-origin"),
      "moz-extension://abcdefghijklmnopqrstuvwxyzabcdef",
    );
    const preflight = await fetch(`${base}/evaluate`, {
      method: "OPTIONS",
      headers: {
        Origin: "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef",
        "Access-Control-Request-Headers": "content-type,x-pro-token",
      },
    });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /X-Pro-Token/);
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
    assert.equal(body.error, "demo_limit");
    assert.equal(body.upgrade, true);
    assert.equal(typeof body.message, "string");
    assert.match(body.message, /Pro/);
    assert.ok(second.headers.get("retry-after"));
    assert.equal(jevCalls.length, before + 1);
    if (previousDaily === undefined) delete process.env.EVALUATE_DAILY_IP_CAP;
    else process.env.EVALUATE_DAILY_IP_CAP = previousDaily;
    if (previousLimit === undefined) delete process.env.EVALUATE_RATE_LIMIT;
    else process.env.EVALUATE_RATE_LIMIT = previousLimit;
    resetRateLimit();
  });

  it("zły token Pro dostaje 401 i nie woła Jev", async () => {
    const previous = process.env.PRO_TOKENS;
    process.env.PRO_TOKENS = "good-pro-token";
    resetRateLimit();
    const before = jevCalls.length;
    const response = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pro-Token": "not-the-token",
      },
      body: JSON.stringify({
        postId: "urn:li:activity:bad",
        text: "Shipped the billing retry last Tuesday. Failure rate dropped from 4.1% to 0.6%.",
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error, "invalid_pro_token");
    assert.equal(jevCalls.length, before);
    assert.equal(JSON.stringify(body).includes("not-the-token"), false);
    if (previous === undefined) delete process.env.PRO_TOKENS;
    else process.env.PRO_TOKENS = previous;
  });

  it("anonimowy limit minutowy nie blokuje tokenu Pro", async () => {
    const previousLimit = process.env.EVALUATE_RATE_LIMIT;
    const previousPro = process.env.PRO_RATE_LIMIT;
    const previousTokens = process.env.PRO_TOKENS;
    process.env.EVALUATE_RATE_LIMIT = "1";
    process.env.PRO_RATE_LIMIT = "2";
    process.env.PRO_TOKENS = `sha256:${tokenDigest("hashed-pro-token")}`;
    resetRateLimit();
    resetVerdictCache();
    const headers = {
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.90",
    };
    const demoBody = JSON.stringify({
      postId: "urn:li:activity:demo-limit",
      text: "Shipped the billing retry last Tuesday. Failure rate dropped from 4.1% to 0.6%.",
    });
    const first = await fetch(`${base}/evaluate`, { method: "POST", headers, body: demoBody });
    const blocked = await fetch(`${base}/evaluate`, { method: "POST", headers, body: demoBody });
    const proHeaders = { ...headers, Authorization: "Bearer hashed-pro-token" };
    const proText = "Hired two SDEs in Kraków last month. Both start Monday on the billing team.";
    const proFirst = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: proHeaders,
      body: JSON.stringify({ postId: "urn:li:activity:pro-1", text: proText }),
    });
    const proSecond = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: proHeaders,
      body: JSON.stringify({ postId: "urn:li:activity:pro-2", text: `${proText} Extra note.` }),
    });
    const proThird = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: proHeaders,
      body: JSON.stringify({ postId: "urn:li:activity:pro-3", text: "I'm humbled and thrilled to announce that consistency is the ultimate leadership hack for everyone." }),
    });
    const proLimited = await proThird.json();
    assert.equal(first.status, 200);
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error, "rate_limited");
    assert.equal(proFirst.status, 200);
    assert.equal(proSecond.status, 200);
    assert.equal(proThird.status, 429);
    assert.equal(proLimited.error, "rate_limited");
    const health = await fetch(`${base}/health`, { headers: { "X-Pro-Token": "hashed-pro-token" } });
    const healthBody = await health.json();
    assert.equal(healthBody.tier, "pro");
    assert.equal(JSON.stringify(healthBody).includes("hashed-pro-token"), false);
    if (previousLimit === undefined) delete process.env.EVALUATE_RATE_LIMIT;
    else process.env.EVALUATE_RATE_LIMIT = previousLimit;
    if (previousPro === undefined) delete process.env.PRO_RATE_LIMIT;
    else process.env.PRO_RATE_LIMIT = previousPro;
    if (previousTokens === undefined) delete process.env.PRO_TOKENS;
    else process.env.PRO_TOKENS = previousTokens;
    resetRateLimit();
  });

  it("DEMO_MODE ustawia dobowy limit demo, a Pro ma osobny kubełek", async () => {
    const previousDemo = process.env.DEMO_MODE;
    const previousDaily = process.env.EVALUATE_DAILY_IP_CAP;
    const previousProDaily = process.env.PRO_DAILY_CAP;
    const previousLimit = process.env.EVALUATE_RATE_LIMIT;
    const previousTokens = process.env.PRO_TOKENS;
    process.env.DEMO_MODE = "1";
    delete process.env.EVALUATE_DAILY_IP_CAP;
    process.env.PRO_DAILY_CAP = "2";
    process.env.EVALUATE_RATE_LIMIT = "0";
    process.env.PRO_TOKENS = "good-pro-token";
    resetRateLimit();
    const health = await fetch(`${base}/health`);
    const healthBody = await health.json();
    assert.equal(healthBody.tier, "demo");
    assert.equal(healthBody.demoMode, true);
    assert.equal(healthBody.dailyIpCap, DEFAULT_DEMO_DAILY_IP_CAP);
    assert.equal(healthBody.stripeCheckout, false);
    const headers = {
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.91",
      "X-Pro-Token": "good-pro-token",
    };
    process.env.EVALUATE_DAILY_IP_CAP = "1";
    resetRateLimit();
    const demo = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.91" },
      body: JSON.stringify({
        postId: "urn:li:activity:cap-demo",
        text: "Shipped the billing retry last Tuesday. Failure rate dropped from 4.1% to 0.6%.",
      }),
    });
    const demoBlocked = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.91" },
      body: JSON.stringify({
        postId: "urn:li:activity:cap-demo-2",
        text: "Hired two SDEs in Kraków last month. Both start Monday on the billing team.",
      }),
    });
    const pro = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        postId: "urn:li:activity:cap-pro",
        text: "I'm humbled and thrilled to announce that consistency is the ultimate leadership hack for everyone.",
      }),
    });
    const demoBody = await demoBlocked.json();
    assert.equal(demo.status, 200);
    assert.equal(demoBlocked.status, 429);
    assert.equal(demoBody.error, "demo_limit");
    assert.equal(demoBody.upgrade, true);
    assert.match(demoBody.message, /Pro/);
    assert.ok(demoBlocked.headers.get("retry-after"));
    assert.equal(pro.status, 200);
    const proJson = await pro.json();
    assert.equal(proJson.upgrade, undefined);
    if (previousDemo === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousDemo;
    if (previousDaily === undefined) delete process.env.EVALUATE_DAILY_IP_CAP;
    else process.env.EVALUATE_DAILY_IP_CAP = previousDaily;
    if (previousProDaily === undefined) delete process.env.PRO_DAILY_CAP;
    else process.env.PRO_DAILY_CAP = previousProDaily;
    if (previousLimit === undefined) delete process.env.EVALUATE_RATE_LIMIT;
    else process.env.EVALUATE_RATE_LIMIT = previousLimit;
    if (previousTokens === undefined) delete process.env.PRO_TOKENS;
    else process.env.PRO_TOKENS = previousTokens;
    resetRateLimit();
  });

  it("DEMO_MODE: limit minutowy Demo to demo_limit, Pro zostaje rate_limited", async () => {
    const previousDemo = process.env.DEMO_MODE;
    const previousLimit = process.env.EVALUATE_RATE_LIMIT;
    const previousPro = process.env.PRO_RATE_LIMIT;
    const previousTokens = process.env.PRO_TOKENS;
    process.env.DEMO_MODE = "1";
    process.env.EVALUATE_RATE_LIMIT = "1";
    process.env.PRO_RATE_LIMIT = "1";
    process.env.PRO_TOKENS = "good-pro-token";
    resetRateLimit();
    resetVerdictCache();
    const headers = {
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.92",
    };
    const before = jevCalls.length;
    const text = "Shipped the billing retry last Tuesday. Failure rate dropped from 4.1% to 0.6%.";
    const first = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ postId: "urn:li:activity:min-demo", text }),
    });
    const blocked = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        postId: "urn:li:activity:min-demo-2",
        text: "Hired two SDEs in Kraków last month. Both start Monday on the billing team.",
      }),
    });
    const body = await blocked.json();
    const proFirst = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: { ...headers, "X-Pro-Token": "good-pro-token" },
      body: JSON.stringify({
        postId: "urn:li:activity:min-pro",
        text: "Hired two SDEs in Kraków last month. Both start Monday on the billing team.",
      }),
    });
    const proBlocked = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: { ...headers, "X-Pro-Token": "good-pro-token" },
      body: JSON.stringify({
        postId: "urn:li:activity:min-pro-2",
        text: "I'm humbled and thrilled to announce that consistency is the ultimate leadership hack for everyone.",
      }),
    });
    const proBody = await proBlocked.json();
    assert.equal(first.status, 200);
    assert.equal(blocked.status, 429);
    assert.equal(body.error, "demo_limit");
    assert.equal(body.upgrade, true);
    assert.match(body.message, /Pro/);
    assert.ok(blocked.headers.get("retry-after"));
    assert.equal(jevCalls.length, before + 2);
    assert.equal(proFirst.status, 200);
    assert.equal(proBlocked.status, 429);
    assert.equal(proBody.error, "rate_limited");
    assert.equal(proBody.upgrade, undefined);
    if (previousDemo === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousDemo;
    if (previousLimit === undefined) delete process.env.EVALUATE_RATE_LIMIT;
    else process.env.EVALUATE_RATE_LIMIT = previousLimit;
    if (previousPro === undefined) delete process.env.PRO_RATE_LIMIT;
    else process.env.PRO_RATE_LIMIT = previousPro;
    if (previousTokens === undefined) delete process.env.PRO_TOKENS;
    else process.env.PRO_TOKENS = previousTokens;
    resetRateLimit();
  });

  it("checkout bez kluczy Stripe mówi wkrótce, a webhook wydaje i cofa token", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_MONTHLY;
    const unavailable = await fetch(`${base}/billing/checkout?plan=monthly`);
    const page = await unavailable.text();
    assert.equal(unavailable.status, 503);
    assert.match(page, /wkrótce/);
    const post = await fetch(`${base}/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "yearly" }),
    });
    assert.equal(post.status, 503);
    assert.equal((await post.json()).error, "checkout_unconfigured");

    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_only";
    resetProTokens();
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { customer: "cus_test", payment_status: "paid", status: "complete" } },
    });
    const stamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", "whsec_test_only").update(`${stamp}.${payload}`).digest("hex");
    const issued = await fetch(`${base}/billing/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": `t=${stamp},v1=${signature}`,
      },
      body: payload,
    });
    assert.equal(issued.status, 200);
    const token = issuedTokenForCustomer("cus_test");
    assert.ok(token?.startsWith("pro_"));
    const rejected = await fetch(`${base}/billing/webhook`, {
      method: "POST",
      headers: { "Stripe-Signature": "t=1,v1=deadbeef" },
      body: payload,
    });
    assert.equal(rejected.status, 400);

    const revokePayload = JSON.stringify({
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_test", status: "canceled" } },
    });
    const revokeStamp = Math.floor(Date.now() / 1000);
    const revokeSig = createHmac("sha256", "whsec_test_only").update(`${revokeStamp}.${revokePayload}`).digest("hex");
    const revoked = await fetch(`${base}/billing/webhook`, {
      method: "POST",
      headers: { "Stripe-Signature": `t=${revokeStamp},v1=${revokeSig}` },
      body: revokePayload,
    });
    assert.equal(revoked.status, 200);
    assert.equal(issuedTokenForCustomer("cus_test"), null);
    const denied = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Pro-Token": token ?? "" },
      body: JSON.stringify({
        postId: "urn:li:activity:revoked",
        text: "Shipped the billing retry last Tuesday. Failure rate dropped from 4.1% to 0.6%.",
      }),
    });
    assert.equal(denied.status, 401);
    delete process.env.STRIPE_WEBHOOK_SECRET;
    resetProTokens();
  });

  after(() => {
    globalThis.fetch = originalFetch;
    server?.close();
  });
});
