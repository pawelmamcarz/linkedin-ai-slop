import { it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
const require = createRequire(import.meta.url);
const api = require("../../extension/ext-api.js");
const content = require("../../extension/content.js");
it("does not migrate legacy default blur into quality consent", () => {
  assert.equal(api.resolveSettings({ blurSlop: true, assessment: "content-v1" }).qualityDimEnabled, false);
});
it("renders quality reasoning and dims only with explicit consent", () => {
  const dom = new JSDOM('<article><div class="update-components-text">Specific text</div></article>');
  const el = dom.window.document.querySelector("article")!;
  content.applySettings({ assessment: "content-v1", qualityDimEnabled: false, blurSlop: true });
  const result = { assessment: "content-v1", badge: "low_information", labelPl: "Mało treściwy", shouldCover: true, reasonCode: "generic_without_detail" };
  content.setBadge(el, result.badge, result);
  assert.match(el.textContent!, /ogólniki/);
  assert.equal(el.classList.contains("li-ai-slop-covered"), false);
  content.applySettings({ qualityDimEnabled: true });
  content.setBadge(el, result.badge, result);
  assert.equal(el.classList.contains("li-ai-slop-covered"), true);
  content.setBadge(el, "uncertain", { ...result, badge: "uncertain", labelPl: "Niepewna ocena", shouldCover: false, reasonCode: "insufficient_or_conflicting_signals" });
  assert.equal(el.classList.contains("li-ai-slop-covered"), false);
  assert.doesNotMatch(el.textContent!, /ogólniki/);
  dom.window.close();
});
