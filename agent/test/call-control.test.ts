import { test } from "node:test";
import assert from "node:assert/strict";
import { callControlFor } from "../src/server.js";
import { tools, runTool } from "../src/tools.js";
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
    const control = callControlFor({ ended: true });
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
