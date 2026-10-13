(function (root, factory) {
  const policy = factory();
  if (typeof module === "object" && module.exports) module.exports = policy;
  else root.LinkedInContentQuality = policy;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = "content-v1";
  function decideQuality(input) {
    const s = input.substanceProbability;
    const l = input.lowInformationProbability;
    const valid = [s, l].every((n) => Number.isFinite(n) && n >= 0 && n <= 1);
    const badge = !valid ? "uncertain" : s >= 0.8 && l <= 0.2 ? "concrete"
      : s <= 0.2 && l >= 0.85 ? "low_information" : "uncertain";
    return {
      badge,
      labelPl: { concrete: "Konkretny", low_information: "Mało treściwy", uncertain: "Niepewna ocena" }[badge],
      reasonCode: { concrete: "specific_information", low_information: "generic_without_detail", uncertain: "insufficient_or_conflicting_signals" }[badge],
      shouldCover: badge === "low_information",
      policyVersion: VERSION,
    };
  }
  return { decideQuality, VERSION };
});
