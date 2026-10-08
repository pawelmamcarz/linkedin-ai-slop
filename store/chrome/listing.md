# Chrome Web Store: LinkedIn AI Slop 0.2.7

Paczka do wgrania: `store/chrome/dist/linkedin-ai-slop-chrome-0.2.7.zip`. Odtworzysz ją przez `npm run pack:chrome`. Stan zgłoszenia i deklaracje danych: [CHROMEWEBSTORE.md](../../CHROMEWEBSTORE.md).

Język domyślny pozycji: polski. Angielski wklej jako drugi język, jeśli panel na to pozwala.

## Adresy

| Pole | URL |
| --- | --- |
| Strona główna (PL) | https://sciema.app/linkedin-ai-slop/ |
| Strona główna (EN) | https://sciema.app/en/linkedin-ai-slop/ |
| Polityka prywatności (PL) | https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html |
| Polityka prywatności (EN) | https://pawelmamcarz.github.io/linkedin-ai-slop/en/privacy.html |
| Support | https://github.com/pawelmamcarz/linkedin-ai-slop/issues |
| Kontakt | pawel@mamcarz.com |

Źródło polityki: `docs/privacy.html` i `docs/en/privacy.html`. Przed wysłaniem zrób deploy GitHub Pages, żeby te adresy pokazywały tekst z tego commita (Stripe, cache, kontakt). Adres `https://sciema.app/linkedin-ai-slop/privacy.html` dziś zwraca stronę główną sciema.app, nie politykę. Nie wklejaj go w pole Privacy policy.

## Nazwa

PL i EN: LinkedIn AI Slop

## Krótki opis

PL (96 znaków, limit 132). Ten sam tekst jest w `manifest.json`:

Oznacza posty na LinkedIn: Ludzki, Mieszany albo AI slop. Ocena Jev. Klucz API zostaje na proxy.

EN (88 znaków, limit 132):

Marks LinkedIn posts Human, Mixed, or AI slop using Jev. The API key stays on the proxy.

## Opis szczegółowy (PL)

LinkedIn AI Slop oznacza posty na feedzie LinkedIn jako Ludzki, Mieszany albo AI slop, aby pomóc Ci zauważyć szablonowe i ogólnikowe treści.

Posty są oceniane podczas przewijania. Po najechaniu na oznaczenie zobaczysz wynik oceny stylu tekstu. Podgląd pokazuje konkretność treści i niepewność oceny. Mocna, zgodna ocena AI slop dodaje mały baner i lekką zasłonę; słabszy lub sprzeczny wynik pozostawia post odsłonięty. Zmiana czułości przelicza dostępne wyniki bez ponownego wysyłania tekstów. „Pokaż” odsłania treść, „Ukryj” przywraca zasłonę. Przyciski posta pozostają dostępne. Zasłanianie możesz wyłączyć w ustawieniach.

W ustawieniach możesz włączyć lub wyłączyć ocenianie, zmienić próg i minimalną długość tekstu oraz wybrać tryb Demo, własne proxy (BYOK) albo Pro. Demo jest bezpłatne i ma limity ocen. Płatny Pro jest opcjonalny. Po limicie minutowym ocenianie wznawia się automatycznie.

Domyślnie samodzielny tekst krótszy niż 100 znaków po usunięciu hashtagów, wzmianek, linków i emoji jest pomijany. Komentarze pod postami nie są oceniane. Przy udostępnieniu oceniany jest własny komentarz autora o długości co najmniej 200 znaków, bez tekstu cytowanego posta. Posty zalogowanej osoby są pomijane, jeśli uda się rozpoznać jej profil. Zapisany wcześniej własny próg długości pozostaje bez zmian.

Ocena dotyczy stylu tekstu, może być błędna i nie stanowi dowodu, że post został napisany przez AI.

Do oceny tekst widocznego posta (do 6000 znaków), identyfikator posta i opcjonalnie imię autora są wysyłane na skonfigurowany serwer, a tekst i imię dalej do TypeSafe. Ustawienia i opcjonalny token Pro są zapisywane w pamięci rozszerzenia. Klucz TypeSafe pozostaje na serwerze.

Rozszerzenie nie czyta skrzynki, nie publikuje postów i nie sprzedaje danych.

Rozszerzenie jest niezależnym projektem, niepowiązanym z LinkedIn.

Kod: https://github.com/pawelmamcarz/linkedin-ai-slop
Polityka: https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html

## Detailed description (EN)

LinkedIn AI Slop labels LinkedIn feed posts Human, Mixed, or AI slop to help you notice formulaic and generic writing.

Posts are evaluated as you scroll. Hover a badge to see the writing-style score. The preview shows substance and uncertainty signals. Strong, consistent AI slop assessments add a small banner and a light cover; weaker or conflicting signals leave the post uncovered. Sensitivity changes recalculate available results without sending text again. "Pokaż" (Show) reveals the content; "Ukryj" (Hide) restores the cover. Post buttons remain usable. You can disable covering in settings.

Settings let you enable evaluation, change the threshold and minimum text length, and choose Demo, your own proxy (BYOK), or Pro. Demo is free with evaluation limits; paid Pro is optional. Evaluation resumes automatically after a minute rate limit.

By default, standalone text shorter than 100 characters after hashtags, mentions, links, and emoji are removed is skipped. Comments are not evaluated. Reshares require at least 200 characters of the sharing author's own commentary; the quoted post is excluded. The signed-in member's posts are skipped when their profile can be recognized. Previously saved custom length settings are preserved.

The judgment describes writing style, can be wrong, and does not prove AI authorship.

The visible post text (up to 6000 characters), post ID, and optional author name go to the configured server; text and name then go to TypeSafe. Settings and an optional Pro token are saved in extension storage. The TypeSafe key stays on the server.

The extension does not read your inbox, publish posts, or sell data.

This is an independent project, unaffiliated with LinkedIn.

Code: https://github.com/pawelmamcarz/linkedin-ai-slop
Privacy: https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html

## Kategoria

Productivity (narzędzia produktywności).

## Single purpose

PL: Oznaczać posty na feedzie LinkedIn odznaką Ludzki, Mieszany albo AI slop, na podstawie oceny tekstu modelem Jev.

EN: Badge LinkedIn feed posts as Human, Mixed, or AI slop, from a Jev score of the post text.

## Uprawnienia (uzasadnienie do panelu)

`storage`

PL: Zapisuje włącznik, próg, tryb (Demo, BYOK, Pro), adres proxy, adres własnego proxy, opcję zakrywania AI slop, minimalną długość tekstu i opcjonalny token Pro. Najpierw storage.sync, a gdy sync nie działa, storage.local. Klucza TypeSafe tu nie ma.

EN: Stores the toggle, threshold, mode (Demo, BYOK, Pro), proxy URL, your own proxy URL, the cover-AI-slop option, the minimum text length, and an optional Pro token. It uses storage.sync first, then storage.local if sync is unavailable. The TypeSafe key is not stored here.

`https://www.linkedin.com/*`

PL: Content script działa tylko na www.linkedin.com. Czyta tekst karty, która weszła w widok, i rysuje odznakę albo baner. Nie chodzi na inne hosty LinkedIn.

EN: The content script runs only on www.linkedin.com. It reads the text of a card that entered the viewport and draws a badge or banner. It does not run on other LinkedIn hosts.

`https://proxy-production-ebcc.up.railway.app/*`

PL: Service worker woła GET /health i POST /evaluate na domyślnym proxy Demo i Pro. Wysyła identyfikator posta, tekst, opcjonalnie autora, próg, a w trybie Pro nagłówek X-Pro-Token. Klucza API tu nie ma.

EN: The service worker calls GET /health and POST /evaluate on the default Demo and Pro proxy. It sends the post id, text, optional author, threshold, and in Pro mode the X-Pro-Token header. The API key is not here.

`http://127.0.0.1/*` i `http://localhost/*`

PL: Własne proxy na tym komputerze (tryb BYOK) oraz lokalny podgląd /demo na porcie 8787. Content script podglądu jest podpięty pod te hosty.

EN: Your own proxy on this computer (BYOK) and the local /demo preview on port 8787. The preview content script is registered for these hosts.

Opcjonalne `https://*.up.railway.app/*`, `https://*/*`, `http://*/*`

PL: Nie są przyznane przy instalacji. Przeglądarka pyta dopiero, gdy w opcjach zapiszesz własny adres proxy spoza listy wymaganej. Prośba dotyczy jednego originu, który wpisałeś.

EN: Not granted at install. The browser asks only when you save your own proxy address outside the required list. The request is for the single origin you typed.

## Remote code

Nie. Paczka nie ładuje skryptów z sieci, nie używa eval ani new Function. Cały kod jest w zipie.

No. The package does not load scripts from the network and does not use eval or new Function. All code is in the zip.

## Privacy practices

Co jest zbierane albo wysyłane:

- Tekst posta (do 6000 znaków), identyfikator posta, opcjonalnie imię autora z karty, próg. Idzie z service workera na skonfigurowane proxy (domyślnie host Railway), a stamtąd do TypeSafe Jev.
- W trybie Pro nagłówek X-Pro-Token. To nie jest klucz TypeSafe.
- Adres IP widzi proxy (limit 60 na minutę i dobowy licznik w pamięci). Treść posta nie jest zapisywana na dysk. Cache trzyma SHA-256 znormalizowanego tekstu i werdykt (domyślnie 12 godzin, do 2000 wpisów).
- Płatność: Stripe Checkout. Numer karty zostaje u Stripe. Plan Team prosi o adres i NIP. Proxy trzyma identyfikator klienta Stripe i token Pro.
- Lokalnie: ustawienia i opcjonalny token Pro w storage rozszerzenia. W sessionStorage karty może zostać znacznik czasu limitu Demo.

Czy dane są sprzedawane: nie.

Czy są używane do reklam: nie. Nie ma pikseli reklamowych.

Czy dane służą do ustalania wiarygodności kredytowej albo do celów niezwiązanych z pojedynczym celem rozszerzenia: nie.

Czy używany jest zdalny kod: nie.

## Grafiki

Wgraj z `store/chrome/assets/`:

- `01-badges-1280x800.png`
- `02-banner-1280x800.png`
- `03-hover-1280x800.png`
- `04-options-1280x800.png`
- `tile-440x280.png` (mały kafelek promo)
- `marquee-1400x560.png`

Ikona 128: `extension/icons/icon128.png` (w zipie jest też 16, 32, 48).

## Checklista wgrania

1. Otwórz istniejącą pozycję `blekdfdinogdmbpakkgaecdpilanobge` u wydawcy `pawelmamcarz`.
2. Sprawdź publiczną politykę prywatności z tabeli.
3. Uruchom testy, typecheck i `npm run pack:chrome`; wybierz ZIP 0.2.7. Nie pakuj katalogu `extension/` ręcznie.
4. Potwierdź bieżący stan pozycji. Wersja 0.2.6 jest opublikowana; wgraj nowy ZIP 0.2.7. Język domyślny: polski.
5. Wklej nazwę, krótki opis i opis szczegółowy z tego pliku. Kategoria: Productivity.
6. Wklej single purpose.
7. Privacy: URL polityki z tabeli. Zaznacz, że wysyłany jest tekst posta do własnego serwera w celu klasyfikacji. Zaznacz, że danych nie sprzedajesz i nie używasz do reklam. Remote code: No.
8. Uzasadnienia uprawnień: skopiuj akapity z sekcji uprawnień, po jednym na każde uprawnienie, o które panel zapyta.
9. Wgraj zrzuty 1280x800, kafelek 440x280 i marquee 1400x560.
10. Homepage: https://sciema.app/linkedin-ai-slop/ . Support: https://github.com/pawelmamcarz/linkedin-ai-slop/issues .
11. Przejrzyj podgląd, wyślij do recenzji z automatyczną publikacją po akceptacji i zapisz potwierdzony status w `CHROMEWEBSTORE.md`.
