# LinkedIn AI Slop

Rozszerzenie Manifest V3 na feed LinkedIn: Chrome, Brave i Edge z jednej paczki, Firefox z osobnego XPI, Safari z projektu Xcode w `safari/`. Przy scrollowaniu wyciąga tekst posta i pyta model **Jev** (TypeSafe System One), czy to AI-slop. Na karcie pojawia się odznaka: **Ludzki**, **Mieszany** albo **AI slop**.

Klucz API zostaje na proxy. Rozszerzenie go nie zawiera. Domyślnie proxy to publiczne demo:

[https://proxy-production-ebcc.up.railway.app](https://proxy-production-ebcc.up.railway.app)

Repozytorium jest publiczne: [https://github.com/pawelmamcarz/linkedin-ai-slop](https://github.com/pawelmamcarz/linkedin-ai-slop).

Strona: [https://pawelmamcarz.github.io/linkedin-ai-slop/](https://pawelmamcarz.github.io/linkedin-ai-slop/) (opis, podgląd odznak, polityka prywatności w `docs/`). Na Pages nie ma klucza. `TYPESAFE_API_KEY` siedzi tylko w zmiennych Railway albo w lokalnym `server/.env`.

## Uruchomienie

Potrzebny Node.js 20+.

### 1. Proxy

Domyślne rozszerzenie woła już hostowane proxy. Własny klucz (BYOK) jest opcjonalny:

```bash
cd server
cp .env.example .env
```

W `server/.env` ustaw klucz z panelu TypeSafe:

```bash
TYPESAFE_API_KEY=twój_klucz
```

```bash
npm install
npm start
```

Lokalnie, bez `PORT`, proces słucha na `127.0.0.1:8787`. Gdy platforma ustawia `PORT`, a `HOST` jest puste, proces słucha na `0.0.0.0`. Na Railway `HOST` jest już `0.0.0.0` i ten wpis wygrywa. Port `8788` nie jest domyślny.

`railway.toml` w katalogu głównym ustawia build `npm --prefix server ci --include=dev` i start `npm --prefix server start`. W Railway **Root Directory musi być `/`**. Przy `/server` deploy pada: `Cannot find module '/jev/thresholds.ts' imported from /app/src/index.ts`, bo `server/src` importuje `../../jev`.

Publiczne demo (`POST /evaluate`) ma okno przesuwne **60 żądań na 60 sekund na adres IP**. Rozszerzenie trzyma równoległość 2 i kolejkę 40, więc szybki scroll potrafi zbliżyć się do ~60 ocen na minutę, gdy Jev odpowiada w około 2 s. Limit 30 na minutę ucinałby taką sesję. `EVALUATE_RATE_LIMIT=0` wyłącza limit (własne proxy). `GET /health` nie jest limitowany. Adres IP bierze się z pierwszego wpisu `X-Forwarded-For` (Railway). `TRUST_PROXY=0` ignoruje ten nagłówek.

Tekst idący do Jev jest obcięty do 6000 znaków (`MAX_TEXT_CHARS`). Content script nie wysyła własnego tekstu, który po odcięciu hashtagów, @wzmianek, linków i emoji ma mniej niż 200 znaków (opcja w ustawieniach, domyślnie 200). Komentarz przy udostępnieniu nie obejmuje tekstu posta w środku. Publiczny hamulec kosztów to limit 60/min oraz pamięć podręczna werdyktów (włączona domyślnie).

Warianty: **Free / BYOK** (własne proxy, rozszerzenie darmowe), **Hosted Demo** (publiczny Railway, marketing, nie plan płatny), **Hosted Pro** (token, wyższe limity, Checkout ~5 USD/mies. albo ~40 USD/rok), **Lifetime Pro** (199 PLN jednorazowo, token bez daty końca, limit sprzedaży) i **Team** (990 PLN rocznie, 10 tokenów Pro). Kroki wdrożenia: [`store/MONETIZATION.md`](store/MONETIZATION.md).

`DEMO_MODE=1` włącza dobowy limit demo **200** na IP, gdy `EVALUATE_DAILY_IP_CAP` jest puste. Jawna wartość tej zmiennej wygrywa (`0` albo brak i brak `DEMO_MODE` wyłącza dobowy cap, tak jest lokalne BYOK). Na publicznym Railway ustaw `DEMO_MODE=1` albo jawne `EVALUATE_DAILY_IP_CAP=200`. Po wyczerpaniu limitu Demo proxy zwraca `429` z `error: demo_limit` i `upgrade: true` (bez wołania TypeSafe). Pro zostaje przy `rate_limited` / `daily_limited`, bez `upgrade`.

Token Pro: nagłówek `X-Pro-Token` albo `Authorization: Bearer`. Lista `PRO_TOKENS` (plain albo `sha256:<hex>`, po przecinku). Zły token to 401, bez zejścia na demo. Pro domyślnie **300/min** (`PRO_RATE_LIMIT`) i **2000/dobę** (`PRO_DAILY_CAP`). Kubełki demo i Pro są osobne. Token Pro nie jest kluczem TypeSafe i nie trafia do logów.

Pamięć podręczna trzyma odpowiedzi Jev pod kluczem SHA-256 znormalizowanego tekstu (trim, zbite białe znaki, obcięcie). Nie zapisuje treści posta ani klucza. Próg z żądania jest nakładany przy odczycie, więc trafienie nie woła TypeSafe i zwraca ten sam kształt JSON co świeża ocena. Nagłówek `X-Cache` to `HIT` albo `MISS`.

| Zmienna | Domyślnie | Znaczenie |
| --- | --- | --- |
| `VERDICT_CACHE` | włączony | `0` wyłącza cache |
| `VERDICT_CACHE_TTL_MS` | 12 godzin | czas życia wpisu |
| `VERDICT_CACHE_MAX` | 2000 | nadmiar usuwa najstarsze wpisy |
| `LOG_TOKEN_USAGE` | włączony | `0` wyłącza log. `1` też włącza |
| `EVALUATE_DAILY_IP_CAP` | `0` (albo 200 przy `DEMO_MODE=1`) | dobowy limit ocen demo na IP |
| `DEMO_MODE` | wyłączony | `1` włącza domyślny cap demo 200 |
| `PRO_TOKENS` | puste | tokeny Pro, plain albo `sha256:` |
| `PRO_RATE_LIMIT` | 300 | ocen Pro na minutę na IP |
| `PRO_DAILY_CAP` | 2000 | ocen Pro na dobę na IP |
| `STRIPE_SECRET_KEY` | puste | Checkout Session; puste = „wkrótce” |
| `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` | puste | price id ~5 USD/mies. i ~40 USD/rok |
| `STRIPE_WEBHOOK_SECRET` | puste | podpis webhooka, wydanie i cofnięcie tokenu |
| `STRIPE_LIFETIME_AMOUNT_PLN` | 199 | kwota Lifetime Pro w PLN, gdy brak `STRIPE_PRICE_LIFETIME` |
| `STRIPE_TEAM_AMOUNT_PLN` | 990 | kwota Team w PLN za rok, gdy brak `STRIPE_PRICE_TEAM` |
| `STRIPE_PRICE_LIFETIME` / `STRIPE_PRICE_TEAM` | puste | opcjonalny price id; gdy ustawiony, wygrywa z kwotą inline |
| `LIFETIME_PRO_CAP` | 50 | ile sztuk Lifetime Pro wolno sprzedać |
| `TEAM_SEATS` | 10 | ile tokenów Pro dostaje zakup Team |
| `PUBLIC_BASE_URL` | lokalny host | adres w success/cancel, na Railway `https://proxy-production-ebcc.up.railway.app` |

Log na stdout jest jednym obiektem JSON: `event`, `tier` (`demo` albo `pro`), `cache`, `input_tokens`, `output_tokens`, `model`, `text_chars`. Bez treści posta, bez klucza i bez tokenu Pro. `GET /health` dopisuje `cache`, `tier`, `dailyIpCap` i `stripeCheckout`. Samej wartości klucza nie zwraca. Zły token Pro na `/health` i `/evaluate` daje 401.

Sprawdzenie cache lokalnie (dwa identyczne `POST /evaluate`, drugie ma `X-Cache: HIT` i nie woła Jev):

```bash
curl -sD - http://127.0.0.1:8787/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"postId":"urn:li:activity:1","text":"Shipped the billing retry last Tuesday. Failure rate dropped from 4.1% to 0.6%."}' \
  -o /tmp/eval.json
curl -sD - http://127.0.0.1:8787/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"postId":"urn:li:activity:1","text":"Shipped the billing retry last Tuesday. Failure rate dropped from 4.1% to 0.6%."}' \
  -o /tmp/eval2.json
```

Drugie wywołanie jest tańsze: w logu `cache` jest `HIT`, a `input_tokens` pochodzą z pierwszego wołania Jev.

- `GET /` i `GET /health` — czy proces żyje i czy klucz jest ustawiony (samej wartości nie zwraca). Pole `model` pochodzi z `jev/questions.ts` (`jev-latest`)
- `POST /evaluate` — jedno wywołanie Jev na post. Ciało: `postId`, `text`, opcjonalnie `author` i `threshold`
- `GET /demo` — lokalny podgląd selektorów, bez logowania do LinkedIn

Sprawdzenie bez przeglądarki:

```bash
curl -s http://127.0.0.1:8787/health

curl -s http://127.0.0.1:8787/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"postId":"urn:li:activity:1","text":"Shipped the billing retry last Tuesday. Failure rate dropped from 4.1% to 0.6% after we stopped retrying 409s."}'
```

Proxy woła wyłącznie:

```http
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer $TYPESAFE_API_KEY
```

z `"model": "jev-latest"` przez `@typesafe-ai/sdk`.

### 2. Rozszerzenie

Chrome, Brave i Edge ładują ten sam katalog `extension/`.

1. Otwórz `chrome://extensions`, w Brave `brave://extensions`, w Edge `edge://extensions`.
2. Włącz tryb dewelopera.
3. **Załaduj rozpakowane** i wskaż katalog `extension/`.
4. Ikona rozszerzenia: włącz ocenę, próg, adres proxy. Domyślny adres to `https://proxy-production-ebcc.up.railway.app`. Przycisk **Sprawdź proxy** powinien pokazać model `jev-latest`. Własny URL spoza manifestu zapisuje się w opcjach. Przeglądarka pyta wtedy o zgodę na ten host. Localhost i publiczne proxy są już na liście hostów.

Firefox nie bierze manifestu Chromium. `npm run pack:firefox` składa `store/linkedin-ai-slop-firefox.xpi` (`background.scripts`, bo Firefox ignoruje sam service worker). Tymczasowo: `about:debugging` → Załaduj dodatek tymczasowy. AMO nie jest wysłane. Notatka: [`store/FIREFOX.md`](store/FIREFOX.md).

Safari nie ładuje tego katalogu wprost. Na Macu: `bash scripts/build-safari.sh`, potem Develop → Allow Unsigned Extensions. Szczegóły: [`safari/README.md`](safari/README.md). Checklist App Store Connect jest w [`store/SAFARI.md`](store/SAFARI.md). Wysyłki nie ma. Notatki: [`store/BRAVE.md`](store/BRAVE.md).

### 3. Feed

Wejdź na [https://www.linkedin.com/feed/](https://www.linkedin.com/feed/) i przewiń. Posty, które wejdą w widok (ok. 35% wysokości), dostają odznakę w prawym górnym rogu karty. Najedź na ocenioną odznakę, żeby zobaczyć "AI slop: N%".

Gdy werdykt to **AI slop**, karta dostaje baner na całą szerokość: „AI slop” i przycisk „Pokaż”. Baner stoi pod nagłówkiem autora (imię i awatar zostają widoczne), nad tekstem. Pod banerem jest lekki scrim, bez `filter: blur`. Treść nie jest czytelna, dopóki nie wybierzesz „Pokaż”. Potem przycisk zmienia się w „Ukryj”, a post da się czytać. Mała odznaka w rogu zostaje dla Ludzki i Mieszany. Przy AI slop baner zastępuje odznakę, żeby nie dublować etykiety. Opcja „Zakrywaj posty AI slop” (Cover AI slop posts, klucz `blurSlop`) jest domyślnie włączona. To samo dotyczy kart recent-activity, które content script już oznacza. Posty zalogowanej osoby są pomijane, gdy da się odczytać profil z menu Ja.

Żeby zobaczyć samą nakładkę bez LinkedIn: załaduj rozszerzenie, uruchom proxy i otwórz [http://127.0.0.1:8787/demo](http://127.0.0.1:8787/demo). To fixture z tymi samymi selektorami, nie strona LinkedIn.

## Progi

Jev zwraca prawdopodobieństwa. Decyzja, co pokazać, jest w kodzie: [`jev/thresholds.ts`](jev/thresholds.ts).

| Sygnał | Próg | Efekt |
| --- | --- | --- |
| Noul `is_ai_slop` | domyślnie **≥ 0.65** (suwak 0.15–0.95 w opcjach) | `isAiSlop = true` i odznaka **AI slop** |
| Score `slop_intensity` | **&lt; 0.75** ludzki, **&lt; 1.5** mieszany, **≥ 1.5** ciężki slop | ciężki slop wymusza odznakę **AI slop** |
| Choice `voice` | etykieta `ai_slop` | też odznaka **AI slop** |
| Choice `voice` albo intensywność `mixed`, bez warunków wyżej | — | odznaka **Mieszany** |
| reszta | — | odznaka **Ludzki** |
| Noul `has_substance` | **≥ 0.50** | tylko w dymku („Substancja: tak/nie”), nie zmienia koloru |

Content script nie wysyła własnego tekstu krótszego niż 200 znaków po odcięciu hashtagów, @wzmianek, linków i emoji. Na proxy limit ciała to 6000 znaków.

## Pytania Jev

Jedno wywołanie na post, cztery pytania. Rubryki: [`jev/questions.ts`](jev/questions.ts). Opis po polsku: [`jev/QUESTIONS.md`](jev/QUESTIONS.md).

| Id | Typ | Po co |
| --- | --- | --- |
| `is_ai_slop` | Noul | filler LinkedIn-AI vs konkretny, ludzki tekst |
| `slop_intensity` | Score 0–2 | ludzki / mieszany / ciężki slop |
| `has_substance` | Noul | czy jest konkret (liczba, decyzja, zdarzenie) |
| `voice` | Choice `human` \| `mixed` \| `ai_slop` | głos, niezależnie od tematu |

`state` to `{ platform: "linkedin", author, post_text }`.

## Architektura

```
extension/          jedna paczka Chromium (Chrome, Brave, Edge) i źródło Safari
  ext-api.js        chrome.* albo browser.*, storage.sync z zejściem na local
  content.js        MutationObserver + IntersectionObserver, deduplikacja, debounce, max 2 żądania naraz
  background.js     fetch do proxy (klucz tu nie występuje)
  options.html      tryb Demo / BYOK / Pro, próg, URL proxy, token Pro
safari/             wrapper Xcode; build kopiuje extension/ do bundla
server/             Node + TypeScript, trzyma TYPESAFE_API_KEY
  POST /evaluate    { postId, text, author? } → mapowanie na odznakę
jev/                pytania i progi, do review
```

CORS proxy puszcza `https://www.linkedin.com`, `https://pawelmamcarz.github.io`, `localhost`, `127.0.0.1`, `chrome-extension://` oraz `safari-web-extension://`. Rozszerzenie i tak woła proxy z service workera (uprawnienie hosta), więc ocena feedu nie zależy od CORS strony. Publiczne demo na Railway odbije origin Safari dopiero po wdrożeniu tej wersji proxy.

Gdy zmienisz port lokalnego proxy, zaktualizuj adres w opcjach. Content script podglądu `/demo` jest podpięty pod `http://127.0.0.1:8787` i `http://localhost:8787`. Te hosty są w wymaganych `host_permissions`. Opcjonalne zostają własne proxy: `https://*.up.railway.app/*` oraz dowolny `https`/`http`.

## Gdy LinkedIn zmieni DOM

Selektory są w `extension/content.js` (`POST_SELECTORS`, `TEXT_SELECTORS`). Obejmują klasyczny `feed-shared-update-v2`, `data-id` / `data-urn` oraz kartę `article[data-id="main-feed-card"]`.

Brak dopasowania nie wysypuje strony: w konsoli pojawi się jedna informacja `[linkedin-ai-slop] brak kart postów`, a odznaki po prostu nie powstaną. Komentarze pod postem są pomijane.

## Testy

```bash
cd server
npm test
npm run typecheck
```

Test proxy podmienia `fetch` do `api.typesafe.ai` i sprawdza, że wychodzi `POST /v1/systemone` z `model: jev-latest` i czterema pytaniami. Żywego klucza ten test nie wymaga.

## Paczka Chrome Web Store

```bash
npm run pack:extension
```

Skrypt pakuje sam katalog `extension/` do `store/linkedin-ai-slop-extension.zip` (`manifest.json` w korzeniu zipa). Ten zip jest dla Chrome, Brave i Edge. `npm run pack:firefox` składa `store/linkedin-ai-slop-firefox.xpi` z manifestem Firefox (te same pliki, inne tło i `browser_specific_settings`). Bez `server/`, bez `.env`, bez `node_modules`. Checklista publikacji: [`store/CHECKLIST.md`](store/CHECKLIST.md). Safari budujesz osobno na Macu (`bash scripts/build-safari.sh`).

## Poza zakresem

Aplikacja mobilna, wątki komentarzy. Wysłanie paczki do Chrome Web Store jest ręczne.

## Prywatność

Tekst widocznego posta i opcjonalnie imię autora idą na skonfigurowane proxy (domyślnie host Railway), a stamtąd do TypeSafe. Proxy nie zapisuje postów. Rozszerzenie trzyma w storage przeglądarki włącznik, próg, tryb, URL i opcjonalny token Pro. Klucza TypeSafe tam nie ma. Polityka: [docs/privacy.html](docs/privacy.html).
