# Weryfikacja lokalnego kandydata 0.2.9

Gałąź `codex/content-quality-pilot`, baza `d70fdc7`. Implementacja i poprawki znajdują się w izolowanym worktree `/private/tmp/linkedin-ai-slop-content-pilot`; główny checkout pozostaje na wcześniejszym stanie.

## Dowody przed końcowym przeglądem

- 93/93 testy, 14 zestawów; typecheck PASS.
- Chrome: rzeczywisty viewport 390 px bez poziomego przewijania; liczba przyciemnionych kart po przełączeniach 0 → 1 → 0; karta niepewna cały czas widoczna.
- Formularz: puste pole fragmentu nawet przy parametrze tekstu w URL, ocena poprawnie wybrana, brak poziomego przewijania.
- Chrome ZIP, Firefox XPI i Chromium ZIP: manifest 0.2.9, porównanie nowych plików z kodem źródłowym, brak sekretów/pliku .env/node_modules.
- Safari Debug/macOS arm64: BUILD SUCCEEDED; podpis ad-hoc, bez instalacji i publikacji.
- CLI trial: pierwszy zapis prywatnego tokenu, drugie wydanie tego samego participantId nie tworzy tokenu ani nie odnawia terminu.
- Narzędzie oceny: testy progów, kompletności, unikalności i zgodności wersji. Syntetyczny test narzędzia nie potwierdza jakości modelu.

## Przegląd i farma

Niezależny reviewer znalazł cztery istotne problemy: odczyt zapisanych ustawień; odczyt tokenu; konflikt zmienionej treści zgłoszenia przy ponowieniu; awaria startu proxy z uszkodzonym plikiem zgłoszeń. Brak usterek krytycznych i drobnych w tym przeglądzie.

Właściciel zlecił pozostałe poprawki na farmie. Sesja `tmux`: `lais-pilot-20261013`; okna `storage` i `feedback`, dwa procesy Codex CLI, oddzielne worktree na `173f51d`, automatyczna ocena uprawnień i sandbox workspace-write. Stanowiska nie publikują ani nie wdrażają zmian. Koordynator odbiera commity i wykonuje wspólne testy. Logi, briefy i kody zakończenia: `/private/tmp/lais-farm-20261013`.

Oba procesy zakończyły się kodem 0. Storage: `7821867` → integracja `7232dfd`; feedback: `afada6c` → integracja `8ae877f`. Koordynator przeczytał różnice i wykonał wspólne testy: **113/113 PASS**, typecheck PASS, wszystkie trzy paczki 0.2.9 i końcowy build Safari PASS. Porównano bajty zmienionych plików z archiwami i zasobami Safari. Wszystkie cztery uwagi review mają regresje RED→GREEN; brak odłożonych drobnych uwag.

Testy finalnych poprawek formularza są DOM/HTTP. Worker nie wykonał nowego testu formularza w Chrome, ponieważ polityka narzędzia zablokowała nawigację do lokalnego pliku; nie obchodzono tego ograniczenia. Wcześniejszy podgląd Chrome (przed poprawkami retry) jest dowodem układu, nie pełnego działania zainstalowanego rozszerzenia. Storage worker sprawdził ponowne otwarcie/zapis rzeczywistego DOM opcji w izolowanym Chromium z atrapą storage.

Paczki końcowe są w `build/pilot/` (lokalne, niepublikowane):

- Chrome SHA-256: `ca6053fd4d88c7d907e8ba48e35b6a505024809180562a441e4819debcc5ccea`.
- Firefox SHA-256: `623f257652a9448cf3fc7a57a30d057703aff00c9c90f1810ef5294706d38f54`.
- Chromium SHA-256: `dba03a2eaa88687f2a50d081d38f02e5a72f4efaf609728f9aa7ebf2b564aca5`.

## Decyzje wykonawcze i koszt pomyłki

- Worktree w `/private/tmp` odizolowały zmiany od oryginału. Do przeglądu należy używać wskazanej gałęzi, nie starego checkoutu.
- Implementacja trwała mimo oczekiwania na rzeczywisty korpus. Bramka jakości blokuje start pilota, a skuteczność modelu nadal nie jest potwierdzona.
- Atomowy plik i synchroniczny zapis obsługują mały pilotaż z jednym procesem. Wiele replik wymaga wspólnej bazy; bez tego grozi utrata aktualizacji.
- Wspólne zmiany kontraktów zapisano w spójnych commitach zamiast siedmiu częściowo zależnych commitów; historia jest mniej granularna.
- Wygasły trial może zgłaszać pomyłki jeszcze przez 30 dni. Operator musi zachować rejestr trial przez ten okres.
- Na polecenie właściciela pozostałe poprawki przejęła farma z dwoma izolowanymi stanowiskami. Koordynator zintegrował wyniki i powtórzył całą weryfikację.
- Brakujące dowody Stripe, LinkedIna, rzeczywistej jakości i trwałości produkcyjnej pozostają bramkami uruchomienia; testy lokalne ich nie zastępują.
- Po awarii retencji feedback pozostaje wyłączony w danym procesie. Operator naprawia plik i restartuje proxy; pozostałe funkcje działają.

## Otwarte bramki uruchomienia

1. Właściciel dostarcza i ocenia 50 rzeczywistych postów; eksperyment Jev musi spełnić uzgodnione progi.
2. Stripe test mode i efektywna cena konfiguracji, dostępność limitu Lifetime oraz trwałość danych na docelowym wolumenie.
3. Odbiór na zalogowanym LinkedIn z rzeczywistym rozszerzeniem; podgląd Chrome nie jest tym odbiorem.
4. Osobna zgoda na publikację/produkcję oraz zaproszenia przez właściciela.

Nie wykonano push, PR, merge, publikacji sklepowej, produkcyjnego wdrożenia, wysyłki zaproszeń ani prawdziwego zakupu.
