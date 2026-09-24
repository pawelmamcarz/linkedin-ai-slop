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
    assert.equal(badge!.textContent, "AI slop");
    assert.ok(badge!.classList.contains("lais-badge--slop"));
    assert.match(badge!.getAttribute("title") || "", /Intensywność: heavy/);
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
