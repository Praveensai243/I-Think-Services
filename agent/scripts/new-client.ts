#!/usr/bin/env tsx
/**
 * Scaffold a new client config from a short Q&A.
 * Usage:  npm run new-client
 * Writes: clients/<slug>.json  (then run it with BUSINESS_CONFIG=clients/<slug>.json npm start)
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Interactive when attached to a terminal; otherwise consume piped stdin
// deterministically (one line per answer) so it can also be scripted.
const interactive = Boolean(stdin.isTTY);
const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;
let queued: string[] = [];
if (!interactive) {
  const chunks: Buffer[] = [];
  for await (const c of stdin) chunks.push(c as Buffer);
  queued = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
}

async function ask(q: string, def = ""): Promise<string> {
  if (rl) {
    const a = (await rl.question(def ? `${q} [${def}] ` : `${q} `)).trim();
    return a || def;
  }
  const a = (queued.shift() ?? "").trim();
  return a || def;
}
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  console.log("\n  New client setup — answer a few questions (Enter accepts the default).\n");
  const name = await ask("Business name?", "Acme Services");
  const industry = await ask("Industry (e.g. dental clinic, hair salon)?", "local business");
  const timezone = await ask("Timezone?", "America/New_York");
  const agentName = await ask("Receptionist's name?", "Ava");
  const phone = await ask("Number to transfer humans to?", "+1 (000) 000-0000");
  const greeting = await ask(
    "Greeting?",
    `Thanks for calling ${name}, this is ${agentName}. How can I help you today?`,
  );

  const config = {
    name, industry, timezone, agentName,
    phoneForHumans: phone,
    greeting,
    hours: {
      mon: ["09:00", "17:00"], tue: ["09:00", "17:00"], wed: ["09:00", "17:00"],
      thu: ["09:00", "17:00"], fri: ["09:00", "17:00"], sat: null, sun: null,
    },
    slotMinutes: 30,
    services: [
      { id: "appointment", name: "Appointment", minutes: 30 },
      { id: "consult", name: "Consultation", minutes: 45 },
    ],
    faq: [
      { q: "hours", a: "Our hours are Monday to Friday, 9 to 5." },
      { q: "location", a: "EDIT ME — add your address here." },
      { q: "pricing", a: "EDIT ME — add pricing info here." },
    ],
    escalation: {
      toHumanWhen: ["the caller is upset or asks for a manager", "a billing or account issue", "anything beyond scheduling"],
    },
    sampleQuestions: ["Book me an appointment", "What are your hours?", "Where are you located?", "I need to reschedule"],
  };

  const slug = slugify(name);
  const dir = resolve(root, "clients");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${slug}.json`);
  if (existsSync(file)) {
    const ok = await ask(`clients/${slug}.json exists — overwrite? (y/N)`, "N");
    if (ok.toLowerCase() !== "y") { console.log("Aborted."); rl?.close(); return; }
  }
  writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  rl?.close();

  console.log(`\n  ✓ Wrote clients/${slug}.json`);
  console.log("  Next:");
  console.log(`    1. Edit clients/${slug}.json — fill in services, FAQ, and hours.`);
  console.log(`    2. Run it:   BUSINESS_CONFIG=clients/${slug}.json npm start`);
  console.log(`    3. Connect their calendar + phone number (see README).\n`);
}

main();
