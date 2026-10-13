import { it } from "node:test";
import assert from "node:assert/strict";
import { scorePilot } from "../../scripts/check-content-pilot.ts";
function rows() {
  return Array.from({ length: 50 }, (_, i) => ({ id: String(i), expected: i < 25 ? "concrete" : "low_information", badge: i < 25 ? "concrete" : "low_information", policyVersion: "content-v1", rubricVersion: "content-v1" }));
}
it("requires corpus completeness and guards against optimistic missing results", () => {
  assert.equal(scorePilot(rows()).passed, true);
  assert.throws(() => scorePilot(rows().slice(1)));
  const duplicate = rows(); duplicate[1].id = "0";
  assert.throws(() => scorePilot(duplicate));
  const mixed = rows(); mixed[0].policyVersion = "style-v2";
  assert.throws(() => scorePilot(mixed));
});
it("rejects two valuable false positives and missed majority of weak posts", () => {
  const r = rows(); r[0].badge = "low_information";
  assert.equal(scorePilot(r).passed, true);
  r[1].badge = "low_information";
  assert.equal(scorePilot(r).passed, false);
  const weak = rows(); for (let i = 25; i < 38; i++) weak[i].badge = "uncertain";
  assert.equal(scorePilot(weak).passed, false);
});
