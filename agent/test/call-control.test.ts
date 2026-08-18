import { test } from "node:test";
import assert from "node:assert/strict";
import { callControlFor } from "../src/server.js";
import { tools, runTool } from "../src/tools.js";
import { business } from "../src/config.js";
import { getAvailability, book } from "../src/calendar.js";

/** The flag is read per call, so tests can flip it around a single assertion. */
function withCallControl<T>(on: boolean, fn: () => T): T {
  const prev = process.env.VOICE_CALL_CONTROL;
  process.env.VOICE_CALL_CONTROL = on ? "1" : "";
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.VOICE_CALL_CONTROL;
    else process.env.VOICE_CALL_CONTROL = prev;
  }
}

// ── the kill switch ────────────────────────────────────────────────
// This is the whole rollback story for #10-class breakage: with the flag off
// the endpoint must send exactly what it sent before this change.

test("no call control is emitted while the flag is off", () => {
  withCallControl(false, () => {
    assert.equal(callControlFor({ ended: true }), null);
    assert.equal(callControlFor({ transfer: { number: "+17043879775" } }), null);
  });
});

test("an ordinary turn never emits call control, flag on or off", () => {
  for (const on of [true, false]) {
    withCallControl(on, () => {
      assert.equal(callControlFor({}), null, `plain turn leaked control (flag=${on})`);
    });
  }
});

// ── hanging up ─────────────────────────────────────────────────────

test("ending the call asks Vapi to hang up", () => {
  withCallControl(true, () => {
    // The caller's own sign-off is required — see the hang-up guard below.
    const control = callControlFor({ ended: true }, {}, "that's all, thanks — bye");
    assert.equal(control?.function_call.name, "endCall");
  });
});

// ── transferring ───────────────────────────────────────────────────

test("a transfer carries a destination Vapi can dial", () => {
  withCallControl(true, () => {
    const control = callControlFor({ transfer: { number: "+17043879775" } });
    assert.equal(control?.function_call.name, "transferCall");
    assert.ok(control?.function_call.arguments.destination, "destination is required by Vapi");
  });
});

test("Vapi's configured destination wins over our fallback number", () => {
  withCallControl(true, () => {
    const control = callControlFor({ transfer: { number: "+17040000000" } }, { destination: "+19995551234" });
    assert.equal(control?.function_call.arguments.destination, "+19995551234");
  });
});

test("a caller asking for a person is connected, not hung up on", () => {
  withCallControl(true, () => {
    // Both flags set: the agent said goodbye AND asked to transfer. Connecting
    // the caller has to win — hanging up on them is the worse failure.
    const control = callControlFor({ transfer: { number: "+17043879775" }, ended: true });
    assert.equal(control?.function_call.name, "transferCall");
  });
});

// ── the tools behind those decisions ───────────────────────────────

test("end_call is registered and does not fire on its own", async () => {
  assert.ok(tools.find((t) => t.name === "end_call"), "end_call must be callable by the agent");
  const out = await runTool("end_call", { reason: "caller said goodbye" }, "s1", "phone");
  assert.equal(out.ok, true);
});

test("transfer_to_human really connects on the phone, and only offers a number on the web", async () => {
  const phone = await runTool("transfer_to_human", { reason: "asked for a person" }, "s1", "phone");
  assert.equal(phone.action, "connect_to_human");

  const web = await runTool("transfer_to_human", { reason: "asked for a person" }, "s2", "web");
  assert.equal(web.action, "give_number", "there is no live line to transfer in the browser demo");
});

// ── the promise we could not keep ──────────────────────────────────

test("booking never promises a reminder we do not send", async () => {
  const [slot] = await getAvailability({ service: "cleaning" });
  const r = await book({
    name: "Reminder Test", phone: "704-555-0101", service: "cleaning", startISO: slot.startISO,
  });
  assert.equal(r.ok, true);

  const out = await runTool("book_appointment", {
    name: "Reminder Test 2", phone: "704-555-0102", service: "cleaning",
    start_iso: (await getAvailability({ service: "cleaning" }))[0].startISO,
  }, "s1", "phone");

  assert.equal(out.ok, true);
  // No SMS or email exists anywhere in this codebase. Until one does, nothing
  // the agent reads back may tell the caller a reminder is coming.
  assert.equal(
    JSON.stringify(out).toLowerCase().includes("reminder"), false,
    "book_appointment must not mention a reminder while none is sent",
  );
});

// ── the hang-up guard ──────────────────────────────────────────────
// From a live call: the caller asked several questions in a row and the agent
// hung up on them. The prompt already said not to. These lock the behaviour in
// code, where it holds no matter what the model decides.

import { callerIsLeaving } from "../src/server.js";

test("a caller still asking questions is never hung up on", () => {
  withCallControl(true, () => {
    for (const said of [
      "what are your hours?",
      "how much does it cost",
      "can you also do text messages",
      "one more thing — do you work weekends",
      "and what about pricing for a second location",
      "tell me more about the setup fee",
    ]) {
      assert.equal(
        callControlFor({ ended: true }, {}, said), null,
        `hung up on a caller who said: ${said}`,
      );
    }
  });
});

test("a real sign-off does end the call", () => {
  withCallControl(true, () => {
    for (const said of [
      "no thanks, that's all",
      "okay, bye",
      "nothing else, thank you",
      "I'm all set",
      "great, take care",
    ]) {
      const control = callControlFor({ ended: true }, {}, said);
      assert.equal(control?.function_call.name, "endCall", `failed to hang up after: ${said}`);
    }
  });
});

test("silence or an unread turn keeps the line open", () => {
  withCallControl(true, () => {
    assert.equal(callControlFor({ ended: true }, {}, ""), null);
    assert.equal(callControlFor({ ended: true }, {}, "   "), null);
  });
});

test("a polite thanks that is really a question stays on the line", () => {
  // "thanks, and can you also..." reads as a sign-off to a keyword match, but
  // the caller is mid-sentence asking for more.
  assert.equal(callerIsLeaving("thanks, and can you also book me for Tuesday"), false);
});

test("a transfer is never blocked by the hang-up guard", () => {
  withCallControl(true, () => {
    const control = callControlFor({ transfer: { number: "+17043879775" } }, {}, "can I speak to someone?");
    assert.equal(control?.function_call.name, "transferCall");
  });
});

// ── the destination must be dialable ───────────────────────────────
// From a live call: the caller asked for a person and the call ENDED. The
// destination was being sent as "+1 (704) 387-9775" — the spoken form — which
// Vapi cannot dial, and a failed transfer makes Vapi hang up.

import { toE164 } from "../src/server.js";

test("the spoken phone number is converted to something Vapi can dial", () => {
  assert.equal(toE164("+1 (704) 387-9775"), "+17043879775");
  assert.equal(toE164("704-387-9775"), "+17043879775");
  assert.equal(toE164("(704) 387 9775"), "+17043879775");
  assert.equal(toE164("+17043879775"), "+17043879775");
});

test("an undialable destination is refused rather than hung up on", () => {
  for (const bad of ["", "   ", "ask for Dave", "123"]) {
    assert.equal(toE164(bad), null, `should not dial: ${bad}`);
  }
  withCallControl(true, () => {
    assert.equal(
      callControlFor({ transfer: { number: "not a number" } }, {}, "can I speak to someone?"), null,
      "a bad destination must not reach Vapi — it ends the call",
    );
  });
});

test("the business's own configured number transfers cleanly", () => {
  withCallControl(true, () => {
    const control = callControlFor({ transfer: { number: business.phoneForHumans } }, {}, "get me a person");
    assert.equal(control?.function_call.name, "transferCall");
    assert.match(String(control?.function_call.arguments.destination), /^\+\d{11,15}$/);
  });
});

test("Vapi's own destination object shape is understood", () => {
  withCallControl(true, () => {
    const control = callControlFor(
      { transfer: { number: "+17040000000" } },
      { destination: { type: "number", number: "+1 (999) 555-1234" } },
      "transfer me",
    );
    assert.equal(control?.function_call.arguments.destination, "+19995551234");
  });
});

// ── frame ordering ─────────────────────────────────────────────────
// The control frame must REPLACE the stop, never follow it. Sending stop first
// declares the turn finished and then keeps writing; when Vapi errors on that
// it ends the call, which sounds exactly like a working hang-up. That
// ambiguity is why the broken transfer survived two rounds of debugging.

import { sseFrames } from "../src/server.js";

const base = { id: "chatcmpl-1", created: 1, model: "gpt-4o", reply: "Sure thing." };

test("an ordinary turn ends with stop, exactly as before", () => {
  const f = sseFrames({ ...base, control: null });
  assert.equal(f.length, 3);
  assert.match(f[0], /"content":"Sure thing\."/);
  assert.match(f[1], /"finish_reason":"stop"/);
  assert.equal(f[2], "data: [DONE]\n\n");
});

test("a control frame replaces the stop instead of following it", () => {
  const f = sseFrames({ ...base, control: { function_call: { name: "endCall", arguments: {} } } });
  const body = f.join("");
  assert.match(body, /"function_call"/);
  assert.doesNotMatch(body, /"finish_reason":"stop"/, "stop must not accompany a control frame");
});

test("the spoken reply is always sent before the line is moved", () => {
  const f = sseFrames({
    ...base, reply: "Putting you through now.",
    control: { function_call: { name: "transferCall", arguments: { destination: "+17043879775" } } },
  });
  assert.match(f[0], /Putting you through now\./);
  assert.match(f[1], /transferCall/);
  assert.equal(f[2], "data: [DONE]\n\n");
});

// ── the diagnostics trail ──────────────────────────────────────────
// Built because this bug is invisible from both ends: a caller cannot tell a
// broken Vapi payload from a deliberate hang-up, and asking someone to search
// a host log viewer mid-debugging did not produce an answer twice running.

import { logCallControlDiagnostics } from "../src/server.js";
import { getCallEvents } from "../src/diag.js";

test("every turn is recorded, not only ones that move the line", () => {
  const before = getCallEvents().length;
  logCallControlDiagnostics({ stream: true }, {}, null, "what are your hours?", "We're open nine to six.", "call-1");
  const events = getCallEvents();
  assert.equal(events.length, before + 1, "an ordinary turn must still leave a trace");
  assert.equal(events[0].callerSaid, "what are your hours?");
  assert.equal(events[0].sentToVapi, null);
});

test("the trail captures the tools Vapi declares, which is the decisive field", () => {
  logCallControlDiagnostics(
    { stream: true, tools: [{ type: "endCall" }, { type: "transferCall" }], destination: "+19995551234" },
    { transfer: { number: "+17043879775" } },
    { function_call: { name: "transferCall", arguments: { destination: "+19995551234" } } },
    "get me a person", "Putting you through.", "call-2",
  );
  const e = getCallEvents()[0];
  assert.deepEqual(e.toolsFromVapi, ["endCall", "transferCall"]);
  assert.equal(e.destinationFromVapi, "+19995551234");
  assert.equal(e.decided.transfer, "+17043879775");
});

test("an assistant with no tools configured is visible in the trail", () => {
  // The case we cannot currently rule out: Vapi sends no tools, so endCall and
  // transferCall were never set up and no code change can make them work.
  logCallControlDiagnostics({ stream: true }, { ended: true }, null, "bye", "Take care!", "call-3");
  assert.deepEqual(getCallEvents()[0].toolsFromVapi, []);
});

test("the trail is capped so a long call cannot grow it without bound", () => {
  for (let i = 0; i < 60; i++) {
    logCallControlDiagnostics({ stream: true }, {}, null, `turn ${i}`, "ok", "call-4");
  }
  assert.ok(getCallEvents().length <= 50, "ring buffer must stay bounded");
});

// ── telling the failures apart ─────────────────────────────────────
// "count: 0" had several possible meanings and the endpoint could not
// distinguish them, which is why three debugging rounds produced no answer.

import { diagnose } from "../src/server.js";

test("no requests at all points at the Vapi assistant, not at this code", () => {
  const d = diagnose(0, { hits: 0, authRejected: 0 });
  assert.match(d, /not pointed at this server/);
  assert.match(d, /Custom LLM/);
});

test("every request rejected points at the shared secret", () => {
  const d = diagnose(0, { hits: 7, authRejected: 7 });
  assert.match(d, /VAPI_SECRET/);
});

test("requests arriving but no turns completing points at a thrown error", () => {
  const d = diagnose(0, { hits: 5, authRejected: 0 });
  assert.match(d, /custom-llm error/);
});

test("healthy traffic sends the reader to the tool list", () => {
  const d = diagnose(12, { hits: 12, authRejected: 0 });
  assert.match(d, /toolsFromVapi/);
});
