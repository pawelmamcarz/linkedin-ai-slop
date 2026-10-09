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
- Production /billing/offers returned Lifetime **19.99 PLN**, available, and Team **990 PLN**. Public landing and plans pages in PL/EN returned HTTP 200 with the new price. /checkout/lifetime created an anonymous session and redirected HTTP 302 to checkout.stripe.com. No payment was made. The rendered amount on Stripe's UI could not be inspected because browser access remained unavailable; the 1999-grosz request is verified by the automated Stripe-boundary regression.
- Browser UI verification and Chrome Web Store upload: blocked by `Sky Computer Use native pipe startup failed`, including a fresh runtime retry and retries after the user offered to enable access and after deployment. Browser provider inventory is empty. 0.2.8 is prepared, not uploaded/submitted; last confirmed Store checkpoint is 0.2.7 pending review / 0.2.6 public on 2026-10-08. Do not infer current approval/publication from that checkpoint.

Reference: [Stripe Checkout Session create](https://docs.stripe.com/api/checkout/sessions/create).
