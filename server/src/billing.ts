import { createHmac, timingSafeEqual } from "node:crypto";
import {
  issueLifetimeToken,
  issueProToken,
  issueTeamTokens,
  lifetimeSoldCount,
  revokeProToken,
} from "./pro-tokens.ts";

export type CheckoutPlan = "monthly" | "yearly" | "lifetime" | "team";

const DEFAULT_LIFETIME_PLN = 199;
const DEFAULT_TEAM_PLN = 990;
const DEFAULT_LIFETIME_CAP = 50;
const DEFAULT_TEAM_SEATS = 10;

const GITHUB_ISSUES = "https://github.com/pawelmamcarz/linkedin-ai-slop/issues";

export function stripeSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function priceIdForPlan(plan: CheckoutPlan, env: NodeJS.ProcessEnv = process.env): string {
  const raw =
    plan === "yearly"
      ? env.STRIPE_PRICE_YEARLY
      : plan === "lifetime"
        ? env.STRIPE_PRICE_LIFETIME
        : plan === "team"
          ? env.STRIPE_PRICE_TEAM
          : env.STRIPE_PRICE_MONTHLY;
  return raw?.trim() ?? "";
}

function positiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 0) return fallback;
  return value;
}

/** Whole PLN. 0 means the env value is unusable and no default applies. */
export function amountPln(plan: "lifetime" | "team", env: NodeJS.ProcessEnv = process.env): number {
  const raw = plan === "lifetime" ? env.STRIPE_LIFETIME_AMOUNT_PLN : env.STRIPE_TEAM_AMOUNT_PLN;
  if (!raw?.trim()) return plan === "lifetime" ? DEFAULT_LIFETIME_PLN : DEFAULT_TEAM_PLN;
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value <= 0) return 0;
  return value;
}

export function lifetimeCap(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.LIFETIME_PRO_CAP, DEFAULT_LIFETIME_CAP);
}

export function teamSeats(env: NodeJS.ProcessEnv = process.env): number {
  const seats = positiveInt(env.TEAM_SEATS, DEFAULT_TEAM_SEATS);
  return seats > 0 ? seats : DEFAULT_TEAM_SEATS;
}

export function lifetimeOffer(env: NodeJS.ProcessEnv = process.env): {
  amountPln: number;
  currency: "pln";
  cap: number;
  sold: number;
  remaining: number;
  available: boolean;
} {
  const cap = lifetimeCap(env);
  const sold = lifetimeSoldCount(env);
  const remaining = Math.max(0, cap - sold);
  return {
    amountPln: amountPln("lifetime", env) || DEFAULT_LIFETIME_PLN,
    currency: "pln",
    cap,
    sold,
    remaining,
    available: remaining > 0 && Boolean(stripeSecret(env)) && checkoutPlanReady("lifetime", env),
  };
}

export function offersPayload(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const lifetime = lifetimeOffer(env);
  return {
    lifetime,
    team: {
      amountPln: amountPln("team", env) || DEFAULT_TEAM_PLN,
      currency: "pln",
      interval: "year",
      seats: teamSeats(env),
      available: Boolean(stripeSecret(env)) && checkoutPlanReady("team", env),
    },
  };
}

export function checkoutPlanReady(plan: CheckoutPlan, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!stripeSecret(env)) return false;
  if (priceIdForPlan(plan, env)) return true;
  if (plan === "lifetime" || plan === "team") return amountPln(plan, env) > 0;
  return false;
}

export function stripeCheckoutConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(stripeSecret(env) && (env.STRIPE_PRICE_MONTHLY?.trim() || env.STRIPE_PRICE_YEARLY?.trim()));
}

export function publicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const port = env.PORT?.trim() || "8787";
  const host = env.HOST?.trim() || "127.0.0.1";
  const hostname = host === "0.0.0.0" ? "127.0.0.1" : host;
  return `http://${hostname}:${port}`;
}

export function parseCheckoutPlan(value: unknown): CheckoutPlan | null {
  const plan = String(value ?? "").trim().toLowerCase();
  if (plan === "monthly" || plan === "month") return "monthly";
  if (plan === "yearly" || plan === "year" || plan === "annual") return "yearly";
  if (plan === "lifetime" || plan === "life") return "lifetime";
  if (plan === "team") return "team";
  return null;
}

export function lifetimeSoldOut(env: NodeJS.ProcessEnv = process.env): boolean {
  return lifetimeSoldCount(env) >= lifetimeCap(env);
}

export function checkoutUnavailableHtml(env: NodeJS.ProcessEnv = process.env): string {
  const contact = env.BILLING_CONTACT_URL?.trim() || GITHUB_ISSUES;
  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pro: wkrótce</title>
  </head>
  <body>
    <main>
      <h1>Hosted Pro: wkrótce</h1>
      <p>Checkout Stripe nie jest jeszcze włączony na tym proxy. Brakuje <code>STRIPE_SECRET_KEY</code> albo identyfikatora ceny.</p>
      <p>Coming soon. Stripe Checkout is not configured on this proxy yet.</p>
      <p>Cena docelowa: około 5 USD miesięcznie albo około 40 USD rocznie. Rozszerzenie zostaje darmowe w trybie BYOK.</p>
      <p><a href="${escapeHtml(contact)}">Kontakt / GitHub</a></p>
    </main>
  </body>
</html>`;
}

function productName(plan: CheckoutPlan, seats: number): string {
  if (plan === "lifetime") return "LinkedIn AI Slop Lifetime Pro";
  if (plan === "team") return `LinkedIn AI Slop Team (${seats} stanowisk)`;
  if (plan === "yearly") return "LinkedIn AI Slop Pro (rok)";
  return "LinkedIn AI Slop Pro (miesiąc)";
}

export async function createCheckoutSession(
  plan: CheckoutPlan,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ url: string }> {
  const secret = stripeSecret(env);
  const price = priceIdForPlan(plan, env);
  const inline = plan === "lifetime" || plan === "team" ? amountPln(plan, env) : 0;
  if (!secret || (!price && inline <= 0)) {
    throw Object.assign(new Error("checkout_unconfigured"), { status: 503 });
  }
  if (plan === "lifetime" && lifetimeSoldOut(env)) {
    throw Object.assign(new Error("lifetime_sold_out"), { status: 409 });
  }
  const base = publicBaseUrl(env);
  const seats = teamSeats(env);
  const params = new URLSearchParams();
  const subscription = plan !== "lifetime";
  params.set("mode", subscription ? "subscription" : "payment");
  params.set("line_items[0][quantity]", "1");
  if (price) {
    params.set("line_items[0][price]", price);
  } else {
    params.set("line_items[0][price_data][currency]", "pln");
    params.set("line_items[0][price_data][unit_amount]", String(inline * 100));
    params.set("line_items[0][price_data][product_data][name]", productName(plan, seats));
    if (plan === "team") params.set("line_items[0][price_data][recurring][interval]", "year");
  }
  params.set("success_url", `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${base}/billing/cancel`);
  params.set("client_reference_id", plan);
  params.set("allow_promotion_codes", "true");
  params.set("metadata[plan]", plan);
  if (plan === "team") params.set("metadata[seats]", String(seats));
  if (plan === "lifetime") {
    params.set("customer_creation", "always");
    params.set("invoice_creation[enabled]", "true");
  }
  if (subscription) {
    params.set("subscription_data[metadata][plan]", plan);
    if (plan === "team") params.set("subscription_data[metadata][seats]", String(seats));
  }
  if (plan === "team") {
    params.set("billing_address_collection", "required");
    params.set("tax_id_collection[enabled]", "true");
  }
  const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = (await response.json().catch(() => ({}))) as { url?: string };
  if (!response.ok || !data.url) {
    console.error("[proxy] stripe_checkout_failed", response.status);
    throw Object.assign(new Error("stripe_checkout_failed"), { status: 502 });
  }
  return { url: data.url };
}

export type StripeSession = {
  id?: string;
  customer?: string | { id?: string } | null;
  mode?: string;
  payment_status?: string;
  status?: string;
  metadata?: { plan?: string; seats?: string } | null;
  subscription?: string | { id?: string } | null;
};

function customerIdOf(customer: StripeSession["customer"]): string {
  if (typeof customer === "string") return customer;
  return customer?.id?.trim() ?? "";
}

export async function retrieveCheckoutSession(
  sessionId: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<StripeSession> {
  const secret = stripeSecret(env);
  if (!secret) throw Object.assign(new Error("checkout_unconfigured"), { status: 503 });
  const response = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = (await response.json().catch(() => ({}))) as StripeSession;
  if (!response.ok) {
    console.error("[proxy] stripe_session_failed", response.status);
    throw Object.assign(new Error("stripe_session_failed"), { status: 502 });
  }
  return data;
}

export function sessionIsPaid(session: StripeSession): boolean {
  return session.payment_status === "paid" || session.status === "complete";
}

function timingSafeHex(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export function verifyStripeSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  now = Date.now(),
): boolean {
  if (!header || !secret) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }
  const stamp = Number(timestamp);
  if (!Number.isFinite(stamp) || signatures.length === 0) return false;
  const ageSec = Math.abs(now / 1000 - stamp);
  if (ageSec > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return signatures.some((signature) => timingSafeHex(signature, expected));
}

type StripeEvent = {
  type?: string;
  data?: { object?: StripeSession };
};

function planOf(object: StripeSession | undefined): string {
  return object?.metadata?.plan?.trim().toLowerCase() ?? "";
}

function seatsOf(object: StripeSession | undefined, env: NodeJS.ProcessEnv): number {
  const raw = Number(object?.metadata?.seats);
  if (Number.isInteger(raw) && raw > 0) return raw;
  return teamSeats(env);
}

function subscriptionIdOf(object: StripeSession | undefined): string {
  const subscription = object?.subscription;
  if (typeof subscription === "string") return subscription;
  return subscription?.id?.trim() ?? "";
}

export function grantFromCheckout(
  object: StripeSession,
  env: NodeJS.ProcessEnv = process.env,
): { tokens: string[]; plan: CheckoutPlan | "pro" } | null {
  const customerId = customerIdOf(object.customer);
  if (!customerId || !sessionIsPaid(object)) return null;
  const plan = planOf(object);
  if (plan === "lifetime") {
    return { tokens: [issueLifetimeToken(customerId, env).token], plan: "lifetime" };
  }
  if (plan === "team") {
    return {
      tokens: issueTeamTokens(customerId, seatsOf(object, env), env, subscriptionIdOf(object)).tokens,
      plan: "team",
    };
  }
  return { tokens: [issueProToken(customerId, env).token], plan: plan === "yearly" || plan === "monthly" ? plan : "pro" };
}

const ACTIVE_SUBSCRIPTION = new Set(["active", "trialing"]);
const DEAD_SUBSCRIPTION = new Set(["canceled", "unpaid", "incomplete_expired"]);

export function applyStripeEvent(event: StripeEvent, env: NodeJS.ProcessEnv = process.env): { ok: true } {
  const type = event.type ?? "";
  const object = event.data?.object;
  const customerId = customerIdOf(object?.customer);
  if (!customerId) return { ok: true };
  if (type === "checkout.session.completed") {
    grantFromCheckout(object ?? {}, env);
    return { ok: true };
  }
  if (type === "customer.subscription.deleted") {
    revokeProToken(customerId, env);
    return { ok: true };
  }
  if (type === "customer.subscription.updated") {
    const status = object?.status ?? "";
    if (DEAD_SUBSCRIPTION.has(status)) revokeProToken(customerId, env);
    else if (ACTIVE_SUBSCRIPTION.has(status)) {
      if (planOf(object) === "team") issueTeamTokens(customerId, seatsOf(object, env), env, object?.id);
      else if (planOf(object) !== "lifetime") issueProToken(customerId, env);
    }
  }
  return { ok: true };
}

export function handleWebhook(
  rawBody: string,
  signature: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): { status: number; body: Record<string, unknown> } {
  const secret = env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    return { status: 503, body: { error: "webhook_unconfigured", message: "Brak STRIPE_WEBHOOK_SECRET." } };
  }
  if (!verifyStripeSignature(rawBody, signature, secret)) {
    return { status: 400, body: { error: "invalid_signature", message: "Podpis Stripe nie pasuje." } };
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return { status: 400, body: { error: "invalid_json", message: "Niepoprawny JSON webhooka." } };
  }
  applyStripeEvent(event, env);
  return { status: 200, body: { received: true } };
}

export function successHtml(token: string | string[], plan: CheckoutPlan | "pro" = "pro"): string {
  const tokens = (Array.isArray(token) ? token : [token]).filter(Boolean);
  const lifetime = plan === "lifetime";
  const team = plan === "team";
  const heading = team ? "Tokeny Team" : lifetime ? "Token Lifetime Pro" : "Token Pro";
  const note = lifetime
    ? "Token Lifetime Pro nie wygasa. Anulowanie innych subskrypcji go nie cofa."
    : team
      ? "Każde stanowisko wkleja własny token w opcjach rozszerzenia (tryb Pro). Subskrypcja roczna. Anulowanie cofa wszystkie tokeny z tej listy."
      : "Zapisz token teraz. Ta strona pokazuje go ponownie po odświeżeniu, dopóki subskrypcja jest aktywna, ale nie wysyłamy go mailem.";
  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body>
    <main>
      <h1>${heading}</h1>
      <p>Wklej token w opcjach rozszerzenia (tryb Pro). To nie jest klucz TypeSafe.</p>
      <p>Paste the token in the extension options (Pro mode). This is not the TypeSafe key.</p>
      <pre>${escapeHtml(tokens.join("\n"))}</pre>
      <p>${note}</p>
    </main>
  </body>
</html>`;
}

export function lifetimeSoldOutHtml(): string {
  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lifetime Pro: limit</title>
  </head>
  <body>
    <main>
      <h1>Lifetime Pro: limit oferty</h1>
      <p>Limit sprzedaży Lifetime Pro został osiągnięty. Checkout jest zamknięty.</p>
      <p>The Lifetime Pro launch cap is reached. Checkout is closed.</p>
      <p><a href="https://pawelmamcarz.github.io/linkedin-ai-slop/pro.html">Wróć do planów</a></p>
    </main>
  </body>
</html>`;
}

export function cancelHtml(): string {
  return `<!doctype html>
<html lang="pl">
  <head><meta charset="utf-8" /><title>Płatność anulowana</title></head>
  <body>
    <main>
      <h1>Płatność anulowana</h1>
      <p>Checkout został przerwany. Token Pro nie został wydany.</p>
      <p><a href="https://pawelmamcarz.github.io/linkedin-ai-slop/pro.html">Wróć do planów</a></p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
