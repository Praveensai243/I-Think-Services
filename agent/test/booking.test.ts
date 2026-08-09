import { test } from "node:test";
import assert from "node:assert/strict";
import { getAvailability, book } from "../src/calendar.js";

test("availability returns real, future slots", async () => {
  const slots = await getAvailability({ service: "cleaning" });
  assert.ok(slots.length > 0, "expected at least one open slot");
  for (const s of slots) {
    assert.ok(Date.parse(s.startISO) > Date.now(), "slot must be in the future");
    assert.match(s.label, /\w+ \d/); // e.g. "Thursday 2:00 PM"
  }
});

test("booking succeeds and then blocks the same slot", async () => {
  const [slot] = await getAvailability({ service: "cleaning" });
  assert.ok(slot, "need a slot to book");

  const first = await book({
    name: "Test Caller", phone: "704-555-0000", service: "cleaning", startISO: slot.startISO,
  });
  assert.equal(first.ok, true);
  assert.ok(first.booking?.id);

  const second = await book({
    name: "Second Caller", phone: "704-555-1111", service: "cleaning", startISO: slot.startISO,
  });
  assert.equal(second.ok, false);
  assert.equal(second.reason, "slot_taken");
});

test("invalid time is rejected", async () => {
  const r = await book({ name: "X", phone: "1", service: "cleaning", startISO: "not-a-date" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "invalid_time");
});
