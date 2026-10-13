# Content Quality Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wprowadzić ostrożną ocenę użyteczności postów i przygotować 14-dniowy test z pomiarem deklarowanego użycia oraz rzeczywistych zakupów.

**Architecture:** Zachować obecne rozszerzenie Manifest V3, proxy Node i Jev. Dodać osobny kontrakt `content-v1` obok istniejącego `style-v2`, wspólną deterministyczną politykę oceny oraz oddzielny, trwały rejestr tokenów testowych. Zgłoszenia obsłuży mały formularz rozszerzenia i prywatny plik na trwałym wolumenie proxy.

**Tech Stack:** Node.js 20+, TypeScript/tsx, node:test, jsdom, JavaScript rozszerzenia, istniejący SDK TypeSafe oraz Stripe Checkout.

**Spec:** `docs/superpowers/specs/2026-10-13-content-quality-pilot.md`

## Global Constraints

- Odznaki: „Konkretny”, „Mało treściwy”, „Niepewna ocena”.
- Domyślnie tylko dyskretne oznaczenie. Przyciemnianie opcjonalne, wyłączone domyślnie.
- Przy niepewności post pozostaje widoczny.
- Uczestnik otrzymuje pełny dostęp na 14 dni.
- Po teście dobrowolny zakup Lifetime Pro za 19,99 zł; bez automatycznego obciążenia.
- Brak nowej automatycznej telemetrii.
- Bez automatycznego dołączania tekstu.
- Node.js 20+, dwie spacje, podwójne cudzysłowy i średniki; jawne importy `.ts`.
- Zachować wcześniejsze lokalne zmiany, pliki tokenów i dane płatnych klientów. Staging/izolowany test przed produkcją.

## Review Focus

1. Brakujące, sprzeczne lub niefinitywne sygnały nie mogą stać się pozytywnym werdyktem ani powodem przyciemnienia — zadanie 1.
2. Nowe rozszerzenie ze starym proxy oraz stary klient z nowym proxy nie mogą mylić jakości z autorstwem — zadania 1–2.
3. Zapisane wcześniej `blurSlop: true` nie dowodzi świadomego wyboru, bo była to wartość domyślna — zadanie 2.
4. Restart serwera nie może zgubić daty wygaśnięcia testu, odnowić testu ani zmienić praw Lifetime/Team — zadania 4–5.
5. Zgłoszenie z timeoutem, podwójnym kliknięciem lub HTML w treści nie może zgubić danych, powielić rekordu ani wykonać kodu — zadanie 6.

## Stan potwierdzony w kodzie

Inspekcja lokalnego HEAD `d70fdc7`, 2026-10-13; bez sprawdzania stanu produkcji.

- `jev/questions.ts`: rubryka `style-v2` zawiera `has_substance`, ale także sygnały stylu/„głosu”.
- `server/src/map-answers.ts`: `substanceProbability` nie jest przekazywane do decyzji o odznace. Braki części odpowiedzi są zamieniane na zero.
- `extension/verdict-policy.js`: wspólna polityka używa stylu i prawdopodobieństwa slopu; odznaki to `human/mixed/slop`.
- `content.js`, `options.js`, `ext-api.js`: domyślne przyciemnianie jest włączone; `content.js` przelicza werdykt lokalnie przy zmianie progu.
- `server/src/verdict-cache.ts`: klucz już zawiera wersję rubryki, ale wersja jest jednym globalnym importem.
- `server/src/pro-tokens.ts`: brak terminu ważności; `loadIssued()` zachowuje tylko `customerId/token/digest/status`, tracąc `kind/plan/seat/subscriptionId` i klucz mapy. W szczególności zapis Lifetime pod `customerId#lifetime` nie odtwarza się w tej postaci.
- `server/src/index.ts`: `/evaluate`, `/health` i billing istnieją; formularz zgłoszeń i trial nie istnieją.
- Manifest 0.2.8; pakowanie Chrome ma jawną listę plików, którą trzeba rozszerzyć.

## Proponowane decyzje techniczne do zatwierdzenia wraz z planem

- Pilotaż opt-in przez oddzielny pakiet/konfigurację `content-v1`; istniejący endpoint bez parametru zachowuje `style-v2`. Nowy klient nie reinterpretowuje starej odpowiedzi.
- Nowe ustawienie `qualityDimEnabled`, domyślnie `false`, bez kopiowania starego `blurSlop`. Stary tryb zachowuje ustawienia.
- Próg startowy jakości: niska treściwość >= 0.85 i konkretność <= 0.20; konkretność >= 0.80 i niska treściwość <= 0.20 daje „Konkretny”; pozostałe przypadki niepewne. To hipoteza do kalibracji, nie zatwierdzona skuteczność.
- Pełny dostęp oznacza funkcje Pro z istniejącymi limitami ochrony kosztów, nie nieograniczone wywołania. 14 dni liczone od pierwszego poprawnego, uwierzytelnionego `/evaluate`; `/health` nie uruchamia zegara.
- Formularz w rozszerzeniu, zgłoszenia w prywatnym JSONL na trwałym wolumenie; dostęp operatora, bez publicznej listy i bez maili. Proponowana retencja 30 dni od wysłania, egzekwowana przy starcie i codziennie.
- Zestaw 50 jest bramką przed pilotażem, nie niezależnym dowodem generalizacji. Każdą korektę po obejrzeniu wyników odnotować jako kalibrację na tym zestawie.

## Kolejność i mapa plików

Ścieżka główna: 1 → 2 → 3 (bramka jakości). Niezależny blok dostępu: 4 → 5. Formularz 6 wymaga kontraktu 1 i autoryzacji 5. Zadanie 7 łączy rezultaty. Każdy blok ma własny odbiór; zatrzymanie na bramce jakości nie wymaga publikacji pozostałych zmian.

Nowe moduły: `jev/content-questions.ts`, `extension/content-quality-policy.js` oraz `.d.ts`, `server/src/content-answers.ts`, `server/src/trial-tokens.ts`, `server/src/feedback.ts`, `extension/feedback.html`, `extension/feedback.js`.

Nowe narzędzia: `scripts/check-content-pilot.ts`, `scripts/issue-trial.ts`; nowe instrukcje: `docs/pilot/runbook.md`. Dane uczestników, tokeny, zgłoszenia i rzeczywiste posty pozostają poza repozytorium.

### Task 1: Osobny kontrakt oceny treści i kompatybilność proxy

**Files:** nowe moduły pytań, polityki i mapowania powyżej; zmiany `server/src/evaluate.ts`, `index.ts`, `verdict-cache.ts`, `jev/QUESTIONS.md`; testy `server/test/content-quality.test.ts`, `proxy.test.ts`, `verdict-cache.test.ts`.

**Interfaces:** `decideQuality({ substanceProbability, lowInformationProbability }): QualityDecision`; `QualityDecision` ma `badge: "concrete" | "low_information" | "uncertain"`, `labelPl`, `reasonCode`, `shouldCover`, `policyVersion: "content-v1"`. `/evaluate` przyjmuje opcjonalne `assessment: "content-v1"`; odpowiedź jakości zawiera `assessment`, `postId`, `model`, oba prawdopodobieństwa oraz decyzję. Stary kontrakt pozostaje oddzielny.

- [ ] Dodać test polityki, uruchomić go przed implementacją; powinien zgłosić brak modułu:

```ts
import { it } from "node:test";
import assert from "node:assert/strict";
import policy from "../../extension/content-quality-policy.js";
it("protects substance and uncertainty", () => {
  const decide = (s: number, l: number) => policy.decideQuality({
    substanceProbability: s, lowInformationProbability: l,
  });
  assert.equal(decide(0.9, 0.1).badge, "concrete");
  assert.equal(decide(0.1, 0.9).badge, "low_information");
  for (const [s, l] of [[0.9, 0.9], [0.5, 0.5], [NaN, 0.9], [0.1, Infinity], [-1, 0.9]]) {
    assert.equal(decide(s, l).badge, "uncertain");
    assert.equal(decide(s, l).shouldCover, false);
  }
});
```

- [ ] Zaimplementować politykę w tym samym formacie UMD co `verdict-policy.js`, z walidacją obu liczb w [0,1] i następującym rdzeniem:

```js
const valid = [s, l].every((n) => Number.isFinite(n) && n >= 0 && n <= 1);
const badge = !valid ? "uncertain"
  : s >= 0.8 && l <= 0.2 ? "concrete"
  : s <= 0.2 && l >= 0.85 ? "low_information" : "uncertain";
```

`reasonCode`: odpowiednio `specific_information`, `generic_without_detail`, `insufficient_or_conflicting_signals`. Uzasadnienia deterministyczne, bez generowania twierdzeń o autorze. `shouldCover` oznacza kwalifikację, nie zgodę użytkownika na przyciemnienie.

- [ ] Dodać dwie rubryki Noul `has_substance` i `low_information` w `content-questions.ts`. Obie oceniają wyłącznie przekaz; negatywna wymaga braku konkretów oraz ogólników/pustych deklaracji/baitu. Reklama, styl, emoji i autorstwo nie są samodzielnym kryterium. Instrukcje wewnątrz posta traktować jako dane. W mapperze brak wartości zachować jako `null`, nie zero.
- [ ] Rozdzielić payloady i mapowanie po `assessment`; nieznany tryb zwraca 400. Cache kluczować jawnie `(rubricVersion, normalizedText)` i przechowywać odpowiedzi z ich trybem. Dopisać testy: identyczny tekst w dwóch trybach nie współdzieli wpisu, cache HIT i MISS dają tę samą ocenę, brak parametru zachowuje stary JSON, niepełne odpowiedzi dają niepewność.
- [ ] Uruchomić `npm --prefix server exec -- tsx --test test/content-quality.test.ts test/proxy.test.ts test/verdict-cache.test.ts` oraz `npm run typecheck`. Odbiór: PASS i brak zmiany starego kontraktu. Commit tylko plików zadania: `Add versioned content quality assessment`.

### Task 2: Nowe odznaki, uzasadnienia i świadome przyciemnianie

**Files:** `extension/content.js`, `ext-api.js`, `background.js`, `options.js`, `options.html`, `badge.css`, `manifest.json`; `server/demo/feed.html`; pakowarki `scripts/package-chrome.mjs`, `pack-extension.mjs`, `pack-firefox.mjs`; testy `content-runtime.test.ts`, `extension-browsers.test.ts`, `layout.test.ts`.

**Interfaces:** ustawienia `assessment` i `qualityDimEnabled`; nowa polityka z zadania 1. Tylko świadomie włączone `qualityDimEnabled` plus `shouldCover` może przyciemnić post jakościowy.

- [ ] W istniejącym harnessie DOM dodać przypadki: czysta instalacja, zapisane `blurSlop: true`, nowa jawna zgoda, cofnięcie zgody, niepewność, stary serwer, ponowne użycie tej samej karty dla innego posta. Sprawdzać brak zasłony, tekst odznaki oraz usunięcie starego uzasadnienia.
- [ ] Dodać do `ExtApi.resolveSettings` niezależną wartość:

```js
qualityDimEnabled: stored.qualityDimEnabled === true
```

Render jakości stosuje `settings.qualityDimEnabled && result.shouldCover`. Nie przelicza nowego kontraktu starą funkcją `currentVerdict` ani suwakiem progu stylu. Suwak dotyczy tylko starego trybu.
- [ ] Zmapować uzasadnienia: `specific_information` → „Post zawiera konkretne informacje lub opis doświadczenia”; `generic_without_detail` → „Przeważają ogólniki bez wspierających konkretów”; pozostałe → „Sygnały są niepełne lub sprzeczne”. Renderować przez `textContent`. Stara lub niezgodna odpowiedź daje komunikat niezgodności i brak przyciemnienia, nie nową etykietę na podstawie starego wyniku.
- [ ] Zachować krótkie posty w widoku: przy pominięciu przez filtr długości nie nadawać negatywnej oceny; próg długości pozostaje filtrem kosztów. Dodać fixture krótkiego użytecznego posta. W eksperymencie jakości oceniać również krótkie przykłady bez tego filtra.
- [ ] Dodać nowy skrypt polityki przed `content.js` w manifeście/demo i do pakowarek. Sprawdzić lokalny `/demo` w przeglądarce: trzy etykiety, uzasadnienia klawiaturą, wąski ekran, linki i komentarze dostępne, zmiana ustawienia bez odświeżania.
- [ ] Uruchomić trzy wskazane pliki testów oraz typecheck. Odbiór: wszystkie przypadki PASS i zapisane screenshoty demo. Commit: `Add content quality badges with opt-in dimming`.

### Task 3: Mierzalna bramka jakości 50 przykładów

**Files:** `scripts/check-content-pilot.ts`, `server/test/content-pilot.test.ts`, `docs/pilot/runbook.md`; prywatne wejście poza repo.

**Interfaces:** wejście JSON: 50 rekordów `{ id, text, expected: "concrete" | "low_information" | "uncertain" }`; wyniki `{ id, badge, policyVersion, rubricVersion }`. Raport bez tekstów: liczebności, macierz ocen, FP, recall, wersje, hash wejścia. Funkcja `scorePilot(rows)` zwraca `{ passed, valuableFalsePositives, lowInformationRecall }`.

- [ ] Testy: 1 FP dopuszczony, 2 FP odrzucone; 10/20 słabych dopuszczone, 9/20 odrzucone; brak wyniku, duplikaty ID, inna wersja, 49 rekordów lub za mała klasa odrzucają cały eksperyment. Niepewność dla słabego liczy się jako nierozpoznanie.
- [ ] Warunek bramki:

```ts
const passed = rows.length === 50 && valuableCount >= 20 && lowCount >= 20
  && valuableFalsePositives <= 1 && lowCorrect / lowCount >= 0.5;
```

Dodać walidację kompletności przed tym warunkiem. Tryb offline liczy raport; osobny jawny tryb live korzysta z Jev i wskazanego pliku. Nigdy nie zapisuje tokenów w raporcie.
- [ ] Właściciel dostarcza/ocenia rzeczywiste 50 przykładów przed porównaniem wyników. Uwzględnić język polski i angielski, reklamę z konkretami, techniczny opis, historię, pusty bait oraz krótką informację. Testy syntetyczne narzędzia nie zastępują tego zbioru.
- [ ] Po przejściu testów narzędzia przeprowadzić jawny eksperyment live na zatwierdzonym materiale. Zablokować pilotaż przy niezaliczeniu lub braku danych. Raport jawnie opisuje poprawki rubryki po obejrzeniu wyników. Commit narzędzia i instrukcji: `Add pilot quality acceptance report`.

### Task 4: Trwałość istniejących uprawnień po restarcie

**Files:** `server/src/pro-tokens.ts`, nowy `server/test/pro-tokens.test.ts`.

**Interfaces:** istniejące `issueLifetimeToken`, `issueTeamTokens`, `resetProTokens`, `isValidProToken`, `lifetimeSoldCount`, `revokeProToken`; bez zmiany publicznych sygnatur.

- [ ] Test na tymczasowym pliku: wydać Lifetime i Team temu samemu klientowi, wykonać `resetProTokens()`, wczytać ponownie; tokeny i liczba sprzedanych Lifetime muszą być zachowane. Cofnięcie subskrypcji po restarcie nie cofa Lifetime. Kolejne wydanie jest idempotentne.
- [ ] Zapisać format `{ version: 2, tokens: [{ key, ...row }] }`, odtwarzać pełne zwalidowane pola. Starsze rekordy bez `key`: odtworzyć klucz z `kind/plan/seat`; przy brakujących metadanych zachować dotychczasowy klucz klienta. Wykrywać kolizje zamiast cicho nadpisywać.
- [ ] Zapis atomowy przez plik tymczasowy w tym samym katalogu i rename, uprawnienia 0600. Błąd odczytu ma przerwać mutację, aby pusty stan nie nadpisał uszkodzonego pliku. Testować uszkodzony JSON i nieudany zapis. Przed migracją produkcyjną prywatna kopia zapasowa i próba odtworzenia.
- [ ] Uruchomić testy tokenów, istniejące proxy i billing. Odbiór: restart, migracja, ponowienia i cofnięcia PASS. Commit: `Preserve issued token identity across restarts`.

### Task 5: Dostęp testowy na 14 dni

**Files:** `server/src/trial-tokens.ts`, `scripts/issue-trial.ts`, `server/src/index.ts`, `extension/options.js`, `options.html`, `server/.env.example`; testy `server/test/trial-tokens.test.ts`, `proxy.test.ts`.

**Interfaces:** `issueTrial(participantId, env)` → `{ token, created }`; `resolveTrial(token, { activate, now }, env)` → `{ status: "pending" | "active" | "expired" | "invalid", expiresAt: number | null }`. Oddzielny `TRIAL_TOKEN_FILE`, rekord `{ participantId, digest, activatedAt, expiresAt }`; token losowy `trial_` + 24 bajty, na dysku tylko digest.

- [ ] Test czasu z wstrzykniętym `now`: health nie aktywuje; pierwsze poprawne evaluate aktywuje; ponowienie nie przesuwa daty; granica dokładnie 14 × 24 h wygasza; restart zachowuje datę. Niepoprawny payload evaluate nie zużywa początku testu.
- [ ] Idempotentne wydawanie: drugi raz dla tego samego participantId zwraca `created: false` bez nowego tokenu i bez przedłużenia. Operator zapisuje pierwszy token w prywatnym pliku 0600; utrata wymaga jawnej rotacji z zachowaniem istniejącej daty.
- [ ] Dodać atomowy trwały zapis jak w zadaniu 4, walidację danych i odmowę uruchomienia trial bez pliku na trwałym dysku. Integracja auth przed cache/wywołaniem modelu; aktywny trial korzysta z limitów Pro. Wygasły zwraca 401 `trial_expired`, bez automatycznego zejścia do Demo.
- [ ] Health uwierzytelnionego użytkownika zwraca stan i termin testu; UI pokazuje datę, komunikat wygaśnięcia i jawny link zakupu. Zachować możliwość ręcznego wyboru Demo. Test nie tworzy Stripe subscription ani obciążenia.
- [ ] Testować Lifetime zakupiony po trial jako oddzielne uprawnienie: wygaśnięcie trial nie dotyka płatnego tokenu. Uruchomić testy trial/proxy oraz typecheck. Commit: `Add expiring pilot access tokens`.

### Task 6: Prywatne zgłoszenia pomyłek

**Files:** `extension/feedback.html`, `feedback.js`, `background.js`, `content.js`, `server/src/feedback.ts`, `index.ts`, pakowarki; `server/test/feedback.test.ts` i testy DOM; `docs/privacy.html`, `docs/en/privacy.html`.

**Interfaces:** `POST /feedback`, body `{ submissionId, assessment: "content-v1", badge, reason, excerpt? }`; auth istniejącym Pro/trial. `submissionId` UUID, powód 1–1000 znaków, excerpt 0–6000, body max 16 KB. Odpowiedź 201 `{ saved: true }`, duplikat 200, niedostępny magazyn 503. `FEEDBACK_FILE` wskazuje prywatny JSONL.

- [ ] Testy endpointu: brak auth 401; wygasły trial może zgłosić pomyłkę w okresie retencji, ale nie oceniać postów; za duże body 413; zły enum/UUID 400; limit 10 zgłoszeń/h na digest tokenu daje 429; błąd zapisu 503. Zapis nie zawiera tokenu, digestu, autora ani URL posta. Idempotencja przez submissionId przy jednym procesie proxy; wiele replik wymaga wspólnego magazynu przed uruchomieniem.
- [ ] Formularz otwierany świadomie z odznaki; przekazać tylko ocenę. Pole fragmentu startuje puste. Użytkownik wpisuje powód i opcjonalny tekst, widzi zakres wysyłki, naciska „Wyślij”. Token pobiera background, nie parametr URL. Endpoint ograniczyć do zaufanego skonfigurowanego proxy.
- [ ] Testy DOM: żadna wysyłka przed kliknięciem, brak automatycznie dołączonego posta, HTML pokazany tekstowo, podwójne kliknięcie zachowuje UUID, timeout zachowuje wpisany formularz, sukces dopiero po odpowiedzi serwera. Błąd nie udaje zapisania.
- [ ] Zapis 0600, serializowana kolejka append i odtworzenie ID po restarcie. Uszkodzony plik blokuje zapis, nie jest czyszczony. Retencja usuwa tylko rekordy starsze niż 30 dni atomową podmianą. Nie rejestrować payloadu ani sekretów w logach. Dokumentacja PL/EN opisuje faktyczny zakres, cel i czas przechowywania.
- [ ] Uruchomić testy API i DOM, wykonać ręczny test formularza z lokalnym serwerem i restartem. Commit: `Add explicit private assessment feedback`.

### Task 7: Przygotowanie i odbiór pilotażu

**Files:** `docs/pilot/runbook.md`, `README.md`, `docs/index.html`, `docs/en/index.html`, `docs/pro.html`, `docs/en/pro.html`, manifest/listingi Store i checklisty pakowania.

- [ ] Zapisać instrukcję operatora: wydanie 10–15 prywatnych tokenów, instalacja pakietu pilota, weryfikacja pierwszej aktywacji, prywatna tabela participantId/start/end/ankieta1/ankieta2/zakup. Bez nazwisk i tokenów w repo; korespondencję wysyła właściciel.
- [ ] Ankieta dzień 7: liczba dni używania 0–7, czy pomogło wybrać posty, najbardziej przeszkadzająca pomyłka. Ankieta dzień 14: liczba dni używania w drugim tygodniu 0–7, chęć dalszego korzystania, powód rezygnacji. Rzeczywisty zakup potwierdzać po stronie Stripe, nie deklaracją ankietową. Proponowane okno raportu zakupów: 7 dni po zakończeniu indywidualnego trial, jawnie opisane w runbooku.
- [ ] Dopasować opis obietnicy PL/EN i listing pakietu pilota. Sprawdzić ofertę 19,99 zł również przy ustawionym `STRIPE_PRICE_LIFETIME`, które może nadpisać cenę z kodu, oraz dostępność istniejącego limitu sprzedaży. Próba w Stripe test mode potwierdza kwotę 1999 groszy, brak cykliczności i wydanie trwałego tokenu. Nie wykonywać prawdziwego zakupu jako testu.
- [ ] Uruchomić `npm test`, `npm run typecheck`, `npm run pack:chrome`, `npm run pack:firefox`, `npm run pack:extension`; przeglądarką sprawdzić demo i formularz. Dla wydania Safari użyć istniejącego builda i wyrównać wersje z manifestem. Oddzielić test pakowania od akceptacji rzeczywistego feedu.
- [ ] Na izolowanym środowisku sprawdzić nowy/stary klient × nowy/stary serwer, trwałe tokeny po restarcie, wygaśnięcie trial, feedback po timeoutie i regresję checkoutu. Użytkownik wykonuje reprezentatywny odbiór feedu przed zaproszeniami. Raportuje się dokładne SHA i wersje.
- [ ] Start dopiero po spełnieniu zadania 3, technicznym odbiorze i osobnej zgodzie na publikację/produkcję. Rollback wyłącza pilota i przywraca poprzedni pakiet/kontrakt; nie przywraca starej kopii tokenów na nowsze zakupy. Zmiana formatu tokenów wymaga rollbacku kompatybilnego z v2.
- [ ] Raport końcowy: liczba rozpoczynających, deklarowane dni drugiego tygodnia, zweryfikowane zakupy. Sukces to 10/6/3 zgodnie ze specyfikacją. Brak odpowiedzi pozostaje brakiem danych; sam sukces nie uruchamia automatycznie szerszego wdrożenia. Commit dokumentacji: `Document content quality pilot operations`.

## Odbiór planu i zależności od właściciela

Do wykonania potrzebne będą: zatwierdzenie proponowanych decyzji technicznych, rzeczywiste przykłady z ocenami, uczestnicy zaproszeni przez właściciela, wybór metody realizacji i późniejsza zgoda na uruchomienie produkcyjne. Nie są to już zrealizowane kroki.

Plan nie tworzy issue ani nie publikuje wiadomości. Gdy zostanie zlecone przeniesienie do trackera, utworzyć nadrzędną specyfikację i siedem zadań w GitHub Issues zgodnie z `docs/agents/issue-tracker.md`.

## Self-review

Wszystkie wymagania specyfikacji mają zadania: kryteria/ostrożność 1 i 3; etykiety/uzasadnienia/widoczność 2; 14 dni i zakup 4–5 i 7; feedback i prywatność 6; kohorta/ankiety/10–6–3 oraz publikacja 7. Dodatkowe założenia techniczne są jawnie oddzielone od uzgodnionego produktu. Przegląd kodu nie zastępuje testów: na etapie planowania testów aplikacji nie uruchamiano.
