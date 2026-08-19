/**
 * Repairs for what a phone transcriber does to an email address spelled out
 * loud, letter by letter.
 *
 * A live call: the caller spelled "santoo" and the transcript came back
 * "sant0o" — a ZERO, because a spoken "oh" is a digit as often as a letter.
 * The agent then read back an address the caller had never said, the caller
 * corrected it, the same thing happened again, and the call died in that loop.
 * Saying "o as in Oscar" did not help: by the time the agent sees the words,
 * the damage is already in the text.
 */

/** Digits that are really letters when they turn up inside a spelled word. */
const MISHEARD: Record<string, string> = { "0": "o", "1": "l", "5": "s" };

/**
 * Fix a digit that is sitting BETWEEN two letters, and only there.
 *
 * The narrowness is the point: real addresses are full of deliberate digits —
 * praveensai243@… is a real one — and "correcting" those would invent an
 * address nobody owns. A digit at the end of a word, or next to another digit,
 * is left exactly as the caller said it. Only a lone digit wedged inside a run
 * of letters is treated as a mishearing, because that is not something people
 * type on purpose.
 */
export function repairSpelledWord(word: string): string {
  return word.replace(/(?<=[a-z])[015](?=[a-z])/gi, (d) => MISHEARD[d]);
}

/**
 * Words callers spell with. NATO plus the "police alphabet" people actually
 * use on the phone — a live caller mixed both in one breath: "Sam, alpha,
 * Nancy, tango, Oscar, Oscar" for santoo.
 */
const PHONETIC = new Set([
  "alpha", "alfa", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel",
  "india", "indigo", "juliet", "juliett", "kilo", "lima", "mike", "november",
  "oscar", "papa", "quebec", "romeo", "sierra", "tango", "uniform", "victor",
  "whiskey", "xray", "x-ray", "yankee", "zulu",
  "adam", "boy", "charles", "david", "edward", "frank", "george", "henry", "ida",
  "john", "king", "lincoln", "mary", "nancy", "ocean", "paul", "queen", "robert",
  "sam", "tom", "union", "william", "young", "zebra",
]);

/**
 * Collapse a spelled-out run of phonetic words into the letters they stand for.
 *
 * Only fires when THREE or more of them appear together, so an address that
 * genuinely contains "oscar" or "victor" is left alone — one stray word is a
 * name, three in a row is someone spelling.
 */
export function decodePhonetic(text: string): string {
  const words = String(text ?? "").toLowerCase().split(/[^a-z-]+/).filter(Boolean);
  const hits = words.filter((w) => PHONETIC.has(w)).length;
  if (hits < 3) return String(text ?? "");
  return words.map((w) => (PHONETIC.has(w) ? w[0] : w)).join("");
}

/**
 * Turn what the transcriber heard into an address worth sending mail to.
 *
 * Handles the spoken forms too — "santoo at gmail dot com", and the spaces
 * left behind when someone spells a name out one letter at a time.
 */
export function normalizeSpokenEmail(raw: string): string {
  let s = String(raw ?? "").trim().toLowerCase();
  s = s.replace(/\s+at\s+/g, "@").replace(/\s+dot\s+/g, ".");
  // "Sam alpha Nancy tango Oscar Oscar" is santoo. Done per part so a decoded
  // local half never swallows the domain.
  s = s.split("@").map(decodePhonetic).join("@");
  s = s.replace(/\s+/g, "");
  const at = s.lastIndexOf("@");
  if (at < 1) return s;
  // Only the local part is repaired. A domain is a real word the transcriber
  // has seen thousands of times, and gmail/outlook do not contain digits.
  return repairSpelledWord(s.slice(0, at)) + s.slice(at);
}
