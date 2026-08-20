import { test } from "node:test";
import assert from "node:assert/strict";

// The one thing a business needs from a booking is WHO TO RING. The team used
// to be CC'd on the caller's own confirmation — "Hi Sai, you're booked for…" —
// which carries no phone number, so whenever a caller gave an email address the
// lead reached the inbox with the callback number missing.
//
// Imports are dynamic: config.ts reads the environment once at import time, so
// a static import would freeze SMTP as "unconfigured" before these can set it.

// notify.ts creates its transport once and caches it, so the stub goes in ONCE
// and every test reads the same outbox — clearing it rather than re-stubbing.
const sent: any[] = [];

async function outbox(): Promise<(b: any) => void> {
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_USER = "user";
  process.env.SMTP_PASS = "pass";
  process.env.SMTP_FROM = "desk@example.com";
  process.env.NOTIFY_EMAIL = "team@example.com";
  const nodemailer = (await import("nodemailer")).default;
  // Stand in for the transport so nothing leaves the machine.
  (nodemailer as any).createTransport = () => ({
    sendMail: (opts: any) => { sent.push(opts); return Promise.resolve({}); },
  });
  const { notifyBooking } = await import("../src/notify.js");
  sent.length = 0;
  return notifyBooking;
}

const booking = {
  name: "Sai Praveen", email: "someone@example.com", phone: "704-555-0142",
  service: "Free AI demo & audit", id: "bk_lead",
  startISO: new Date(Date.now() + 86_400_000).toISOString(),
  endISO: new Date(Date.now() + 88_200_000).toISOString(),
};

test("the team gets the caller's number even when the caller gave an email", async () => {
  const notifyBooking = await outbox();
  notifyBooking(booking);
  await new Promise((r) => setTimeout(r, 20));

  const toTeam = sent.find((m) => m.to === "team@example.com");
  assert.ok(toTeam, "the team must always get its own copy, not a CC of the receipt");
  assert.match(toTeam.subject, /New booking/);
  assert.match(toTeam.subject, /704-555-0142/, "the number belongs in the subject — readable from a lock screen");
  assert.match(toTeam.text, /Sai Praveen/);
  assert.match(toTeam.text, /someone@example\.com/);
});

test("the caller still gets their own confirmation, addressed to them", async () => {
  const notifyBooking = await outbox();
  notifyBooking(booking);
  await new Promise((r) => setTimeout(r, 20));

  const toCaller = sent.find((m) => m.to === "someone@example.com");
  assert.ok(toCaller, "the caller's confirmation must still go out");
  assert.ok(toCaller.attachments?.length, "with the calendar file attached");
});

test("no email address still reaches the team with everything else", async () => {
  const notifyBooking = await outbox();
  notifyBooking({ ...booking, email: undefined });
  await new Promise((r) => setTimeout(r, 20));

  const toTeam = sent.find((m) => m.to === "team@example.com");
  assert.ok(toTeam);
  assert.match(toTeam.text, /704-555-0142/);
  assert.match(toTeam.text, /not given/, "the team needs to know the caller has nothing in writing");
  assert.equal(sent.filter((m) => m.to === "someone@example.com").length, 0);
});
