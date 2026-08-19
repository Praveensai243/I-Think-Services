import { test } from "node:test";
import assert from "node:assert/strict";
import { transcriptLines, logCallControlDiagnostics } from "../src/server.js";

// The point of this email is to see what a caller actually experienced, with
// the number to ring them back on. A booking that went well and one that went
// in circles look identical in a usage counter.

test("Vapi's own transcript is used when it sends one", () => {
  const lines = transcriptLines({
    artifact: {
      messages: [
        { role: "user", message: "I'd like to book an appointment" },
        { role: "bot", message: "I can do Thursday at two, or Friday at ten." },
        { role: "system", message: "ignore me" },
      ],
    },
  }, "call-a");
  assert.deepEqual(lines, [
    "Caller: I'd like to book an appointment",
    "Charlotte: I can do Thursday at two, or Friday at ten.",
  ]);
});

test("a plain transcript string still becomes lines", () => {
  const lines = transcriptLines({ transcript: "Caller: hello\nCharlotte: hi there" }, "call-b");
  assert.equal(lines.length, 2);
});

test("with nothing from Vapi, our own recorded turns are used", () => {
  logCallControlDiagnostics({ stream: true }, {}, null, "what are your hours?", "Nine to six.", "call-c");
  const lines = transcriptLines({}, "call-c");
  assert.deepEqual(lines, ["Caller: what are your hours?", "Charlotte: Nine to six."]);
});

test("a call with no record anywhere returns nothing, rather than throwing", () => {
  assert.deepEqual(transcriptLines({}, "call-that-never-happened"), []);
});
