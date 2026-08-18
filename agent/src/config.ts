import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface BusinessConfig {
  name: string;
  industry: string;
  timezone: string;
  phoneForHumans: string;
  greeting: string;
  agentName: string;
  hours: Record<string, [string, string] | null>;
  slotMinutes: number;
  services: { id: string; name: string; minutes: number }[];
  faq: { q: string; a: string }[];
  escalation: { toHumanWhen: string[] };
  sampleQuestions?: string[];
  /**
   * What a good call looks like for this business, in one line — e.g. "book a
   * free demo". Drives the agent's sense of purpose; without it the agent is a
   * polite question-answerer that never asks for anything.
   */
  objective?: string;
}

/**
 * The business this agent instance is trained on. Point at a different client
 * with BUSINESS_CONFIG=examples/salon.json (path relative to the agent/ folder),
 * so one deploy can serve many clients — or just edit business.config.json.
 */
const configPath = resolve(
  __dirname,
  "..",
  process.env.BUSINESS_CONFIG ?? "business.config.json",
);
export const business: BusinessConfig = JSON.parse(readFileSync(configPath, "utf8"));

export const env = {
  port: Number(process.env.PORT ?? 8787),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:8787",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  model: process.env.MODEL ?? "claude-opus-5",
  calendar: (process.env.CALENDAR ?? "mock").toLowerCase() as "mock" | "google" | "calcom",
  vapiSecret: process.env.VAPI_SECRET ?? "",
  /**
   * How a call-control instruction is framed for Vapi. "tool_calls" is the
   * ordinary OpenAI shape and the default, because Vapi sends its built-ins to
   * us as OpenAI function definitions. "function_call" is the bare frame from
   * Vapi's proxy example. Switchable without a deploy so a live call can settle
   * which one Vapi actually acts on.
   */
  get controlShape(): "tool_calls" | "function_call" {
    return (process.env.VAPI_CONTROL_SHAPE ?? "").toLowerCase() === "function_call"
      ? "function_call"
      : "tool_calls";
  },
  /**
   * Lets the agent hang up and transfer by sending Vapi call-control payloads.
   * Off by default and read per request, so if a live call misbehaves this can
   * be switched off in the host's dashboard — no redeploy, no revert. #10 cost
   * us a working phone precisely because recovery meant shipping code.
   */
  get callControl(): boolean {
    const v = (process.env.VOICE_CALL_CONTROL ?? "").toLowerCase();
    return v === "1" || v === "true" || v === "on";
  },
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? "",
  adminToken: process.env.ADMIN_TOKEN ?? "",
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    priceStarter: process.env.STRIPE_PRICE_STARTER ?? "",
    pricePro: process.env.STRIPE_PRICE_PRO ?? "",
    portalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL ?? "",
  },
  calcom: {
    apiKey: process.env.CALCOM_API_KEY ?? "",
    eventTypeId: process.env.CALCOM_EVENT_TYPE_ID ?? "",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "",
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary",
  },
};

/** True when we can actually call Claude. Without it, the demo replies with a canned notice. */
export const hasBrain = Boolean(env.anthropicKey);

/**
 * Service-account credentials, when supplied. Accepts either the raw JSON key or
 * that JSON base64-encoded — hosts like Render mangle multi-line env values, so
 * base64 is the reliable way to paste a key in.
 */
export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}
function parseServiceAccount(raw: string): ServiceAccountKey | null {
  const text = raw.trim();
  if (!text) return null;
  const json = text.startsWith("{")
    ? text
    : Buffer.from(text, "base64").toString("utf8");
  try {
    const key = JSON.parse(json);
    if (!key.client_email || !key.private_key) return null;
    // Escaped newlines survive a round-trip through most env-var UIs; restore them.
    return {
      client_email: String(key.client_email),
      private_key: String(key.private_key).replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}
export const googleServiceAccount = parseServiceAccount(env.google.serviceAccountJson);

/** How we authenticate to Google, if at all. */
export const googleAuthMode: "service-account" | "oauth" | "none" =
  env.calendar !== "google"
    ? "none"
    : googleServiceAccount
      ? "service-account"
      : env.google.clientId && env.google.clientSecret && env.google.refreshToken
        ? "oauth"
        : "none";

/** True when a real Google Calendar is configured. */
export const usingGoogle = googleAuthMode !== "none";

/** True when Cal.com is configured. */
export const usingCalcom = env.calendar === "calcom" && Boolean(env.calcom.apiKey);

/** True when Stripe billing is configured. */
export const usingStripe = Boolean(env.stripe.secretKey);
