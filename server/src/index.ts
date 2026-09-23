import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config as loadEnv } from "dotenv";
import { DEFAULT_PROXY_URL } from "../../jev/thresholds.ts";
import { JEV_ENDPOINT, JEV_MODEL } from "../../jev/questions.ts";
import { evaluatePost, MissingApiKeyError, clampThreshold } from "./evaluate.ts";

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
        json(res, 200, {
          ok: true,
          service: "linkedin-ai-slop-proxy",
          model: JEV_MODEL,
          endpoint: JEV_ENDPOINT,
          hasApiKey: Boolean(process.env.TYPESAFE_API_KEY?.trim()),
          defaultProxy: DEFAULT_PROXY_URL,
        });
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

        const result = await evaluatePost({ postId, text, author, threshold });
        json(res, 200, result);
        return;
      }

      json(res, 404, { error: "not_found" });
    } catch (error) {
      handleError(res, error);
    }
  });
}

export function startServer(port = Number(process.env.PORT) || 8787, host = process.env.HOST || "127.0.0.1"): Promise<Server> {
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
  const port = Number(process.env.PORT) || 8787;
  const host = process.env.HOST || "127.0.0.1";
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (origin === "https://www.linkedin.com" || origin === "https://linkedin.com") return true;
  if (origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")) {
    return true;
  }
  try {
    const { hostname } = new URL(origin);
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const size = chunks.reduce((n, c) => n + c.length, 0);
    if (size > 80_000) {
      throw Object.assign(new Error("Request too large"), { status: 413 });
    }
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
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
