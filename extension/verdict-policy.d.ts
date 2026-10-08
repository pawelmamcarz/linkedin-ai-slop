declare const policy: {
  VERSION: string;
  decide(input: {
    slopProbability: number;
    intensity: "human" | "mixed" | "heavy";
    voice: "human" | "mixed" | "ai_slop";
    voiceProbability?: number | null;
    threshold: number;
  }): {
    badge: "human" | "mixed" | "slop";
    isAiSlop: boolean;
    threshold: number;
    uncertain: boolean;
    shouldCover: boolean;
    policyVersion: string;
  };
};
export = policy;
