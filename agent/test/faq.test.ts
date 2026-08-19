import { test } from "node:test";
import assert from "node:assert/strict";
import { tools } from "../src/tools.js";
import { systemPrompt } from "../src/prompt.js";
import { business } from "../src/config.js";

test("every FAQ answer is in the prompt", () => {
  const p = systemPrompt();
  for (const f of business.faq) {
    assert.ok(
      p.includes(f.a),
      `FAQ "${f.q}" is missing from the prompt — the agent cannot answer it`,
    );
  }
});

test("no FAQ lookup tool — the knowledge is inline", () => {
  // A tool round trip on every factual question is latency the caller hears.
  assert.equal(tools.find((t) => t.name === "answer_faq"), undefined);
});

test("booking tools survive", () => {
  for (const name of [
    "check_availability", "book_appointment", "reschedule_appointment",
    "cancel_appointment", "take_message", "transfer_to_human",
  ]) {
    assert.ok(tools.find((t) => t.name === name), `missing tool: ${name}`);
  }
});

test("caller ID is offered back instead of asking for digits", () => {
  const withId = systemPrompt({ callerPhone: "+17045551234" });
  assert.match(withId, /\+17045551234/);
  assert.match(withId, /best number/i);
  assert.doesNotMatch(systemPrompt(), /\+1704555/);
});

test("digits are taken in chunks, never re-read whole", () => {
  const p = systemPrompt();
  assert.match(p, /chunks/i);
  assert.match(p, /never make a caller repeat a whole number twice/i);
});

test("prompt reflects the client's own topics, not clinic assumptions", () => {
  const p = systemPrompt();
  assert.match(p, /pricing/);
  assert.doesNotMatch(p, /parking/i);
});

test("the objective gives the call a purpose", () => {
  assert.ok(business.objective, "I Think Services should have an objective set");
  assert.match(systemPrompt(), /free AI demo and audit/);
});

// The whole FAQ ships inside the system prompt on EVERY turn, so its size is
// paid for in latency on every single thing the caller says. This is a budget,
// not a limit on knowledge: if it trips, tighten wording or merge overlapping
// entries rather than raising the number without a thought about the caller.
// Currently ~3.4k. The ceiling is set for headroom, not to rubber-stamp
// whatever happens to be here — it should catch a careless doubling.
test("the system prompt stays inside its latency budget", () => {
  const approxTokens = systemPrompt().length / 4;
  assert.ok(
    approxTokens < 4000,
    `system prompt is ~${Math.round(approxTokens)} tokens; every turn pays for this`,
  );
});

// Emails are the worst thing to take by ear: spoken letters sound alike and a
// wrong one fails silently — the caller just never gets the confirmation.
test("email capture has a give-up rule", () => {
  const p = systemPrompt();
  // Read-backs are GONE, not merely limited. A live call spent 100 seconds of
  // a 3-minute call spelling one address, because every read-back invited
  // another correction. The appointment is already made by then and we already
  // have the caller's phone number, so a wrong address costs nothing and a
  // confirmation loop costs the call.
  assert.match(p, /ONE pass, NO read-back/i);
  assert.match(p, /Do NOT read the address back/i);
  assert.match(p, /if it bounces/i);
});

// Without the current date the agent cannot resolve "tomorrow" or "next
// Tuesday" and falls back on its training's idea of today, which is wrong.
// Every date mix-up reported from a live call traced back to this line missing.
test("the prompt states the current date", () => {
  const p = systemPrompt();
  const today = new Intl.DateTimeFormat("en-US", {
    timeZone: business.timezone, weekday: "long", month: "long", day: "numeric",
  }).format(new Date());
  assert.ok(p.includes(today), `prompt must name today (${today}) — it does not`);
  assert.match(p, /never from anything you think you know about the date/i);
});

// A live call: the caller spelled the email out, the agent read it back
// correctly, then booked an earlier wrong version it was still holding. The
// last confirmed value has to win, and the booked address has to be spoken so
// a wrong one is caught while the caller is still on the line.
test("a correction overrides earlier attempts", () => {
  const p = systemPrompt();
  assert.match(p, /use their LAST version/i);
  // A mis-heard letter now arrives as a DIGIT, so the rule has to name that:
  // "o as in Oscar" never helped, because the damage was already in the text.
  assert.match(p, /digit inside a spelled name is a LETTER/i);
});

// ── the half we cache must never move ──────────────────────────────
// Prompt caching is a prefix match: one changed byte anywhere invalidates the
// whole thing. The clock line changes every minute and the caller's number
// changes every call, so while those sat in the middle of the prompt nothing
// in it could be cached — including the 38-entry FAQ we resend on every single
// turn. They now live in a separate block that goes AFTER the cache point.

import { systemPromptStable, systemPromptLive } from "../src/prompt.js";

test("the cached half is identical for different callers", () => {
  assert.equal(systemPromptStable(), systemPromptStable());
  assert.doesNotMatch(systemPromptStable(), /\+1704555/);
});

test("the cached half holds nothing that changes by the minute", () => {
  const stable = systemPromptStable();
  assert.doesNotMatch(stable, /\b\d{1,2}:\d{2}\s?(AM|PM)\b/i, "a clock in here kills every cache hit");
  assert.doesNotMatch(stable, new RegExp(String(new Date().getFullYear())), "and so does today's date");
});

test("the live half still tells the agent the date and who is calling", () => {
  const live = systemPromptLive({ callerPhone: "+17045551234" });
  assert.match(live, new RegExp(String(new Date().getFullYear())));
  assert.match(live, /\+17045551234/);
});

test("the FAQ is in the cached half, since it is what makes caching worth doing", () => {
  assert.match(systemPromptStable(), /pricing/i);
  assert.ok(systemPromptStable().length > systemPromptLive().length * 10);
});
