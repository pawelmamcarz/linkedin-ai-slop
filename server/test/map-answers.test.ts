import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  badgeFromSignals,
  intensityLabel,
  mapAnswers,
  polishLabel,
} from "../src/map-answers.ts";
import { buildState, buildSystemOnePayload, clampThreshold } from "../src/evaluate.ts";
import { JEV_ENDPOINT, JEV_MODEL, JEV_QUESTIONS } from "../../jev/questions.ts";
import { DEFAULT_SLOP_THRESHOLD } from "../../jev/thresholds.ts";

describe("progi intensywności", () => {
  it("mapuje score na human / mixed / heavy", () => {
    assert.equal(intensityLabel(0), "human");
    assert.equal(intensityLabel(0.74), "human");
    assert.equal(intensityLabel(0.75), "mixed");
    assert.equal(intensityLabel(1.49), "mixed");
    assert.equal(intensityLabel(1.5), "heavy");
    assert.equal(intensityLabel(2), "heavy");
  });
});

describe("odznaka", () => {
  it("jest slop gdy noul przekracza próg", () => {
    assert.equal(
      badgeFromSignals({
        slopProbability: 0.8,
        intensity: "human",
        voice: "human",
        threshold: 0.65,
      }),
      "slop",
    );
  });

  it("jest slop przy heavy lub voice ai_slop", () => {
    assert.equal(
      badgeFromSignals({
        slopProbability: 0.2,
        intensity: "heavy",
        voice: "human",
        threshold: 0.65,
      }),
      "slop",
    );
    assert.equal(
      badgeFromSignals({
        slopProbability: 0.2,
        intensity: "human",
        voice: "ai_slop",
        threshold: 0.65,
      }),
      "slop",
    );
  });

  it("jest mieszany przy słabszym sygnale", () => {
    assert.equal(
      badgeFromSignals({
        slopProbability: 0.4,
        intensity: "mixed",
        voice: "human",
        threshold: 0.65,
      }),
      "mixed",
    );
  });

  it("jest ludzki gdy wszystkie sygnały są czyste", () => {
    assert.equal(
      badgeFromSignals({
        slopProbability: 0.1,
        intensity: "human",
        voice: "human",
        threshold: 0.65,
      }),
      "human",
    );
  });

  it("tłumaczy etykiety PL", () => {
    assert.equal(polishLabel("human"), "Ludzki");
    assert.equal(polishLabel("mixed"), "Mieszany");
    assert.equal(polishLabel("slop"), "AI slop");
  });
});

describe("mapAnswers", () => {
  it("składa wynik UI z odpowiedzi Jev", () => {
    const result = mapAnswers(
      "urn:li:activity:1",
      "jev-1.13.0",
      {
        is_ai_slop: { type: "noul", noul: 0.91 },
        slop_intensity: { type: "score", score: 1.8 },
        has_substance: { type: "noul", noul: 0.12 },
        voice: { type: "choice", choice: "ai_slop", confidence: 0.7 },
      },
      0.65,
    );
    assert.equal(result.badge, "slop");
    assert.equal(result.labelPl, "AI slop");
    assert.equal(result.isAiSlop, true);
    assert.equal(result.hasSubstance, false);
    assert.equal(result.slopIntensityLabel, "heavy");
    assert.equal(result.model, "jev-1.13.0");
  });
});

describe("payload Jev", () => {
  it("trzyma model jev-latest i cztery pytania", () => {
    const payload = buildSystemOnePayload({
      postId: "p1",
      text: "Shipped the billing retry last Tuesday. Failure rate dropped from 4.1% to 0.6%.",
      author: "Ada",
    });
    assert.equal(payload.model, JEV_MODEL);
    assert.equal(payload.model, "jev-latest");
    assert.equal(JEV_ENDPOINT, "https://api.typesafe.ai/v1/systemone");
    assert.deepEqual(Object.keys(payload.questions), [
      "is_ai_slop",
      "slop_intensity",
      "has_substance",
      "voice",
    ]);
    assert.equal(payload.questions.is_ai_slop.type, "noul");
    assert.equal(payload.questions.slop_intensity.type, "score");
    assert.equal(payload.questions.has_substance.type, "noul");
    assert.equal(payload.questions.voice.type, "choice");
    assert.equal(payload.state.platform, "linkedin");
    assert.equal(payload.state.author, "Ada");
    assert.match(payload.state.post_text, /billing retry/);
  });

  it("przycina pustego autora i zbędne białe znaki", () => {
    const state = buildState({ postId: "x", text: "  hello   world  ", author: "  " });
    assert.equal(state.author, null);
    assert.equal(state.post_text, "hello world");
  });

  it("trzyma próg w rozsądnym zakresie", () => {
    assert.equal(clampThreshold(undefined), DEFAULT_SLOP_THRESHOLD);
    assert.equal(clampThreshold(0.01), 0.15);
    assert.equal(clampThreshold(1.5), 0.95);
    assert.equal(clampThreshold(0.7), 0.7);
  });
});
