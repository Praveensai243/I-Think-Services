import { business } from "./config.js";

/**
 * Lightweight per-deployment usage tracking for billing.
 * One deployment serves one business (its config), so counters are for that
 * business, bucketed by calendar month. Swap the Map for a DB in production.
 */
export interface Counters {
  webTurns: number;      // messages handled in the browser demo
  webSessions: number;   // distinct browser conversations
  phoneCalls: number;    // completed phone calls (from Vapi end-of-call reports)
  phoneMinutes: number;  // billable voice minutes
  bookings: number;
  reschedules: number;
  cancellations: number;
  messages: number;      // messages taken for the team
  transfers: number;     // handoffs to a human
}

function blank(): Counters {
  return {
    webTurns: 0, webSessions: 0, phoneCalls: 0, phoneMinutes: 0,
    bookings: 0, reschedules: 0, cancellations: 0, messages: 0, transfers: 0,
  };
}

const byMonth = new Map<string, Counters>();
const seenWebSessions = new Set<string>();

function ym(): string { return new Date().toISOString().slice(0, 7); }
function cur(): Counters {
  const m = ym();
  let c = byMonth.get(m);
  if (!c) { c = blank(); byMonth.set(m, c); }
  return c;
}

export function recordWebTurn(sessionId: string): void {
  const c = cur();
  c.webTurns++;
  if (!seenWebSessions.has(sessionId)) { seenWebSessions.add(sessionId); c.webSessions++; }
}

export function recordPhoneCall(seconds: number): void {
  const c = cur();
  c.phoneCalls++;
  c.phoneMinutes = Math.round((c.phoneMinutes + seconds / 60) * 10) / 10;
}

/** Record a successful agent action (both web and phone go through here). */
export function recordAction(tool: string, ok: boolean): void {
  if (!ok) return;
  const c = cur();
  if (tool === "book_appointment") c.bookings++;
  else if (tool === "reschedule_appointment") c.reschedules++;
  else if (tool === "cancel_appointment") c.cancellations++;
  else if (tool === "take_message") c.messages++;
  else if (tool === "transfer_to_human") c.transfers++;
}

export function getUsage() {
  return {
    business: business.name,
    current: { month: ym(), ...cur() },
    months: Object.fromEntries([...byMonth.entries()].sort()),
  };
}
