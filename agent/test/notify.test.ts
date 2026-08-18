import { test } from "node:test";
import assert from "node:assert/strict";
import { emailEnabled, messageEmail } from "../src/notify.js";
import { runTool } from "../src/tools.js";
import { messageLog } from "../src/store.js";

const note = {
  name: "Sai", phone: "925-567-4035", message: "Wants a quote for HVAC dispatch after hours.",
  at: "2026-08-18T18:30:00.000Z", sessionId: "vapi:1",
};

test("alerts stay off until SMTP is configured, and that is not an error", () => {
  assert.equal(emailEnabled(), false, "no SMTP settings in the test environment");
});

test("a message is still taken and logged when nothing can be emailed", async () => {
  const before = messageLog.length;
  const out = await runTool(
    "take_message",
    { name: "Sai", phone: "925-567-4035", message: "Please call back about dispatch." },
    "vapi:1", "phone",
  );
  assert.equal(out.ok, true, "a missing mail server must never fail the call");
  assert.equal(messageLog.length, before + 1);
});

test("the alert leads with who called and how to reach them", () => {
  const { subject } = messageEmail(note, "phone");
  assert.match(subject, /Sai/);
  assert.match(subject, /925-567-4035/, "the callback number must be readable without opening it");
});

test("the alert carries everything needed to return the call", () => {
  const { text } = messageEmail(note, "phone");
  assert.match(text, /Wants a quote for HVAC dispatch/);
  assert.match(text, /925-567-4035/);
  assert.match(text, /phone call/, "says which channel it came from");
});

test("a missing callback number is stated plainly rather than left blank", () => {
  const { text } = messageEmail({ ...note, phone: undefined }, "web");
  assert.match(text, /Callback: not given/);
  assert.match(text, /website/);
});

// ── proving it works without placing a call ────────────────────────
// The real send is fire-and-forget so it can never delay a caller, which also
// means a wrong password is invisible until a message has been lost. This one
// is awaited and reports what the mail server actually said.

import { sendTestEmail } from "../src/notify.js";

test("an unconfigured mailer names the variables that are missing", async () => {
  const r = await sendTestEmail();
  assert.equal(r.ok, false);
  assert.match(r.detail, /SMTP_HOST/);
  assert.match(r.detail, /NOTIFY_EMAIL/);
  assert.doesNotMatch(r.detail, /undefined|\[object/, "must read as instructions, not a dump");
});

test("the test send never throws, whatever the mail server does", async () => {
  const prev = { ...process.env };
  Object.assign(process.env, {
    SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_USER: "u",
    SMTP_PASS: "p", NOTIFY_EMAIL: "someone@example.com",
  });
  try {
    const r = await sendTestEmail();
    assert.equal(r.ok, false);
    assert.ok(r.detail.length > 0, "the provider's own words are what make this fixable");
  } finally {
    for (const k of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "NOTIFY_EMAIL"]) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
});

// ── booking confirmations ──────────────────────────────────────────
// The caller used to leave the call with nothing written down. A Google
// attendee invite is not an option: a service account cannot send one without
// domain-wide delegation, so we attach an .ics instead and send it ourselves.

import { buildIcs, confirmationEmail, type BookingConfirmation } from "../src/notify.js";

const booking: BookingConfirmation = {
  id: "bk_1", name: "Sai", email: "sai@example.com", phone: "925-567-4035",
  service: "Free AI demo & audit",
  startISO: "2026-08-20T18:00:00.000Z", endISO: "2026-08-20T18:30:00.000Z",
};

test("the calendar file carries the real start and end", () => {
  const ics = buildIcs(booking);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTART:20260820T180000Z/);
  assert.match(ics, /DTEND:20260820T183000Z/);
  assert.match(ics, /SUMMARY:Free AI demo & audit/);
});

test("the calendar file uses CRLF, which is what the spec requires", () => {
  // Apple Calendar and Outlook reject LF-only .ics files.
  assert.ok(buildIcs(booking).includes("\r\n"));
});

test("the confirmation states the time in the business's timezone", () => {
  const { subject, text } = confirmationEmail(booking);
  // 18:00 UTC is 2pm in New York — the caller must read their local time.
  assert.match(subject, /2:00 PM/);
  assert.match(text, /Thursday, August 20/);
  assert.match(text, /Sai/);
});

test("the confirmation says how to change the appointment", () => {
  assert.match(confirmationEmail(booking).text, /704/, "a way to reach a human");
});
