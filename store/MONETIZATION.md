# Monetyzacja (launch)

Produkt jest tylko na LinkedIn. Trzy warianty, bez nowych cen:

| Wariant | Cena | Co jest live |
| --- | --- | --- |
| Free / BYOK | 0 | Rozszerzenie + własne proxy + własny `TYPESAFE_API_KEY`. Live. |
| Hosted Demo | 0, marketing | Publiczne proxy Railway. Limit ~60/min na IP. Nie jest planem płatnym. |
| Hosted Pro | od ~5 USD/mies. albo ~40 USD/rok | Ten sam proxy, token w nagłówku, wyższe limity. Bramka tokenu jest w kodzie. Checkout działa po ustawieniu Stripe. |

Jednorazowo w kopii wolno mówić o przedziale ~9–19 USD. Checkout wystawia subskrypcję, nie płatność jednorazową.

## Jak ktoś zostaje Pro

1. Na stronie planów klika Checkout (miesiąc albo rok): `https://proxy-production-ebcc.up.railway.app/billing/checkout?plan=monthly`.
2. Stripe Checkout bierze cenę z `STRIPE_PRICE_MONTHLY` albo `STRIPE_PRICE_YEARLY`.
3. Po opłaceniu sukces (`/billing/success?session_id=`) pokazuje token `pro_…`. Webhook `checkout.session.completed` zapisuje ten sam token dla `customer`.
4. Użytkownik wkleja token w opcjach rozszerzenia, tryb Pro. Rozszerzenie wysyła `X-Pro-Token` albo `Authorization: Bearer`. To nie jest `TYPESAFE_API_KEY`.
5. `customer.subscription.deleted` (oraz status `canceled`, `unpaid`, `incomplete_expired`) cofa token wydany z webhooka. Wpisy z `PRO_TOKENS` zostają, dopóki ich nie usuniesz z env.

Bez kluczy Stripe przycisk nie tworzy sesji. `GET /billing/checkout` zwraca HTML „wkrótce” i link do GitHub Issues.

## Railway

Root Directory zostaje `/`. W zmiennych serwisu:

- `TYPESAFE_API_KEY` (już jest na demo)
- `DEMO_MODE=1` (dobowy cap demo 40, gdy `EVALUATE_DAILY_IP_CAP` puste)
- opcjonalnie `EVALUATE_DAILY_IP_CAP=40`
- `PRO_TOKENS` (ręczna lista, plain albo `sha256:<hex>`)
- `PRO_RATE_LIMIT=300`, `PRO_DAILY_CAP=2000` (domyślne, można pominąć)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`
- `PUBLIC_BASE_URL=https://proxy-production-ebcc.up.railway.app`
- opcjonalnie `PRO_TOKEN_FILE` na volume, inaczej tokeny z webhooka giną po restarcie i trzeba je dopisać do `PRO_TOKENS`

Nie commituj wartości sekretów.

## Stripe Dashboard

1. Produkt Pro, dwie ceny recurring: ~5 USD / month i ~40 USD / year. Skopiuj `price_…` do env.
2. Webhook na `https://proxy-production-ebcc.up.railway.app/billing/webhook`.
   Zdarzenia: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Signing secret → `STRIPE_WEBHOOK_SECRET`.

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
