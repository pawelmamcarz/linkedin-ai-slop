import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const slop = require("../../extension/content.js") as {
  findPostElements: (root: ParentNode) => HTMLElement[];
  extractPost: (el: HTMLElement) => { id: string; text: string; author: string } | null;
  setBadge: (el: HTMLElement, state: string, result?: Record<string, unknown>) => void;
  applySettings: (partial: { blurSlop?: boolean }) => { blurSlop: boolean };
};

const fixture = readFileSync(resolve(import.meta.dirname, "fixtures/linkedin-feed.html"), "utf8");

describe("selektory LinkedIn (fixture)", () => {
  let dom: JSDOM;
  let document: Document;

  before(() => {
    dom = new JSDOM(fixture, { url: "https://www.linkedin.com/feed/" });
    document = dom.window.document;
    (globalThis as { document?: Document }).document = document;
  });

  after(() => {
    delete (globalThis as { document?: Document }).document;
    dom.window.close();
  });

  it("znajduje posty z kilku wariantów DOM i deduplikuje zagnieżdżenia", () => {
    const posts = slop.findPostElements(document);
    const ids = posts.map((el) => slop.extractPost(el)?.id).filter(Boolean);
    assert.ok(posts.length >= 4, `oczekiwano ≥4 postów, jest ${posts.length}`);
    assert.ok(ids.some((id) => String(id).includes("activity:111")));
    assert.ok(ids.some((id) => String(id).includes("activity:222")));
    assert.ok(ids.some((id) => String(id).includes("ugcPost:333")));
  });

  it("wyciąga tekst i autora, pomija puste / za krótkie", () => {
    const posts = slop.findPostElements(document);
    const extracted = posts.map((el) => slop.extractPost(el)).filter(Boolean);
    const texts = extracted.map((p) => p!.text);
    assert.ok(texts.some((t) => t.includes("billing retry")));
    assert.ok(texts.some((t) => t.includes("humbled and thrilled")));
    assert.ok(extracted.some((p) => p!.author.includes("Ada")));
    assert.ok(!texts.some((t) => t.length < 20));
  });

  it("nie traktuje komentarzy jako postów feedu", () => {
    const posts = slop.findPostElements(document);
    const extracted = posts.map((el) => slop.extractPost(el)).filter(Boolean);
    assert.ok(!extracted.some((p) => p!.text.includes("komentarz testowy")));
  });

  it("maluje odznakę PL na karcie", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    slop.setBadge(host, "slop", {
      labelPl: "AI slop",
      voice: "ai_slop",
      slopProbability: 0.91,
      threshold: 0.65,
      slopIntensityLabel: "heavy",
      slopIntensity: 1.8,
      hasSubstance: false,
      substanceProbability: 0.1,
      model: "jev-1.13.0",
    });
    const badge = host.querySelector(".lais-badge");
    assert.ok(badge);
    assert.equal(badge!.querySelector(".lais-badge__label")!.textContent, "AI slop");
    assert.ok(badge!.classList.contains("lais-badge--slop"));
    assert.equal(badge!.getAttribute("title"), "AI slop: 91%");
    const tip = badge!.querySelector(".lais-tip");
    assert.equal(tip?.querySelector(".lais-tip__pct")?.textContent, "AI slop: 91%");
    assert.match(tip?.querySelector(".lais-tip__meta")?.textContent || "", /Intensywność: heavy/);
    assert.ok(host.classList.contains("li-ai-slop-blurred"));
    assert.equal(host.dataset.laisVerdict, "slop");
    assert.ok(host.querySelector(":scope > .lais-blur"));
    const reveal = badge!.querySelector(".lais-reveal");
    assert.equal(reveal?.textContent, "Pokaż");
    assert.match(reveal?.getAttribute("title") || "", /AI slop/);
    reveal?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(host.classList.contains("li-ai-slop-blurred"), false);
    assert.equal(host.querySelector(":scope > .lais-blur"), null);
    assert.ok(host.classList.contains("li-ai-slop-revealed"));
    assert.equal(host.querySelector(".lais-reveal")?.textContent, "Ukryj");
  });

  it("rozmywa treść pod display:contents, nie samą odznakę", () => {
    const card = document.createElement("div");
    card.className = "feed-shared-update-v2";
    const shell = document.createElement("div");
    shell.style.display = "contents";
    const copy = document.createElement("div");
    copy.className = "update-components-text";
    copy.textContent = "Po potasowaniu talii kart i rozłożeniu jej przed zespołem zostaje jeden scenariusz.";
    const photo = document.createElement("img");
    photo.alt = "talia";
    shell.append(copy, photo);
    card.appendChild(shell);
    document.body.appendChild(card);
    slop.setBadge(card, "slop", { labelPl: "AI slop", slopProbability: 0.88 });
    assert.equal(shell.dataset.laisFiltered, undefined);
    assert.ok(copy.classList.contains("lais-paint-blur"));
    assert.ok(photo.classList.contains("lais-paint-blur"));
    assert.match(copy.style.getPropertyValue("filter"), /blur\(20px\)/);
    assert.match(photo.style.getPropertyValue("filter"), /blur\(20px\)/);
    assert.equal(card.querySelector(".lais-badge")!.style.getPropertyValue("filter"), "none");
    assert.equal(card.querySelector(".lais-badge")!.classList.contains("lais-paint-blur"), false);
    const veil = card.querySelector(":scope > .lais-blur") as HTMLElement;
    assert.ok(veil);
    assert.equal(veil.dataset.laisVeil, "blur-24");
    assert.equal(copy.querySelector(":scope > .lais-blur"), null);
    const css = readFileSync(resolve(import.meta.dirname, "../../extension/badge.css"), "utf8");
    assert.match(css, /backdrop-filter:\s*blur\(24px\)/);
    assert.match(css, /\.lais-paint-blur[\s\S]*filter:\s*blur\(20px\)/);
    assert.equal(card.querySelector(".lais-badge")!.style.getPropertyValue("z-index"), "21");
  });

  it("karta display:contents dostaje welon na prawdziwych boksach", () => {
    const card = document.createElement("div");
    card.style.display = "contents";
    const copy = document.createElement("div");
    copy.className = "update-components-text";
    copy.textContent = "Treść pod display contents na korzeniu karty, dość długa na werdykt slop.";
    const photo = document.createElement("img");
    photo.alt = "obraz";
    card.append(copy, photo);
    document.body.appendChild(card);
    slop.setBadge(card, "slop", { labelPl: "AI slop", slopProbability: 0.9 });
    assert.equal(card.querySelector(":scope > .lais-blur"), null);
    assert.ok(copy.querySelector(":scope > .lais-blur"));
    assert.equal(photo.querySelector(".lais-blur"), null);
    assert.ok(copy.classList.contains("lais-paint-blur"));
    assert.ok(photo.classList.contains("lais-paint-blur"));
    assert.match(copy.style.getPropertyValue("filter"), /blur\(20px\)/);
    assert.equal(card.querySelector(".lais-badge")!.classList.contains("lais-paint-blur"), false);
    const reveal = card.querySelector(".lais-reveal");
    reveal?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.equal(copy.classList.contains("lais-paint-blur"), false);
    assert.equal(copy.querySelector(".lais-blur"), null);
    assert.equal(photo.style.getPropertyValue("filter"), "");
  });

  it("rozmywa tylko AI slop i respektuje wyłącznik", () => {
    const human = document.createElement("article");
    const mixed = document.createElement("article");
    const heavy = document.createElement("article");
    document.body.append(human, mixed, heavy);
    slop.setBadge(human, "human", { labelPl: "Ludzki", slopProbability: 0.1 });
    slop.setBadge(mixed, "mixed", { labelPl: "Mieszany", slopProbability: 0.4 });
    slop.setBadge(heavy, "heavy", { labelPl: "Ciężki", slopProbability: 0.99 });
    assert.equal(human.classList.contains("li-ai-slop-blurred"), false);
    assert.equal(mixed.classList.contains("li-ai-slop-blurred"), false);
    assert.equal(heavy.classList.contains("li-ai-slop-blurred"), false);
    assert.equal(human.querySelector(".lais-paint-blur"), null);
    assert.equal(mixed.querySelector(".lais-paint-blur"), null);
    assert.equal(human.querySelector(".lais-reveal"), null);
    assert.equal(mixed.querySelector(".lais-reveal"), null);

    const slopCard = document.createElement("div");
    slopCard.className = "feed-shared-update-v2";
    document.body.appendChild(slopCard);
    slop.setBadge(slopCard, "slop", { labelPl: "AI slop", slopProbability: 0.8 });
    assert.ok(slopCard.classList.contains("li-ai-slop-blurred"));
    slop.applySettings({ blurSlop: false });
    assert.equal(slopCard.classList.contains("li-ai-slop-blurred"), false);
    assert.equal(slopCard.querySelector(".lais-blur"), null);
    assert.equal(slopCard.querySelector(".lais-reveal"), null);
    slop.applySettings({ blurSlop: true });
    assert.ok(slopCard.classList.contains("li-ai-slop-blurred"));
    assert.equal(slopCard.querySelector(".lais-reveal")?.textContent, "Pokaż");
  });

  it("pokazuje procent slopu na Ludzki i Mieszany, bez fałszywego 0%", () => {
    const human = document.createElement("div");
    const mixed = document.createElement("div");
    document.body.append(human, mixed);
    slop.setBadge(human, "human", {
      labelPl: "Ludzki",
      voice: "human",
      slopProbability: 0.082,
      threshold: 0.65,
      slopIntensityLabel: "human",
      slopIntensity: 0.18,
      hasSubstance: true,
      substanceProbability: 0.86,
    });
    slop.setBadge(mixed, "mixed", {
      labelPl: "Mieszany",
      voice: "mixed",
      slopProbability: 0.41,
      threshold: 0.65,
      slopIntensityLabel: "mixed",
      slopIntensity: 1.05,
      hasSubstance: true,
      substanceProbability: 0.62,
    });
    assert.equal(human.querySelector(".lais-badge")!.getAttribute("title"), "AI slop: 8%");
    assert.equal(mixed.querySelector(".lais-badge")!.getAttribute("title"), "AI slop: 41%");
    assert.equal(human.querySelector(".lais-tip__pct")!.textContent, "AI slop: 8%");
    assert.equal(mixed.querySelector(".lais-tip__pct")!.textContent, "AI slop: 41%");

    const pending = document.createElement("div");
    document.body.appendChild(pending);
    slop.setBadge(pending, "pending");
    const pendingBadge = pending.querySelector(".lais-badge")!;
    assert.equal(pendingBadge.getAttribute("title"), "Czekam na Jev (proxy lokalne)");
    assert.equal(pendingBadge.querySelector(".lais-tip"), null);

    const errored = document.createElement("div");
    document.body.appendChild(errored);
    slop.setBadge(errored, "error", { message: "Proxy nie oceniło posta", slopProbability: 0.9 });
    const errorBadge = errored.querySelector(".lais-badge")!;
    assert.equal(errorBadge.getAttribute("title"), "Proxy nie oceniło posta");
    assert.equal(errorBadge.querySelector(".lais-tip"), null);

    const bare = document.createElement("div");
    document.body.appendChild(bare);
    slop.setBadge(bare, "human", { labelPl: "Ludzki", voice: "human" });
    const bareBadge = bare.querySelector(".lais-badge")!;
    assert.equal(bareBadge.getAttribute("title"), null);
    assert.equal(bareBadge.querySelector(".lais-tip"), null);
  });

  it("limit Demo maluje informację o Pro, nie błąd", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    slop.setBadge(host, "info", {
      labelPl: "Potrzebujesz Pro",
      message:
        "Darmowy limit Demo na dziś się wyczerpał. Pro odblokowuje wyższe limity. Checkout jest na stronie Pro.",
    });
    const badge = host.querySelector(".lais-badge");
    assert.equal(badge!.textContent, "Potrzebujesz Pro");
    assert.ok(badge!.classList.contains("lais-badge--info"));
    assert.equal(badge!.classList.contains("lais-badge--error"), false);
    assert.match(badge!.getAttribute("title") || "", /limit Demo/);
  });
});

const activityFixture = readFileSync(
  resolve(import.meta.dirname, "fixtures/linkedin-activity.html"),
  "utf8",
);

describe("selektory recent-activity (fixture)", () => {
  let dom: JSDOM;
  let document: Document;

  before(() => {
    dom = new JSDOM(activityFixture, {
      url: "https://www.linkedin.com/in/example/recent-activity/all/",
    });
    document = dom.window.document;
    (globalThis as { document?: Document }).document = document;
  });

  after(() => {
    delete (globalThis as { document?: Document }).document;
    dom.window.close();
  });

  it("znajduje karty z listy aktywności profilu", () => {
    const posts = slop.findPostElements(document);
    const extracted = posts.map((el) => slop.extractPost(el)).filter(Boolean);
    const ids = extracted.map((post) => post!.id);
    assert.ok(ids.some((id) => String(id).includes("activity:777")));
    assert.ok(ids.some((id) => String(id).includes("ugcPost:888")));
    assert.ok(ids.some((id) => String(id).includes("activity:999")));
    assert.ok(extracted.some((post) => post!.text.includes("retry policy")));
    assert.ok(extracted.some((post) => post!.text.includes("commentary block")));
    assert.ok(!extracted.some((post) => post!.id.includes("activity:000")));
  });
});
