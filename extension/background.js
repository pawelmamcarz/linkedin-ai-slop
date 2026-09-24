/**
 * Service worker: woła proxy, żeby content script na https://www.linkedin.com
 * nie trzymał klucza i nie walczył z CORS / mixed content.
 * Fetch idzie z rozszerzenia (Chrome, Brave, Edge, Firefox, Safari), nie ze strony,
 * więc Shields Brave na linkedin.com tego żądania nie widzą.
 * Domyślny adres trzymaj zgodny z jev/thresholds.ts (DEFAULT_PROXY_URL).
 *
 * Chrome ładuje ten plik jako service worker i woła importScripts.
 * Firefox ładuje ext-api.js wcześniej przez background.scripts, więc importScripts tu nie ma.
 */
if (typeof importScripts === "function") {
  importScripts("ext-api.js");
}

const DEFAULT_PROXY = "https://proxy-production-ebcc.up.railway.app";

ExtApi.onMessage((message) => {
  if (!message || (message.type !== "evaluate" && message.type !== "health")) return undefined;
  const task = message.type === "health" ? health(message.proxyUrl, message.proToken) : evaluate(message.payload);
  return task.catch((error) => ({
    ok: false,
    status: 0,
    body: {
      error: "proxy_unreachable",
      message: error instanceof Error ? error.message : "Brak połączenia z proxy",
    },
  }));
});

async function proxyBase(override) {
  if (override) return String(override).replace(/\/$/, "");
  const stored = await ExtApi.storageGet({});
  return ExtApi.resolveSettings(stored).proxyUrl;
}

async function proHeaders(explicitToken) {
  if (typeof explicitToken === "string") {
    const token = explicitToken.trim();
    return token ? { "X-Pro-Token": token } : {};
  }
  const stored = await ExtApi.storageGet({});
  const token = ExtApi.resolveSettings(stored).proToken;
  return token ? { "X-Pro-Token": token } : {};
}

async function evaluate(payload) {
  const base = await proxyBase(payload?.proxyUrl);
  const response = await fetch(`${base}/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await proHeaders()),
    },
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

async function health(proxyUrl, proToken) {
  const base = await proxyBase(proxyUrl);
  const response = await fetch(`${base}/health`, { headers: await proHeaders(proToken) });
  const body = await response.json().catch(() => ({ error: "bad_response" }));
  return { ok: response.ok, status: response.status, body };
}
