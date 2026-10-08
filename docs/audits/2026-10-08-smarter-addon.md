# Jak poprawić trafność LinkedIn AI Slop

Data: 2026-10-08. Analiza kodu wersji 0.2.6 w lokalnym commicie `011ee1f`. To projekt zmian i wyniki reprodukcji; nie zapis wdrożenia tych zmian.

Cel użytkownika: więcej trafnych wykryć, mniej fałszywych alarmów oraz czytelne uzasadnienie oceny. Poprawę tych trzech cech trzeba zmierzyć razem. Samo obniżenie progu zwiększa czułość, lecz nie dowodzi poprawy trafności.

## Co już działa

W 0.2.6 są już: próg 100 znaków dla samodzielnych postów, 200 dla komentarzy do udostępnień, oczekiwanie na rozwinięcie tekstu, unieważnianie wyników po zmianie tekstu, wznowienie po minutowym 429 oraz lekka zasłona. Nie są to nowe propozycje. Obecny backend ma też cache surowych odpowiedzi Jev i nakłada próg przy odczycie.

## Potwierdzone problemy

| Priorytet | Problem | Dowód i skutek |
| --- | --- | --- |
| P1 | Niepewny wybór stylu bezwarunkowo wymusza `slop`. | `server/src/map-answers.ts:67`: OR z `voice === "ai_slop"`. Syntetyczne odpowiedzi: Noul 0.20, intensywność 0.20, prawdopodobieństwo wybranej opcji 0.34, `confidence` 0.01. Wynik `slop` również przy progu 0.95; jednocześnie `isAiSlop: false`. Rozkład prawdopodobieństw nie uczestniczy w decyzji. To reprodukcja kompozycji odpowiedzi, a nie dowód, że model często zwraca taki zestaw. |
| P1 | Format tekstu znika przed oceną stylu. | `cleanText()` w `extension/content.js` i `normalizePostText()` w `server/src/verdict-cache.ts` zamieniają wszystkie białe znaki na pojedynczą spację. Próba `buildState()` nie zachowała żadnego podziału wiersza. Lista i jej spłaszczona wersja mają ten sam klucz cache. Model nie dostaje części układu, który ma oceniać. Wpływ na trafność wymaga porównania na przykładach. |
| P1 | Fallback pobierania tekstu może zostawić cudzy post. | `stripNestedFromClone()` usuwa zagnieżdżenia tylko przy `node.isConnected`, chociaż pracuje na odłączonym klonie. W reprodukcji znacznik cudzego tekstu znalazł się w ekstrakcji. jsdom wymagał jawnego zastąpienia `innerText` przez `textContent`; to izoluje błąd usuwania węzłów, nie potwierdza całego renderowania Chrome. |
| P1 | Włączenie dodatku po starcie z `enabled: false` nie uruchamia obserwatorów. | `boot()` kończy się przed `watch()`, a callback ustawień wywołuje tylko pojedynczy skan. W reprodukcji pierwsza karta otrzymała ocenę po włączeniu, ale dodana później karta już nie. |
| P2 | Kolejka ocenia posty, które opuściły ekran. | `pump()` sprawdza podłączenie do DOM i generację ustawień, ale nie aktualną widoczność. Reprodukcja: dwie zajęte oceny, trzecia karta przesunięta poza ekran; po zwolnieniu miejsca trzecia została wysłana. |
| P2 | Zmiana samej czułości czyści wyniki i ponownie wysyła teksty. | Callback ustawień w `boot()` wywołuje `verdicts.clear()` również dla `threshold`. Cache proxy oszczędza wnioskowanie modelu, ale żądanie przechodzi wcześniej przez limit minutowy i dobowy. Lokalna zmiana prezentacji może zatem zużywać limit ocen. To ustalenie z kodu. |

Wyniki izolowanych prób: [smarter-addon-evidence.json](2026-10-08-smarter-addon-evidence.json).

## Ryzyka w pytaniach Jev

Obecne pytania częściowo mieszają styl, użyteczność tekstu i domniemane autorstwo. Kryterium odpowiedzi NO wymienia nazwy, liczby i daty jako cechy ludzkiego pisania. To może chronić szablonowy tekst z dekoracyjnymi liczbami. Z drugiej strony samo wygładzenie stylu nie oznacza pustej treści. To hipotezy do sprawdzenia na oznaczonych tekstach, nie zmierzone błędy modelu.

`has_substance` jest już oceniane, ale nie wpływa na odznakę i nie jest pokazywane w podglądzie. Można wykorzystać ten sygnał do odróżnienia szablonu z konkretną treścią od pustosłowia. Nie należy robić z nazw i liczb automatycznego zwolnienia z oceny slopu.

Noul, intensywność i voice oceniają podobne cechy tego samego tekstu. Ich zgodność nie jest niezależnym potwierdzeniem prawdy. Średnia tych wyników nie powinna być przedstawiana jako nowe, skalibrowane prawdopodobieństwo.

## Rekomendowany pierwszy zakres

1. **Naprawić materiał do oceny i ciągłość pracy.** Usuwać zagnieżdżenia z klonu niezależnie od `isConnected`; zachować granice akapitów i list przy normalizacji tekstu oraz klucza cache; uruchamiać obserwatory przy pierwszym włączeniu. Dodać regresje dla każdego odtworzonego przypadku.
2. **Ujednolicić decyzję i czułość.** Noul pozostaje głównym sygnałem sterowanym suwakiem. Intensywność oraz prawdopodobieństwo konkretnej opcji `voice.probabilities[voice.choice]` opisują dodatkowe sygnały i rozbieżności, zamiast bezwarunkowo nadpisywać próg. Brak rozkładu oznacza brak tej informacji; nie zastępować go wartością `confidence`. Ujednolicić znaczenie `badge`, `isAiSlop` i informacji na odznace. Sprzeczna ocena otrzymuje informację o niepewności i pozostawia post odsłonięty. Dokładne granice wybrać na benchmarku.
3. **Oddzielić oznaczenie od zasłaniania.** Słabszy sygnał może dać odznakę, mocniejsze i zgodne sygnały pozwalają na automatyczne zasłonięcie. Użytkownik zachowuje Pokaż/Ukryj. Dzięki temu większe pokrycie nie wymusza większej liczby zasłoniętych dobrych postów.
4. **Pokazać sygnały oceny.** Podgląd: ocena szablonowości, konkretność treści i ewentualna rozbieżność między sygnałami. Etykiety opisują cechy tekstu, a nie ustalone autorstwo AI. Pierwszy wariant może korzystać z już zwracanych sygnałów i stałych komunikatów. Nie przypisywać modelowi wygenerowanego uzasadnienia, którego nie zwrócił, ani wskazywać konkretnego zdania bez osobnej oceny tego zdania.
5. **Oszczędzać żądania.** Przed wysłaniem ponownie sprawdzać widoczność karty. Zmiana samego progu przelicza dostępne sygnały lokalnie; zmiana tekstu, proxy lub wersji rubryki unieważnia odpowiednie wyniki. Zachować wyniki, gdy użytkownik zmienia tylko sposób zasłaniania.

Pliki pierwszego zakresu: `extension/content.js`, `extension/badge.css`, `extension/options.html`, `extension/options.js`, `server/src/map-answers.ts`, `server/src/verdict-cache.ts`, `jev/questions.ts` oraz odpowiadające im testy. Zmiany rubryki wymagają wersjonowania klucza cache. Backend musi być zgodny ze starszym rozszerzeniem; rozszerzenie musi bezpiecznie obsługiwać brak nowych pól w odpowiedzi starszego proxy.

Pierwszy zakres obejmuje istniejący przepływ ekstrakcji, oceny i prezentacji. Lokalne korekty użytkownika, eksport przykładów i dodatkowe pytania o poszczególne przyczyny slopu są osobnym etapem. Nie należy przedstawiać korekty odznaki jako samoczynnego trenowania Jev. Ewentualne zbieranie tekstów do strojenia wymaga osobnego, jawnego działania użytkownika.

## Jak sprawdzić, czy jest lepiej

- Zestaw 60–100 oznaczonych przykładów PL/EN: pusty szablon, szablon z liczbami, konkretna profesjonalna aktualizacja, osobista historia, ironia, uzasadnione pytanie do czytelników, krótki post, udostępnienie i instrukcje w treści próbujące wpłynąć na ocenę.
- Oddzielić część do strojenia od części sprawdzającej. Syntetyczne przykłady nadają się do regresji; trafność na prawdziwym feedzie wymaga przykładów ocenionych przez użytkownika.
- Porównać liczbę wykrytych slopów, fałszywych alarmów, niepewnych ocen i błędnie zasłoniętych dobrych postów. Osobno mierzyć pominięcia ekstrakcji, czas do odznaki i liczbę żądań. Przy wariancie ostrożniejszym raportować również spadek liczby automatycznych decyzji.
- Porównywać obecną rubrykę z wersją oceniającą szablonowość i pustosłowie niezależnie od deklarowanego autorstwa. Sprawdzić, czy wynik nie zmienia się istotnie po przestawieniu opcji Choice.
- Nie podawać procentowej poprawy przed pomiarem. Każda zmiana progów ma przejść również przypadki graniczne i sprzeczne sygnały.
- Przed wydaniem: testy i typecheck, izolowany Chrome z prawdziwym service workerem, szybki scroll, włączenie/wyłączenie, akapity, udostępnienia, zmiana ustawień bez dodatkowych żądań i zgodność ze starszym proxy. Zalogowany LinkedIn pozostaje oddzielnym sprawdzeniem.

## Walidacja tej analizy

- `npm test`: 62/62, bez pominięć.
- `npm run typecheck`: przechodzi.
- Reprodukcje offline używały sztucznych tekstów i atrap odpowiedzi proxy. Nie pobierano prywatnych postów ani nie zmieniano produkcji.
- Przeczytano bieżącą dokumentację TypeSafe. `confidence` jest statystyką rozkładu; prawdopodobieństwo wskazanej opcji jest osobnym polem. Jev zwraca ustrukturyzowane odpowiedzi i nie jest modelem do generowania swobodnych wyjaśnień.

Źródła: [Choice](https://docs.typesafe.ai/primitives/choice), [Confidence](https://docs.typesafe.ai/confidence), [State](https://docs.typesafe.ai/concepts/state), [ograniczenia Jev 1.13](https://docs.typesafe.ai/model-jaggedness/jev-1.13).
