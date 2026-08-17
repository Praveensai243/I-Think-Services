/**
 * A short in-memory trail of what the phone agent actually did, readable over
 * HTTP at /api/admin/diagnostics.
 *
 * This exists because the failure we are chasing is invisible from both ends:
 * a caller cannot tell a broken Vapi payload from a deliberate hang-up, and
 * host log viewers are awkward to search mid-debugging. A URL you can open on
 * the phone you just called from is worth more than a log line nobody finds.
 *
 * In memory on purpose — it is a debugging aid, not a record. A restart clears
 * it, which is fine for something read minutes after a test call.
 */
export interface CallEvent {
  at: string;
  callId: string;
  callerSaid: string;
  agentSaid: string;
  decided: { transfer?: string; ended?: boolean };
  sentToVapi: unknown;
  toolsFromVapi: string[];
  destinationFromVapi: unknown;
  controlEnabled: boolean;
  streaming: boolean;
}

const MAX = 50;
const events: CallEvent[] = [];

export function recordCallEvent(e: CallEvent): void {
  events.unshift(e);
  if (events.length > MAX) events.length = MAX;
}

export function getCallEvents(): CallEvent[] {
  return events;
}

/** Trim spoken text so the trail stays readable on a phone screen. */
export function short(text: unknown, max = 160): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}
