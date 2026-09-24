const DEFAULTS = {
  enabled: true,
  threshold: 0.65,
  proxyUrl: "https://proxy-production-ebcc.up.railway.app",
};

const enabledEl = document.querySelector("#enabled");
const thresholdEl = document.querySelector("#threshold");
const thresholdValue = document.querySelector("#threshold-value");
const proxyEl = document.querySelector("#proxy");
const statusEl = document.querySelector("#status");
const form = document.querySelector("#settings");

thresholdEl.addEventListener("input", () => {
  thresholdValue.textContent = Number(thresholdEl.value).toFixed(2);
});

chrome.storage.sync.get(DEFAULTS, (stored) => {
  enabledEl.checked = stored.enabled !== false;
  thresholdEl.value = String(stored.threshold ?? DEFAULTS.threshold);
  thresholdValue.textContent = Number(thresholdEl.value).toFixed(2);
  proxyEl.value = stored.proxyUrl || DEFAULTS.proxyUrl;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const proxyUrl = proxyEl.value.trim().replace(/\/$/, "");
  const granted = await ensureProxyPermission(proxyUrl);
  if (!granted) {
    statusEl.textContent = "Chrome nie dostał zgody na ten adres proxy.";
    return;
  }
  await chrome.storage.sync.set({
    enabled: enabledEl.checked,
    threshold: Number(thresholdEl.value),
    proxyUrl,
  });
  statusEl.textContent = "Zapisano. Nowe posty na feedzie użyją tych ustawień.";
});

document.querySelector("#check").addEventListener("click", async () => {
  const proxyUrl = proxyEl.value.trim().replace(/\/$/, "");
  statusEl.textContent = "Sprawdzam…";
  const granted = await ensureProxyPermission(proxyUrl);
  if (!granted) {
    statusEl.textContent = "Chrome nie dostał zgody na ten adres proxy.";
    return;
  }
  chrome.runtime.sendMessage({ type: "health", proxyUrl }, (response) => {
    const err = chrome.runtime.lastError;
    if (err) {
      statusEl.textContent = err.message;
      return;
    }
    if (response?.ok && response.body?.hasApiKey) {
      statusEl.textContent = `Proxy działa. Model: ${response.body.model}.`;
      return;
    }
    if (response?.ok) {
      statusEl.textContent = "Proxy działa, ale nie ma ustawionego TYPESAFE_API_KEY.";
      return;
    }
    statusEl.textContent =
      response?.body?.message ||
      "Brak połączenia z proxy. Domyślny adres to hostowane proxy. Lokalne `npm start` w server/ jest potrzebne tylko przy własnym kluczu.";
  });
});

async function ensureProxyPermission(proxyUrl) {
  let origin;
  try {
    origin = new URL(proxyUrl).origin + "/";
  } catch {
    return false;
  }
  const has = await chrome.permissions.contains({ origins: [origin] });
  if (has) return true;
  return chrome.permissions.request({ origins: [origin] });
}
