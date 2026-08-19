/**
 * Keep the server alive through a stray error.
 *
 * A crash here does not fail one turn — it takes every call in progress with
 * it, and wipes the in-memory diagnostics trail so nobody can see what
 * happened. That is exactly what a caller heard on 2026-08-19: they booked a
 * time, confirmed it, and then got a canned "I couldn't catch that" on every
 * turn afterwards while the server restarted underneath them.
 *
 * Two ways this happens, both of which end the process by default:
 *  - An unhandled promise rejection. Node exits on one.
 *  - An async throw inside an Express 4 route. Express 4 only catches
 *    synchronous errors, so an async one becomes an unhandled rejection.
 *
 * Staying up is the right trade for a phone line. The alternative to a logged
 * error and a slightly wrong turn is a dead line for every caller at once.
 */
/** Say what died and that we chose to carry on, so the log names the cause. */
export function reportSurvived(kind: string, detail: unknown): void {
  console.error(`${kind} — server kept alive on purpose:`, detail);
}

export function installCrashGuards(): void {
  process.on("unhandledRejection", (reason) => reportSurvived("UNHANDLED REJECTION", reason));
  process.on("uncaughtException", (err) => reportSurvived("UNCAUGHT EXCEPTION", err));
}
