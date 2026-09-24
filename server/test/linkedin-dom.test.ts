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
});
