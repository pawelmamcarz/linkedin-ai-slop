/** Shared decision rules for the proxy and local sensitivity changes. */
(function (root, factory) {
  const policy = factory();
  if (typeof module === "object" && module.exports) module.exports = policy;
  else root.LinkedInAiSlopVerdict = policy;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = "style-v2";
  const COVER_FLOOR = 0.8;
  const STRONG_VOICE = 0.65;
  const UNCERTAIN_MARGIN = 0.1;

  function decide(input) {
    const probability = input.slopProbability;
    const valid = Number.isFinite(probability) && probability >= 0 && probability <= 1;
    const threshold = Number.isFinite(input.threshold) ? Math.min(0.95, Math.max(0.15, input.threshold)) : 0.65;
    const intensity = input.intensity || "mixed";
    const voice = input.voice || "mixed";
    const voiceProbability = Number.isFinite(input.voiceProbability) ? input.voiceProbability : null;
    const strongVoice = voiceProbability !== null && voiceProbability >= STRONG_VOICE;
    const isAiSlop = valid && probability >= threshold;
    const slopStyle = intensity === "heavy" || voice === "ai_slop";
    const humanStyle = intensity === "human" || (voice === "human" && strongVoice);
    const conflict = isAiSlop ? humanStyle : slopStyle;
    const uncertain = !valid || (probability < COVER_FLOOR && Math.abs(probability - threshold) < UNCERTAIN_MARGIN) || conflict;
    const badge = isAiSlop ? "slop" : !valid || intensity !== "human" || voice !== "human" ? "mixed" : "human";
    const supported = intensity === "heavy" || (voice === "ai_slop" && strongVoice);
    return {
      badge,
      isAiSlop,
      threshold,
      uncertain,
      shouldCover: isAiSlop && !uncertain && probability >= Math.max(COVER_FLOOR, threshold) && supported,
      policyVersion: VERSION,
    };
  }

  return { decide, VERSION };
});
