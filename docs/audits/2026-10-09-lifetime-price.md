# Lifetime price update — 2026-10-09

Requested price: **19.99 PLN (1999 grosze), one time**. Previous default: 199 PLN. Team stays 990 PLN/year, 10 seats; existing token/subscription handling is unchanged.

## Change and validation

- The default Lifetime price, PL/EN landing/plans/privacy/terms, extension options, README and configuration examples now agree on 19.99 PLN.
- Configuration accepts PLN with at most two decimal places, dot or comma. It is parsed directly into integer grosze; invalid values and fractions of a grosz are rejected rather than rounded.
- Stripe receives `unit_amount=1999`, currency PLN and payment mode. An explicitly configured Stripe price ID still takes precedence; production inspection confirmed no Lifetime amount or price-ID override, without outputting credentials.
- New price tests failed before the fix and pass afterward. Full suite **75/75**, no skips; typecheck and diff check pass. Independent review found no material issue. Team still serializes to 99000 grosze.
- Chrome/Safari marketing version 0.2.8; Chrome ZIP 13 files, 39,068 bytes, SHA-256 `4ba50d86526874df1e81fefc10d19c7b81a49dfa0108f026e0fe0d22bb1679d3`. Every packaged byte matches extension/.

## Release gates

- Code/CI: [PR #29](https://github.com/pawelmamcarz/linkedin-ai-slop/pull/29) merged as `3720de8c16edac948aff3abe5d66aa6e9c3d8702`. PR CI and main Tests run `37935512168` passed; Pages run `37935511001` passed. Railway deployment `e8f2635e-db1b-4c07-a1c3-087a25ef2301` is SUCCESS for that exact commit.
- Production /billing/offers returned Lifetime **19.99 PLN**, available, and Team **990 PLN**. Public landing and plans pages in PL/EN returned HTTP 200 with the new price. /checkout/lifetime created an anonymous session and redirected HTTP 302 to checkout.stripe.com. After browser access was restored, Stripe's live Checkout UI displayed **19.99 PLN**, and the rendered PL plans page displayed **19.99 PLN**, one time. No payment was made. The 1999-grosz request is also verified by the automated Stripe-boundary regression.
- Chrome Web Store: access was initially blocked by `Sky Computer Use native pipe startup failed`. Access was restored on 2026-10-09 and the user completed Google re-login. The refreshed Package tab confirmed **0.2.7 published publicly**. With the user's explicit approval, the unchanged 0.2.8 ZIP was uploaded and submitted with automatic publication after approval selected. The receipt dialog confirmed submission; a fresh Package load confirmed **0.2.8**, revision **00004**, **Oczekuje na sprawdzenie**, and **0.2.7** still published. No review was cancelled. Approval and publication of 0.2.8 are pending.
- Fresh continuation checks: **75/75 tests**, no skips; typecheck and ZIP integrity/source-byte comparison passed. GitHub main was `79b4618b096076bb7341ebcde5df864e9abed021`; Tests run `37936229261` and Pages run `37936227734` passed for that commit.

Reference: [Stripe Checkout Session create](https://docs.stripe.com/api/checkout/sessions/create).
