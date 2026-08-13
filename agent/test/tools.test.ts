import { test } from "node:test";
import assert from "node:assert/strict";
import { tools, runTool } from "../src/tools.js";

test("end_call is exposed to the model", () => {
  const t = tools.find((x) => x.name === "end_call");
  assert.ok(t, "the agent cannot hang up without this tool");
  // The description drives behavior — it must not read as an escape hatch.
  assert.match(t.description ?? "", /after you have said goodbye/i);
});

test("end_call reports the hang-up action", async () => {
  const out = await runTool("end_call", { reason: "booking confirmed" }, "sess", "phone");
  assert.equal(out.ok, true);
  assert.equal(out.action, "end_call");
  assert.equal(out.reason, "booking confirmed");
});

test("unknown tools fail closed", async () => {
  const out = await runTool("drop_database", {}, "sess", "phone");
  assert.equal(out.ok, false);
});
