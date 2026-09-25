# Checklista Chrome Web Store

Paczka do wgrania w sklep jest w [`chrome/listing.md`](chrome/listing.md): `store/chrome/dist/linkedin-ai-slop-chrome-0.2.5.zip` (`npm run pack:chrome`).

Poniżej zostaje starsza notatka o `store/linkedin-ai-slop-extension.zip` (`npm run pack:extension`).

W zipie jest tylko zawartość `extension/`. `manifest.json` leży w korzeniu archiwum. Nie ma `server/`, `.env` ani `node_modules`.

## Wersja 0.2.4

v0.2.4 nie ocenia krótkiego komentarza przy udostępnieniu ani tekstu posta w środku jako werdyktu karty zewnętrznej. Próg to 200 znaków własnego tekstu po odcięciu hashtagów, wzmianek, linków i emoji (opcja w ustawieniach). Posty zalogowanej osoby są pomijane. Baner AI slop stoi pod nagłówkiem autora.

v0.2.4 does not score a short reshare comment, and it does not treat the nested post as the outer card's verdict. The floor is 200 characters of the post's own text after hashtags, mentions, links, and emoji are removed (an option in settings). The signed-in member's posts are skipped. The AI slop banner sits below the author header.

## Wersja 0.2.3

v0.2.3 zastępuje mocne rozmycie banerem na całą szerokość karty: „AI slop” i „Pokaż”. Po odsłonięciu przycisk to „Ukryj”. Scrim jest lekki, bez `filter: blur(20px)`. Wersja w manifeście jest podbita, żeby Chrome pokazał nową paczkę.

v0.2.3 replaces the strong blur with a full-width banner: "AI slop" and "Pokaż". After reveal the button reads "Ukryj". The scrim is light, with no `filter: blur(20px)`. The manifest version is bumped so Chrome shows the new build.

## Wersja 0.2.2

v0.2.2 mocniej rozmywa cały post przy werdykcie AI slop (`filter: blur(20px)` na boksach treści i welon `backdrop-filter: blur(24px)`). Wersja w manifeście jest podbita, żeby Chrome pokazał nową paczkę.

v0.2.2 blurs the whole AI-slop post more strongly (`filter: blur(20px)` on painted boxes plus a `backdrop-filter: blur(24px)` veil). The manifest version is bumped so Chrome shows the new build.

## Wersja 0.2.1

v0.2.1 dodaje na ocenionych odznakach podpowiedź po najechaniu: "AI slop: N%". Publiczne Demo ma 60 ocen na minutę oraz 200 na dobę z jednego IP (`EVALUATE_DAILY_IP_CAP=200`).

v0.2.1 adds a hover tip on scored badges: "AI slop: N%". The public Demo cap is 60 scores per minute and 200 per day per IP (`EVALUATE_DAILY_IP_CAP=200`).

Firefox bierze wersję z `extension/manifest.json` przy `npm run pack:firefox`. Safari: `MARKETING_VERSION` w `safari/Config/Shared.xcconfig` ma być taki sam jak manifest (teraz 0.2.4).

## Przed wysłaniem

- [ ] Wersja w `extension/manifest.json` to 0.2.4
- [ ] `npm run pack:extension` po ostatniej zmianie w `extension/`
- [ ] W zipie są `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`
- [ ] Domyślny adres proxy to `https://proxy-production-ebcc.up.railway.app`
- [ ] W repozytorium nie ma `TYPESAFE_API_KEY`, tokenu Pro ani pliku `.env`
- [ ] Kroki Stripe i Railway: [`MONETIZATION.md`](MONETIZATION.md)
- [ ] Polityka prywatności działa pod adresem poniżej

## Konto dewelopera

- Jednorazowa opłata rejestracji Chrome Web Store
- Konto Google, które będzie właścicielem pozycji

## Pojedynczy cel (single purpose)

Oznaczać posty na feedzie LinkedIn odznaką: Ludzki, Mieszany albo AI slop, na podstawie oceny tekstu modelem Jev.

## Polityka prywatności

https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html

Źródło: `docs/privacy.html`. Wersja angielska: https://pawelmamcarz.github.io/linkedin-ai-slop/en/privacy.html (`docs/en/privacy.html`).

## Regulamin

https://pawelmamcarz.github.io/linkedin-ai-slop/terms.html

Źródło: `docs/terms.html`. Wersja angielska: https://pawelmamcarz.github.io/linkedin-ai-slop/en/terms.html.

Produkt jest tylko na LinkedIn. Nie ma adapterów Facebooka, X ani Instagrama.

## Uprawnienia

| Uprawnienie | Po co |
| --- | --- |
| `storage` | Włącznik, próg, tryb (Demo / BYOK / Pro), adres proxy i opcjonalny token Pro. Najpierw `storage.sync`, przy braku sync (część instalacji Safari) `storage.local`. Klucza TypeSafe tu nie ma. |
| `https://www.linkedin.com/*` i `https://*.linkedin.com/*` | Content script jest podpięty pod `www.linkedin.com`. Szerszy host jest na liście uprawnień. |
| `https://proxy-production-ebcc.up.railway.app/*` | Service worker woła `GET /health` i `POST /evaluate`. Klucza API tu nie ma. |
| `http://127.0.0.1/*` i `http://localhost/*` | Lokalne proxy i podgląd `/demo`. |
| `optional_host_permissions` | Własne proxy spoza listy: inny host Railway albo dowolny `http`/`https`. Przeglądarka pyta przy zapisie adresu. |

Paczka Chromium (Chrome, Brave, Edge) to ten sam zip. Brave: [`BRAVE.md`](BRAVE.md). Firefox to osobny XPI (`npm run pack:firefox`): [`FIREFOX.md`](FIREFOX.md). AMO nie jest wysłane. Safari to projekt Xcode, nie ten zip: [`SAFARI.md`](SAFARI.md). Checklist App Store Connect jest tam. Wysyłki nie ma.

## Ikona i zrzuty

| Zasób | Wymiar | Uwagi |
| --- | --- | --- |
| Ikona sklepu | 128×128 PNG | `extension/icons/icon128.png` (znak: chmurka z lupą). Jest też `icon16.png` i `icon48.png`. Źródło: `docs/brand/mark.svg`, odświeżenie: `npm run brand`. |
| Zrzut ekranu | **1280×800** | Gotowe do wgrania, 24-bit PNG bez przezroczystości: `store/screenshots/01-overview.png`, `store/screenshots/02-feed.png`, `store/screenshots/03-options.png`. Odświeżenie: `npm run shots`. |
| Mały kafelek promo (opcjonalnie) | 440×280 | `store/screenshots/tile-440x280.png` |
| Obraz OG | 1200×630 | `docs/og.png` |
| Marquee (opcjonalnie) | 1400×560 | |

## Opis krótki (PL, do 132 znaków)

Oznacza posty na LinkedIn: Ludzki, Mieszany albo AI slop. Ocena Jev. Klucz API zostaje na proxy.

## Opis krótki (EN, do 132 znaków)

Marks LinkedIn posts Human, Mixed, or AI slop using Jev. The API key stays on the proxy, not in the extension.

## Opis długi (PL)

LinkedIn AI Slop dodaje odznakę na karcie posta, gdy scrollujesz feed.

Odznaki: Ludzki, Mieszany, AI slop. Najedź na ocenioną odznakę, żeby zobaczyć "AI slop: N%".

Jak to liczy: tekst widocznego posta idzie na proxy, a proxy pyta TypeSafe Jev (model jev-latest). Próg is_ai_slop ustawisz suwakiem. Domyślnie 0.65.

Klucz TYPESAFE_API_KEY nie jest w rozszerzeniu. Domyślne proxy to publiczne demo na Railway (60 ocen na minutę i 200 na dobę z jednego adresu IP, `EVALUATE_DAILY_IP_CAP=200`). W opcjach: Demo, BYOK (własne proxy) albo Pro (token, nie klucz TypeSafe). Plany: https://pawelmamcarz.github.io/linkedin-ai-slop/pro.html

Rozszerzenie trzyma tylko włącznik, próg i adres URL. Nie czyta skrzynki, nie publikuje postów, nie sprzedaje danych.

Kod: https://github.com/pawelmamcarz/linkedin-ai-slop
Polityka: https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html

## Opis długi (EN)

LinkedIn AI Slop badges a post card while you scroll the feed.

Badges: Human, Mixed, AI slop. Hover a scored badge to see "AI slop: N%".

The visible post text goes to a proxy. The proxy asks TypeSafe Jev (model jev-latest). You can move the is_ai_slop threshold. The default is 0.65.

TYPESAFE_API_KEY is not inside the extension. The default proxy is a public Railway demo (60 evaluations per minute and 200 per day per IP, `EVALUATE_DAILY_IP_CAP=200`). Options: Demo, BYOK (your own proxy), or Pro (a token, not the TypeSafe key). Plans: https://pawelmamcarz.github.io/linkedin-ai-slop/en/pro.html

The extension stores only the toggle, the threshold, and the proxy URL. It does not read your inbox, publish posts, or sell data.

Code: https://github.com/pawelmamcarz/linkedin-ai-slop
Privacy: https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html

## Kategoria i język

- Kategoria: narzędzia produktywności albo społecznościowe (bliżej narzędzi)
- Język pozycji: polski, z angielskim opisem wklejonym w szczegółach jeśli sklep pozwala na jeden język naraz. Wtedy wyślij polski jako główny.
