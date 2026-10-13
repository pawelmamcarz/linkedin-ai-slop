# Pilotaż oceny treści — instrukcja operatora

Status: implementacja lokalna; start zablokowany do oceny korpusu i odbioru środowiska. Zatwierdzony zakres: `../superpowers/specs/2026-10-13-content-quality-pilot.md`.

## Przed zaproszeniami

1. Uruchom `npm test`, `npm run typecheck` oraz pakowanie Chrome/Firefox/Chromium. Sprawdź `server/demo/content-quality.html`, formularz i rzeczywisty feed w osobnym profilu z rozszerzeniem. Nie traktuj podglądu syntetycznego jako pomiaru Jev.
2. Uruchom jedną instancję proxy na izolowanym środowisku z trwałym prywatnym wolumenem. Ustaw `TRIAL_TOKEN_FILE` i `FEEDBACK_FILE`, a istniejący `PRO_TOKEN_FILE` zabezpiecz kopią i sprawdź odtworzenie. Rejestry plikowe wymagają jednego procesu i operatora; przed wieloma replikami potrzebny wspólny magazyn.
3. Ustaw trial i feedback na tym samym wolumenie co trwałe dane, nie w efemerycznym kontenerze. Dostęp operatora, pliki 0600. Zgłoszenia usuwane po 30 dniach przy starcie, codziennie i przy nowych zapisach. Logi nie zawierają tekstów ani tokenów. Kopie zapasowe zgłoszeń również muszą wygasać w tym terminie.
4. Właściciel ocenia 50 przykładów przed zobaczeniem predykcji: co najmniej 20 `concrete`, 20 `low_information`, pozostałe mogą być `uncertain`. Przechowuj rzeczywiste posty poza repo. JSON: `[{"id":"p01","text":"...","expected":"concrete"}]`. Wszystkie ID unikalne. Uwzględnij PL/EN, krótkie informacje, reklamy, technikę i historie.
5. Po ustawieniu klucza tylko w środowisku uruchom z katalogu repo `node --import ./server/node_modules/tsx/dist/loader.mjs scripts/check-content-pilot.ts --live /private/path/corpus.json /private/path/report.json`. To wykonuje płatne wywołania API. Raport nie zawiera tekstów. Tryb `--offline` przyjmuje kompletne rekordy z `badge`, `policyVersion`, `rubricVersion` i nie woła modelu. Narzędzie nie nadpisuje istniejącego raportu.
6. Dopuść pilotaż tylko gdy `passed: true`: najwyżej 1 wartościowy oceniony negatywnie, rozpoznana minimum połowa słabych. Każdą poprawkę po obejrzeniu wyników zapisuj jako kalibrację na tym zestawie. Brak raportu oznacza brak dowodu jakości.
7. Potwierdź osobno zgodę na publikację/produkcję. Przy promocji zanotuj SHA, wersję pakietu, poprzedni release i zgodny format tokenów. Rollback kodu nie może cofnąć nowszych zakupów; format v2 wymaga kompatybilnego loadera.

## Dostęp i oferta

- Właściciel zaprasza osobiście 10–15 osób. Uczestnicy używają pseudonimów `p01` itd. Lista kontaktów poza repo; agent nie wysyła zaproszeń.
- CLI na serwerze/jedynym rejestrze: `node --import ./server/node_modules/tsx/dist/loader.mjs scripts/issue-trial.ts p01 /private/path/p01-token.txt`. Ustaw `TRIAL_TOKEN_FILE` w środowisku. Wynik 0600; token nie trafia do stdout. Powtórne wydanie nie odnawia ani nie odtwarza sekretu. Zabezpiecz pierwszy plik; zgubiony token wymaga osobnej kontrolowanej rotacji z zachowaniem terminu.
- W opcjach: tryb Pro, wklej token, wybierz „Pilotaż: ocena treści”, zapisz. Przycisk sprawdzenia proxy pokazuje status. Pierwsza poprawna ocena rozpoczyna 14 × 24 h; health i niepoprawne żądania nie aktywują. Pełne funkcje Pro z limitami ochrony kosztów, nie nieograniczone wywołania.
- Przyciemnianie jest osobnym wyborem, domyślnie wyłączonym. Ocena niepewna pozostawia post widoczny. Ocena dotyczy treści, nie autorstwa.
- Po końcu token zwraca `trial_expired`; użytkownik może ręcznie wybrać Demo lub kupić Lifetime Pro za 19,99 zł bez automatycznej płatności. Nowy płatny token wkleja w opcjach.
- Przed testem sprawdź `/billing/offers`, faktyczny Stripe Price (jeśli `STRIPE_PRICE_LIFETIME` jest ustawiony) oraz limit sprzedaży. Stripe test mode: kwota 1999 groszy, PLN, payment, nie subscription; checkout i webhook wydają ten sam trwały token. Powtórz po restarcie. Nigdy nie używaj testu jako powodu do prawdziwego obciążenia.
- Feedback działa dla Pro i trial, również przez 30 dni po wygaśnięciu trial. Tylko ocena/powód/dobrowolny fragment, brak automatycznego autora/URL/tekstu. Limit 10 zgłoszeń/h, potwierdzenie dopiero po zapisie; ponowienie z tym samym ID nie dubluje.

## Ankiety i raport

Prywatna tabela: participantId, data pierwszej aktywacji, koniec trial, ankieta 7, ankieta 14, zakup potwierdzony/niepotwierdzony. Dane używania są deklarowane, nie mierzone telemetrycznie.

Dzień 7: „Przez ile dni używałeś rozszerzenia (0–7)?”, „Czy pomogło wybrać posty?”, „Która pomyłka przeszkadzała najbardziej?”.

Dzień 14: „Przez ile dni używałeś w drugim tygodniu (0–7)?”, „Czy chcesz nadal korzystać?”, „Co skłania do zakupu lub rezygnacji?”. Zakup sprawdź w Stripe; identyfikację z uczestnikiem potwierdza operator. Brak ankiety pozostaje brakiem danych.

Raport zakupów zamknij 7 dni po indywidualnym końcu testu. Sukces: minimum 10 rozpoczynających, minimum 6 deklarujących 3 dni używania w drugim tygodniu i minimum 3 potwierdzone zakupy. Nie ogłaszaj sukcesu na podstawie zamiaru zakupu. Wynik nie uruchamia samoczynnie szerszego wdrożenia.
