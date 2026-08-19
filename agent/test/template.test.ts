import { test } from "node:test";
import assert from "node:assert/strict";

// This product is a TEMPLATE. Selling it to a second business must be a config
// swap — BUSINESS_CONFIG=clients/<slug>.json — and nothing else. Every detail
// that belongs to one business has to come from that file, so this test loads a
// DIFFERENT business and checks that none of ours survives.
//
// config.ts reads the environment once at import time, so the imports here are
// dynamic on purpose: a static one would freeze our own config before the test
// could point at another.

// One config for the whole file: config.ts reads the environment once at import
// time, and a cache-busting query string is not an option here — a URL ending
// in ".json" makes Node's loader treat the module as JSON.
process.env.BUSINESS_CONFIG = "examples/dental.json";

test("a different client's prompt carries none of our details", async () => {
  const { systemPrompt } = await import("../src/prompt.js");
  const p = systemPrompt();
  for (const ours of ["I Think Services", "ithinkservices", "704-387-9775", "santoo", "saipraveen"]) {
    assert.ok(!p.toLowerCase().includes(ours.toLowerCase()), `"${ours}" leaked into a client prompt`);
  }
});

test("the prompt is built from whichever business is configured", async () => {
  const { systemPrompt } = await import("../src/prompt.js");
  const { business } = await import("../src/config.js");
  const p = systemPrompt();
  assert.equal(business.name, "Bright Smile Dental", "the test must actually be running a client config");
  assert.ok(p.includes(business.name), "the business's own name must appear");
  assert.ok(p.includes(business.agentName), "the receptionist's name comes from config too");
  assert.ok(p.includes(business.phoneForHumans), "the human line is the client's, not ours");
});

test("every example client has the fields the prompt needs", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const needed = [
    "name", "industry", "timezone", "phoneForHumans", "greeting", "agentName",
    "hours", "slotMinutes", "services", "faq", "escalation",
  ];
  for (const file of readdirSync("examples").filter((f) => f.endsWith(".json"))) {
    const cfg = JSON.parse(readFileSync(`examples/${file}`, "utf8"));
    for (const key of needed) {
      assert.ok(key in cfg, `examples/${file} is missing "${key}" — onboarding a client would break`);
    }
    assert.ok(cfg.faq.length > 0, `examples/${file} has an empty FAQ`);
  }
});
