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

/**
 * Confirms a booking to the caller, with a calendar file they can open.
 *
 * Deliberately NOT done by adding them as a Google attendee: a service account
 * cannot send invitations without domain-wide delegation, and asking for one
 * would trade a working booking for a Google admin project. An .ics attachment
 * lands the same appointment in Google, Apple or Outlook with one tap, and
 * uses the SMTP we already have.
 */
export interface BookingConfirmation {
  name: string; email?: string; phone: string;
  service: string; startISO: string; endISO: string; id: string;
}

/** iCalendar wants UTC stamped as YYYYMMDDTHHMMSSZ. */
function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildIcs(b: BookingConfirmation): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${business.name}//AI Receptionist//EN`,
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${b.id}@ithinkservices.net`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(b.startISO)}`,
    `DTEND:${icsStamp(b.endISO)}`,
    `SUMMARY:${b.service} — ${business.name}`,
    `DESCRIPTION:Booked by phone with ${business.agentName}. Questions? Call ${business.phoneForHumans}.`,
    `ORGANIZER;CN=${business.name}:mailto:${env.smtp.from || env.smtp.user}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function confirmationEmail(b: BookingConfirmation): { subject: string; text: string } {
  const when = new Date(b.startISO).toLocaleString("en-US", {
    timeZone: business.timezone, weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
  return {
    subject: `Confirmed: ${b.service} on ${when}`,
    text: [
      `Hi ${b.name},`,
      "",
      `You're booked for ${b.service} on ${when} (${business.timezone}).`,
      "",
      "The attached file adds it to your calendar.",
      "",
      `Need to change it? Call ${business.phoneForHumans}.`,
      "",
      `— ${business.agentName}, ${business.name}`,
    ].join("\n"),
  };
}

/** Not awaited: an SMTP round trip inside the caller's turn is heard as silence. */
export function notifyBooking(b: BookingConfirmation): void {
  if (!emailEnabled()) {
    console.log("booking made but no SMTP configured — not emailed:", b.name);
    return;
  }
  const { subject, text } = confirmationEmail(b);
  const ics = { filename: "appointment.ics", content: buildIcs(b), contentType: "text/calendar; method=REQUEST" };

  // The caller gets the confirmation; the team gets told either way, so a
  // booking taken without an email address still reaches somebody.
  const to = b.email || env.smtp.to;
  getTransport()
    .sendMail({
      from: env.smtp.from || env.smtp.user,
      to,
      cc: b.email ? env.smtp.to : undefined,
      subject: b.email ? subject : `New booking: ${b.name} (${b.phone}) — ${b.service}`,
      text: b.email ? text : `${b.name} booked ${b.service}.\nPhone: ${b.phone}\nNo email given, so they have no confirmation.`,
      attachments: [ics],
    })
    .then(() => console.log("booking emailed:", subject))
    .catch((err) => console.error("could not email the booking:", err));
}
