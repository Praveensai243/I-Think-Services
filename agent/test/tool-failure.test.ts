import { test } from "node:test";
import assert from "node:assert/strict";

// A live call: the caller confirmed a booking and then heard "I couldn't catch
// that" no matter what they said. Nothing was wrong with their speech — a tool
// threw, the exception escaped the turn, and the agent retried the same failing
// tool on every following thing they said. Tool failures have to be reportable,
// not fatal.
//
// Everything here is imported dynamically ON PURPOSE. config.ts reads the
// environment once at import time, so a static import anywhere in this file
// would freeze SMTP as "unconfigured" before a test could set it — and the
// failing path would never be reached.

test("a confirmation that cannot be built never breaks the booking", async () => {
  process.env.SMTP_HOST = "smtp.invalid";
  process.env.SMTP_USER = "user";
  process.env.SMTP_PASS = "pass";
  process.env.NOTIFY_EMAIL = "team@example.com";
  const { notifyBooking, emailEnabled, buildIcs } = await import("../src/notify.js");
  assert.equal(emailEnabled(), true, "the failing path must actually be reachable");

  const bad = {
    name: "Test Caller",
    email: "someone@example.com",
    phone: "704-555-0000",
    service: "Free AI demo & audit",
    startISO: "not-a-real-date",
    endISO: "also-not-a-date",
    id: "bk_test",
  };

  // Confirm the throw is real, so the test below is not passing by luck.
  assert.throws(() => buildIcs(bad), "expected the .ics builder to reject a bad date");

  // The appointment is already in the calendar by this point. A confirmation
  // that cannot be built must never take the booking — or the turn — down.
  assert.doesNotThrow(() => notifyBooking(bad));
});

test("a bad booking is reported, not thrown", async () => {
  const { runTool } = await import("../src/tools.js");
  const out = await runTool(
    "book_appointment",
    { name: "X", phone: "1", service: "demo", start_iso: "not-a-date" },
    "sess",
    "phone",
  );
  assert.equal(out.ok, false, "a rejected booking must come back as a result");
});

test("an unknown tool fails closed rather than throwing", async () => {
  const { runTool } = await import("../src/tools.js");
  const out = await runTool("no_such_tool", {}, "sess", "phone");
  assert.equal(out.ok, false);
});

test("booking an invalid time returns a reason instead of throwing", async () => {
  const { book } = await import("../src/calendar.js");
  const r = await book({ name: "X", phone: "1", service: "demo", startISO: "nope" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "invalid_time");
});
