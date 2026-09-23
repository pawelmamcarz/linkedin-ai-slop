import {
  DEFAULT_SLOP_THRESHOLD,
  INTENSITY_HUMAN_MAX,
  INTENSITY_MIXED_MAX,
  SUBSTANCE_THRESHOLD,
} from "../../jev/thresholds.ts";

export type IntensityLabel = "human" | "mixed" | "heavy";
export type VoiceLabel = "human" | "mixed" | "ai_slop";
export type BadgeKind = "human" | "mixed" | "slop";

export type JevAnswers = {
  is_ai_slop?: { type: "noul"; noul?: number };
  slop_intensity?: {
    type: "score";
    score?: number;
    confidence?: number;
    legend?: Record<string, string>;
    probabilities?: Record<string, number>;
  };
  has_substance?: { type: "noul"; noul?: number };
  voice?: {
    type: "choice";
    choice?: string;
    confidence?: number;
    probabilities?: Record<string, number>;
  };
};

export type EvaluateResult = {
  postId: string;
  model: string;
  isAiSlop: boolean;
  slopProbability: number;
  slopIntensity: number;
  slopIntensityLabel: IntensityLabel;
  hasSubstance: boolean;
  substanceProbability: number;
  voice: VoiceLabel;
  voiceConfidence: number;
  badge: BadgeKind;
  labelPl: string;
  threshold: number;
};

const VOICES = new Set<VoiceLabel>(["human", "mixed", "ai_slop"]);

export function intensityLabel(score: number): IntensityLabel {
  if (score < INTENSITY_HUMAN_MAX) return "human";
  if (score < INTENSITY_MIXED_MAX) return "mixed";
  return "heavy";
}

export function polishLabel(badge: BadgeKind): string {
  if (badge === "slop") return "AI slop";
  if (badge === "mixed") return "Mieszany";
  return "Ludzki";
}

export function badgeFromSignals(input: {
  slopProbability: number;
  intensity: IntensityLabel;
  voice: VoiceLabel;
  threshold: number;
}): BadgeKind {
  const { slopProbability, intensity, voice, threshold } = input;
  if (intensity === "heavy" || voice === "ai_slop" || slopProbability >= threshold) {
    return "slop";
  }
  if (intensity === "mixed" || voice === "mixed") return "mixed";
  return "human";
}

export function mapAnswers(
  postId: string,
  model: string,
  answers: JevAnswers,
  threshold = DEFAULT_SLOP_THRESHOLD,
): EvaluateResult {
  const slopProbability = clamp01(answers.is_ai_slop?.noul ?? 0);
  const slopIntensity = Number.isFinite(answers.slop_intensity?.score)
    ? Number(answers.slop_intensity?.score)
    : 0;
  const substanceProbability = clamp01(answers.has_substance?.noul ?? 0);
  const voiceRaw = answers.voice?.choice;
  const voice: VoiceLabel = VOICES.has(voiceRaw as VoiceLabel)
    ? (voiceRaw as VoiceLabel)
    : "mixed";
  const intensity = intensityLabel(slopIntensity);
  const badge = badgeFromSignals({
    slopProbability,
    intensity,
    voice,
    threshold,
  });

  return {
    postId,
    model,
    isAiSlop: slopProbability >= threshold,
    slopProbability,
    slopIntensity,
    slopIntensityLabel: intensity,
    hasSubstance: substanceProbability >= SUBSTANCE_THRESHOLD,
    substanceProbability,
    voice,
    voiceConfidence: clamp01(answers.voice?.confidence ?? 0),
    badge,
    labelPl: polishLabel(badge),
    threshold,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
