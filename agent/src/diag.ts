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
  /** The number the caller dialled — if the transfer destination matches it, the transfer self-loops. */
  dialedNumber?: unknown;
  controlEnabled: boolean;
  streaming: boolean;
  /** Set when the turn threw. A failed turn used to leave no trace at all. */
  failed?: string;
  /** How long the caller waited for this turn, and where it went. */
  tookMs?: number;
  modelMs?: number[];
  toolMs?: { name: string; ms: number }[];
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

/**
 * Counters for the endpoint itself, kept separately from turns because they
 * answer a different question: not "what did the agent decide" but "did Vapi
 * even get here". A rejected request never reaches the turn recorder.
 */
const counters = { hits: 0, authRejected: 0 };

export function recordEndpointHit(): void {
  counters.hits++;
}

/** @param sentSomething whether a secret was presented at all, vs none sent. */
export function recordAuthRejection(sentSomething: boolean): void {
  counters.authRejected++;
  if (!sentSomething) console.error("custom-llm 401: Vapi sent no secret at all");
}

export function getCounters(): { hits: number; authRejected: number; wrongPaths: string[] } {
  return { ...counters, wrongPaths: getWrongPaths() };
}

/**
 * Paths under /api/vapi that Vapi tried and we do not serve. The one that
 * matters is the doubled /chat/completions/chat/completions, which comes from
 * pasting the full endpoint into a field that wants the base URL.
 */
const wrongPaths = new Set<string>();

export function recordWrongPath(path: string): void {
  wrongPaths.add(path);
}

export function getWrongPaths(): string[] {
  return [...wrongPaths];
}

/** When this process started — a fresh restart explains an empty trail. */
const startedAt = Date.now();

export function uptimeSeconds(): number {
  return Math.round((Date.now() - startedAt) / 1000);
}

/**
 * When this process started, as a wall-clock time.
 *
 * The one fact that tells a restart apart from a misconfigured assistant: if
 * this is LATER than the call you are asking about, the trail you are reading
 * is not the trail of that call — the process restarted and took it with it.
 */
export function startedAtISO(): string {
  return new Date(startedAt).toISOString();
}
