import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_VERDICT_CACHE_MAX,
  normalizePostText,
  readVerdict,
  resetVerdictCache,
  storeVerdict,
  verdictCacheConfig,
  verdictCacheKey,
  verdictCacheStats,
} from "../src/verdict-cache.ts";

const answers = {
  is_ai_slop: { type: "noul" as const, noul: 0.1 },
  slop_intensity: { type: "score" as const, score: 0.2 },
  has_substance: { type: "noul" as const, noul: 0.8 },
  voice: { type: "choice" as const, choice: "human", confidence: 0.7 },
};

describe("verdict cache", () => {
  it("zlewa białe znaki do jednego klucza i nie trzyma surowego tekstu w kluczu", () => {
    const a = verdictCacheKey("  Foo   bar\n");
    const b = verdictCacheKey("Foo bar");
    assert.equal(a, b);
    assert.equal(a.includes("Foo"), false);
    assert.equal(normalizePostText("  a \n b  "), "a b");
  });

  it("wyrzuca wpis po TTL i obcina kolejkę do VERDICT_CACHE_MAX", () => {
    resetVerdictCache();
    const env = { VERDICT_CACHE_TTL_MS: "1000", VERDICT_CACHE_MAX: "2" };
    storeVerdict("pierwszy post o billingu", { model: "jev-latest", answers, inputTokens: 11, outputTokens: 4 }, 1_000, env);
    storeVerdict("drugi post o onboardingu", { model: "jev-latest", answers, inputTokens: 12, outputTokens: 4 }, 1_000, env);
    storeVerdict("trzeci post o wdrożeniu", { model: "jev-latest", answers, inputTokens: 13, outputTokens: 4 }, 1_000, env);
    assert.equal(readVerdict("pierwszy post o billingu", 1_500, env), null);
    assert.ok(readVerdict("trzeci post o wdrożeniu", 1_500, env));
    const stale = storeVerdict(
      "świeży post",
      { model: "jev-latest", answers, inputTokens: 9, outputTokens: 1 },
      5_000,
      env,
    );
    assert.equal(stale, undefined);
    assert.equal(readVerdict("świeży post", 6_100, env), null);
    assert.equal(verdictCacheConfig(env).max, 2);
    assert.equal(verdictCacheConfig({}).max, DEFAULT_VERDICT_CACHE_MAX);
    assert.equal(verdictCacheConfig({ VERDICT_CACHE: "0" }).enabled, false);
    resetVerdictCache();
    assert.equal(verdictCacheStats().entries, 0);
  });
});
