# Pytania Jev (przegląd)

Jedno wywołanie `POST https://api.typesafe.ai/v1/systemone` na post.
Model: `jev-latest`. Źródło w kodzie: [`questions.ts`](./questions.ts).

`state` to obiekt, nie goły string:

```json
{
  "platform": "linkedin",
  "author": "Ada Kowalska",
  "post_text": "…"
}
```

## `is_ai_slop` — Noul

Czy post to głównie AI-filler, a nie autentyczny tekst.

| Wynik | Kryterium |
| --- | --- |
| **true** (blisko 1) | Szablonowy cadence GPT, puste inspiracje, emoji-listy „thought leadership”, *I'm humbled/thrilled*, *In a world where…*, engagement-bait bez zdarzenia, buzzword salad, brak konkretów. |
| **false** (blisko 0) | Konkret (nazwy, liczby, daty), nierówny głos, suchy update zawodowy ze szczegółami, ludzki humor, krótki fakt (*shipped X*, *hired Y*). |

Domyślny próg UI: **≥ 0.65** → traktuj jako slop. Konfigurowalne w opcjach rozszerzenia.

## `slop_intensity` — Score (0 / 1 / 2)

Jak silny jest sygnał slopu. API zwraca ważoną średnią, może paść między poziomami.

| Poziom | Etykieta | Znaczenie |
| --- | --- | --- |
| 0 | human | Ludzki, konkretny, mało szablonu. |
| 1 | mixed | Trochę GPT-cadence, ale jest treść albo głos. |
| 2 | heavy slop | Czysty filler LinkedIn-AI. |

Progi etykiety w kodzie (`jev/thresholds.ts`):

- score **&lt; 0.75** → `human` / „Ludzki”
- score **&lt; 1.5** → `mixed` / „Mieszany”
- score **≥ 1.5** → `heavy` / „AI slop”

## `has_substance` — Noul

Czy czytelnik dowiaduje się czegoś konkretnego.

| Wynik | Kryterium |
| --- | --- |
| **true** | Wynik, liczba, nazwa, decyzja i trade-off, lekcja z sytuacji, rzeczowy update. |
| **false** | Pusta inspiracja, ogólniki (*consistency is key*), bait. |

Próg: **≥ 0.50** → jest substancja. Pokazywane w dymku odznaki, nie steruje kolorem.

## `voice` — Choice

| Opcja | Znaczenie |
| --- | --- |
| `human` | Brzmi jak konkretna osoba. |
| `mixed` | Mieszanka szczegółu i szablonu. |
| `ai_slop` | Wymienny głos LLM-LinkedIn. |

Używane jako dodatkowy sygnał; etykieta odznaki idzie przede wszystkim z `slop_intensity` + progu `is_ai_slop`.
