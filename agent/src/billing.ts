import Stripe from "stripe";
import { env, usingStripe, business } from "./config.js";

/**
 * Stripe billing — subscriptions for your clients (setup fee handled as a
 * one-time line item or a separate invoice; monthly plans via price IDs).
 * Keyless-safe: with no STRIPE_SECRET_KEY the endpoints report "not configured"
 * and nothing else in the app is affected.
 */
const stripe = usingStripe ? new Stripe(env.stripe.secretKey) : null;

export function billingEnabled(): boolean {
  return Boolean(stripe);
}

/** Create a Checkout link for a monthly plan. */
export async function createCheckout(
  plan: "starter" | "pro",
  opts?: { email?: string; success?: string; cancel?: string },
): Promise<string> {
  if (!stripe) throw new Error("stripe_not_configured");
  const price = plan === "pro" ? env.stripe.pricePro : env.stripe.priceStarter;
  if (!price) throw new Error("price_not_configured");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    customer_email: opts?.email,
    success_url: opts?.success ?? `${env.publicBaseUrl}/admin?billing=success`,
    cancel_url: opts?.cancel ?? `${env.publicBaseUrl}/admin?billing=cancel`,
    metadata: { business: business.name },
  });
  return session.url ?? "";
}

/** Self-serve billing portal for an existing customer. */
export async function portalLink(customerId: string): Promise<string> {
  if (!stripe) throw new Error("stripe_not_configured");
  const s = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: env.stripe.portalReturnUrl || `${env.publicBaseUrl}/admin`,
  });
  return s.url;
}

/** Verify a Stripe webhook signature and return the parsed event. */
export function verifyWebhook(rawBody: Buffer, signature: string): Stripe.Event {
  if (!stripe) throw new Error("stripe_not_configured");
  return stripe.webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
}
