/**
 * Progi decyzyjne — żyją w kodzie, nie w Jev.
 * Jev zwraca prawdopodobieństwa / score; te stałe decydują, jak UI je interpretuje.
 *
 * Dokumentacja dla użytkownika: README.md (sekcja „Progi”).
 */

/** Domyślny próg Noul `is_ai_slop` (0–1). Powyżej → odznaka „AI slop”. */
export const DEFAULT_SLOP_THRESHOLD = 0.65;

/** Noul `has_substance` ≥ tego progu → post ma treść. */
export const SUBSTANCE_THRESHOLD = 0.5;

/**
 * Score `slop_intensity` jest ważoną średnią poziomów 0 / 1 / 2.
 * 0 = ludzki, 1 = mieszany, 2 = ciężki slop.
 */
export const INTENSITY_HUMAN_MAX = 0.75;
export const INTENSITY_MIXED_MAX = 1.5;

export const DEFAULT_PROXY_URL = "http://127.0.0.1:8787";
export const DEFAULT_CONCURRENCY = 2;
export const MIN_TEXT_CHARS = 40;
export const MAX_TEXT_CHARS = 6000;
