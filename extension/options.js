const DEFAULTS = {
  enabled: true,
  threshold: 0.65,
  proxyUrl: "https://proxy-production-ebcc.up.railway.app",
  mode: "demo",
  proToken: "",
  byokProxyUrl: "",
  blurSlop: true,
};

const enabledEl = document.querySelector("#enabled");
const blurSlopEl = document.querySelector("#blur-slop");
const thresholdEl = document.querySelector("#threshold");
const thresholdValue = document.querySelector("#threshold-value");
const proxyEl = document.querySelector("#proxy");
const tokenEl = document.querySelector("#pro-token");
const tokenRow = document.querySelector("#token-row");
const statusEl = document.querySelector("#status");
const form = document.querySelector("#settings");

thresholdEl.addEventListener("input", () => {
  thresholdValue.textContent = Number(thresholdEl.value).toFixed(2);
});

function selectedMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || "demo";
}

function syncMode() {
  const mode = selectedMode();
  const byok = mode === "byok";
  proxyEl.readOnly = !byok;
  proxyEl.required = byok;
  tokenRow.hidden = mode !== "pro";
  if (!byok) proxyEl.value = DEFAULTS.proxyUrl;
}

document.querySelectorAll('input[name="mode"]').forEach((input) => {
  input.addEventListener("change", syncMode);
});

const lifetimeLeft = document.querySelector("#lifetime-left");
fetch(`${DEFAULTS.proxyUrl}/billing/offers`)
  .then((response) => (response.ok ? response.json() : null))
  .then((data) => {
    const lifetime = data && data.lifetime;
    if (!lifetimeLeft || !lifetime || typeof lifetime.remaining !== "number") return;
    lifetimeLeft.textContent = lifetime.remaining > 0
      ? `Lifetime Pro: zostało ${lifetime.remaining} z ${lifetime.cap}.`
      : "Lifetime Pro: limit oferty został osiągnięty.";
  })
  .catch(() => {});

ExtApi.storageGet(DEFAULTS).then((stored) => {
  const settings = ExtApi.resolveSettings(stored);
  enabledEl.checked = settings.enabled !== false;
  blurSlopEl.checked = settings.blurSlop !== false;
  thresholdEl.value = String(settings.threshold ?? DEFAULTS.threshold);
  thresholdValue.textContent = Number(thresholdEl.value).toFixed(2);
  const modeInput = document.querySelector(`input[name="mode"][value="${settings.mode}"]`);
  if (modeInput) modeInput.checked = true;
  tokenEl.value = stored.proToken || "";
  if (settings.mode === "byok") proxyEl.value = settings.proxyUrl;
  syncMode();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const mode = selectedMode();
  const proxyUrl = (mode === "byok" ? proxyEl.value : DEFAULTS.proxyUrl).trim().replace(/\/$/, "");
  const granted = await ensureProxyPermission(proxyUrl);
  if (!granted) {
    statusEl.textContent = "Przeglądarka nie dostała zgody na ten adres proxy.";
    return;
  }
  const previous = ExtApi.resolveSettings(await ExtApi.storageGet(DEFAULTS));
  const byokProxyUrl = mode === "byok" ? proxyUrl : previous.byokProxyUrl;
  await ExtApi.storageSet({
    enabled: enabledEl.checked,
    blurSlop: blurSlopEl.checked,
    threshold: Number(thresholdEl.value),
    mode,
    proxyUrl: mode === "byok" ? proxyUrl : DEFAULTS.proxyUrl,
    byokProxyUrl,
    proToken: tokenEl.value.trim(),
  });
  statusEl.textContent =
    mode === "pro"
      ? "Zapisano tryb Pro. Token idzie w nagłówku X-Pro-Token, nie jako klucz TypeSafe."
      : "Zapisano. Nowe posty na feedzie użyją tych ustawień.";
});

document.querySelector("#check").addEventListener("click", async () => {
  const mode = selectedMode();
  const proxyUrl = (mode === "byok" ? proxyEl.value : DEFAULTS.proxyUrl).trim().replace(/\/$/, "");
  statusEl.textContent = "Sprawdzam…";
  const granted = await ensureProxyPermission(proxyUrl);
  if (!granted) {
    statusEl.textContent = "Przeglądarka nie dostała zgody na ten adres proxy.";
    return;
  }
  try {
    const response = await ExtApi.sendMessage({
      type: "health",
      proxyUrl,
      proToken: mode === "pro" ? tokenEl.value.trim() : "",
    });
    if (response?.status === 401) {
      statusEl.textContent = "Token Pro odrzucony. Sprawdź wklejkę. To nie jest klucz TypeSafe.";
      return;
    }
    if (response?.ok && response.body?.tier === "pro") {
      statusEl.textContent = `Proxy działa w trybie Pro. Model: ${response.body.model}.`;
      return;
    }
    if (response?.ok && response.body?.hasApiKey) {
      const cap = response.body.dailyIpCap ? `, dobowy limit ${response.body.dailyIpCap}` : "";
      statusEl.textContent = `Proxy działa (${response.body.tier || "demo"}). Model: ${response.body.model}${cap}.`;
      return;
    }
    if (response?.ok) {
      statusEl.textContent = "Proxy działa, ale nie ma ustawionego TYPESAFE_API_KEY.";
      return;
    }
    statusEl.textContent =
      response?.body?.message ||
      "Brak połączenia z proxy. Domyślny adres to hostowane proxy. Lokalne `npm start` w server/ jest potrzebne tylko przy własnym kluczu.";
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : "Brak połączenia z proxy";
  }
});

async function ensureProxyPermission(proxyUrl) {
  let origin;
  try {
    origin = new URL(proxyUrl).origin + "/";
  } catch {
    return false;
  }
  const has = await ExtApi.permissionsContains(origin);
  if (has) return true;
  return ExtApi.permissionsRequest(origin);
}
