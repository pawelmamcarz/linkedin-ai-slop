import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { JSDOM } from "jsdom";

const extension = resolve(import.meta.dirname, "../../extension");
const content = readFileSync(resolve(extension, "content.js"), "utf8");
const extApi = readFileSync(resolve(extension, "ext-api.js"), "utf8");
const human = { badge: "human", labelPl: "Ludzki", slopProbability: 0.08 };
const slop = { badge: "slop", labelPl: "AI slop", slopProbability: 0.93, slopIntensity: 1.8, slopIntensityLabel: "heavy", voice: "ai_slop", voiceProbability: 0.9 };
const text = "Prawdziwy sukces zaczyna się tam, gdzie kończy się strefa komfortu. Każdy dzień jest nową szansą, by zmienić wyzwania w możliwości i inspirować innych do działania.";
type Payload = { postId: string; text: string };

function fixture(evaluate: (payload: Payload) => Promise<unknown>, postText = text, enabled = true) {
  const dom = new JSDOM('<html data-slop-demo="1"><body><article class="feed-shared-update-v2" data-urn="urn:li:activity:test"><div class="update-components-actor">Ada</div><div class="update-components-text"></div><button class="reaction">Lubię to</button></article></body></html>', {
    url: "http://localhost:8787/demo", runScripts: "outside-only", pretendToBeVisual: true,
  });
  const win = dom.window as unknown as Window & { eval: (script: string) => void; ExtApi: Record<string, unknown>; LinkedInAiSlop: { boot: () => Promise<void> } };
  const copy = dom.window.document.querySelector(".update-components-text")!;
  copy.textContent = postText;
  win.eval(extApi);
  win.eval(readFileSync(resolve(extension, "verdict-policy.js"), "utf8"));
  let changed!: (changes: Record<string, { newValue: unknown }>) => void;
  win.ExtApi = { ...win.ExtApi, hasRuntime: () => false, storageGet: async (defaults: object) => ({ ...defaults, enabled }), onStorageChanged: (cb: typeof changed) => { changed = cb; }, sendMessage: async (message: { payload: Payload }) => evaluate(message.payload) };
  // Only the external classification boundary is replaced; DOM, observers and queues are real.
  win.eval(content);
  win.ExtApi.hasRuntime = () => true;
  return { dom, copy, card: dom.window.document.querySelector("article")!, boot: () => win.LinkedInAiSlop.boot(), change: (changes: Parameters<typeof changed>[0]) => changed(changes) };
}

it("po włączeniu zaczyna obserwować nowo dodane posty", async () => {
  let requests = 0;
  const f = fixture(async () => { requests += 1; return { ok: true, body: human }; }, text, false);
  try {
    await f.boot();
    f.change({ enabled: { newValue: true } });
    await waitFor(() => requests === 1);
    const next = f.card.cloneNode(true) as HTMLElement;
    next.dataset.urn = "urn:li:activity:new-card";
    next.querySelector(".lais-badge")?.remove();
    f.card.after(next);
    await waitFor(() => requests === 2);
  } finally { f.dom.window.close(); }
});

it("zmiana samego progu przelicza odznakę bez żądania", async () => {
  let requests = 0;
  const f = fixture(async () => { requests += 1; return { ok: true, body: { ...slop, slopProbability: 0.7, slopIntensity: 1, slopIntensityLabel: "mixed", voice: "mixed", substanceProbability: 0.7 } }; });
  try {
    await f.boot();
    await waitFor(() => f.card.querySelector(".lais-badge--slop") !== null);
    f.change({ threshold: { newValue: 0.9 } });
    await waitFor(() => f.card.querySelector(".lais-badge--mixed") !== null);
    assert.equal(requests, 1);
    assert.equal(f.card.querySelector(".lais-cover"), null);
  } finally { f.dom.window.close(); }
});

it("zmiana progu po wyłączeniu nie odtwarza oznaczeń ani zasłony", async () => {
  const f = fixture(async () => ({ ok: true, body: slop }));
  try {
    await f.boot();
    await waitFor(() => f.card.querySelector(".lais-badge--slop") !== null);
    f.change({ threshold: { newValue: 0.95 } });
    assert.ok(f.card.querySelector(".lais-badge--mixed"));
    f.change({ enabled: { newValue: false } });
    f.change({ threshold: { newValue: 0.65 } });
    assert.equal(f.card.querySelector(".lais-badge, .lais-cover"), null);
    assert.equal(f.card.dataset.laisTextHash, undefined);
    assert.equal(f.card.dataset.laisAutoCover, undefined);
  } finally { f.dom.window.close(); }
});

it("pierwszy zapis progu z domyślnymi ustawieniami nie powtarza ocen", async () => {
  let requests = 0;
  const f = fixture(async () => { requests += 1; return { ok: true, body: slop }; });
  try {
    await f.boot();
    await waitFor(() => f.card.querySelector(".lais-badge--slop") !== null);
    f.change(Object.fromEntries(Object.entries({
      enabled: true, threshold: 0.95, blurSlop: true, minTextChars: 100,
      mode: "demo", proxyUrl: "https://proxy-production-ebcc.up.railway.app",
      byokProxyUrl: "", proToken: "",
    }).map(([key, newValue]) => [key, { newValue }])));
    await waitFor(() => f.card.querySelector(".lais-badge--mixed") !== null);
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(requests, 1);
  } finally { f.dom.window.close(); }
});

it("nie wysyła posta przewiniętego poza ekran podczas rozwijania", async () => {
  let requests = 0;
  let expanded = false;
  const f = fixture(async () => { requests += 1; return { ok: true, body: human }; });
  class Intersections { observe() {} unobserve() {} disconnect() {} }
  Object.defineProperty(f.dom.window, "IntersectionObserver", { value: Intersections });
  f.card.getBoundingClientRect = () => ({ top: 10, bottom: 310, height: 300 } as DOMRect);
  const more = f.dom.window.document.createElement("button");
  more.setAttribute("aria-label", "więcej");
  more.addEventListener("click", () => f.dom.window.setTimeout(() => {
    f.card.getBoundingClientRect = () => ({ top: 4000, bottom: 4300, height: 300 } as DOMRect);
    f.copy.textContent = text + " Rozwinięta treść posta.";
    expanded = true;
  }, 30));
  f.copy.append(more);
  try {
    await f.boot();
    await waitFor(() => expanded);
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(requests, 0);
    assert.equal(f.card.querySelector(".lais-badge--pending"), null);
  } finally { f.dom.window.close(); }
});

it("nie zasłania niepewnego slopu i pokazuje sygnały", async () => {
  const f = fixture(async () => ({ ok: true, body: { ...slop, shouldCover: false, uncertain: true, substanceProbability: 0.8, slopIntensity: 0.2, slopIntensityLabel: "human", voice: "human", voiceProbability: 0.9 } }));
  try {
    await f.boot();
    await waitFor(() => f.card.querySelector(".lais-badge--slop") !== null);
    assert.equal(f.card.querySelector(".lais-cover"), null);
    assert.match(f.card.querySelector(".lais-tip")?.textContent || "", /niepewna/i);
    assert.match(f.card.querySelector(".lais-tip")?.textContent || "", /konkret/i);
  } finally { f.dom.window.close(); }
});

it("fallback usuwa cudzy tekst z odłączonego klonu i zachowuje akapity", async () => {
  const requests: Payload[] = [];
  const f = fixture(async (payload) => { requests.push(payload); return { ok: true, body: human }; });
  f.copy.className = "new-linkedin-layout";
  f.copy.textContent = text.repeat(2) + "\n\nDrugi akapit z decyzją.";
  const nested = f.dom.window.document.createElement("div");
  nested.className = "update-components-mini-update-v2";
  nested.textContent = "CUDZY_TEKST_NIE_PODLEGA_OCENIE ".repeat(10);
  f.card.append(nested);
  try {
    await f.boot();
    await waitFor(() => requests.length === 1);
    assert.doesNotMatch(requests[0].text, /CUDZY_TEKST/);
    assert.match(requests[0].text, /\n\nDrugi akapit/);
  } finally { f.dom.window.close(); }
});

it("nie wysyła karty, która opuściła ekran podczas oczekiwania w kolejce", async () => {
  const requests: Payload[] = [];
  let release!: (value: unknown) => void;
  const pending = new Promise((resolve) => { release = resolve; });
  const f = fixture(async (payload) => { requests.push(payload); return requests.length <= 2 ? pending : { ok: true, body: human }; });
  class Intersections { observe() {} unobserve() {} disconnect() {} }
  Object.defineProperty(f.dom.window, "IntersectionObserver", { value: Intersections });
  const cards = [f.card, f.card.cloneNode(true) as HTMLElement, f.card.cloneNode(true) as HTMLElement];
  cards.forEach((card, i) => {
    card.dataset.urn = `urn:li:activity:queue-${i}`;
    card.getBoundingClientRect = () => ({ top: 10, bottom: 310, height: 300 } as DOMRect);
    if (i) f.card.parentElement!.append(card);
  });
  try {
    await f.boot();
    await waitFor(() => requests.length === 2);
    cards[2].getBoundingClientRect = () => ({ top: 4000, bottom: 4300, height: 300 } as DOMRect);
    release({ ok: true, body: human });
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(requests.length, 2);
  } finally { f.dom.window.close(); }
});

async function waitFor(predicate: () => boolean, timeout = 2200) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= deadline) assert.fail("Warunek nie został spełniony przed upływem czasu");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

it("ocenia krótki samodzielny post zamiast pomijać go przed wysłaniem", async () => {
  const requests: Payload[] = [];
  const f = fixture(async (payload) => { requests.push(payload); return { ok: true, body: slop }; });
  try {
    await f.boot();
    await waitFor(() => requests.length === 1);
    assert.equal(requests[0].text, text);
    await waitFor(() => f.card.dataset.laisVerdict === "slop");
  } finally { f.dom.window.close(); }
});

it("czeka na asynchroniczne rozwinięcie więcej przed oceną", async () => {
  const requests: Payload[] = [];
  const excerpt = text + " Wytrwałość pomaga zespołom tworzyć lepszą przyszłość.";
  const full = excerpt + " W ubiegłym tygodniu poprawiliśmy kolejkę i usunęliśmy powtarzające się żądania.";
  const f = fixture(async (payload) => { requests.push(payload); return { ok: true, body: human }; }, excerpt);
  const more = f.dom.window.document.createElement("button");
  more.setAttribute("aria-label", "więcej");
  more.addEventListener("click", () => f.dom.window.setTimeout(() => { f.copy.textContent = full; more.remove(); }, 30));
  f.copy.append(more);
  try {
    await f.boot();
    await waitFor(() => requests.length > 0);
    assert.equal(requests[0].text, full);
  } finally { f.dom.window.close(); }
});

it("ponownie ocenia zmieniony koniec tekstu pod tym samym ID", async () => {
  const requests: Payload[] = [];
  const prefix = "Wspólna praca zespołu przynosi efekty, gdy każdy rozumie cel i może samodzielnie podejmować decyzje. ".repeat(3);
  const f = fixture(async (payload) => { requests.push(payload); return { ok: true, body: requests.length === 1 ? slop : human }; }, prefix + "Ogólnikowa puenta.");
  try {
    await f.boot();
    await waitFor(() => f.card.dataset.laisVerdict === "slop");
    f.copy.textContent = prefix + "Naprawiliśmy trzy błędy i skróciliśmy przetwarzanie z 9 do 2 sekund.";
    await waitFor(() => requests.length === 2);
    await waitFor(() => f.card.querySelector(".lais-badge__label")?.textContent === "Ludzki");
    assert.equal(requests[1].postId, requests[0].postId);
    assert.match(requests[1].text, /z 9 do 2 sekund/);
    assert.equal(f.card.querySelector(".lais-cover"), null);
  } finally { f.dom.window.close(); }
});

it("odrzuca odpowiedź dla tekstu zmienionego podczas żądania", async () => {
  const requests: Payload[] = [];
  let resolveFirst!: (value: unknown) => void;
  const first = new Promise((resolve) => { resolveFirst = resolve; });
  const f = fixture(async (payload) => { requests.push(payload); return requests.length === 1 ? first : { ok: true, body: human }; }, text.repeat(2));
  try {
    await f.boot();
    await waitFor(() => requests.length === 1);
    f.copy.textContent = "W poniedziałek usunęliśmy błąd w kolejce. Klient czekał 9 sekund na odpowiedź, teraz czeka 2 sekundy. Testy obejmują ponowienie i zerwane połączenie.";
    resolveFirst({ ok: true, body: slop });
    await waitFor(() => requests.length === 2);
    await waitFor(() => f.card.querySelector(".lais-badge__label")?.textContent === "Ludzki");
    assert.equal(f.card.dataset.laisVerdict, undefined);
  } finally { f.dom.window.close(); }
});

it("nakładka pozostaje stabilna bez działań użytkownika", async () => {
  let requests = 0;
  const f = fixture(async () => { requests += 1; return { ok: true, body: slop }; }, text.repeat(2));
  try {
    await f.boot();
    await waitFor(() => Boolean(f.card.querySelector(".lais-cover")));
    const cover = f.card.querySelector(".lais-cover");
    let changes = 0;
    const observer = new f.dom.window.MutationObserver((records) => { changes += records.length; });
    observer.observe(f.card, { childList: true, subtree: true });
    await new Promise((resolve) => setTimeout(resolve, 750));
    observer.disconnect();
    assert.equal(f.card.querySelector(".lais-cover"), cover);
    assert.equal(changes, 0);
    assert.equal(requests, 1);
  } finally { f.dom.window.close(); }
});

it("spóźniony wynik poprzedniej karty nie usuwa nowszej oceny po recyklingu DOM", async () => {
  let resolveFirst!: (value: unknown) => void;
  const first = new Promise((resolve) => { resolveFirst = resolve; });
  const requests: Payload[] = [];
  const f = fixture(async (payload) => { requests.push(payload); return requests.length === 1 ? first : { ok: true, body: human }; }, text.repeat(2));
  try {
    await f.boot();
    await waitFor(() => requests.length === 1);
    f.card.dataset.urn = "urn:li:activity:recycled";
    f.copy.textContent = "W środę naprawiliśmy ponawianie żądań do API. Zmiana dotyczy statusu 409 i obejmuje trzy scenariusze: brak odpowiedzi, błąd połączenia oraz ponowienie tej samej operacji.";
    await waitFor(() => f.card.querySelector(".lais-badge__label")?.textContent === "Ludzki");
    resolveFirst({ ok: true, body: slop });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(f.card.querySelector(".lais-badge__label")?.textContent, "Ludzki");
    assert.equal(requests[1].postId, "urn:li:activity:recycled");
  } finally { f.dom.window.close(); }
});

it("po minutowym 429 wznawia ten sam post bez blokady do końca dnia", async () => {
  let requests = 0;
  const f = fixture(async () => {
    requests += 1;
    return requests === 1 ? { ok: false, status: 429, retryAfterSec: 1, body: { error: "demo_limit", upgrade: true, limitType: "minute", retryAfterSec: 1, message: "Limit minutowy darmowego Demo." } } : { ok: true, body: human };
  }, text.repeat(2));
  try {
    await f.boot();
    await waitFor(() => requests === 1);
    assert.equal(f.dom.window.sessionStorage.length, 0);
    await waitFor(() => requests === 2);
    await waitFor(() => f.card.querySelector(".lais-badge__label")?.textContent === "Ludzki");
  } finally { f.dom.window.close(); }
});

it("stara odpowiedź minutowa Demo także wznawia ocenianie", async () => {
  let requests = 0;
  const f = fixture(async () => {
    requests += 1;
    return requests === 1 ? { ok: false, status: 429, retryAfterSec: 1, body: { error: "demo_limit", upgrade: true, message: "Limit minutowy darmowego Demo: 60 ocen na 60s." } } : { ok: true, body: human };
  });
  try {
    await f.boot();
    await waitFor(() => requests === 2);
    assert.equal(f.dom.window.sessionStorage.length, 0);
  } finally { f.dom.window.close(); }
});

it("display contents zachowuje stabilną zasłonę i przywraca własne style mediów", async () => {
  const f = fixture(async () => ({ ok: true, body: slop }));
  f.card.style.display = "contents";
  const photo = f.dom.window.document.createElement("img");
  photo.style.setProperty("opacity", "0.6", "important");
  f.card.append(photo);
  try {
    await f.boot();
    await waitFor(() => Boolean(f.card.querySelector(".lais-cover")));
    const cover = f.card.querySelector(".lais-cover");
    await new Promise((resolve) => setTimeout(resolve, 650));
    assert.equal(f.card.querySelector(".lais-cover"), cover);
    assert.equal(photo.style.opacity, "0.78");
    f.card.querySelector(".lais-reveal")!.dispatchEvent(new f.dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(photo.style.opacity, "0.6");
    assert.equal(photo.style.getPropertyPriority("opacity"), "important");
  } finally { f.dom.window.close(); }
});

it("dobowy 429 zatrzymuje dalsze żądania i zapisuje czas blokady", async () => {
  let requests = 0;
  const f = fixture(async () => {
    requests += 1;
    return { ok: false, status: 429, retryAfterSec: 3600, body: { error: "demo_limit", upgrade: true, limitType: "daily", retryAfterSec: 3600, message: "Dzienny limit darmowego Demo." } };
  }, text.repeat(2));
  try {
    await f.boot();
    await waitFor(() => f.card.querySelector(".lais-badge--info") !== null);
    const until = Number(f.dom.window.sessionStorage.getItem(f.dom.window.sessionStorage.key(0)!));
    assert.ok(until > Date.now() + 3_590_000 && until <= Date.now() + 3_601_000);
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(requests, 1);
  } finally { f.dom.window.close(); }
});

it("service worker przekazuje Retry-After do content scriptu", async () => {
  let listener!: (message: unknown) => Promise<{ retryAfterSec?: number }>;
  runInNewContext(readFileSync(resolve(extension, "background.js"), "utf8"), {
    ExtApi: { onMessage: (handler: typeof listener) => { listener = handler; }, storageGet: async () => ({}), resolveSettings: () => ({ proToken: "" }) },
    fetch: async () => new Response(JSON.stringify({ error: "demo_limit", upgrade: true }), { status: 429, headers: { "Retry-After": "7" } }),
  });
  const response = await listener({ type: "evaluate", payload: { proxyUrl: "http://localhost:8787", postId: "test", text } });
  assert.equal(response.retryAfterSec, 7);
});
