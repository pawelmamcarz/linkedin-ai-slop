import { it } from "node:test";
import assert from "node:assert/strict";
import policy from "../../extension/content-quality-policy.js";
import { mapContentAnswers } from "../src/content-answers.ts";
import { verdictCacheKey } from "../src/verdict-cache.ts";
it("protects substance and uncertainty", () => {
  const decide = (s: unknown, l: unknown) => policy.decideQuality({ substanceProbability: s, lowInformationProbability: l });
  assert.equal(decide(0.9, 0.1).badge, "concrete");
  assert.equal(decide(0.1, 0.9).badge, "low_information");
  for (const [s, l] of [[0.9, 0.9], [0.5, 0.5], [NaN, 0.9], [0.1, Infinity], [-1, 0.9], [null, 0.99], [0.1, "0.99"]]) {
    assert.equal(decide(s, l).badge, "uncertain");
    assert.equal(decide(s, l).shouldCover, false);
  }
});
it("keeps missing model answers uncertain rather than treating absence as zero", () => {
  const r = mapContentAnswers("p", "test", { low_information: { type: "noul", noul: 0.99 } });
  assert.equal(r.badge, "uncertain");
  assert.equal(r.substanceProbability, null);
});
it("separates cache keys by rubric", () => {
  assert.notEqual(verdictCacheKey("same text"), verdictCacheKey("same text", "content-v1"));
});
