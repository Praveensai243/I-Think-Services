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
  // Shape-agnostic: whichever framing is in use, a turn that moves the line
  // must never also declare itself finished with a plain stop.
  const f = sseFrames({ ...base, control: { function_call: { name: "endCall", arguments: {} } } });
  const body = f.join("");
  assert.match(body, /endCall/);
  assert.doesNotMatch(body, /"finish_reason":"stop"/, "stop must not accompany a control frame");
});

test("when we do speak on a control turn, the words come before the control", () => {
  // Hanging up is the case where this matters: the farewell has to reach the
  // caller before the line closes, and only we can say it. (A transfer sends
  // no text of ours at all — Vapi speaks that line. See the transfer tests.)
  const f = sseFrames({
    ...base, reply: "Thanks for calling — take care!",
    control: { function_call: { name: "end_call_tool", arguments: {} } },
  });
  assert.match(f[0], /Thanks for calling/, "the farewell must be spoken first");
  assert.ok(f.slice(1).some((x) => x.includes("end_call_tool")), "the control must follow the words");
  assert.equal(f.at(-1), "data: [DONE]\n\n");
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

import { diagnose, createServer } from "../src/server.js";

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

// ── the misconfigured Custom LLM URL ───────────────────────────────
// The real cause of "requestsToThisEndpoint: 0". Vapi appends /chat/completions
// to whatever base URL you give it, so pasting the full endpoint path makes it
// call /api/vapi/chat/completions/chat/completions — a 404 that never reaches
// any handler, leaving the backend looking idle while every call fails.

test("a doubled path is named as the cause, not reported as silence", () => {
  const d = diagnose(0, {
    hits: 0, authRejected: 0,
    wrongPaths: ["/api/vapi/chat/completions/chat/completions"],
  });
  assert.match(d, /wrong path/);
  assert.match(d, /BASE url/);
  assert.doesNotMatch(d, /not pointed at this server/, "wrong path is a different fault from no traffic");
});

test("genuinely no traffic still reads as a misconfigured assistant", () => {
  const d = diagnose(0, { hits: 0, authRejected: 0, wrongPaths: [] });
  assert.match(d, /not pointed at this server/);
});

test("an unknown /api/vapi path returns a hint instead of a bare 404", async () => {
  const server = createServer().listen(0);
  await new Promise((r) => server.once("listening", r));
  const port = (server.address() as { port: number }).port;
  const res = await fetch(`http://127.0.0.1:${port}/api/vapi/chat/completions/chat/completions`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  });
  const body = await res.json() as any;
  server.close();

  assert.equal(res.status, 404);
  assert.match(body.hint, /base URL/i);
  assert.equal(body.youCalled, "/api/vapi/chat/completions/chat/completions");
});

// ── stalling a caller who wants a person ───────────────────────────
// From the first call that actually reached this backend: the caller asked to
// be transferred four times while the agent kept qualifying them. Being
// helpful first is right; using it to stall someone is how you lose the call.

import { callerInsistsOnHuman } from "../src/server.js";

const user = (content: string) => ({ role: "user", content });
const bot = (content: string) => ({ role: "assistant", content });

test("one request for a person is not yet insistence", () => {
  assert.equal(callerInsistsOnHuman([user("can you transfer me to someone?")]), false,
    "a single ask leaves room for one clarifying question");
});

test("asking twice forces the transfer", () => {
  // The real transcript, condensed.
  const history = [
    user("Hey. Hi. Can you please transfer the call to someone?"),
    bot("Of course! Can you tell me what's going on?"),
    user("I need some help with a HVAC business."),
    bot("Before I transfer you, what specific question do you have?"),
    user("I have some customer requirements. So I'd like to speak to someone."),
  ];
  assert.equal(callerInsistsOnHuman(history), true);
});

test("the forced transfer produces a real dialable control", () => {
  withCallControl(true, () => {
    const control = callControlFor(
      { transfer: { number: business.phoneForHumans } }, {}, "please transfer the call",
    );
    assert.equal(control?.function_call.name, "transferCall");
    assert.match(String(control?.function_call.arguments.destination), /^\+\d{11,15}$/);
  });
});

test("ordinary conversation is never mistaken for wanting a human", () => {
  const history = [
    user("do you have someone available Tuesday?"),
    bot("Let me check."),
    user("what does a real receptionist cost by comparison?"),
  ];
  assert.equal(callerInsistsOnHuman(history), false,
    "these mention people but are not requests to be transferred");
});

// ── the shape Vapi actually parses ─────────────────────────────────
// Vapi hands us its built-ins as OpenAI function definitions
// ({type:"function",function:{name:"transferCall"}}), so the reply it parses
// for is the ordinary OpenAI tool call, not the bare function_call frame from
// the proxy example in their docs. Kept switchable by env because a live call
// is the only thing that can settle it.

function withShape<T>(shape: string, fn: () => T): T {
  const prev = process.env.VAPI_CONTROL_SHAPE;
  process.env.VAPI_CONTROL_SHAPE = shape;
  try { return fn(); } finally {
    if (prev === undefined) delete process.env.VAPI_CONTROL_SHAPE;
    else process.env.VAPI_CONTROL_SHAPE = prev;
  }
}

const transfer = {
  function_call: { name: "transferCall", arguments: { destination: "+17043879775" } },
};

test("by default a transfer is an ordinary OpenAI tool call", () => {
  withShape("", () => {
    const body = sseFrames({ ...base, control: transfer }).join("");
    assert.match(body, /"tool_calls"/);
    assert.match(body, /"finish_reason":"tool_calls"/);
    assert.match(body, /"name":"transferCall"/);
  });
});

test("tool call arguments are a JSON string, as OpenAI specifies", () => {
  withShape("", () => {
    const frames = sseFrames({ ...base, control: transfer });
    const toolFrame = frames.find((f) => f.includes("tool_calls") && f.includes("transferCall"))!;
    const parsed = JSON.parse(toolFrame.replace(/^data: /, ""));
    const args = parsed.choices[0].delta.tool_calls[0].function.arguments;
    assert.equal(typeof args, "string", "arguments must be a string, not an object");
    assert.deepEqual(JSON.parse(args), { destination: "+17043879775" });
  });
});

test("the old bare frame is still reachable without a deploy", () => {
  withShape("function_call", () => {
    const body = sseFrames({ ...base, control: transfer }).join("");
    assert.match(body, /"function_call"/);
    assert.doesNotMatch(body, /"tool_calls"/);
  });
});

test("an ordinary turn is unaffected by the shape setting", () => {
  for (const shape of ["", "function_call", "tool_calls"]) {
    withShape(shape, () => {
      const body = sseFrames({ ...base, control: null }).join("");
      assert.match(body, /"finish_reason":"stop"/);
      assert.doesNotMatch(body, /tool_calls|function_call/);
    });
  }
});

// ── matching the name Vapi actually declared ───────────────────────
// From the dashboard: the tools are named "transfer_call_tool" and
// "end_call_tool", not "transferCall" and "endCall". We were emitting the
// canonical names, which matched nothing Vapi had.

import { vapiToolName } from "../src/server.js";

const asDeclared = {
  tools: [
    { type: "function", function: { name: "google_calendar_tool" } },
    { type: "function", function: { name: "transfer_call_tool" } },
    { type: "function", function: { name: "end_call_tool" } },
  ],
};

test("the dashboard's own tool names are used, not the canonical ones", () => {
  assert.equal(vapiToolName(asDeclared, "transferCall"), "transfer_call_tool");
  assert.equal(vapiToolName(asDeclared, "endCall"), "end_call_tool");
});

test("canonical names still match when that is what Vapi sent", () => {
  const canonical = {
    tools: [
      { type: "function", function: { name: "transferCall" } },
      { type: "function", function: { name: "endCall" } },
    ],
  };
  assert.equal(vapiToolName(canonical, "transferCall"), "transferCall");
  assert.equal(vapiToolName(canonical, "endCall"), "endCall");
});

test("with no tools declared we fall back to the canonical name", () => {
  assert.equal(vapiToolName({}, "transferCall"), "transferCall");
  assert.equal(vapiToolName({ tools: [] }, "endCall"), "endCall");
});

test("an unrelated tool is never mistaken for a call control", () => {
  const onlyCalendar = { tools: [{ type: "function", function: { name: "google_calendar_tool" } }] };
  assert.equal(vapiToolName(onlyCalendar, "transferCall"), "transferCall", "falls back, not the calendar");
  assert.equal(vapiToolName(onlyCalendar, "endCall"), "endCall");
});

test("the emitted transfer carries the declared name end to end", () => {
  withCallControl(true, () => {
    const control = callControlFor(
      { transfer: { number: "+17043879775" } }, asDeclared, "please transfer me",
    );
    assert.equal(control?.function_call.name, "transfer_call_tool");
    const body = sseFrames({ ...base, control }).join("");
    assert.match(body, /"name":"transfer_call_tool"/);
  });
});

// ── a call cannot be transferred to its own line ───────────────────
// Suspected cause of the transfer that keeps ending the call: the business
// number on the marketing site is also the number the assistant answers, so
// transferring to it hands the call back to itself. Vapi answers a failed
// transfer by ending the call, so this looks exactly like a hang-up.

test("transferring to the number the caller dialled is refused", () => {
  withCallControl(true, () => {
    const control = callControlFor(
      { transfer: { number: "+17043879775" } }, {}, "get me a person",
      { dialedNumber: "+1 (704) 387-9775" },
    );
    assert.equal(control, null, "a line cannot be transferred to itself");
  });
});

test("transferring a caller back to their own handset is refused", () => {
  withCallControl(true, () => {
    const control = callControlFor(
      { transfer: { number: "+19995551234" } }, {}, "transfer me",
      { callerPhone: "+19995551234" },
    );
    assert.equal(control, null);
  });
});

test("a different destination transfers normally", () => {
  withCallControl(true, () => {
    const control = callControlFor(
      { transfer: { number: "+19995551234" } }, {}, "transfer me",
      { dialedNumber: "+17043879775", callerPhone: "+18885550000" },
    );
    assert.equal(control?.function_call.arguments.destination, "+19995551234");
  });
});

test("the self-transfer check compares numbers, not their formatting", () => {
  withCallControl(true, () => {
    // Same line, written three ways — all must be caught.
    for (const dialed of ["704-387-9775", "(704) 387 9775", "+1 704 387 9775"]) {
      assert.equal(
        callControlFor({ transfer: { number: "+17043879775" } }, {}, "transfer me", { dialedNumber: dialed }),
        null, `missed self-transfer for: ${dialed}`,
      );
    }
  });
});

// ── a transfer turn carries no competing text ──────────────────────
// Live call: Vapi accepted a correctly named tool call sent alongside a spoken
// reply and silently did nothing. The caller heard "putting you through", then
// asked "are you there?". A message carrying content reads as a finished
// answer to many OpenAI-compatible parsers, which then never look at its
// tool_calls.

function withSpeaks<T>(who: string, fn: () => T): T {
  const prev = process.env.VAPI_CONTROL_SPEAKS;
  process.env.VAPI_CONTROL_SPEAKS = who;
  try { return fn(); } finally {
    if (prev === undefined) delete process.env.VAPI_CONTROL_SPEAKS;
    else process.env.VAPI_CONTROL_SPEAKS = prev;
  }
}

const transferControl = {
  function_call: { name: "transfer_call_tool", arguments: { destination: "+17043879775" } },
};

test("a transfer sends the tool call with no text of our own", () => {
  withSpeaks("", () => {
    const body = sseFrames({ ...base, reply: "I'm putting you through.", control: transferControl }).join("");
    assert.match(body, /transfer_call_tool/);
    assert.doesNotMatch(body, /putting you through/, "Vapi speaks this via Message to Customer");
  });
});

test("hanging up still speaks the farewell, which only we can say", () => {
  withSpeaks("", () => {
    const body = sseFrames({
      ...base, reply: "Thanks for calling — take care!",
      control: { function_call: { name: "end_call_tool", arguments: {} } },
    }).join("");
    assert.match(body, /Thanks for calling/, "there is no Vapi field for the farewell");
    assert.match(body, /end_call_tool/);
  });
});

test("the spoken reply can be restored without a deploy", () => {
  withSpeaks("agent", () => {
    const body = sseFrames({ ...base, reply: "I'm putting you through.", control: transferControl }).join("");
    assert.match(body, /putting you through/);
    assert.match(body, /transfer_call_tool/);
  });
});

test("an ordinary turn always speaks, whoever is set to speak on control", () => {
  for (const who of ["", "vapi", "agent"]) {
    withSpeaks(who, () => {
      const body = sseFrames({ ...base, reply: "We're open nine to six.", control: null }).join("");
      assert.match(body, /nine to six/);
      assert.match(body, /"finish_reason":"stop"/);
    });
  }
});
