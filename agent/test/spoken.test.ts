import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSpokenEmail, repairSpelledWord, decodePhonetic } from "../src/spoken.js";
import { confirmWording } from "../src/tools.js";

// A live call: the caller spelled "santoo" and the transcript said "sant0o" —
// a zero, because a spoken "oh" is a digit as often as a letter. The agent read
// back an address the caller had never said, the caller corrected it, and the
// same thing happened on the next pass. The call ended in that loop.

test("a zero wedged inside a spelled word is the letter o", () => {
  assert.equal(normalizeSpokenEmail("sant0o.saipraveen@gmail.com"), "santoo.saipraveen@gmail.com");
  assert.equal(repairSpelledWord("sant0o"), "santoo");
});

test("digits the caller actually meant are left alone", () => {
  // The real risk of a repair like this: inventing an address nobody owns.
  assert.equal(normalizeSpokenEmail("praveensai243@gmail.com"), "praveensai243@gmail.com");
  assert.equal(normalizeSpokenEmail("user2020@gmail.com"), "user2020@gmail.com");
  assert.equal(repairSpelledWord("abc123"), "abc123");
});

test("the domain is never repaired", () => {
  assert.equal(normalizeSpokenEmail("someone@h0tmail.com"), "someone@h0tmail.com");
});

test("spoken 'at' and 'dot' and spelled-out spacing become an address", () => {
  assert.equal(normalizeSpokenEmail("santoo at gmail dot com"), "santoo@gmail.com");
  assert.equal(normalizeSpokenEmail("S A N T O O @ Gmail.com"), "santoo@gmail.com");
});

// ── the confirmation loop ──────────────────────────────────────────
// Reading the address back is worth doing once. Doing it again invites another
// correction, and the caller is stuck confirming an appointment that is already
// booked.

test("booking without an email asks for one, once, after the fact", () => {
  const w = confirmWording(0);
  assert.match(w, /Booked/);
  assert.match(w, /once/i);
});

test("the first address given is read back", () => {
  assert.match(confirmWording(1, "santoo@gmail.com"), /say out loud/);
});

test("a second address must not be read back again", () => {
  const w = confirmWording(2, "santoo@gmail.com");
  assert.match(w, /do NOT spell the address out again/);
  assert.match(w, /confirm by phone/, "there has to be a way out that is not another read-back");
});

// ── spelling with words ────────────────────────────────────────────
// From a live call: "It's a sand alpha Nancy tango Oscar Oscar dot Sam alpha
// indigo Paul Romeo Victor echo…". The caller spelled the whole address in the
// phonetic alphabet, mixing NATO and the police one, and the agent guessed at
// it for a hundred seconds — "antoo", "saitraveen", "saipraviep".

test("a run of phonetic words becomes the letters they stand for", () => {
  assert.equal(decodePhonetic("Sam alpha Nancy tango Oscar Oscar"), "santoo");
  assert.equal(normalizeSpokenEmail("Sam alpha Nancy tango Oscar Oscar at gmail dot com"), "santoo@gmail.com");
});

test("one phonetic word on its own is a word, not spelling", () => {
  // Real addresses contain these. Three in a row is someone spelling; one is a
  // name, and rewriting it would invent an address nobody owns.
  assert.equal(decodePhonetic("oscar"), "oscar");
  assert.equal(normalizeSpokenEmail("oscar.romeo@gmail.com"), "oscar.romeo@gmail.com");
});

test("the domain survives a decoded local part", () => {
  assert.equal(normalizeSpokenEmail("sam alpha india@gmail.com"), "sai@gmail.com");
});
