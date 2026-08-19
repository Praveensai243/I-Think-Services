import { test } from "node:test";
import assert from "node:assert/strict";
import { installCrashGuards, reportSurvived } from "../src/crash.js";

// A live call on 2026-08-19: the caller booked a time, confirmed it, and then
// heard a canned "I couldn't catch that" on every turn afterwards. The Render
// service is on Starter, which never sleeps, so it did not idle out — it
// crashed and restarted mid-call, taking the diagnostics trail with it.
//
// Node exits on an unhandled promise rejection when nothing is listening, and
// Express 4 turns any async throw in a route into exactly that. One stray error
// therefore ends every call in progress at once. For a phone line, staying up
// beats dying tidily.
//
// Neither test throws a real unhandled rejection: node:test installs its own
// listener and fails any test that sees one, which would hide the behaviour
// being asserted. What matters is that OUR listener exists — that alone is
// what stops Node exiting — and that it names the cause in the log.

test("a listener is installed, which is what stops Node exiting", () => {
  installCrashGuards();
  assert.ok(
    process.listenerCount("unhandledRejection") > 0,
    "with no listener Node exits the process on the first unhandled rejection",
  );
  assert.ok(
    process.listenerCount("uncaughtException") > 0,
    "an async throw in an Express 4 route arrives here",
  );
});

test("the guard logs the failure instead of swallowing it", () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { errors.push(args.map(String).join(" ")); };
  try {
    // A real one from this codebase: SMTP giving up after the appointment is
    // already in the calendar.
    reportSurvived("UNHANDLED REJECTION", new Error("smtp timed out"));
  } finally {
    console.error = original;
  }
  assert.ok(
    errors.some((e) => e.includes("smtp timed out")),
    "a swallowed crash with no log is worse than the crash",
  );
});
