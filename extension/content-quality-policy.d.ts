declare const policy: {
  VERSION: "content-v1";
  decideQuality(input: { substanceProbability: unknown; lowInformationProbability: unknown }): {
    badge: "concrete" | "low_information" | "uncertain";
    labelPl: string;
    reasonCode: string;
    shouldCover: boolean;
    policyVersion: "content-v1";
  };
};
export = policy;
