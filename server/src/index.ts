import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config as loadEnv } from "dotenv";
import { DEFAULT_PROXY_URL } from "../../jev/thresholds.ts";
import { JEV_ENDPOINT, JEV_MODEL } from "../../jev/questions.ts";
import {
  cancelHtml,
  checkoutUnavailableHtml,
  createCheckoutSession,
  handleWebhook,
  parseCheckoutPlan,
  retrieveCheckoutSession,
  sessionIsPaid,
  stripeCheckoutConfigured,
  successHtml,
} from "./billing.ts";
import { evaluateWithMeta, MissingApiKeyError, clampThreshold } from "./evaluate.ts";
import { issueProToken, readPresentedToken, resolveTier } from "./pro-tokens.ts";
import { clientIp, consumeDailySlot, consumeEvaluateSlot, dailyIpCap, demoMode, evaluateRateConfig } from "./rate-limit.ts";
import {
  logTokenUsage,
  normalizePostText,
  readVerdict,
  storeVerdict,
  verdictCacheStats,
  verdictFromCache,
} from "./verdict-cache.ts";

const envPath = resolve(import.meta.dirname, "../.env");
if (existsSync(envPath)) {
  loadEnv({ path: envPath });
} else {
  loadEnv();
}

const DEMO_HTML = resolve(import.meta.dirname, "../demo/feed.html");

export function createProxyServer(): Server {
  return createServer(async (req, res) => {
    try {
      applyCors(req, res);
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url ?? "/", "http://127.0.0.1");

      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
        const presented = readPresentedToken(req);
        const tier = resolveTier(presented);
        if (tier === "invalid") {
          json(res, 401, {
            error: "invalid_pro_token",
            message: "Token Pro jest nieprawidłowy albo został cofnięty.",
          });
          return;
        }
        const limits = evaluateRateConfig(process.env, tier);
        json(res, 200, {
          ok: true,
          service: "linkedin-ai-slop-proxy",
          model: JEV_MODEL,
          endpoint: JEV_ENDPOINT,
          hasApiKey: Boolean(process.env.TYPESAFE_API_KEY?.trim()),
          defaultProxy: DEFAULT_PROXY_URL,
          cache: verdictCacheStats(),
          tier,
          demoMode: demoMode(),
          dailyIpCap: dailyIpCap(process.env, tier),
          rateLimit: limits.limit,
          stripeCheckout: stripeCheckoutConfigured(),
        });
        return;
      }

      if (url.pathname === "/billing/checkout" && (req.method === "GET" || req.method === "POST")) {
        await handleCheckout(req, res, url);
        return;
      }

      if (req.method === "POST" && url.pathname === "/billing/webhook") {
        const raw = await readRaw(req, 1_000_000);
        const signature = req.headers["stripe-signature"];
        const header = Array.isArray(signature) ? signature[0] : signature;
        const result = handleWebhook(raw.toString("utf8"), header, process.env);
        json(res, result.status, result.body);
        return;
      }

      if (req.method === "GET" && url.pathname === "/billing/success") {
        await handleCheckoutSuccess(url, res);
        return;
      }

      if (req.method === "GET" && url.pathname === "/billing/cancel") {
        html(res, 200, cancelHtml());
        return;
      }

      if (req.method === "GET" && url.pathname === "/demo") {
        const html = readFileSync(DEMO_HTML, "utf8");
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(html);
        return;
      }

      if (req.method === "POST" && url.pathname === "/evaluate") {
        const presented = readPresentedToken(req);
        const tier = resolveTier(presented);
        if (tier === "invalid") {
          json(res, 401, {
            error: "invalid_pro_token",
            message: "Token Pro jest nieprawidłowy albo został cofnięty.",
          });
          return;
        }

        const ip = clientIp(req);
        const limit = consumeEvaluateSlot(ip, Date.now(), process.env, tier);
        if (!limit.allowed) {
          const windowSec = Math.round(limit.windowMs / 1000);
          res.setHeader("Retry-After", String(limit.retryAfterSec));
          if (tier === "demo" && demoMode()) {
            json(res, 429, demoLimitBody(
              `Limit minutowy darmowego Demo: ${limit.limit} ocen na ${windowSec}s z jednego adresu IP. Pro odblokowuje wyższe limity.`,
            ));
            return;
          }
          json(res, 429, {
            error: "rate_limited",
            message:
              tier === "pro"
                ? `Limit Pro: ${limit.limit} ocen na ${windowSec}s. Spróbuj za ${limit.retryAfterSec}s.`
                : `Limit publicznego demo: ${limit.limit} ocen na ${windowSec}s z jednego adresu IP. Spróbuj za ${limit.retryAfterSec}s albo uruchom własne proxy.`,
          });
          return;
        }

        const daily = consumeDailySlot(ip, Date.now(), process.env, tier);
        if (!daily.allowed) {
          res.setHeader("Retry-After", String(daily.retryAfterSec));
          if (tier === "demo") {
            json(res, 429, demoLimitBody(
              `Dzienny limit darmowego Demo: ${daily.cap} ocen z jednego adresu IP. Pro odblokowuje wyższe limity.`,
            ));
            return;
          }
          json(res, 429, {
            error: "daily_limited",
            message: `Dzienny limit Pro: ${daily.cap} ocen. Spróbuj jutro.`,
          });
          return;
        }

        const body = await readJson(req);
        const postId = String(body.postId ?? "").trim();
        const text = String(body.text ?? "").trim();
        const author = typeof body.author === "string" ? body.author : undefined;
        const threshold = clampThreshold(body.threshold);

        if (!postId || text.length < 8) {
          json(res, 400, {
            error: "invalid_request",
            message: "Wymagane: postId oraz text (min. 8 znaków).",
          });
          return;
        }

        const textChars = normalizePostText(text).length;
        const cached = readVerdict(text);
        if (cached) {
          logTokenUsage({
            cache: "HIT",
            inputTokens: cached.inputTokens,
            outputTokens: cached.outputTokens,
            model: cached.model,
            textChars,
            tier,
          });
          json(res, 200, verdictFromCache(postId, cached, threshold), { "X-Cache": "HIT" });
          return;
        }

        const evaluated = await evaluateWithMeta({ postId, text, author, threshold });
        storeVerdict(text, {
          model: evaluated.model,
          answers: evaluated.answers,
          inputTokens: evaluated.inputTokens,
          outputTokens: evaluated.outputTokens,
        });
        logTokenUsage({
          cache: "MISS",
          inputTokens: evaluated.inputTokens,
          outputTokens: evaluated.outputTokens,
          model: evaluated.model,
          textChars,
          tier,
        });
        json(res, 200, evaluated.result, { "X-Cache": "MISS" });
        return;
      }

      json(res, 404, { error: "not_found" });
    } catch (error) {
      handleError(res, error);
    }
  });
}

/** HOST wygrywa. Sam PORT (Railway) oznacza 0.0.0.0, nie 127.0.0.1. */
export function resolveListenHost(env: NodeJS.ProcessEnv = process.env): string {
  const host = env.HOST?.trim();
  if (host) return host;
  if (env.PORT?.trim()) return "0.0.0.0";
  return "127.0.0.1";
}

export function resolveListenPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.PORT?.trim();
  if (!raw) return 8787;
  const port = Number(raw);
  return Number.isFinite(port) && port > 0 ? port : 8787;
}

export function startServer(port = resolveListenPort(), host = resolveListenHost()): Promise<Server> {
  const server = createProxyServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const port = resolveListenPort();
  const host = resolveListenHost();
  startServer(port, host).then(() => {
    const keyState = process.env.TYPESAFE_API_KEY?.trim()
      ? "TYPESAFE_API_KEY ustawiony"
      : "UWAGA: brak TYPESAFE_API_KEY";
    console.log(`linkedin-ai-slop proxy na http://${host}:${port}  (${keyState})`);
    console.log(`Jev: ${JEV_MODEL} → ${JEV_ENDPOINT}`);
    console.log(`Podgląd DOM: http://${host}:${port}/demo`);
  });
}

function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin ?? "";
  const allow =
    process.env.CORS_ORIGIN ||
    (isAllowedOrigin(origin) ? origin : "https://www.linkedin.com");
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Pro-Token");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (origin === "https://www.linkedin.com" || origin === "https://linkedin.com") return true;
  if (origin === "https://pawelmamcarz.github.io") return true;
  if (
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    origin.startsWith("safari-web-extension://")
  ) {
    return true;
  }
  try {
    const { hostname } = new URL(origin);
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

async function handleCheckout(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const body = req.method === "POST" ? await readJson(req) : {};
  const plan = parseCheckoutPlan(url.searchParams.get("plan") ?? body.plan);
  if (!plan) {
    json(res, 400, { error: "invalid_plan", message: "Plan: monthly albo yearly." });
    return;
  }
  if (!stripeCheckoutConfigured() || !priceIdFor(plan)) {
    if (req.method === "GET") {
      html(res, 503, checkoutUnavailableHtml());
      return;
    }
    json(res, 503, {
      error: "checkout_unconfigured",
      message: "Checkout Stripe nie jest skonfigurowany (wkrótce).",
    });
    return;
  }
  const session = await createCheckoutSession(plan);
  if (req.method === "GET") {
    res.writeHead(302, { Location: session.url, "Cache-Control": "no-store" });
    res.end();
    return;
  }
  json(res, 200, { url: session.url });
}

function priceIdFor(plan: "monthly" | "yearly"): string {
  const raw = plan === "yearly" ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
  return raw?.trim() ?? "";
}

async function handleCheckoutSuccess(url: URL, res: ServerResponse): Promise<void> {
  const sessionId = url.searchParams.get("session_id")?.trim() ?? "";
  if (!sessionId || sessionId.includes("{")) {
    html(res, 400, checkoutUnavailableHtml());
    return;
  }
  const session = await retrieveCheckoutSession(sessionId);
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id ?? "";
  if (!customer || !sessionIsPaid(session)) {
    html(res, 402, checkoutUnavailableHtml());
    return;
  }
  const issued = issueProToken(customer);
  html(res, 200, successHtml(issued.token));
}

function html(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function demoLimitBody(message: string): { error: "demo_limit"; upgrade: true; message: string } {
  return { error: "demo_limit", upgrade: true, message };
}

function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  extra?: Record<string, string>,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...extra,
  });
  res.end(payload);
}

async function readRaw(req: IncomingMessage, maxBytes = 80_000): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const size = chunks.reduce((n, c) => n + c.length, 0);
    if (size > maxBytes) {
      throw Object.assign(new Error("Request too large"), { status: 413 });
    }
  }
  return Buffer.concat(chunks);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readRaw(req);
  if (raw.length === 0) return {};
  try {
    return JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw Object.assign(new Error("Niepoprawny JSON"), { status: 400 });
  }
}

function handleError(res: ServerResponse, error: unknown): void {
  if (error instanceof MissingApiKeyError) {
    json(res, 503, { error: "missing_api_key", message: error.message });
    return;
  }
  const status = (error as { status?: number }).status;
  const name = (error as { name?: string }).name ?? "";
  const message = error instanceof Error ? error.message : "unknown_error";

  if (status === 400 || status === 413) {
    json(res, status, { error: "invalid_request", message });
    return;
  }
  if (status === 401 || name === "AuthenticationError") {
    json(res, 502, {
      error: "typesafe_unauthorized",
      message: "TypeSafe odrzucił klucz (401). Sprawdź TYPESAFE_API_KEY.",
    });
    return;
  }
  if (status === 429 || name === "RateLimitError") {
    json(res, 429, { error: "rate_limited", message: "Jev: 429 — zwolnij i spróbuj ponownie." });
    return;
  }
  if (status === 529 || /529|overloaded/i.test(message)) {
    json(res, 503, { error: "overloaded", message: "Jev przeciążony (529). Retry za chwilę." });
    return;
  }
  console.error("[proxy]", name || "error", message);
  json(res, 502, { error: "evaluate_failed", message: "Proxy nie oceniło posta (Jev)." });
}
