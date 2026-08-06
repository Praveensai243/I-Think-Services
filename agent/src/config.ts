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
}

/** The single business the agent is trained on. Swap this file per client. */
export const business: BusinessConfig = JSON.parse(
  readFileSync(resolve(__dirname, "../business.config.json"), "utf8"),
);

export const env = {
  port: Number(process.env.PORT ?? 8787),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:8787",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  model: process.env.MODEL ?? "claude-opus-5",
  calendar: (process.env.CALENDAR ?? "mock").toLowerCase() as "mock" | "google",
  vapiSecret: process.env.VAPI_SECRET ?? "",
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? "",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary",
  },
};

/** True when we can actually call Claude. Without it, the demo replies with a canned notice. */
export const hasBrain = Boolean(env.anthropicKey);

/** True when a real Google Calendar is configured. */
export const usingGoogle =
  env.calendar === "google" &&
  Boolean(env.google.clientId && env.google.clientSecret && env.google.refreshToken);
