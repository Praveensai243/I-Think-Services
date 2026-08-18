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
