/**
 * Pytania Jev (System One) — jedno wywołanie na post LinkedIn.
 *
 * Model: jev-latest
 * Endpoint: POST https://api.typesafe.ai/v1/systemone
 *
 * Ten plik jest źródłem prawdy. Serwer wysyła dokładnie ten obiekt `questions`.
 * Kryteria są po angielsku, bo Jev jest trenowany na angielskich rubrykach;
 * UI mapuje wyniki na etykiety PL.
 */

export const JEV_MODEL = "jev-latest" as const;

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

/**
 * Stan przekazywany do Jev. Tekst posta jest w `post_text`,
 * żeby model nie mylił metadanych z treścią.
 */
export type JevPostState = {
  platform: "linkedin";
  author: string | null;
  post_text: string;
};

export const JEV_QUESTIONS = {
  is_ai_slop: {
    type: "noul" as const,
    instructions:
      "Is this LinkedIn feed post primarily AI slop (generic LLM filler) rather than authentic human writing?",
    criteria: {
      true:
        "Treat as YES when the writing is dominated by LinkedIn AI-filler patterns: hollow inspiration, " +
        "template storytelling with no concrete details, 'I'm humbled / thrilled / excited to announce' cadence, " +
        "'In a world where…' openers, emoji-bullet thought-leadership, engagement-bait questions that do not follow " +
        "from a real event, corporate buzzword salad, identical sentence rhythm, or advice that could be pasted onto " +
        "any profile. YES also when the post is clearly an LLM rewrite of a thin idea.",
      false:
        "Treat as NO when a specific person is visibly writing: concrete names, numbers, dates, products, or " +
        "decisions; uneven or personal rhythm; imperfect phrasing; a real anecdote; dry professional update that " +
        "is specific even if polished; or human humor/sarcasm that is not a stock LinkedIn joke. Short factual " +
        "updates (hired, shipped, event recap with details) are NOT slop.",
    },
  },

  slop_intensity: {
    type: "score" as const,
    instructions:
      "How strong is the AI-slop signal in this LinkedIn post? Rate the writing itself, not whether you agree with it.",
    criteria: [
      "Human: specific, personal, or clearly authored. Little or no LLM-template cadence. Concrete details or a distinct voice.",
      "Mixed: some AI-typical polish, tropes, or structure, but also real substance, a personal detail, or an uneven human voice.",
      "Heavy slop: generic AI LinkedIn filler. Template cadence, empty inspiration, or buzzword thought-leadership with almost no authentic voice.",
    ],
  },

  has_substance: {
    type: "noul" as const,
    instructions:
      "Does this LinkedIn post contain substance — a concrete claim, experience, number, decision, or useful information?",
    criteria: {
      true:
        "YES when the reader learns something specific: a result, a number, a named tool/team/customer, a real " +
        "decision and its tradeoff, a lesson tied to a situation, a job/product update with facts, or a clear argument.",
      false:
        "NO when the post is empty inspiration, vague gratitude, engagement bait, or generic advice that applies to anyone " +
        "('consistency is key', 'hire slow', 'be authentic') without a grounding example.",
    },
  },

  voice: {
    type: "choice" as const,
    instructions:
      "Which voice best describes this LinkedIn post? Pick one. Ignore topic quality; judge only how it is written.",
    criteria: {
      human:
        "Sounds like a particular person wrote it: specific, uneven, or plainly professional with real details.",
      mixed:
        "Blend of human detail and AI-typical polish, templates, or LinkedIn-GPT cadence.",
      ai_slop:
        "Generic LLM LinkedIn voice — interchangeable with thousands of other AI-written posts.",
    },
  },
} as const;

export type JevQuestionId = keyof typeof JEV_QUESTIONS;
