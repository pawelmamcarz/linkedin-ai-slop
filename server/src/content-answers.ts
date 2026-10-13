import policy from "../../extension/content-quality-policy.js";
export type ContentAnswers = {
  has_substance?: { type: "noul"; noul?: number };
  low_information?: { type: "noul"; noul?: number };
};
function probability(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}
export function mapContentAnswers(postId: string, model: string, answers: ContentAnswers) {
  const substanceProbability = probability(answers?.has_substance?.noul);
  const lowInformationProbability = probability(answers?.low_information?.noul);
  return { assessment: "content-v1" as const, postId, model, substanceProbability, lowInformationProbability,
    ...policy.decideQuality({ substanceProbability, lowInformationProbability }) };
}
