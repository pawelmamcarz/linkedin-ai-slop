# Analiza optymalizacji LinkedIn AI Slop 0.2.5

Data: 2026-10-07. Źródła: lokalny commit `6c77bc5`, paczka Chrome 0.2.5, działające publiczne proxy i izolowane reprodukcje jsdom. Użytkownik potwierdził używanie 0.2.5. Analiza nie zmienia działania rozszerzenia ani proxy.

## Wniosek

Optymalizacja ma sens. Najpierw trzeba poprawić pokrycie postów, rozwijanie tekstu i obsługę limitu minutowego. Dopiero potem stroić pytania i progi na oznaczonych przykładach użytkownika. Lżejsze zasłanianie jest osobną zmianą prezentacji i nie wymaga zmiany klasyfikatora.

## Potwierdzone przyczyny i skutki

| Priorytet | Ustalenie | Dowód | Kierunek poprawki |
| --- | --- | --- | --- |
| P1 | Teksty poniżej 200 znaków po oczyszczeniu nie trafiają do oceny. | `extractPost()` w `extension/content.js`; syntetyczny post 162 znaki: ekstrakcja `null`, a bezpośrednia ocena proxy: 0.93 i `slop`. | Oddzielić próg samodzielnych postów od komentarzy przy udostępnieniu. Rozważyć 80–120 znaków dla samodzielnych postów; dobrać próg na przykładach. Zachować ochronę przed przypisywaniem tekstu cytowanego autora udostępniającemu. |
| P1 | Kliknięcie „więcej” nie czeka na zmianę DOM, a wynik jest pamiętany według ID posta. | Reprodukcja jsdom: wysłano 215 znaków, po 30 ms pojawiło się 327; po kolejnych skanach nadal tylko jedno żądanie, pełny tekst nie został wysłany. | Krótko czekać na zmianę własnego tekstu, z limitem czasu. Powiązać pamięć wyniku ze skrótem tekstu i odrzucać wyniki dla zmienionej treści. |
| P1 | Limit minutowy Demo blokuje ocenianie do końca dnia UTC. | Serwer zwraca `demo_limit` dla limitu minutowego i dobowego. `markDemoLimit()` zawsze zapisuje koniec dnia. Reprodukcja odpowiedzi minutowej zablokowała sesję do `2026-10-08T00:00:00Z`, zamiast krótkiej przerwy. | Rozróżnić rodzaj limitu, przekazać `Retry-After` przez service worker i wznowić kolejkę po limicie minutowym. Blokadę dobową stosować wyłącznie po wyczerpaniu limitu dobowego. |
| P1 | Zasłanianie jest bardzo mocne również bez filtra blur. | CSS i `SCRIM` mają alpha 0.92; alternatywna ścieżka dla mediów ustawia opacity 0.12. Style są też wpisywane inline z `important`. | Mały baner pod autorem; proponowane lekkie przyciemnienie 15–25% i ewentualny blur około 2 px na mediach. Autor, reakcje i przyciski powinny pozostać dostępne. Zmienić również style inline; sama poprawka CSS nie wystarczy. |
| P2 | Suwak progu nie kontroluje wszystkich dróg do etykiety `slop`. | `badgeFromSignals()` używa OR: Noul przekracza próg **lub** intensywność jest heavy **lub** voice to ai_slop. `isAiSlop` opisuje tylko Noul. | Ujednolicić znaczenie pól odpowiedzi i jasno określić, które sygnały reguluje czułość. Sprawdzić prawdopodobieństwo wybranej opcji `voice`, zamiast traktować każdy wybór kategorii jako bezwarunkowe nadpisanie. |
| P2 | Pytania uprzywilejowują liczby i nazwy jako sygnał „human”; jednocześnie zmieszany styl jest osobną kategorią. | `jev/questions.ts`. To potencjalna przyczyna łagodnych ocen, nie potwierdzony błąd na postach użytkownika. | Oceniać szablonowość i pustosłowie niezależnie od obecności liczb. Doprecyzować przykłady PL/EN. Nie przedstawiać oceny stylu jako dowodu autorstwa AI. |
| P1 | Nakładka sama wywołuje kolejne przebudowy podczas bezczynności. | Reprodukcja jsdom: jedna ocena `slop`; po 650 ms bez działań użytkownika element nakładki był zastąpiony, a licznik zmian DOM nadal rósł. `enqueue()` bezwarunkowo przebudowuje zasłonę dla wyniku z cache, a MutationObserver planuje kolejny skan. | Nie przebudowywać poprawnej nakładki, ignorować własne mutacje i zachować tożsamość elementów. Sprawdzić, że po zakończeniu oceny liczba mutacji stabilizuje się. |
| P2 | Skanowanie obejmuje cały dokument po zmianach DOM i scrollu; wykrywanie zagnieżdżeń porównuje karty parami. | `watch()`, `scan()`, `findPostElements()`. Brak pomiaru obciążenia na rzeczywistym feedzie. | Obserwować kontener feedu, przetwarzać zmienione poddrzewa, ignorować własne mutacje, ograniczyć mapy i usuwać odłączone karty z obserwatora. Zmierzyć koszt przed i po. |

## Próby działającego proxy

Wszystkie pięć ocen zwróciło HTTP 200, `X-Cache: MISS`, model `jev-1.13.0`. Czasy całego żądania w tej próbie: 0.29–0.44 s.

| Przykład syntetyczny | Wynik Noul | Etykieta |
| --- | --- | --- |
| Polski ogólnikowy tekst motywacyjny | 0.95 | AI slop |
| Polski tekst z liczbami i szablonową puentą | 0.73 | AI slop |
| Konkretny opis naprawy błędu | 0.05 | Ludzki |
| Angielski ogólnikowy tekst motywacyjny | 0.97 | AI slop |
| Polski krótki ogólnik, 162 znaki | 0.93 | AI slop; wtyczka domyślnie go pomija |

Pełne teksty i odpowiedzi: `2026-10-07-detection-results.json`. Te próby potwierdzają działanie przepływu i konkretne rozbieżności. Nie pozwalają podać skuteczności ani liczby fałszywych alarmów na rzeczywistym LinkedIn.

`GET /health`: Demo włączone, limit 60/min oraz **500/dobę**. Starsze materiały opisują 200/dobę. Należy uzgodnić materiały z konfiguracją. Przy odpowiedziach trwających około 0.3 s sama równoległość 2 nie chroni przed przekroczeniem limitu minutowego.

## Plan walidacji zmian

1. Dodać testy krótkich samodzielnych postów, rozwinięcia tekstu, zmiany treści pod tym samym ID i wznowienia po minutowym 429.
2. Zebrać 30–50 przykładów PL/EN: slop, mixed i zwykłe aktualizacje. Użytkownik potwierdza oczekiwane oceny; osobno mierzyć pominięcia ekstrakcji, przeoczenia modelu i fałszywe alarmy.
3. Porównać obecny próg 0.65 z wariantami, np. 0.55 i 0.50. To kandydaci do sprawdzenia, nie gotowa kalibracja.
4. Sprawdzić lekkie zasłanianie w prawdziwym Chrome: obrazy, wideo, długie karty, udostępnienia i Pokaż/Ukryj.
5. Wdrożyć zgodne proxy przed zależną zmianą rozszerzenia; przygotować aktualizację sklepu z nowym numerem wersji i zrzutami.

## Stan weryfikacji

- `npm test`: 51/51 przechodzi.
- `npm run typecheck`: cztery istniejące błędy w `server/test/extension-browsers.test.ts`: brak deklaracji dla importu `pack-firefox.mjs` oraz trzy odwołania do `minTextChars` nieobecnego w lokalnym typie testowym.
- Paczka 0.2.5: 12 plików, 36 219 bajtów; każdy odpowiada plikowi w `extension/`. SHA-256: `e48a488c50d49995445a3bdf84a30609d12d9d28191163a77ad785293d4edc32`.
- Grafiki Chrome: cztery PNG 1280×800, kafelek 440×280, marquee 1400×560.
- Obie publiczne polityki prywatności: HTTP 200, sekcje Stripe, storage i kontakt.

## Chrome Web Store

Po ponownym zalogowaniu konto `pawel@mamcarz.com`, wydawca `pawelmamcarz`, pokazuje 0/2 produktów, również brak pozycji archiwalnych. Nie potwierdzono wcześniejszego zgłoszenia. Użytkownik polecił zgłosić od nowa. Aktualny postęp i treści formularza są w `../../CHROMEWEBSTORE.md`.

Nowe zgłoszenie 0.2.5 zostało wysłane 2026-10-07. Panel potwierdził „Oczekuje na sprawdzenie”; zaznaczono automatyczną publikację po akceptacji. ID: `blekdfdinogdmbpakkgaecdpilanobge`. Paczka zachowuje dotychczasowe działanie; poprawki opisane w tej analizie nie zostały wdrożone. Wskazany później przez użytkownika „rejected” dotyczył innej usługi, nie tego zgłoszenia Chrome.

Google podaje zwykle kilka dni recenzji, czasem kilka tygodni; po **ponad trzech tygodniach** oczekiwania zaleca kontakt z pomocą. Po zaakceptowaniu zgłoszenia z odroczoną publikacją jest 30 dni na ręczne opublikowanie. Nie anulować trwającej recenzji jedynie w celu „popchnięcia”; ponowne zgłoszenie oznacza kolejny przegląd.

Źródła: [proces recenzji Chrome](https://developer.chrome.com/docs/webstore/review-process), [publikowanie](https://developer.chrome.com/docs/webstore/publish), [Noul](https://docs.typesafe.ai/primitives/noul), [Choice](https://docs.typesafe.ai/primitives/choice), [kontekst modelu](https://docs.typesafe.ai/concepts/state).
