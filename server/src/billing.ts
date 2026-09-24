import { createHmac, timingSafeEqual } from "node:crypto";
import { issueProToken, revokeProToken } from "./pro-tokens.ts";

export type CheckoutPlan = "monthly" | "yearly";

const GITHUB_ISSUES = "https://github.com/pawelmamcarz/linkedin-ai-slop/issues";

export function stripeSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function priceIdForPlan(plan: CheckoutPlan, env: NodeJS.ProcessEnv = process.env): string {
  const raw = plan === "yearly" ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY;
  return raw?.trim() ?? "";
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
  return null;
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

export async function createCheckoutSession(
  plan: CheckoutPlan,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ url: string }> {
  const secret = stripeSecret(env);
  const price = priceIdForPlan(plan, env);
  if (!secret || !price) {
    throw Object.assign(new Error("checkout_unconfigured"), { status: 503 });
  }
  const base = publicBaseUrl(env);
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", price);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${base}/billing/cancel`);
  params.set("client_reference_id", plan);
  params.set("allow_promotion_codes", "true");
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

type StripeSession = {
  id?: string;
  customer?: string | { id?: string } | null;
  mode?: string;
  payment_status?: string;
  status?: string;
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
  data?: {
    object?: {
      customer?: string | { id?: string } | null;
      mode?: string;
      payment_status?: string;
      status?: string;
    };
  };
};

const ACTIVE_SUBSCRIPTION = new Set(["active", "trialing"]);
const DEAD_SUBSCRIPTION = new Set(["canceled", "unpaid", "incomplete_expired"]);

export function applyStripeEvent(event: StripeEvent, env: NodeJS.ProcessEnv = process.env): { ok: true } {
  const type = event.type ?? "";
  const object = event.data?.object;
  const customerId = customerIdOf(object?.customer);
  if (!customerId) return { ok: true };
  if (type === "checkout.session.completed") {
    if (sessionIsPaid(object ?? {})) issueProToken(customerId, env);
    return { ok: true };
  }
  if (type === "customer.subscription.deleted") {
    revokeProToken(customerId, env);
    return { ok: true };
  }
  if (type === "customer.subscription.updated") {
    const status = object?.status ?? "";
    if (DEAD_SUBSCRIPTION.has(status)) revokeProToken(customerId, env);
    else if (ACTIVE_SUBSCRIPTION.has(status)) issueProToken(customerId, env);
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

export function successHtml(token: string): string {
  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Token Pro</title>
  </head>
  <body>
    <main>
      <h1>Token Pro</h1>
      <p>Wklej ten token w opcjach rozszerzenia (tryb Pro). To nie jest klucz TypeSafe.</p>
      <p>Paste this token in the extension options (Pro mode). This is not the TypeSafe key.</p>
      <pre>${escapeHtml(token)}</pre>
      <p>Zapisz token teraz. Ta strona pokazuje go ponownie po odświeżeniu, dopóki subskrypcja jest aktywna, ale nie wysyłamy go mailem.</p>
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
