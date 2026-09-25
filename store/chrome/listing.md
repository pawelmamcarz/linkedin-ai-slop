# Chrome Web Store: LinkedIn AI Slop 0.2.5

Paczka do wgrania: `store/chrome/dist/linkedin-ai-slop-chrome-0.2.5.zip` (po `git pull`). Odtworzysz ją przez `npm run pack:chrome`.

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

LinkedIn AI Slop dodaje odznakę na karcie posta, gdy scrollujesz feed LinkedIn.

Odznaki: Ludzki, Mieszany, AI slop. Najedź na ocenioną odznakę, żeby zobaczyć „AI slop: N%”. Gdy werdykt to AI slop, karta dostaje baner na całą szerokość z przyciskiem „Pokaż”. „Ukryj” zakrywa ten post z powrotem.

Jak to liczy: tekst widocznego posta (do 6000 znaków) i opcjonalnie imię z karty idą na proxy. Proxy pyta TypeSafe Jev (model jev-latest). Próg is_ai_slop ustawisz suwakiem. Domyślnie 0.65. Własny tekst krótszy niż 200 znaków po odcięciu hashtagów, wzmianek, linków i emoji nie jest wysyłany. Komentarze i post w środku udostępnienia są pomijane. Posty zalogowanej osoby są pomijane, gdy da się odczytać profil z menu.

Klucz TYPESAFE_API_KEY nie jest w rozszerzeniu. Domyślne proxy to https://proxy-production-ebcc.up.railway.app (publiczne Demo: 60 ocen na minutę i 200 na dobę z jednego adresu IP, gdy na serwerze włączony jest ten cap). W opcjach: Demo, BYOK (własne proxy) albo Pro (token, nie klucz TypeSafe).

Ceny: Demo 0. Lifetime Pro 199 PLN jednorazowo, limit sprzedaży 50. Team 990 PLN rocznie, 10 stanowisk. Hosted Pro to około 5 USD miesięcznie albo około 40 USD rocznie. Płatność idzie przez Stripe Checkout na proxy.

Przeglądarki: Chrome, Brave, Firefox, Safari. Ta paczka jest pod Chrome (działa też w Brave i Edge). Firefox i Safari mają osobne paczki.

Rozszerzenie nie czyta skrzynki, nie publikuje postów i nie sprzedaje danych.

Kod: https://github.com/pawelmamcarz/linkedin-ai-slop
Polityka: https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html

## Detailed description (EN)

LinkedIn AI Slop badges a post card while you scroll the LinkedIn feed.

Badges: Human, Mixed, AI slop. Hover a scored badge to see "AI slop: N%". An AI slop verdict adds a full-width banner with a "Pokaż" (Show) button. "Ukryj" (Hide) covers that post again.

The visible post text (up to 6000 characters) and, when present, the name on the card go to a proxy. The proxy asks TypeSafe Jev (model jev-latest). You can move the is_ai_slop threshold. The default is 0.65. Own text shorter than 200 characters after hashtags, mentions, links, and emoji are removed is not sent. Comments and the nested reshare are skipped. The signed-in member's posts are skipped when the profile can be read from the menu.

TYPESAFE_API_KEY is not inside the extension. The default proxy is https://proxy-production-ebcc.up.railway.app (public Demo: 60 scores per minute and 200 per day per IP when that cap is enabled on the server). Options: Demo, BYOK (your own proxy), or Pro (a token, not the TypeSafe key).

Pricing: Demo is free. Lifetime Pro is 199 PLN once, limited to 50 sales. Team is 990 PLN per year for 10 seats. Hosted Pro is about 5 USD a month or about 40 USD a year. Payment goes through Stripe Checkout on the proxy.

Browsers: Chrome, Brave, Firefox, Safari. This package is for Chrome (it also loads in Brave and Edge). Firefox and Safari use separate packages.

The extension does not read your inbox, publish posts, or sell data.

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

1. Załóż konto Chrome Web Store na koncie Google właściciela (Paweł Mamcarz) i opłać rejestrację.
2. Zrób deploy GitHub Pages z tego repozytorium, potem otwórz https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html i sprawdź, że jest sekcja Stripe i adres pawel@mamcarz.com.
3. `git pull`, weź `store/chrome/dist/linkedin-ai-slop-chrome-0.2.5.zip`. Nie pakuj katalogu `extension/` ręcznie.
4. Nowa pozycja. Wgraj zip. Język domyślny: polski.
5. Wklej nazwę, krótki opis i opis szczegółowy z tego pliku. Kategoria: Productivity.
6. Wklej single purpose.
7. Privacy: URL polityki z tabeli. Zaznacz, że wysyłany jest tekst posta do własnego serwera w celu klasyfikacji. Zaznacz, że danych nie sprzedajesz i nie używasz do reklam. Remote code: No.
8. Uzasadnienia uprawnień: skopiuj akapity z sekcji uprawnień, po jednym na każde uprawnienie, o które panel zapyta.
9. Wgraj zrzuty 1280x800, kafelek 440x280 i marquee 1400x560.
10. Homepage: https://sciema.app/linkedin-ai-slop/ . Support: https://github.com/pawelmamcarz/linkedin-ai-slop/issues .
11. Wyślij do recenzji. Nie publikuj, dopóki nie przejrzysz podglądu.
