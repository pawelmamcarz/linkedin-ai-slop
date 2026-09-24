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
    minTextChars: 200,
  };

  /** Domyślna minimalna długość własnego tekstu po odcięciu hashtagów, wzmianek, URL i emoji. */
  const DEFAULT_MIN_TEXT_CHARS = 200;
  const MIN_TEXT_CHARS_FLOOR = 40;
  const MIN_TEXT_CHARS_CEILING = 2000;
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

  const ACTOR_HEADER_SELECTORS = [
    ".update-components-actor",
    ".feed-shared-actor",
    ".update-components-actor__container",
    '[data-view-name="feed-actor"]',
    '[data-view-name="feed-header"]',
    '[data-view-name="feed-header-actor"]',
  ];

  /** Kontenery cudzego posta w środku udostępnienia. Nie obejmują własnego komentarza autora. */
  const NESTED_UPDATE_SELECTORS = [
    ".feed-shared-update-v2__update-content-wrapper",
    ".update-components-mini-update-v2",
    ".feed-shared-mini-update-v2",
    ".update-components-mini-update",
    ".feed-shared-update-v2--nested",
    ".update-components-reshared-content",
    ".feed-shared-update-v2__reshared-content",
    '[data-view-name="feed-reshared-update"]',
    '[data-view-name="feed-reshare-content"]',
    '[data-view-name="feed-reshare"]',
  ];

  const SELF_PROFILE_SELECTORS = [
    ".global-nav__me a[href*='/in/']",
    "a.global-nav__primary-link--me",
    ".global-nav__me-content a[href*='/in/']",
    "a[data-control-name='identity_profile_photo']",
    "a[data-control-name='nav.settings_view_profile']",
    "[data-view-name='nav-me'] a[href*='/in/']",
    "a[data-view-name='navigation-me']",
    "a[data-view-name='identity-self-profile']",
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
    return found.filter((el) => {
      return !found.some((other) => {
        if (other === el || !other.contains(el)) return false;
        const inner = ownUrn(el);
        const outer = ownUrn(other);
        if (inner && outer && inner !== outer) return false;
        return true;
      });
    });
  }

  function clampMinTextChars(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_MIN_TEXT_CHARS;
    return Math.min(MIN_TEXT_CHARS_CEILING, Math.max(MIN_TEXT_CHARS_FLOOR, Math.round(n)));
  }

  function minTextChars() {
    return clampMinTextChars(settings.minTextChars);
  }

  function ownUrn(el) {
    if (!el || el.nodeType !== 1) return "";
    const attrs = ["data-id", "data-urn", "componentkey", "data-activity-urn"];
    for (const attr of attrs) {
      const value = el.getAttribute(attr);
      if (!value || !/urn:li:(activity|ugcPost|share|aggregatedShare)/.test(value)) continue;
      const match = value.match(/urn:li:(?:activity|ugcPost|share|aggregatedShare):[^\s,"]+/);
      return match ? match[0] : value;
    }
    return "";
  }

  function matchesSelector(node, selector) {
    try {
      return Boolean(node?.matches?.(selector));
    } catch {
      return false;
    }
  }

  function isInsideNestedUpdate(node, root) {
    if (!node || !root || node === root) return false;
    const rootUrn = ownUrn(root);
    let current = node.nodeType === 1 ? node : node.parentElement;
    while (current && current !== root) {
      if (NESTED_UPDATE_SELECTORS.some((selector) => matchesSelector(current, selector))) return true;
      const urn = ownUrn(current);
      if (rootUrn && urn && urn !== rootUrn) return true;
      current = current.parentElement;
    }
    return false;
  }

  function profileSlugFromHref(href) {
    if (!href) return "";
    try {
      const url = new URL(href, "https://www.linkedin.com");
      const match = url.pathname.match(/\/in\/([^/]+)/i);
      return match ? decodeURIComponent(match[1]).replace(/\/$/, "").toLowerCase() : "";
    } catch {
      return "";
    }
  }

  function selfProfileSlug() {
    const doc = typeof document !== "undefined" ? document : null;
    if (!doc) return "";
    for (const selector of SELF_PROFILE_SELECTORS) {
      let nodes = [];
      try {
        nodes = Array.from(doc.querySelectorAll(selector));
      } catch {
        continue;
      }
      for (const node of nodes) {
        const slug = profileSlugFromHref(node.getAttribute("href") || "");
        if (slug) return slug;
      }
    }
    let links = [];
    try {
      links = Array.from(doc.querySelectorAll("nav a[href*='/in/'], header a[href*='/in/'], .global-nav a[href*='/in/']"));
    } catch {
      links = [];
    }
    for (const link of links) {
      const label = `${link.getAttribute("aria-label") || ""} ${link.innerText || ""}`.replace(/\s+/g, " ").trim();
      if (!/^(me|ja)\b/i.test(label)) continue;
      const slug = profileSlugFromHref(link.getAttribute("href") || "");
      if (slug) return slug;
    }
    return "";
  }

  function isOwnProfileSurface() {
    const self = selfProfileSlug();
    if (!self || typeof location === "undefined") return false;
    const page = profileSlugFromHref(location.pathname);
    if (!page || page !== self) return false;
    return /\/recent-activity(\/|$)/.test(location.pathname) || /\/in\/[^/]+\/?$/.test(location.pathname);
  }

  function actorProfileSlug(el) {
    let links = [];
    try {
      links = Array.from(el.querySelectorAll('a[href*="/in/"]'));
    } catch {
      return "";
    }
    for (const link of links) {
      if (link.closest(".comments-comment-item, .comments-comments-list")) continue;
      if (isInsideNestedUpdate(link, el)) continue;
      const slug = profileSlugFromHref(link.getAttribute("href") || "");
      if (slug) return slug;
    }
    return "";
  }

  function isNestedCard(el) {
    const parent = el?.parentElement?.closest?.(POST_SELECTORS.join(","));
    return Boolean(parent && parent !== el);
  }

  function isOwnPost(el) {
    const self = selfProfileSlug();
    if (!self || !el) return false;
    const actor = actorProfileSlug(el);
    if (actor) return actor === self;
    if (isOwnProfileSurface() && !isNestedCard(el)) return true;
    return false;
  }

  function substantiveText(value) {
    return String(value || "")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/\bwww\.\S+/gi, " ")
      .replace(/[#＃][\p{L}\p{N}_-]+/gu, " ")
      .replace(/@[\p{L}\p{N}_.-]+/gu, " ")
      .replace(/\p{Extended_Pictographic}/gu, " ")
      .replace(/[\u{1F1E6}-\u{1F1FF}\u200D\uFE0F]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
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
    if (!el || isSkipped(el) || isOwnPost(el)) return null;
    const id = postId(el);
    const text = postText(el);
    if (!id || !text || substantiveText(text).length < minTextChars()) return null;
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

  function queryAll(root, selector) {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  function stripNestedFromClone(clone, rootUrn) {
    const drop = [];
    for (const node of queryAll(clone, "*")) {
      if (NESTED_UPDATE_SELECTORS.some((selector) => matchesSelector(node, selector))) {
        drop.push(node);
        continue;
      }
      const urn = ownUrn(node);
      if (rootUrn && urn && urn !== rootUrn) drop.push(node);
    }
    for (const node of drop) {
      if (node.isConnected) node.remove();
    }
    clone.querySelectorAll(
      ".comments-comment-item, .comments-comments-list, .social-details-social-counts, button, nav, .update-components-actor",
    ).forEach((node) => node.remove());
  }

  function postText(el) {
    let best = "";
    for (const selector of TEXT_SELECTORS) {
      for (const node of queryAll(el, selector)) {
        if (node.closest(".comments-comment-item, .comments-comments-list")) continue;
        if (isInsideNestedUpdate(node, el)) continue;
        const text = cleanText(node.innerText || node.textContent || "");
        if (text.length > best.length) best = text;
      }
    }
    if (best) return best.slice(0, 6000);
    const clone = el.cloneNode(true);
    stripNestedFromClone(clone, ownUrn(el));
    const fallback = cleanText(clone.innerText || "");
    return fallback ? fallback.slice(0, 6000) : "";
  }

  function postAuthor(el) {
    for (const selector of AUTHOR_SELECTORS) {
      for (const node of queryAll(el, selector)) {
        if (isInsideNestedUpdate(node, el)) continue;
        if (node.closest(".comments-comment-item, .comments-comments-list")) continue;
        const text = cleanText(node?.innerText || node?.textContent || "");
        if (text && text.length < 80) return text.split("\n")[0];
      }
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
      el.classList.remove("li-ai-slop-revealed", "li-ai-slop-covered", "li-ai-slop-blurred");
    }
    syncCardCover(el);
  }

  const SCRIM = "rgba(255, 252, 248, 0.92)";
  const REPLACED_TAGS = new Set(["IMG", "VIDEO", "CANVAS", "SVG", "PICTURE", "INPUT"]);
  let repairingCover = false;

  function syncCardCover(el) {
    const slop = el.dataset.laisVerdict === "slop";
    const revealed = el.dataset.laisRevealed === "1";
    const allow = slop && settings.blurSlop !== false;
    el.classList.toggle("li-ai-slop-covered", allow && !revealed);
    el.classList.toggle("li-ai-slop-revealed", allow && revealed);
    el.classList.remove("li-ai-slop-blurred");
    ensureCover(el, allow, revealed);
    const badge = el.querySelector(":scope > .lais-badge");
    if (badge) {
      badge.classList.toggle("lais-badge--folded", allow);
      badge.querySelector(":scope > .lais-reveal")?.remove();
    }
  }

  function isExtensionChrome(node) {
    if (!node?.classList) return false;
    if (
      node.classList.contains("lais-badge") ||
      node.classList.contains("lais-cover") ||
      node.classList.contains("lais-banner") ||
      node.classList.contains("lais-scrim") ||
      node.classList.contains("lais-reveal") ||
      node.classList.contains("lais-tip")
    ) {
      return true;
    }
    return Boolean(node.closest?.(".lais-badge, .lais-cover, .lais-banner"));
  }

  function isContentsDisplay(node) {
    let display = node?.style?.display || "";
    if (display === "contents") return true;
    try {
      if (typeof getComputedStyle === "function") {
        display = getComputedStyle(node).display || display;
      }
    } catch {
      /* zostaw inline */
    }
    return display === "contents";
  }

  function childElements(node) {
    const kids = node.children ? Array.from(node.children) : [];
    if (node.shadowRoot) kids.push(...node.shadowRoot.children);
    return kids;
  }

  function canHostVeil(node) {
    return node?.nodeType === 1 && !REPLACED_TAGS.has(node.tagName);
  }

  function ensurePaintBox(node) {
    if (!canHostVeil(node) || isContentsDisplay(node)) return false;
    try {
      if (typeof getComputedStyle === "function") {
        const pos = getComputedStyle(node).position;
        if (!pos || pos === "static") node.style.setProperty("position", "relative", "important");
      } else if (!node.style.position) {
        node.style.setProperty("position", "relative", "important");
      }
    } catch {
      node.style.setProperty("position", "relative", "important");
    }
    return true;
  }

  function pinBox(node, styles) {
    for (const [key, value] of Object.entries(styles)) {
      node.style.setProperty(key, value, "important");
    }
  }

  function clearCoverNodes(el) {
    const drop = [];
    function visit(node) {
      for (const child of childElements(node)) {
        if (
          child.classList?.contains("lais-cover") ||
          child.classList?.contains("lais-banner") ||
          child.classList?.contains("lais-scrim")
        ) {
          drop.push(child);
          continue;
        }
        if (child.dataset?.laisDimmed) drop.push(child);
        visit(child);
      }
    }
    visit(el);
    for (const node of drop) {
      if (node.dataset?.laisDimmed && !node.classList.contains("lais-cover")) {
        node.classList.remove("lais-dimmed");
        node.style.removeProperty("opacity");
        delete node.dataset.laisDimmed;
        continue;
      }
      node.remove();
    }
  }

  function bannerCopy(el) {
    const badge = el.querySelector(".lais-badge");
    const label = badge?.querySelector(".lais-badge__label")?.textContent || "AI slop";
    const percent = badge?.querySelector(".lais-tip__pct")?.textContent || "";
    const meta = badge?.querySelector(".lais-tip__meta")?.textContent || "";
    const title = badge?.getAttribute("title") || percent;
    return { label: String(label).trim() || "AI slop", percent, meta, title };
  }

  function fillBanner(banner, el, revealed, placement) {
    const doc = banner.ownerDocument || document;
    const copy = bannerCopy(el);
    banner.className = revealed ? "lais-banner lais-banner--open" : "lais-banner";
    banner.replaceChildren();
    const label = doc.createElement("span");
    label.className = "lais-banner__label";
    label.textContent = copy.label;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "lais-reveal";
    button.textContent = revealed ? "Ukryj" : "Pokaż";
    button.title = revealed
      ? "Ukryj treść tego posta"
      : "Post zakryty, bo sklasyfikowano go jako AI slop. Pokaż ten post.";
    button.setAttribute("aria-pressed", revealed ? "true" : "false");
    button.addEventListener("click", onRevealClick);
    banner.append(label, button);
    if (copy.percent) {
      const tip = doc.createElement("span");
      tip.className = "lais-tip";
      tip.setAttribute("role", "tooltip");
      const pctEl = doc.createElement("span");
      pctEl.className = "lais-tip__pct";
      pctEl.textContent = copy.percent;
      tip.appendChild(pctEl);
      if (copy.meta) {
        const meta = doc.createElement("span");
        meta.className = "lais-tip__meta";
        meta.textContent = copy.meta;
        tip.appendChild(meta);
      }
      banner.appendChild(tip);
    }
    if (copy.title) banner.title = copy.title;
    const inFlow = placement === "flow";
    const floating = revealed && !inFlow;
    pinBox(banner, {
      position: floating ? "absolute" : "relative",
      "z-index": "22",
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "12px",
      "box-sizing": "border-box",
      width: floating ? "auto" : "100%",
      margin: inFlow ? "8px 0" : "0",
      padding: revealed ? "10px 14px" : "16px 18px",
      "border-radius": "14px",
      background: "#9f1239",
      color: "#fffdf8",
      "font-family": '"Segoe UI", system-ui, sans-serif',
      "font-size": revealed ? "18px" : "22px",
      "font-weight": "750",
      "line-height": "1.2",
      "pointer-events": "auto",
      filter: "none",
      "-webkit-filter": "none",
      top: floating ? "8px" : "auto",
      right: floating ? "8px" : "auto",
      left: floating ? "8px" : "auto",
    });
  }

  function commentaryNode(card) {
    for (const selector of TEXT_SELECTORS) {
      for (const node of queryAll(card, selector)) {
        if (node.closest(".comments-comment-item, .comments-comments-list")) continue;
        if (isInsideNestedUpdate(node, card)) continue;
        return node;
      }
    }
    return null;
  }

  function actorHeader(card) {
    if (!card) return null;
    for (const selector of ACTOR_HEADER_SELECTORS) {
      for (const node of queryAll(card, selector)) {
        if (isInsideNestedUpdate(node, card)) continue;
        if (node.closest(".comments-comment-item, .comments-comments-list")) continue;
        return node;
      }
    }
    const commentary = commentaryNode(card);
    let avatar = null;
    for (const node of queryAll(card, "a[href*='/in/'] img, img.update-components-actor__avatar, [data-view-name='feed-actor-image'], a[data-view-name='feed-actor-image']")) {
      if (isInsideNestedUpdate(node, card)) continue;
      if (node.closest(".comments-comment-item")) continue;
      avatar = node;
      break;
    }
    if (!avatar) return null;
    let node = avatar;
    while (node.parentElement && node.parentElement !== card) {
      const parent = node.parentElement;
      if (commentary && parent.contains(commentary) && !node.contains(commentary)) break;
      node = parent;
    }
    return node === card ? null : node;
  }

  function offsetBelow(card, actor) {
    const cardRect = card.getBoundingClientRect?.();
    const actorRect = actor.getBoundingClientRect?.();
    if (cardRect && actorRect && (actorRect.height > 0 || actorRect.bottom > cardRect.top)) {
      return Math.max(0, Math.round(actorRect.bottom - cardRect.top));
    }
    let top = 0;
    let node = actor;
    const guard = new Set();
    while (node && node !== card && !guard.has(node)) {
      guard.add(node);
      top += node.offsetTop || 0;
      const next = node.offsetParent;
      if (!next || next === node) break;
      if (next !== card && !card.contains(next)) break;
      node = next;
    }
    return Math.max(0, top + (actor.offsetHeight || 0));
  }

  function styleCover(cover) {
    pinBox(cover, {
      position: "absolute",
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
      "z-index": "20",
      display: "flex",
      "align-items": "center",
      "box-sizing": "border-box",
      margin: "0",
      padding: "16px",
      border: "0",
      background: SCRIM,
      "pointer-events": "auto",
      filter: "none",
      "-webkit-filter": "none",
      "backdrop-filter": "none",
      "-webkit-backdrop-filter": "none",
    });
  }

  function mountCover(host, card) {
    ensurePaintBox(host);
    const doc = host.ownerDocument || document;
    let cover = null;
    for (const child of childElements(host)) {
      if (child.classList?.contains("lais-cover")) {
        cover = child;
        break;
      }
    }
    if (!cover) {
      cover = doc.createElement("div");
      cover.className = "lais-cover";
      host.appendChild(cover);
    }
    styleCover(cover);
    let banner = null;
    for (const child of childElements(cover)) {
      if (child.classList?.contains("lais-banner")) {
        banner = child;
        break;
      }
    }
    if (!banner) {
      banner = doc.createElement("div");
      banner.setAttribute("role", "status");
      cover.appendChild(banner);
    }
    fillBanner(banner, card, false, "cover");
  }

  function mountCoverBelowActor(card, actor) {
    ensurePaintBox(card);
    const doc = card.ownerDocument || document;
    const cover = doc.createElement("div");
    cover.className = "lais-cover lais-cover--below-actor";
    card.appendChild(cover);
    styleCover(cover);
    const top = offsetBelow(card, actor);
    pinBox(cover, { top: `${top}px` });
    const banner = doc.createElement("div");
    banner.setAttribute("role", "status");
    cover.appendChild(banner);
    fillBanner(banner, card, false, "cover");
  }

  function mountFlowBanner(actor, card) {
    const doc = actor.ownerDocument || document;
    const banner = doc.createElement("div");
    banner.setAttribute("role", "status");
    actor.insertAdjacentElement("afterend", banner);
    fillBanner(banner, card, true, "flow");
  }

  function mountOpenBanner(host, card) {
    ensurePaintBox(host);
    const doc = host.ownerDocument || document;
    let banner = null;
    for (const child of childElements(host)) {
      if (child.classList?.contains("lais-banner")) {
        banner = child;
        break;
      }
    }
    if (!banner) {
      banner = doc.createElement("div");
      banner.setAttribute("role", "status");
      host.appendChild(banner);
    }
    fillBanner(banner, card, true, "overlay");
  }

  function mountScrim(host) {
    ensurePaintBox(host);
    let scrim = null;
    for (const child of childElements(host)) {
      if (child.classList?.contains("lais-scrim")) {
        scrim = child;
        break;
      }
    }
    if (!scrim) {
      const doc = host.ownerDocument || document;
      scrim = doc.createElement("div");
      scrim.className = "lais-scrim";
      scrim.setAttribute("aria-hidden", "true");
      host.appendChild(scrim);
    }
    pinBox(scrim, {
      position: "absolute",
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
      "z-index": "20",
      display: "block",
      background: SCRIM,
      "pointer-events": "auto",
      filter: "none",
      "backdrop-filter": "none",
    });
  }

  function dimReplaced(node) {
    if (!REPLACED_TAGS.has(node.tagName)) return;
    node.classList.add("lais-dimmed");
    node.style.setProperty("opacity", "0.12", "important");
    node.dataset.laisDimmed = "1";
  }

  function hostBoxes(el) {
    const boxes = [];
    function visit(node) {
      for (const child of childElements(node)) {
        if (isExtensionChrome(child)) continue;
        if (isContentsDisplay(child)) {
          visit(child);
          continue;
        }
        boxes.push(child);
      }
    }
    visit(el);
    return boxes;
  }

  function ensureCover(el, allow, revealed) {
    if (!allow) {
      clearCoverNodes(el);
      return;
    }
    const rooted = ensurePaintBox(el);
    const boxes = rooted ? [] : hostBoxes(el);
    clearCoverNodes(el);
    const actor = actorHeader(el);
    if (actor && rooted) {
      if (revealed) mountFlowBanner(actor, el);
      else mountCoverBelowActor(el, actor);
      return;
    }
    if (rooted) {
      if (revealed) mountOpenBanner(el, el);
      else mountCover(el, el);
      return;
    }
    const hosts = boxes.filter((box) => {
      if (!canHostVeil(box)) return false;
      if (!actor) return true;
      if (box === actor || actor.contains(box)) return false;
      return true;
    });
    if (actor && revealed) {
      mountFlowBanner(actor, el);
      return;
    }
    const target = hosts[0] || el;
    if (revealed) {
      mountOpenBanner(target, el);
      return;
    }
    if (hosts.length) mountCover(hosts[0], el);
    else mountOpenBanner(el, el);
    for (const box of hosts.slice(1)) mountScrim(box);
    for (const box of boxes) dimReplaced(box);
  }

  function coverNeedsRepair(el) {
    const allow = el.dataset.laisVerdict === "slop" && settings.blurSlop !== false;
    const revealed = el.dataset.laisRevealed === "1";
    const hasCover = Boolean(el.querySelector(".lais-cover, .lais-scrim"));
    const hasBanner = Boolean(el.querySelector(".lais-banner"));
    const actor = actorHeader(el);
    if (actor && !isContentsDisplay(el)) {
      if (!allow) return hasCover || hasBanner || el.classList.contains("li-ai-slop-covered");
      if (revealed) {
        const banner = actor.nextElementSibling;
        return hasCover || !banner?.classList?.contains("lais-banner") || !el.classList.contains("li-ai-slop-revealed");
      }
      const cover = el.querySelector(":scope > .lais-cover.lais-cover--below-actor");
      if (!el.classList.contains("li-ai-slop-covered") || !cover?.querySelector(".lais-banner")) return true;
      return false;
    }
    if (!allow) return hasCover || hasBanner || el.classList.contains("li-ai-slop-covered");
    if (revealed) return hasCover || !hasBanner || !el.classList.contains("li-ai-slop-revealed");
    if (!el.classList.contains("li-ai-slop-covered") || !hasBanner) return true;
    if (!isContentsDisplay(el)) return !el.querySelector(":scope > .lais-cover");
    const hosts = hostBoxes(el).filter((box) => canHostVeil(box));
    if (!hosts.length) return !hasBanner;
    if (!hosts[0].querySelector(":scope > .lais-cover")) return true;
    return hosts.slice(1).some((box) => !box.querySelector(":scope > .lais-scrim"));
  }

  function repairSlopCovers() {
    if (repairingCover || typeof document === "undefined") return;
    repairingCover = true;
    try {
      document.querySelectorAll("[data-lais-verdict='slop']").forEach((el) => {
        if (coverNeedsRepair(el)) syncCardCover(el);
      });
    } finally {
      repairingCover = false;
    }
  }

  function onRevealClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    const card = button?.closest?.("[data-lais-verdict='slop']");
    if (!card) return;
    if (card.dataset.laisRevealed === "1") delete card.dataset.laisRevealed;
    else card.dataset.laisRevealed = "1";
    syncCardCover(card);
  }

  function applySettings(partial) {
    if (partial && typeof partial === "object") settings = { ...settings, ...partial };
    if (typeof document !== "undefined") {
      document.querySelectorAll("[data-lais-verdict='slop']").forEach((el) => syncCardCover(el));
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
      minTextChars: clampMinTextChars(stored.minTextChars),
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

  function clearCardChrome(el) {
    if (!el) return;
    el.querySelectorAll("[data-lais-dimmed]").forEach((node) => {
      node.classList.remove("lais-dimmed");
      node.style.removeProperty("opacity");
      delete node.dataset.laisDimmed;
    });
    el.querySelectorAll(".lais-badge, .lais-cover, .lais-banner, .lais-scrim").forEach((node) => node.remove());
    el.classList.remove("li-ai-slop-covered", "li-ai-slop-blurred", "li-ai-slop-revealed");
    delete el.dataset.laisVerdict;
    delete el.dataset.laisRevealed;
  }

  function enqueue(el) {
    if (!settings.enabled) return;
    if (demoLimitActive()) return;
    if (isOwnPost(el)) {
      clearCardChrome(el);
      return;
    }
    const post = extractPost(el);
    if (!post) return;
    const cached = verdicts.get(post.id);
    if (cached) {
      if (!el.querySelector(":scope > .lais-badge")) {
        setBadge(el, cached.badge || "human", cached);
      } else if (cached.badge === "slop") {
        el.dataset.laisVerdict = "slop";
        syncCardCover(el);
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
    observer = new MutationObserver(() => {
      repairSlopCovers();
      scheduleScan();
    });
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
    document.querySelectorAll("[data-lais-dimmed]").forEach((node) => {
      node.classList.remove("lais-dimmed");
      node.style.removeProperty("opacity");
      delete node.dataset.laisDimmed;
    });
    document.querySelectorAll(".lais-badge, .lais-cover, .lais-banner, .lais-scrim").forEach((n) => n.remove());
    document.querySelectorAll(".li-ai-slop-covered, .li-ai-slop-blurred, .li-ai-slop-revealed, [data-lais-verdict]").forEach((el) => {
      el.classList.remove("li-ai-slop-covered", "li-ai-slop-blurred", "li-ai-slop-revealed");
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
        if (changes.minTextChars) settings.minTextChars = clampMinTextChars(changes.minTextChars.newValue);
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
    postAuthor,
    substantiveText,
    isOwnPost,
    selfProfileSlug,
    actorHeader,
    setBadge,
    applySettings,
    DEFAULTS,
    DEFAULT_MIN_TEXT_CHARS,
  };
});
