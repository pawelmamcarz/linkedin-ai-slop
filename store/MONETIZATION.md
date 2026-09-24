# Monetyzacja (launch)

Produkt jest tylko na LinkedIn.

| Wariant | Cena | Co jest live |
| --- | --- | --- |
| Free / BYOK | 0 | Rozszerzenie + własne proxy + własny `TYPESAFE_API_KEY`. Live. |
| Hosted Demo | 0, marketing | Publiczne proxy Railway. Limit ~60/min i około 200/dobę na IP. Nie jest planem płatnym. |
| Hosted Pro | od ~5 USD/mies. albo ~40 USD/rok | Ten sam proxy, token w nagłówku, wyższe limity. Subskrypcja Stripe. |
| Lifetime Pro | 199 PLN, jednorazowo | Jeden token Pro bez daty końca. Limit sprzedaży `LIFETIME_PRO_CAP` (domyślnie 50). Po przekroczeniu checkout zwraca 409. |
| Team | 990 PLN / rok, 10 stanowisk | 10 tokenów Pro (po jednym na instalację). Subskrypcja roczna. Anulowanie cofa wszystkie. Checkout zbiera NIP i adres. |

## Jak ktoś zostaje Pro

1. Na stronie planów klika Checkout:
   - miesiąc: `https://proxy-production-ebcc.up.railway.app/billing/checkout?plan=monthly`
   - rok: `https://proxy-production-ebcc.up.railway.app/billing/checkout?plan=yearly`
   - Lifetime: `https://proxy-production-ebcc.up.railway.app/checkout/lifetime`
   - Team: `https://proxy-production-ebcc.up.railway.app/checkout/team`
2. Hosted Pro bierze cenę z `STRIPE_PRICE_MONTHLY` albo `STRIPE_PRICE_YEARLY`. Lifetime i Team biorą `price_data` w PLN (`STRIPE_LIFETIME_AMOUNT_PLN`, `STRIPE_TEAM_AMOUNT_PLN`), chyba że ustawisz `STRIPE_PRICE_LIFETIME` albo `STRIPE_PRICE_TEAM`.
3. Po opłaceniu sukces (`/billing/success?session_id=`) pokazuje token `pro_…` (Team: 10 tokenów). Webhook `checkout.session.completed` zapisuje te same tokeny dla `customer`.
4. Użytkownik wkleja token w opcjach rozszerzenia, tryb Pro. Rozszerzenie wysyła `X-Pro-Token` albo `Authorization: Bearer`. To nie jest `TYPESAFE_API_KEY`.
5. `customer.subscription.deleted` (oraz status `canceled`, `unpaid`, `incomplete_expired`) cofa tokeny subskrypcji (Hosted Pro i Team). Token Lifetime Pro zostaje. Wpisy z `PRO_TOKENS` zostają, dopóki ich nie usuniesz z env.
6. Licznik oferty: `GET /billing/offers` zwraca `lifetime.remaining` (sprzedane kontra cap). Strona planów pokazuje tę liczbę, gdy proxy odpowie.

Bez kluczy Stripe przycisk nie tworzy sesji. `GET /billing/checkout` zwraca HTML „wkrótce” i link do GitHub Issues.

## Railway

Root Directory zostaje `/`. W zmiennych serwisu:

- `TYPESAFE_API_KEY` (już jest na demo)
- `DEMO_MODE=1` (dobowy cap demo 200, gdy `EVALUATE_DAILY_IP_CAP` puste)
- `EVALUATE_DAILY_IP_CAP=200` (jawny cap na produkcji)
- `PRO_TOKENS` (ręczna lista, plain albo `sha256:<hex>`)
- `PRO_RATE_LIMIT=300`, `PRO_DAILY_CAP=2000` (domyślne, można pominąć)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`
- `PUBLIC_BASE_URL=https://proxy-production-ebcc.up.railway.app`
- `STRIPE_LIFETIME_AMOUNT_PLN=199` (opcjonalne, taki jest default)
- `STRIPE_TEAM_AMOUNT_PLN=990` (opcjonalne, taki jest default)
- `LIFETIME_PRO_CAP=50` (opcjonalne, taki jest default)
- `TEAM_SEATS=10` (opcjonalne, taki jest default)
- `STRIPE_PRICE_LIFETIME` i `STRIPE_PRICE_TEAM` tylko wtedy, gdy ceny są już w Dashboard. Puste = `price_data` w PLN, bez ręcznego produktu.
- opcjonalnie `PRO_TOKEN_FILE` na volume, inaczej tokeny z webhooka giną po restarcie i trzeba je dopisać do `PRO_TOKENS`

Nie ustawiaj sekretów w repozytorium. Wartości `sk_` i `whsec_` zostają tylko w Railway.

Nie commituj wartości sekretów.

## Stripe Dashboard

1. Produkt Pro, dwie ceny recurring: ~5 USD / month i ~40 USD / year. Skopiuj `price_…` do `STRIPE_PRICE_MONTHLY` i `STRIPE_PRICE_YEARLY`. Lifetime i Team nie wymagają cen w Dashboard.
2. Webhook na `https://proxy-production-ebcc.up.railway.app/billing/webhook`.
   Zdarzenia: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Signing secret → `STRIPE_WEBHOOK_SECRET`.

## Adresy checkout (stabilne, do sciema.app)

- `GET /checkout/lifetime` → Stripe Checkout, 199 PLN, `mode=payment`
- `GET /checkout/team` → Stripe Checkout, 990 PLN / rok, `mode=subscription`, NIP i kody rabatowe
- `GET /billing/offers` → JSON z `lifetime.remaining` i cenami
- `GET /billing/checkout?plan=monthly|yearly|lifetime|team` zostaje

Gdy cap Lifetime jest wyczerpany, `GET /checkout/lifetime` zwraca 409 i nie tworzy sesji.

## Lokalnie (Stripe CLI)

```bash
cd server
cp .env.example .env
# STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, PUBLIC_BASE_URL=http://127.0.0.1:8787
npm start
stripe listen --forward-to localhost:8787/billing/webhook
```

CLI wypisze `whsec_…`. Wklej je do `STRIPE_WEBHOOK_SECRET` i zrestartuj proxy. Potem:

```bash
curl -sI "http://127.0.0.1:8787/billing/checkout?plan=monthly"
```

Przy kluczach dostaniesz przekierowanie na Checkout. Bez kluczy HTML ze słowem „wkrótce”.

Test bramki bez Stripe: ustaw `PRO_TOKENS` i wołaj `POST /evaluate` z `X-Pro-Token`.
