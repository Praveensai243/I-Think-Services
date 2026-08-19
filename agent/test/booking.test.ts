import { test } from "node:test";
import assert from "node:assert/strict";
import { getAvailability, book, reschedule } from "../src/calendar.js";

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

test("reschedule moves the appointment and frees the old slot", async () => {
  const [from, to] = await getAvailability({ service: "demo" });
  assert.ok(from && to, "need two open slots");
  const booked = await book({
    name: "Mover", phone: "704-555-5555", service: "demo", startISO: from.startISO,
  });
  assert.equal(booked.ok, true);

  const moved = await reschedule({ phone: "704-555-5555", newStartISO: to.startISO });
  assert.equal(moved.ok, true);
  assert.equal(moved.booking?.startISO, to.startISO);

  // the vacated time is bookable again
  const reuse = await book({
    name: "Late Comer", phone: "704-555-6666", service: "demo", startISO: from.startISO,
  });
  assert.equal(reuse.ok, true);
});

test("reschedule to a partially overlapping time is not self-blocked", async () => {
  const [from] = await getAvailability({ service: "demo" });
  assert.ok(from, "need an open slot");
  await book({
    name: "Shifter", phone: "704-555-7777", service: "demo", startISO: from.startISO,
  });
  // 15 minutes later overlaps the caller's own appointment — that must not count
  // as a conflict with itself.
  const shifted = new Date(Date.parse(from.startISO) + 15 * 60000).toISOString();
  const moved = await reschedule({ phone: "704-555-7777", newStartISO: shifted });
  assert.equal(moved.ok, true, moved.reason);
  assert.equal(moved.booking?.startISO, shifted);
});

test("a rejected reschedule keeps the original appointment", async () => {
  const [from, taken] = await getAvailability({ service: "demo" });
  assert.ok(from && taken, "need two open slots");
  await book({
    name: "Original", phone: "704-555-2222", service: "demo", startISO: from.startISO,
  });
  await book({
    name: "Blocker", phone: "704-555-3333", service: "demo", startISO: taken.startISO,
  });

  const moved = await reschedule({ phone: "704-555-2222", newStartISO: taken.startISO });
  assert.equal(moved.ok, false);
  assert.equal(moved.reason, "slot_taken");

  // The original must survive a failed move — if anyone else can claim that time,
  // the caller silently lost their appointment.
  const steal = await book({
    name: "Someone Else", phone: "704-555-4444", service: "demo", startISO: from.startISO,
  });
  assert.equal(steal.ok, false, "failed reschedule destroyed the original appointment");
  assert.equal(steal.reason, "slot_taken");
});

// ── correcting an email must not fight the booking it just made ────
// A live call: the caller gave their email, the agent read it back, the caller
// corrected it — and the line went quiet. The prompt tells the agent to re-book
// with the SAME time when an address is fixed, and the free/busy check then saw
// the appointment made seconds earlier and reported the slot as taken. The
// agent went hunting for another time while the caller heard nothing.

test("re-booking the same caller at the same time returns their appointment, not a clash", async () => {
  const slots = await getAvailability({ service: "cleaning" });
  const slot = slots[slots.length - 1];
  assert.ok(slot, "need a free slot to book");
  const details = {
    name: "Sai Praveen", phone: "704-555-0142",
    service: "cleaning", startISO: slot.startISO,
  };

  const first = await book(details);
  assert.equal(first.ok, true, "the first booking must succeed for this test to mean anything");

  // The caller corrected their email, so the agent books once more — same time.
  const second = await book(details);
  assert.equal(second.ok, true, "a correction is not a double booking");
  assert.equal(second.booking?.startISO, first.booking?.startISO, "same slot, same appointment");
  assert.notEqual(second.reason, "slot_taken");
});
