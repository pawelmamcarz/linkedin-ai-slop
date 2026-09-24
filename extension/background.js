/**
 * Service worker: woła proxy, żeby content script na https://www.linkedin.com
 * nie trzymał klucza i nie walczył z CORS / mixed content.
 * Domyślny adres trzymaj zgodny z jev/thresholds.ts (DEFAULT_PROXY_URL).
 */
const DEFAULT_PROXY = "https://proxy-production-ebcc.up.railway.app";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || (message.type !== "evaluate" && message.type !== "health")) return;
  const task = message.type === "health" ? health(message.proxyUrl) : evaluate(message.payload);
  task
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        status: 0,
        body: {
          error: "proxy_unreachable",
          message: error instanceof Error ? error.message : "Brak połączenia z proxy",
        },
      });
    });
  return true;
});

async function proxyBase(override) {
  if (override) return String(override).replace(/\/$/, "");
  const stored = await chrome.storage.sync.get({ proxyUrl: DEFAULT_PROXY });
  return String(stored.proxyUrl || DEFAULT_PROXY).replace(/\/$/, "");
}

async function evaluate(payload) {
  const base = await proxyBase(payload?.proxyUrl);
  const response = await fetch(`${base}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postId: payload?.postId,
      text: payload?.text,
      author: payload?.author,
      threshold: payload?.threshold,
    }),
  });
  const body = await response.json().catch(() => ({ error: "bad_response" }));
  return { ok: response.ok, status: response.status, body };
}

async function health(proxyUrl) {
  const base = await proxyBase(proxyUrl);
  const response = await fetch(`${base}/health`);
  const body = await response.json().catch(() => ({ error: "bad_response" }));
  return { ok: response.ok, status: response.status, body };
}
