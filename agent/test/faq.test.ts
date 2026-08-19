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
  assert.match(p, /never make the caller repeat a whole number twice/i);
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
  assert.match(p, /TWO halves/);
  assert.match(p, /gmail dot com/);
  assert.match(p, /after two tries, STOP/i);
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
