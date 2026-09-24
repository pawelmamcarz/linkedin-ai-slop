# Checklista Chrome Web Store

Paczka: `store/linkedin-ai-slop-extension.zip` (odtworzysz ją przez `npm run pack:extension`).

W zipie jest tylko zawartość `extension/`. `manifest.json` leży w korzeniu archiwum. Nie ma `server/`, `.env` ani `node_modules`.

## Przed wysłaniem

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

Paczka Chromium (Chrome, Brave, Edge) to ten sam zip. Brave: [`BRAVE.md`](BRAVE.md). Firefox to osobny XPI (`npm run pack:firefox`): [`FIREFOX.md`](FIREFOX.md). AMO nie jest wysłane. Safari to projekt Xcode, nie ten zip: [`SAFARI.md`](SAFARI.md). App Store nie jest przygotowany.

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

Odznaki: Ludzki, Mieszany, AI slop. Najedź, żeby zobaczyć prawdopodobieństwa.

Jak to liczy: tekst widocznego posta idzie na proxy, a proxy pyta TypeSafe Jev (model jev-latest). Próg is_ai_slop ustawisz suwakiem. Domyślnie 0.65.

Klucz TYPESAFE_API_KEY nie jest w rozszerzeniu. Domyślne proxy to publiczne demo na Railway (limit 60 ocen na minutę z jednego adresu IP). W opcjach: Demo, BYOK (własne proxy) albo Pro (token, nie klucz TypeSafe). Plany: https://pawelmamcarz.github.io/linkedin-ai-slop/pro.html

Rozszerzenie trzyma tylko włącznik, próg i adres URL. Nie czyta skrzynki, nie publikuje postów, nie sprzedaje danych.

Kod: https://github.com/pawelmamcarz/linkedin-ai-slop
Polityka: https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html

## Opis długi (EN)

LinkedIn AI Slop badges a post card while you scroll the feed.

Badges: Human, Mixed, AI slop. Hover for the probabilities.

The visible post text goes to a proxy. The proxy asks TypeSafe Jev (model jev-latest). You can move the is_ai_slop threshold. The default is 0.65.

TYPESAFE_API_KEY is not inside the extension. The default proxy is a public Railway demo (60 evaluations per minute per IP). Options: Demo, BYOK (your own proxy), or Pro (a token, not the TypeSafe key). Plans: https://pawelmamcarz.github.io/linkedin-ai-slop/en/pro.html

The extension stores only the toggle, the threshold, and the proxy URL. It does not read your inbox, publish posts, or sell data.

Code: https://github.com/pawelmamcarz/linkedin-ai-slop
Privacy: https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html

## Kategoria i język

- Kategoria: narzędzia produktywności albo społecznościowe (bliżej narzędzi)
- Język pozycji: polski, z angielskim opisem wklejonym w szczegółach jeśli sklep pozwala na jeden język naraz. Wtedy wyślij polski jako główny.
