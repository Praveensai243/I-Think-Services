import nodemailer from "nodemailer";
import { business, env } from "./config.js";
import type { MessageNote } from "./store.js";

/**
 * Tells a human that a caller left a message.
 *
 * This is also, for now, the only durable copy: messages live in an in-memory
 * array that every restart clears, so an email at 2am is what survives until
 * there is a database. That is a deliberate trade — a delivered email beats a
 * row in a table nobody reads.
 *
 * Keyless-safe, like billing: with no SMTP settings it logs and moves on
 * rather than throwing on a live call.
 */

export function emailEnabled(): boolean {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass && env.smtp.to);
}

let transport: nodemailer.Transporter | null = null;
function getTransport(): nodemailer.Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      // 465 is implicit TLS; everything else upgrades with STARTTLS.
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transport;
}

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", { timeZone: business.timezone });
  } catch {
    return iso;
  }
}

/**
 * Never awaited by the caller's turn — an SMTP round trip would be heard as
 * silence on the phone. Failures are logged and reported through the message
 * log rather than surfaced to the caller, who cannot do anything about them.
 */
export function messageEmail(note: MessageNote, source: "web" | "phone"): { subject: string; text: string } {
  const via = source === "phone" ? "a phone call" : "the website";
  return {
    // The caller's number belongs in the subject: it is what you act on, and
    // it should be readable from a phone's notification without opening it.
    subject: `New message from ${note.name}${note.phone ? ` (${note.phone})` : ""}`,
    text: [
      `${note.name} left a message via ${via}.`,
      "",
      `Message: ${note.message}`,
      `Callback: ${note.phone ?? "not given"}`,
      `Taken: ${when(note.at)} (${business.timezone})`,
      "",
      `— ${business.agentName}, ${business.name}`,
    ].join("\n"),
  };
}

export function notifyNewMessage(note: MessageNote, source: "web" | "phone"): void {
  if (!emailEnabled()) {
    console.log("message taken but no SMTP configured — not emailed:", note.name);
    return;
  }
  const { subject, text } = messageEmail(note, source);

  getTransport()
    .sendMail({ from: env.smtp.from || env.smtp.user, to: env.smtp.to, subject, text })
    .then(() => console.log("message emailed:", subject))
    .catch((err) => console.error("could not email the message:", err));
}

/**
 * Sends a test alert and reports what actually happened.
 *
 * Configuration errors here are invisible otherwise: the real path never
 * blocks a call, so a wrong password just leaves a line in the logs that
 * nobody sees until a caller's message has already been lost. This one is
 * awaited and returns the provider's own error text, because "it didn't work"
 * has cost this project enough time already.
 */
export async function sendTestEmail(): Promise<{ ok: boolean; detail: string }> {
  if (!emailEnabled()) {
    const missing = [
      !env.smtp.host && "SMTP_HOST",
      !env.smtp.user && "SMTP_USER",
      !env.smtp.pass && "SMTP_PASS",
      !env.smtp.to && "NOTIFY_EMAIL",
    ].filter(Boolean);
    return { ok: false, detail: `Not configured yet — still missing: ${missing.join(", ")}` };
  }
  try {
    await getTransport().sendMail({
      from: env.smtp.from || env.smtp.user,
      to: env.smtp.to,
      subject: `Test alert from ${business.agentName}`,
      text: [
        "If you are reading this, message alerts are working.",
        "",
        `A real one arrives the moment a caller leaves a message with ${business.agentName},`,
        "with their name, number and what they said.",
      ].join("\n"),
    });
    return { ok: true, detail: `Sent to ${env.smtp.to}. Check that inbox, including spam.` };
  } catch (err) {
    // Verbatim: "Invalid login" means a wrong app password, "self signed
    // certificate" means the wrong port, and guessing between them wastes a day.
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
