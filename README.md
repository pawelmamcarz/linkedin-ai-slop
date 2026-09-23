# LinkedIn AI Slop

Rozszerzenie Chrome/Edge (Manifest V3) na feed LinkedIn. Przy scrollowaniu wyciąga tekst posta i pyta model **Jev** (TypeSafe System One), czy to AI-slop. Na karcie pojawia się odznaka: **Ludzki**, **Mieszany** albo **AI slop**.

Klucz API zostaje w lokalnym proxy. Rozszerzenie go nie zawiera.

## Uruchomienie

Potrzebny Node.js 20+.

### 1. Proxy

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

Proxy słucha na `http://127.0.0.1:8787`.

- `GET /health` — czy proces żyje i czy klucz jest ustawiony (samej wartości nie zwraca)
- `POST /evaluate` — jedno wywołanie Jev na post
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

1. Otwórz `chrome://extensions` (w Edge: `edge://extensions`).
2. Włącz tryb dewelopera.
3. **Załaduj rozpakowane** i wskaż katalog `extension/`.
4. Ikona rozszerzenia: włącz ocenę, próg, adres proxy. Domyślny adres to `http://127.0.0.1:8787`. Przycisk **Sprawdź proxy** powinien pokazać model `jev-latest`.

### 3. Feed

Wejdź na [https://www.linkedin.com/feed/](https://www.linkedin.com/feed/) i przewiń. Posty, które wejdą w widok (ok. 35% wysokości), dostają odznakę w prawym górnym rogu karty. Najedź, żeby zobaczyć prawdopodobieństwa.

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

Content script nie wysyła tekstu krótszego niż 40 znaków. Na proxy limit ciała to 6000 znaków.

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
extension/          content script na linkedin.com
  content.js        MutationObserver + IntersectionObserver, deduplikacja, debounce, max 2 żądania naraz
  background.js     fetch do proxy (klucz tu nie występuje)
  options.html      włącznik, próg, URL proxy
server/             Node + TypeScript, trzyma TYPESAFE_API_KEY
  POST /evaluate    { postId, text, author? } → mapowanie na odznakę
jev/                pytania i progi, do review
```

CORS proxy puszcza `https://www.linkedin.com`, `localhost`, `127.0.0.1` oraz `chrome-extension://`. Rozszerzenie i tak woła proxy z service workera (uprawnienie hosta), więc ocena nie zależy od CORS strony.

Gdy zmienisz port, zaktualizuj adres w opcjach. Content script podglądu `/demo` jest podpięty tylko pod port **8787**.

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

## Poza zakresem

Chrome Web Store, aplikacja mobilna, wątki komentarzy.

## Prywatność

Tekst widocznego posta i opcjonalnie imię autora idą na `127.0.0.1`, a stamtąd do TypeSafe. Proxy nie zapisuje postów. Rozszerzenie trzyma w `chrome.storage.sync` tylko włącznik, próg i URL.
