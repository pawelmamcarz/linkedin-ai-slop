import { it } from "node:test";
import assert from "node:assert/strict";
import { amountPln, createCheckoutSession } from "../src/billing.ts";

it("Lifetime kosztuje 19.99 PLN i wysyła dokładnie 1999 groszy do Stripe", async () => {
  for (const raw of [undefined, "19.99", "19,99"]) {
    const env = { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_LIFETIME_AMOUNT_PLN: raw };
    assert.equal(amountPln("lifetime", env), 19.99);
    let body = "";
    await createCheckoutSession("lifetime", env, (async (_input, init) => {
      body = String(init?.body);
      return new Response(JSON.stringify({ url: "https://checkout.stripe.com/fixture" }));
    }) as typeof fetch);
    const params = new URLSearchParams(body);
    assert.equal(params.get("mode"), "payment");
    assert.equal(params.get("line_items[0][price_data][currency]"), "pln");
    assert.equal(params.get("line_items[0][price_data][unit_amount]"), "1999");
  }
});

it("nie zaokrągla błędnie skonfigurowanej ceny z ułamkiem grosza", async () => {
  for (const raw of ["19.999", "0", "-19.99", "NaN", "1e2", "9007199254740991"]) {
    const env = { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_LIFETIME_AMOUNT_PLN: raw };
    assert.equal(amountPln("lifetime", env), 0);
    await assert.rejects(createCheckoutSession("lifetime", env), /checkout_unconfigured/);
  }
  assert.equal(amountPln("team", {}), 990);
});
