/**
 * LinkedIn AI Slop — content script (Manifest V3).
 * Selektory celowo szerokie: LinkedIn często zmienia klasy. Porażka = skip, nie crash.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.LinkedInAiSlop = api;
  const ext = typeof globalThis !== "undefined" ? globalThis.ExtApi : undefined;
  const hasRuntime =
    (ext && typeof ext.hasRuntime === "function" && ext.hasRuntime()) ||
    (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) ||
    (typeof browser !== "undefined" && browser.runtime && browser.runtime.id);
  if (hasRuntime) {
    const host = typeof location !== "undefined" ? location.hostname : "";
    const isLinkedIn = host.endsWith("linkedin.com");
    const isDemo =
      typeof document !== "undefined" && document.documentElement?.dataset.slopDemo === "1";
    if (isLinkedIn || isDemo) {
      api.boot();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function factory() {
  const DEFAULTS = {
    enabled: true,
    threshold: 0.65,
    proxyUrl: "https://proxy-production-ebcc.up.railway.app",
    mode: "demo",
    proToken: "",
    byokProxyUrl: "",
    blurSlop: true,
  };

  const MIN_TEXT_CHARS = 40;
  const CONCURRENCY = 2;
  const DEBOUNCE_MS = 280;
  const INTERSECT_RATIO = 0.35;
  const MAX_QUEUE = 40;

  const POST_SELECTORS = [
    "div.feed-shared-update-v2",
    "article.feed-shared-update-v2",
    'div[data-id^="urn:li:activity"]',
    'div[data-id^="urn:li:ugcPost"]',
    'div[data-id^="urn:li:share"]',
    '[data-id^="urn:li:activity"]',
    '[data-id^="urn:li:ugcPost"]',
    '[data-id^="urn:li:share"]',
    'div[data-urn^="urn:li:activity"]',
    'div[data-urn^="urn:li:ugcPost"]',
    'div[data-urn^="urn:li:share"]',
    'div[data-urn^="urn:li:aggregatedShare"]',
    '[data-urn^="urn:li:activity"]',
    '[data-urn^="urn:li:ugcPost"]',
    '[data-urn^="urn:li:share"]',
    '[data-urn^="urn:li:aggregatedShare"]',
    '[role="article"][data-urn]',
    'article[data-id="main-feed-card"]',
    'article[componentkey*="urn:li:activity"]',
    '[componentkey*="urn:li:activity"]',
    "div.occludable-update",
    "li.occludable-update",
    ".profile-creator-shared-feed-update__container",
    'div[data-view-name="feed-full-update"]',
    '[data-view-name="feed-full-update"]',
    "li.feed-item",
    '[data-testid="mainFeed"] [role="listitem"]',
    "div[componentkey][role='listitem']",
    ".scaffold-finite-scroll__content [role='listitem']",
    ".scaffold-finite-scroll__content [data-urn*='urn:li:activity']",
    ".scaffold-finite-scroll__content [data-urn*='urn:li:ugcPost']",
    ".scaffold-finite-scroll__content [data-urn*='urn:li:share']",
  ];

  const TEXT_SELECTORS = [
    ".update-components-text",
    ".feed-shared-update-v2__commentary",
    ".feed-shared-update-v2__description-wrapper",
    ".feed-shared-update-v2__description",
    ".feed-shared-inline-show-more-text",
    '[data-testid="expandable-text-box"]',
    '[data-view-name="feed-commentary"]',
    '[componentkey^="feed-commentary"]',
    ".update-components-text span[dir='ltr']",
    ".feed-shared-update-v2__description .break-words",
    ".break-words span[dir='ltr']",
    "span.break-words",
    ".feed-shared-text",
  ];

  const AUTHOR_SELECTORS = [
    '.update-components-actor__title span[aria-hidden="true"]',
    ".update-components-actor__name",
    ".update-components-actor__title",
    'a[href*="/in/"]',
    'a[href*="/company/"]',
  ];

  const SKIP_INSIDE = [
    ".comments-comment-item",
    ".comments-comments-list",
    ".comments-comment-entity",
    "form",
  ];

  const seen = new Set();
  const verdicts = new Map();
  const inFlight = new Set();
  const failedAt = new Map();
  const queue = [];
  let active = 0;
  let settings = { ...DEFAULTS };
  let debounceTimer = 0;
  let observer = null;
  let intersect = null;
  let warnedProxy = false;
  let demoLimitedUntil = 0;
  const DEMO_LIMIT_KEY = "lais-demo-limit-until";
  let selectorMissLogged = false;
  let booted = false;
  let generation = 0;
  let lastHref = "";
  const MIN_VISIBLE_PX = 120;

  function findPostElements(root) {
    const doc = root || document;
    const found = [];
    const seenEl = new Set();
    for (const selector of POST_SELECTORS) {
      let nodes = [];
      try {
        nodes = Array.from(doc.querySelectorAll(selector));
      } catch {
        continue;
      }
      for (const node of nodes) {
        if (!node || node.nodeType !== 1) continue;
        if (seenEl.has(node)) continue;
        if (isSkipped(node)) continue;
        seenEl.add(node);
        found.push(node);
      }
    }
    return found.filter((el) => !found.some((other) => other !== el && other.contains(el)));
  }

  function isSkipped(el) {
    return SKIP_INSIDE.some((sel) => {
      try {
        return Boolean(el.closest(sel));
      } catch {
        return false;
      }
    });
  }

  function extractPost(el) {
    if (!el || isSkipped(el)) return null;
    const id = postId(el);
    const text = postText(el);
    if (!id || !text || text.length < MIN_TEXT_CHARS) return null;
    return { id, text, author: postAuthor(el) };
  }

  function postId(el) {
    const attrs = ["data-id", "data-urn", "componentkey", "data-activity-urn"];
    for (const attr of attrs) {
      const value = el.getAttribute(attr);
      if (value && /urn:li:(activity|ugcPost|share|aggregatedShare)/.test(value)) {
        const match = value.match(/urn:li:(?:activity|ugcPost|share|aggregatedShare):[^\s,"]+/);
        return match ? match[0] : value;
      }
    }
    for (const attr of attrs) {
      const nested = el.querySelector(`[${attr}]`);
      const value = nested?.getAttribute(attr);
      if (value && value.includes("urn:li:")) return value;
    }
    const href = el.querySelector('a[href*="/feed/update/"], a[href*="/posts/"]')?.getAttribute("href");
    if (href) return href.split("?")[0];
    return "hash:" + hashText(postText(el) || el.textContent || "");
  }

  function postText(el) {
    for (const selector of TEXT_SELECTORS) {
      let node = null;
      try {
        node = el.querySelector(selector);
      } catch {
        node = null;
      }
      if (!node || node.closest(".comments-comment-item")) continue;
      const text = cleanText(node.innerText || node.textContent || "");
      if (text.length >= MIN_TEXT_CHARS) return text.slice(0, 6000);
    }
    const clone = el.cloneNode(true);
    clone.querySelectorAll(
      ".comments-comment-item, .social-details-social-counts, button, nav, .update-components-actor",
    ).forEach((n) => n.remove());
    const fallback = cleanText(clone.innerText || "");
    return fallback.length >= MIN_TEXT_CHARS ? fallback.slice(0, 6000) : "";
  }

  function postAuthor(el) {
    for (const selector of AUTHOR_SELECTORS) {
      let node = null;
      try {
        node = el.querySelector(selector);
      } catch {
        continue;
      }
      const text = cleanText(node?.innerText || node?.textContent || "");
      if (text && text.length < 80) return text.split("\n")[0];
    }
    const aria = el.querySelector("[aria-label*='post by'], [aria-label*='posta']")?.getAttribute("aria-label");
    if (aria) {
      const m = aria.match(/post by (.+)/i) || aria.match(/posta[:\s]+(.+)/i);
      if (m) return m[1].trim();
    }
    return "";
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/…więcej|…more|see more|więcej$/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hashText(text) {
    let h = 2166136261;
    const s = text.slice(0, 240);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function ensureBadge(el) {
    let badge = el.querySelector(":scope > .lais-badge");
    if (!badge) {
      if (typeof getComputedStyle === "function") {
        const pos = getComputedStyle(el).position;
        if (pos === "static") el.style.position = "relative";
      } else {
        el.style.position = el.style.position || "relative";
      }
      badge = (el.ownerDocument || document).createElement("div");
      badge.className = "lais-badge lais-badge--pending";
      badge.setAttribute("role", "status");
      el.appendChild(badge);
    }
    return badge;
  }

  function formatPercent(n) {
    const value = Number(n);
    if (!Number.isFinite(value)) return "";
    return `${Math.round(value * 100)}%`;
  }

  function readSlopProbability(result) {
    if (!result || typeof result !== "object") return NaN;
    const raw = result.slopProbability ?? result.slop_probability;
    return Number(raw);
  }

  function slopPercentLine(result) {
    const pct = formatPercent(readSlopProbability(result));
    return pct ? `AI slop: ${pct}` : "";
  }

  function intensityLine(result) {
    if (!result?.slopIntensityLabel) return "";
    const intensity = Number(result.slopIntensity);
    const suffix = Number.isFinite(intensity) ? ` (${intensity.toFixed(2)})` : "";
    return `Intensywność: ${result.slopIntensityLabel}${suffix}`;
  }

  function clearTip(badge) {
    badge.querySelector(":scope > .lais-tip")?.remove();
  }

  function paintScoredBadge(badge, result) {
    const doc = badge.ownerDocument || document;
    const percent = slopPercentLine(result);
    const intensity = intensityLine(result);
    badge.replaceChildren();
    const label = doc.createElement("span");
    label.className = "lais-badge__label";
    label.textContent = result.labelPl || "";
    badge.appendChild(label);
    if (!percent) {
      badge.removeAttribute("title");
      return;
    }
    const tip = doc.createElement("span");
    tip.className = "lais-tip";
    tip.setAttribute("role", "tooltip");
    const pctEl = doc.createElement("span");
    pctEl.className = "lais-tip__pct";
    pctEl.textContent = percent;
    tip.appendChild(pctEl);
    if (intensity) {
      const meta = doc.createElement("span");
      meta.className = "lais-tip__meta";
      meta.textContent = intensity;
      tip.appendChild(meta);
    }
    badge.appendChild(tip);
    badge.title = percent;
  }

  function setBadge(el, state, result) {
    const badge = ensureBadge(el);
    badge.className = `lais-badge lais-badge--${state}`;
    const scored = state === "human" || state === "mixed" || state === "slop" || state === "heavy";
    try {
      if (!scored) {
        clearTip(badge);
      }
      if (state === "pending") {
        badge.textContent = "Ocena…";
        badge.title = "Czekam na Jev (proxy lokalne)";
        return;
      }
      if (state === "info") {
        badge.textContent = result?.labelPl || "Potrzebujesz Pro";
        badge.title =
          result?.message ||
          "Darmowy limit Demo na dziś się wyczerpał. Pro odblokowuje wyższe limity. Checkout jest na stronie Pro.";
        return;
      }
      if (state === "error") {
        badge.textContent = "Błąd";
        badge.title = result?.message || "Nie udało się ocenić posta";
        return;
      }
      if (!scored) {
        if (result?.labelPl) badge.textContent = result.labelPl;
        if (result?.message) badge.title = result.message;
        return;
      }
      if (!result) return;
      paintScoredBadge(badge, result);
    } finally {
      syncCardFromState(el, state);
    }
  }

  function syncCardFromState(el, state) {
    if (state === "slop") {
      el.dataset.laisVerdict = "slop";
    } else {
      delete el.dataset.laisVerdict;
      delete el.dataset.laisRevealed;
      el.classList.remove("li-ai-slop-revealed");
    }
    syncCardBlur(el);
  }

  const CONTENT_BLUR = "blur(8px)";

  function syncCardBlur(el) {
    const slop = el.dataset.laisVerdict === "slop";
    const revealed = el.dataset.laisRevealed === "1";
    const allow = slop && settings.blurSlop !== false;
    const blur = allow && !revealed;
    el.classList.toggle("li-ai-slop-blurred", blur);
    el.classList.toggle("li-ai-slop-revealed", allow && revealed);
    ensureBlurLayer(el, blur);
    const badge = el.querySelector(":scope > .lais-badge");
    if (badge) syncRevealControl(badge, allow);
  }

  function isExtensionChrome(node) {
    return (
      node.classList?.contains("lais-badge") ||
      node.classList?.contains("lais-blur") ||
      node.classList?.contains("lais-reveal")
    );
  }

  function childElements(node) {
    const kids = node.children ? Array.from(node.children) : [];
    if (node.shadowRoot) kids.push(...node.shadowRoot.children);
    return kids;
  }

  function ensureBlurLayer(el, on) {
    const badge = el.querySelector(":scope > .lais-badge");
    if (!on) {
      el.querySelector(":scope > .lais-blur")?.remove();
      if (badge) badge.style.removeProperty("z-index");
      clearPaintedFilters(el);
      return;
    }
    let veil = el.querySelector(":scope > .lais-blur");
    if (!veil) {
      const doc = el.ownerDocument || document;
      veil = doc.createElement("div");
      veil.className = "lais-blur";
      veil.setAttribute("aria-hidden", "true");
      el.appendChild(veil);
    }
    veil.style.setProperty("position", "absolute", "important");
    veil.style.setProperty("top", "0", "important");
    veil.style.setProperty("right", "0", "important");
    veil.style.setProperty("bottom", "0", "important");
    veil.style.setProperty("left", "0", "important");
    veil.style.setProperty("z-index", "20", "important");
    veil.style.setProperty("display", "block", "important");
    veil.style.setProperty("box-sizing", "border-box", "important");
    veil.style.setProperty("pointer-events", "none", "important");
    veil.style.setProperty("background", "rgba(255, 252, 248, 0.4)", "important");
    veil.style.setProperty("backdrop-filter", "blur(14px) saturate(0.85)", "important");
    veil.style.setProperty("-webkit-backdrop-filter", "blur(14px) saturate(0.85)", "important");
    veil.dataset.laisVeil = "blur-14";
    if (badge) {
      badge.style.setProperty("z-index", "21", "important");
      el.appendChild(badge);
    }
    paintContentFilters(el);
  }

  function paintContentFilters(el) {
    function visit(node) {
      for (const child of childElements(node)) {
        if (isExtensionChrome(child)) continue;
        let display = child.style?.display || "";
        try {
          if (display !== "contents" && typeof getComputedStyle === "function") {
            display = getComputedStyle(child).display || display;
          }
        } catch {
          /* zostaw inline */
        }
        if (display === "contents") {
          visit(child);
          continue;
        }
        child.style.setProperty("filter", CONTENT_BLUR, "important");
        child.style.setProperty("-webkit-filter", CONTENT_BLUR, "important");
        child.dataset.laisFiltered = "1";
      }
    }
    visit(el);
  }

  function clearPaintedFilters(el) {
    const drop = [];
    function visit(node) {
      for (const child of childElements(node)) {
        if (child.dataset?.laisFiltered === "1") drop.push(child);
        visit(child);
      }
    }
    visit(el);
    try {
      el.querySelectorAll("[data-lais-filtered='1']").forEach((node) => drop.push(node));
    } catch {
      /* ignore */
    }
    for (const node of drop) {
      node.style.removeProperty("filter");
      node.style.removeProperty("-webkit-filter");
      delete node.dataset.laisFiltered;
    }
  }

  function syncRevealControl(badge, show) {
    let button = badge.querySelector(":scope > .lais-reveal");
    if (!show) {
      button?.remove();
      return;
    }
    if (!button) {
      const doc = badge.ownerDocument || document;
      button = doc.createElement("button");
      button.type = "button";
      button.className = "lais-reveal";
      button.addEventListener("click", onRevealClick);
      badge.appendChild(button);
    }
    const revealed = badge.parentElement?.dataset.laisRevealed === "1";
    button.textContent = revealed ? "Ukryj" : "Pokaż";
    button.title = revealed
      ? "Ukryj treść tego posta"
      : "Treść rozmyta, bo post sklasyfikowano jako AI slop. Pokaż ten post.";
    button.setAttribute("aria-pressed", revealed ? "true" : "false");
  }

  function onRevealClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    const card = button?.closest?.("[data-lais-verdict='slop']");
    if (!card) return;
    if (card.dataset.laisRevealed === "1") delete card.dataset.laisRevealed;
    else card.dataset.laisRevealed = "1";
    syncCardBlur(card);
  }

  function applySettings(partial) {
    if (partial && typeof partial === "object") settings = { ...settings, ...partial };
    if (typeof document !== "undefined") {
      document.querySelectorAll("[data-lais-verdict='slop']").forEach((el) => syncCardBlur(el));
    }
    return settings;
  }

  function extensionApi() {
    if (typeof globalThis !== "undefined" && globalThis.ExtApi?.storageGet) return globalThis.ExtApi;
    return null;
  }

  async function loadSettings() {
    const api = extensionApi();
    if (!api) {
      settings = { ...DEFAULTS };
      return settings;
    }
    const stored = await api.storageGet(DEFAULTS);
    settings = api.resolveSettings ? api.resolveSettings(stored) : {
      enabled: stored.enabled !== false,
      threshold: Number(stored.threshold) || DEFAULTS.threshold,
      proxyUrl: String(stored.proxyUrl || DEFAULTS.proxyUrl).replace(/\/$/, ""),
      mode: "demo",
      proToken: "",
      blurSlop: stored.blurSlop !== false,
    };
    return settings;
  }

  function scheduleScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scan, DEBOUNCE_MS);
  }

  function scan() {
    if (!settings.enabled) return;
    const posts = findPostElements(document);
    if (posts.length === 0) {
      if (!selectorMissLogged) {
        selectorMissLogged = true;
        console.info("[linkedin-ai-slop] brak kart postów — selektory LinkedIn mogły się zmienić");
      }
      return;
    }
    selectorMissLogged = false;
    for (const el of posts) {
      if (intersect) intersect.observe(el);
      if (!intersect || isInView(el)) enqueue(el);
    }
  }

  function isInView(el) {
    const rect = el.getBoundingClientRect();
    const height = window.innerHeight || document.documentElement.clientHeight || 0;
    return rect.bottom > 0 && rect.top < height && rect.height > 0;
  }

  function demoLimitActive() {
    if (settings.mode !== "demo") return false;
    const until = Math.max(demoLimitedUntil, readDemoLimitUntil());
    return until > Date.now();
  }

  function readDemoLimitUntil() {
    try {
      const n = Number(sessionStorage.getItem(DEMO_LIMIT_KEY));
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }

  function utcDayEnd(now = Date.now()) {
    const day = new Date(now).toISOString().slice(0, 10);
    return Date.parse(`${day}T00:00:00.000Z`) + 86_400_000;
  }

  function markDemoLimit() {
    const until = utcDayEnd();
    demoLimitedUntil = until;
    try {
      sessionStorage.setItem(DEMO_LIMIT_KEY, String(until));
    } catch {
      /* sesja bez storage */
    }
    queue.length = 0;
  }

  function clearDemoLimit() {
    demoLimitedUntil = 0;
    try {
      sessionStorage.removeItem(DEMO_LIMIT_KEY);
    } catch {
      /* ignore */
    }
  }

  function enqueue(el) {
    if (!settings.enabled) return;
    if (demoLimitActive()) return;
    const post = extractPost(el);
    if (!post) return;
    const cached = verdicts.get(post.id);
    if (cached) {
      if (!el.querySelector(":scope > .lais-badge")) {
        setBadge(el, cached.badge || "human", cached);
      } else if (cached.badge === "slop") {
        el.dataset.laisVerdict = "slop";
        syncCardBlur(el);
      }
      return;
    }
    if (seen.has(post.id) || inFlight.has(post.id)) return;
    const failed = failedAt.get(post.id);
    if (failed && Date.now() - failed < 15000) return;
    if (queue.some((item) => item.id === post.id)) return;
    if (queue.length >= MAX_QUEUE) queue.shift();
    queue.push({ el, ...post, gen: generation });
    pump();
  }

  function pump() {
    while (active < CONCURRENCY && queue.length) {
      const item = queue.shift();
      if (!item || item.gen !== generation || seen.has(item.id)) continue;
      active += 1;
      inFlight.add(item.id);
      evaluate(item)
        .catch((error) => {
          if (item.gen !== generation) return;
          if (error?.code === "demo_limit" && error?.upgrade && settings.mode === "demo") {
            markDemoLimit();
            seen.add(item.id);
            setBadge(item.el, "info", {
              labelPl: "Potrzebujesz Pro",
              message:
                "Darmowy limit Demo na dziś się wyczerpał. Pro odblokowuje wyższe limity. Checkout jest na stronie Pro.",
            });
            return;
          }
          failedAt.set(item.id, Date.now());
          setBadge(item.el, "error", { message: error.message });
        })
        .finally(() => {
          inFlight.delete(item.id);
          active -= 1;
          pump();
        });
    }
  }

  async function evaluate(item) {
    if (demoLimitActive()) {
      seen.add(item.id);
      setBadge(item.el, "info", {
        labelPl: "Potrzebujesz Pro",
        message:
          "Darmowy limit Demo na dziś się wyczerpał. Pro odblokowuje wyższe limity. Checkout jest na stronie Pro.",
      });
      return;
    }
    setBadge(item.el, "pending");
    tryExpand(item.el);
    const text = postText(item.el) || item.text;
    const payload = {
      postId: item.id,
      text,
      author: item.author || undefined,
      threshold: settings.threshold,
      proxyUrl: settings.proxyUrl,
    };
    const result = await requestEvaluation(payload);
    if (item.gen !== generation) return;
    seen.add(item.id);
    verdicts.set(item.id, result);
    setBadge(item.el, result.badge || "human", result);
  }

  function requestEvaluation(payload) {
    const api = extensionApi();
    if (api?.hasRuntime?.() && api.sendMessage) {
      return api.sendMessage({ type: "evaluate", payload }).then((response) => {
        if (!response?.ok) throw proxyError(response?.body, "Proxy nie oceniło posta");
        return response.body;
      });
    }
    const headers = { "Content-Type": "application/json" };
    if (settings.proToken) headers["X-Pro-Token"] = settings.proToken;
    return fetch(`${settings.proxyUrl}/evaluate`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }).then(async (response) => {
      if (!response.ok) {
        let body = null;
        try {
          body = await response.json();
        } catch {
          /* puste ciało */
        }
        throw proxyError(body, `HTTP ${response.status}`);
      }
      return response.json();
    });
  }

  function proxyError(body, fallback) {
    const message = body?.message || body?.error || fallback;
    const error = new Error(message);
    error.code = body?.error;
    error.upgrade = body?.upgrade === true;
    noteProxy(message);
    return error;
  }

  function noteProxy(message) {
    if (warnedProxy) return;
    warnedProxy = true;
    console.warn("[linkedin-ai-slop] proxy:", message);
  }

  function tryExpand(el) {
    const buttons = el.querySelectorAll("button, .see-more, .line-clamp-show-more-button");
    for (const btn of buttons) {
      if (btn.closest(".comments-comment-item, .comments-comments-list")) continue;
      const label = `${btn.innerText || ""} ${btn.getAttribute("aria-label") || ""}`
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (/^(…\s*)?(see more|show more|więcej|…more|…więcej)$/i.test(label)) {
        try {
          btn.click();
        } catch {
          /* LinkedIn czasem blokuje syntetyczny click — ocena idzie na skrócie */
        }
        break;
      }
    }
  }

  function watchNavigation() {
    if (watchNavigation.hooked) return;
    watchNavigation.hooked = true;
    lastHref = typeof location !== "undefined" ? location.href : "";
    const onChange = () => {
      const href = typeof location !== "undefined" ? location.href : "";
      if (href === lastHref) return;
      lastHref = href;
      selectorMissLogged = false;
      scheduleScan();
    };
    const wrap = (name) => {
      const orig = history[name];
      if (typeof orig !== "function") return;
      history[name] = function patchedHistory() {
        const result = orig.apply(this, arguments);
        onChange();
        return result;
      };
    };
    wrap("pushState");
    wrap("replaceState");
    window.addEventListener("popstate", onChange);
  }

  function watch() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("scroll", scheduleScan, { passive: true });
    document.addEventListener("scroll", scheduleScan, { passive: true, capture: true });
    watchNavigation();

    if (typeof IntersectionObserver === "function") {
      intersect = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const visiblePx = entry.intersectionRect ? entry.intersectionRect.height : 0;
            if (entry.intersectionRatio >= INTERSECT_RATIO || visiblePx >= MIN_VISIBLE_PX) {
              enqueue(entry.target);
            }
          }
        },
        { threshold: [0, INTERSECT_RATIO, 0.6] },
      );
    }
    scheduleScan();
  }

  function clearBadges() {
    document.querySelectorAll("[data-lais-filtered]").forEach((node) => {
      node.style.removeProperty("filter");
      node.style.removeProperty("-webkit-filter");
      delete node.dataset.laisFiltered;
    });
    document.querySelectorAll(".lais-badge, .lais-blur").forEach((n) => n.remove());
    document.querySelectorAll(".li-ai-slop-blurred, .li-ai-slop-revealed, [data-lais-verdict]").forEach((el) => {
      el.classList.remove("li-ai-slop-blurred", "li-ai-slop-revealed");
      delete el.dataset.laisVerdict;
      delete el.dataset.laisRevealed;
    });
  }

  async function boot() {
    if (booted) return;
    booted = true;
    await loadSettings();
    const api = extensionApi();
    if (api?.onStorageChanged) {
      api.onStorageChanged((changes) => {
        if (changes.blurSlop) settings.blurSlop = changes.blurSlop.newValue !== false;
        const changedKeys = Object.keys(changes);
        if (changedKeys.length > 0 && changedKeys.every((key) => key === "blurSlop")) {
          applySettings({ blurSlop: settings.blurSlop });
          return;
        }
        if (changes.enabled) settings.enabled = changes.enabled.newValue !== false;
        if (changes.threshold) settings.threshold = Number(changes.threshold.newValue) || DEFAULTS.threshold;
        if (changes.proxyUrl || changes.mode || changes.proToken || changes.byokProxyUrl) {
          const apiNow = extensionApi();
          const next = {
            ...settings,
            proxyUrl: changes.proxyUrl ? changes.proxyUrl.newValue : settings.proxyUrl,
            mode: changes.mode ? changes.mode.newValue : settings.mode,
            proToken: changes.proToken ? changes.proToken.newValue : settings.proToken,
            byokProxyUrl: changes.byokProxyUrl ? changes.byokProxyUrl.newValue : settings.byokProxyUrl,
          };
          settings = apiNow?.resolveSettings ? apiNow.resolveSettings(next) : next;
        }
        generation += 1;
        queue.length = 0;
        warnedProxy = false;
        failedAt.clear();
        if (settings.mode !== "demo") clearDemoLimit();
        if (!settings.enabled) {
          clearBadges();
          return;
        }
        seen.clear();
        verdicts.clear();
        clearBadges();
        scheduleScan();
      });
    }
    if (!settings.enabled) return;
    watch();
  }

  return {
    boot,
    findPostElements,
    extractPost,
    postId,
    postText,
    setBadge,
    applySettings,
    DEFAULTS,
  };
});
