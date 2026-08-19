import express, { type Request, type Response, type NextFunction } from "express";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { business, env, hasBrain, usingGoogle, usingCalcom, googleAuthMode } from "./config.js";
import { checkGoogleAccess } from "./calendar.js";
import { runTool } from "./tools.js";
import type Anthropic from "@anthropic-ai/sdk";
import { respond, runAgent } from "./agent.js";
import { resetSession, messageLog, handoffLog, bookingLog } from "./store.js";
import { getUsage, recordPhoneCall } from "./usage.js";
import { billingEnabled, createCheckout, verifyWebhook } from "./billing.js";
import { emailEnabled, sendTestEmail } from "./notify.js";
import { recordCallEvent, getCallEvents, short, recordEndpointHit, recordAuthRejection, getCounters, recordWrongPath, uptimeSeconds, startedAtISO } from "./diag.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function calendarLabel(): string {
  if (usingGoogle) return `google (${googleAuthMode})`;
  return usingCalcom ? "calcom" : "mock";
}

export function createServer() {
  const app = express();

  // Stripe webhook needs the RAW body for signature verification — mount before json().
  app.post("/api/billing/webhook", express.raw({ type: "*/*" }), (req, res) => {
    try {
      const event = verifyWebhook(req.body as Buffer, req.get("stripe-signature") ?? "");
      // React to lifecycle events as needed (activate/deactivate a client, etc.)
      console.log("stripe event:", event.type);
      res.json({ received: true });
    } catch (err) {
      console.error("stripe webhook error", err);
      res.status(400).json({ error: "invalid_signature" });
    }
  });

  app.use(express.json({ limit: "1mb" }));

  // ── health & public config for the demo UI ─────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      brain: hasBrain ? "connected" : "demo-mode (no ANTHROPIC_API_KEY)",
      calendar: calendarLabel(),
      billing: billingEnabled() ? "stripe" : "off",
      messageAlerts: emailEnabled() ? "email" : "off (set SMTP_HOST/USER/PASS and NOTIFY_EMAIL)",
      business: business.name,
    });
  });

  app.get("/api/config", (_req, res) => {
    res.json({
      name: business.name,
      agentName: business.agentName,
      greeting: business.greeting,
      services: business.services.map((s) => s.name),
      sampleQuestions: business.sampleQuestions ?? [],
      brain: hasBrain,
    });
  });

  // ── browser voice widget backend ───────────────────────────────
  app.post("/api/agent/turn", async (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId || "web");
      const text = String(req.body?.text || "").slice(0, 2000);
      if (!text.trim()) return res.status(400).json({ error: "empty" });
      const turn = await respond(sessionId, text);
      res.json(turn);
    } catch (err) {
      console.error("turn error", err);
      res.status(500).json({ error: "agent_error", reply: "Sorry, I hit a snag — could you say that again?" });
    }
  });

  app.post("/api/agent/reset", (req, res) => {
    resetSession(String(req.body?.sessionId || "web"));
    res.json({ ok: true });
  });

  // ── Vapi phone webhook: the phone agent calls our SAME tools ────
  app.post("/api/vapi/function", async (req, res) => {
    if (env.vapiSecret && req.get("x-vapi-secret") !== env.vapiSecret) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const msg = req.body?.message ?? {};
    const sessionId = "vapi:" + (req.body?.call?.id ?? msg.call?.id ?? "unknown");

    try {
      // Completed call → record billable minutes.
      if (msg.type === "end-of-call-report") {
        const seconds = Number(msg.durationSeconds ?? msg.call?.durationSeconds ?? 0);
        if (seconds > 0) recordPhoneCall(seconds);
        return res.json({ ok: true });
      }

      const toolCalls = msg.toolCallList ?? msg.toolCalls;
      if (msg.type === "tool-calls" && Array.isArray(toolCalls)) {
        const results = [];
        for (const c of toolCalls) {
          const name = c.function?.name ?? c.name;
          const args = parseArgs(c.function?.arguments ?? c.arguments);
          const out = await runTool(name, args, sessionId, "phone");
          results.push({ toolCallId: c.id, result: JSON.stringify(out) });
        }
        return res.json({ results });
      }

      if (msg.type === "function-call" && msg.functionCall) {
        const out = await runTool(msg.functionCall.name, parseArgs(msg.functionCall.parameters), sessionId, "phone");
        return res.json({ result: JSON.stringify(out) });
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("vapi function error", err);
      return res.status(500).json({ error: "tool_error" });
    }
  });

  // ── Vapi "Custom LLM": our backend IS the brain ────────────────
  // Vapi posts an OpenAI-style chat request here; we run the whole Claude
  // agent (prompt + booking tools) and reply. This makes the Vapi setup a
  // one-URL affair — no tools or model keys to configure on their side.
  app.post("/api/vapi/chat/completions", async (req, res) => {
    // Counted BEFORE the auth check on purpose. Everything else in this handler
    // records only after a request is accepted, so a rejected one used to leave
    // no trace — making "nothing reached us" and "we turned it away" look
    // identical from the outside. They need very different fixes.
    recordEndpointHit();
    if (env.vapiSecret) {
      const bearer = (req.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const tok = bearer || req.get("x-vapi-secret");
      if (tok !== env.vapiSecret) {
        recordAuthRejection(Boolean(bearer || req.get("x-vapi-secret")));
        console.error("custom-llm 401: VAPI_SECRET is set here but the request did not match it");
        return res.status(401).json({ error: "unauthorized" });
      }
    }
    const body = req.body ?? {};
    const incoming: any[] = Array.isArray(body.messages) ? body.messages : [];

    // Build Claude history from the transcript (our own system prompt wins,
    // so we ignore Vapi's system messages). Claude must start with a user turn.
    const history: Anthropic.MessageParam[] = [];
    for (const m of incoming) {
      if (m.role !== "user" && m.role !== "assistant") continue;
      const text = typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join(" ")
          : "";
      if (text.trim()) history.push({ role: m.role, content: text });
    }
    while (history.length && history[0].role === "assistant") history.shift();
    if (!history.length) history.push({ role: "user", content: "Hello" });

    const callId = body?.call?.id ?? body?.metadata?.call?.id ?? "phone";
    // Vapi knows who is calling — using it beats making them recite ten digits
    // over a phone line that mangles them.
    const call = body?.call ?? body?.metadata?.call ?? {};
    const callerPhone: string | undefined =
      call?.customer?.number ?? call?.from ?? body?.customer?.number ?? undefined;
    // The number the caller dialled to reach us. Transferring a call to the
    // line it arrived on fails instantly, and Vapi ends the call when a
    // transfer fails — which is indistinguishable from a deliberate hang-up.
    const dialedNumber: string | undefined =
      call?.phoneNumber?.number ?? call?.phoneNumberId ?? call?.to ?? undefined;

    // Never the empty-sounding placeholder: whatever we put here is what the
    // caller hears if everything else fails, and silence is the one failure
    // they cannot work around.
    let reply = "Sorry, I went quiet there for a second — where were we?";
    let control: VapiControl = null;
    try {
      const out = await runAgent(history, "vapi:" + callId, "phone", { callerPhone });
      reply = out.reply || reply;
      // A caller who has asked for a person more than once gets connected, full
      // stop. Live transcript: they asked four times while the agent kept
      // qualifying them. Being helpful first is right; using it to stall
      // someone who wants a human is how you lose the call.
      if (!out.transfer && callerInsistsOnHuman(history)) {
        console.log("forcing transfer: caller asked for a person repeatedly");
        out.transfer = { number: business.phoneForHumans };
      }
      control = callControlFor(out, body, lastCallerText(history), { dialedNumber, callerPhone });
      // Recorded on EVERY turn, not just ones that move the line. An empty
      // trail after a test call is itself the answer: it means Vapi never
      // reached this endpoint.
      logCallControlDiagnostics(body, out, control, lastCallerText(history), reply, callId, undefined, out.timing);
    } catch (err) {
      console.error("custom-llm error", err);
      // NOT "I didn't catch that". This fires when OUR side broke, and dressing
      // a backend failure up as a hearing problem sent a caller round the same
      // loop for a whole call — they kept repeating themselves at something
      // that was never listening. Say what is true and offer a way out.
      reply =
        `Sorry — something went wrong on my end just then. You can reach the team directly on ${business.phoneForHumans}, or tell me and I'll take a message.`;
      // Record the failure as a turn. Until now the diagnostics call sat inside
      // the try, so the turns worth reading — the ones that broke — were the
      // only ones that left nothing behind, and the trail simply stopped mid
      // call with no hint that anything had gone wrong.
      logCallControlDiagnostics(
        body, {}, null, lastCallerText(history), reply, callId,
        err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      );
    }

    const id = "chatcmpl-" + Date.now();
    const created = Math.floor(Date.now() / 1000);
    const model = body.model || env.model;

    // Sending the reply is inside a guard too. Express 4 does not catch an
    // async throw in a route, so a write to a socket Vapi has already dropped
    // used to become an unhandled rejection — which ends the whole process and
    // with it every other call on the line.
    try {
      if (body.stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        for (const frame of sseFrames({ id, created, model, reply, control })) res.write(frame);
        return res.end();
      }
      res.json({
        id, object: "chat.completion", created, model,
        choices: [{
          index: 0,
          message: { role: "assistant", content: reply, ...(control ?? {}) },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    } catch (err) {
      console.error("could not send the reply to Vapi:", err);
      if (!res.headersSent) res.status(500).json({ error: "send_failed" });
      else res.end();
    }
  });

  app.get("/api/vapi/assistant", (_req, res) => {
    res.json({
      name: `${business.name} — Receptionist`,
      firstMessage: business.greeting,
      // Custom LLM: our backend is the brain (prompt + booking tools live here),
      // so Vapi just forwards the conversation. No tools/model keys to set in Vapi.
      model: {
        provider: "custom-llm",
        url: `${env.publicBaseUrl}/api/vapi/chat/completions`,
        model: env.model,
        // Vapi only honours endCall/transferCall if the assistant declares them.
        // Without these two entries the agent can ask to hang up or connect the
        // caller all it likes and nothing happens on the line.
        tools: [
          { type: "endCall" },
          {
            type: "transferCall",
            destinations: [{
              type: "number",
              number: business.phoneForHumans.replace(/[^\d+]/g, ""),
              message: "Connecting you now — one moment.",
            }],
          },
        ],
      },
      voice: env.elevenLabsVoiceId
        ? { provider: "11labs", voiceId: env.elevenLabsVoiceId }
        : { provider: "vapi", voiceId: "Elliot" },
      transcriber: { provider: "deepgram", model: "nova-2" },
      // Server URL receives call events (e.g. end-of-call reports → billable minutes).
      server: { url: `${env.publicBaseUrl}/api/vapi/function`, secret: env.vapiSecret || undefined },
      _note:
        "In Vapi: create an assistant with model provider 'custom-llm' pointing at the url above, pick a voice, and attach a phone number. Set PUBLIC_BASE_URL on the server to your Render URL first.",
    });
  });

  // ── billing (client subscriptions) ─────────────────────────────
  app.post("/api/billing/checkout", async (req, res) => {
    if (!billingEnabled()) return res.status(501).json({ error: "billing_not_configured" });
    try {
      const plan = req.body?.plan === "pro" ? "pro" : "starter";
      const url = await createCheckout(plan, { email: req.body?.email });
      res.json({ url });
    } catch (err) {
      console.error("checkout error", err);
      res.status(500).json({ error: "checkout_failed" });
    }
  });

  // ── admin (token-protected) ────────────────────────────────────
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!env.adminToken) return next(); // open when no token set (local dev)
    const t = req.get("x-admin-token") ?? (req.query.token as string | undefined);
    if (t === env.adminToken) return next();
    res.status(401).json({ error: "unauthorized" });
  };

  // Prove the calendar wiring works without placing a phone call. Read-only.
  app.get("/api/admin/calendar-check", requireAdmin, async (_req, res) => {
    if (!usingGoogle) {
      return res.json({
        ok: false,
        calendar: calendarLabel(),
        reason: usingCalcom
          ? "Cal.com is the active backend; this check covers Google only."
          : "CALENDAR is not set to google, so bookings live in memory and are lost on restart.",
      });
    }
    res.json({ calendar: calendarLabel(), ...(await checkGoogleAccess()) });
  });

  /**
   * Proves message alerts work without placing a call and leaving a message.
   * Returns the mail server's own error, since "Invalid login" (wrong app
   * password) and a TLS complaint (wrong port) need different fixes.
   */
  app.get("/api/admin/test-email", requireAdmin, async (_req, res) => {
    const result = await sendTestEmail();
    res.status(result.ok ? 200 : 500).json(result);
  });

  app.get("/api/admin/data", requireAdmin, (_req, res) => {
    res.json({
      usage: getUsage(),
      bookings: bookingLog.slice(0, 50),
      messages: messageLog.slice(-50).reverse(),
      handoffs: handoffLog.slice(0, 50),
      billing: billingEnabled(),
    });
  });

  /**
   * What the phone agent did on recent turns. Built for debugging a live call
   * from the phone you just called on, when the host's log viewer is not to
   * hand. `toolsFromVapi` is the decisive field: Vapi sends the assistant's own
   * tool list on every request, so if endCall and transferCall are missing
   * there, they were never configured on the assistant.
   */
  app.get("/api/admin/diagnostics", requireAdmin, (_req, res) => {
    const events = getCallEvents();
    const counters = getCounters();
    const failed = events.filter((e) => e.failed);
    res.json({
      diagnosis: diagnose(events.length, {
        ...counters,
        uptime: uptimeSeconds(),
        failedTurns: failed.length,
        lastError: failed[0]?.failed,
      }),
      requestsToThisEndpoint: counters.hits,
      // Compare this with the time of the call you are asking about. A start
      // time AFTER that call means this process is not the one that took it.
      serverStartedAt: startedAtISO(),
      serverUpForSeconds: uptimeSeconds(),
      wrongPathsTried: counters.wrongPaths,
      rejectedForBadSecret: counters.authRejected,
      secretRequiredHere: Boolean(env.vapiSecret),
      controlEnabled: env.callControl,
      count: events.length,
      events,
    });
  });

  /**
   * Anything under /api/vapi that is not a real route. This exists because a
   * misconfigured Custom LLM URL is otherwise completely silent: Vapi appends
   * /chat/completions to the base URL you give it, so pasting the full path
   * makes it call /chat/completions/chat/completions, which 404s before
   * reaching any handler. Calls then fail with the backend looking idle and
   * innocent. Recording the attempted path turns that into a visible answer.
   */
  app.all("/api/vapi/*", (req, res) => {
    recordWrongPath(req.path);
    console.error("vapi hit an unknown path:", req.path);
    res.status(404).json({
      error: "no_such_endpoint",
      hint: "Vapi appends /chat/completions to the Custom LLM base URL. Set the base URL to "
        + `${env.publicBaseUrl}/api/vapi — not the full path.`,
      youCalled: req.path,
    });
  });

  app.get("/admin", (_req, res) => res.sendFile(resolve(__dirname, "../public/admin.html")));

  // ── static: the browser voice demo ─────────────────────────────
  app.use(express.static(resolve(__dirname, "../public")));
  app.get("/", (_req, res) => res.sendFile(resolve(__dirname, "../public/demo.html")));

  return app;
}

/**
 * Vapi's built-in call controls are triggered by a `function_call` payload
 * naming one of its own functions — not by our booking tools, which go over the
 * separate /api/vapi/function webhook. Shape per Vapi's custom-LLM tool-calling
 * docs.
 */
export type VapiControl = { function_call: { name: string; arguments: Record<string, unknown> } } | null;

/**
 * Decide whether this turn should move or close the line.
 *
 * Returns null unless VOICE_CALL_CONTROL is on, so the default deployment sends
 * byte-identical frames to what it sends today and the flag is the whole
 * rollback story. `transfer` wins over `ended`: connecting a caller who asked
 * for a person matters more than hanging up tidily.
 */
/**
 * The name Vapi will recognise for one of its built-ins.
 *
 * Tools are named by whoever created them in the dashboard —
 * "transfer_call_tool", not "transferCall" — and that name is what arrives in
 * the request and what Vapi matches our reply against. Emitting the canonical
 * name matched nothing. So read the name back out of the request Vapi just
 * sent, and only fall back to the canonical one when it declared no such tool.
 */
export function vapiToolName(body: any, kind: "transferCall" | "endCall"): string {
  const tools = Array.isArray(body?.tools) ? body.tools : [];
  const want = kind === "transferCall" ? /transfer/i : /end.?call|hang.?up/i;
  for (const t of tools) {
    const name = t?.function?.name;
    if (typeof name === "string" && (name === kind || want.test(name))) return name;
    if (t?.type === kind) return kind;
  }
  return kind;
}

export function callControlFor(
  out: { transfer?: { number: string }; ended?: boolean },
  body: any = {},
  lastCallerText = "",
  lines: { dialedNumber?: string; callerPhone?: string } = {},
): VapiControl {
  if (!env.callControl) return null;
  if (out.transfer) {
    // Vapi passes the configured destination on the request; fall back to the
    // business's own human line so a missing config still reaches someone.
    const raw = body?.destination?.number ?? body?.destination ?? out.transfer.number ?? business.phoneForHumans;
    const destination = toE164(raw);
    // A line cannot be transferred to itself, and neither can a caller be
    // transferred back to their own handset. Vapi answers both by ending the
    // call, so refusing here keeps the caller talking to the agent instead.
    const self = [lines.dialedNumber, lines.callerPhone].map(toE164).filter(Boolean);
    if (destination && self.includes(destination)) {
      console.error(
        "transfer skipped; destination is the line the call is already on:", destination,
        "— set the transfer destination to a different phone, e.g. a mobile.",
      );
      return null;
    }
    if (!destination) {
      // A destination Vapi cannot dial makes it END the call, which is the
      // worst possible answer to "can I speak to a person?". Sending nothing
      // at least leaves the caller on the line with the agent.
      console.error("transfer skipped; destination is not dialable:", JSON.stringify(raw));
      return null;
    }
    return { function_call: { name: vapiToolName(body, "transferCall"), arguments: { destination } } };
  }
  if (out.ended) {
    if (!callerIsLeaving(lastCallerText)) {
      // The agent asked to hang up on someone who was still talking. Refuse:
      // the farewell is still spoken but the line stays open, which is exactly
      // how the phone behaved before end_call existed. Prompt rules alone did
      // not hold here — a caller asking several questions in a row got cut off.
      console.warn("suppressed end_call; caller had not signed off:", JSON.stringify(lastCallerText.slice(0, 120)));
      return null;
    }
    return { function_call: { name: vapiToolName(body, "endCall"), arguments: {} } };
  }
  return null;
}

/**
 * The exact SSE frames sent to Vapi for one turn, as a list so the ordering is
 * testable rather than something we infer from a phone call.
 *
 * The control frame REPLACES the stop; it never follows it. Sending stop first
 * declares the completion finished and then keeps writing, and when Vapi
 * errors on that it ends the call — which sounds exactly like a working
 * hang-up. That ambiguity is why this took three attempts to see.
 */
export function sseFrames(
  o: { id: string; created: number; model: string; reply: string; control: VapiControl },
): string[] {
  const chunk = (delta: object, finish: string | null) =>
    `data: ${JSON.stringify({
      id: o.id, object: "chat.completion.chunk", created: o.created, model: o.model,
      choices: [{ index: 0, delta, finish_reason: finish }],
    })}\n\n`;

  // A transfer turn carries NO text by default.
  //
  // Live call: Vapi accepted a correctly named tool call alongside a spoken
  // reply and silently did nothing — the caller heard "putting you through"
  // and then asked "are you there?". Many OpenAI-compatible parsers treat a
  // message that has content as a finished answer and never read its
  // tool_calls. Vapi also has its own "Message to Customer" field on the
  // transfer tool, which is where it expects that line to come from.
  //
  // endCall keeps its text: the farewell has to be spoken by us, and there is
  // no equivalent field for it.
  const silent = o.control
    && o.control.function_call.name.toLowerCase().includes("transfer")
    && env.controlSpeaks === "vapi";
  const frames = silent ? [] : [chunk({ role: "assistant", content: o.reply }, null)];

  if (!o.control) {
    frames.push(chunk({}, "stop"));
    frames.push("data: [DONE]\n\n");
    return frames;
  }

  if (env.controlShape === "function_call") {
    // Vapi's proxy example writes this bare frame. Kept switchable because it
    // is what we shipped first and the docs show both.
    frames.push(`data: ${JSON.stringify(o.control)}\n\n`);
  } else {
    // Default. Vapi hands us its built-ins as OpenAI function definitions
    // ({type:"function",function:{name:"transferCall"}}), so the reply it is
    // parsing for is the ordinary OpenAI tool call: a tool_calls delta closed
    // by finish_reason "tool_calls". Arguments must be a JSON *string*.
    frames.push(chunk({
      tool_calls: [{
        index: 0,
        id: "call_" + o.control.function_call.name,
        type: "function",
        function: {
          name: o.control.function_call.name,
          arguments: JSON.stringify(o.control.function_call.arguments ?? {}),
        },
      }],
    }, null));
    frames.push(chunk({}, "tool_calls"));
  }
  frames.push("data: [DONE]\n\n");
  return frames;
}

/**
 * Turns the counters into the one sentence worth reading. Zero requests and
 * zero rejections means Vapi is not talking to this server at all, which no
 * change to this codebase can fix.
 */
export function diagnose(
  turns: number,
  c: {
    hits: number; authRejected: number; wrongPaths?: string[]; uptime?: number;
    failedTurns?: number; lastError?: string;
  },
): string {
  const wrong = c.wrongPaths ?? [];
  // Lead with our own breakage when there is any. A caller hears a thrown turn
  // as the agent not understanding them, so this is the sentence that stops
  // someone debugging the transcriber for a fault that is in this process.
  if (c.failedTurns) {
    return `${c.failedTurns} of the last ${turns} recorded turn(s) threw before the agent could reply`
      + (c.lastError ? ` — most recently: ${c.lastError}` : "")
      + ". The caller hears this as the agent not understanding them, whatever they say. Read the failed "
      + "events below and the host logs for 'custom-llm error'.";
  }
  if (c.hits === 0 && wrong.length > 0) {
    return "Vapi is reaching this server but calling the wrong path: " + wrong.join(", ")
      + ". The Custom LLM URL in Vapi must be the BASE url — Vapi appends /chat/completions itself, so "
      + "pasting the full path doubles it.";
  }
  if (c.hits === 0 && (c.uptime ?? Infinity) < 15 * 60) {
    // A deploy restarts the process and clears the trail, so an empty one
    // shortly afterwards means nobody has called yet — not that the config
    // broke. Saying otherwise sends people to fix something that is fine.
    return `No calls yet since this server restarted ${Math.max(1, Math.round((c.uptime ?? 0) / 60))} `
      + "minute(s) ago — that is expected right after a deploy. Place a call, then reload this page.";
  }
  if (c.hits === 0) {
    // Two very different faults look identical here, and this used to name only
    // one of them. A caller whose booking went through has PROVED the assistant
    // reaches this server, so telling them to go re-point it is wrong and costs
    // a round of debugging. The counters live in memory: a restart zeroes them.
    const up = Math.round((c.uptime ?? 0) / 60);
    return `Nothing has reached this endpoint in the ${up} minute(s) this process has been up. `
      + "Either nobody has called in that window, or the process restarted AFTER your call and took the "
      + "trail with it — compare serverStartedAt below with the time you called, and check the host's "
      + "restart events. If the call is older than this process, this page cannot tell you anything about "
      + "it; the host logs can. If it is NOT, the Vapi assistant is not pointed at this server — check "
      + "that its model provider is Custom LLM with url .../api/vapi.";
  }
  if (c.authRejected === c.hits) {
    return "Every request was rejected: VAPI_SECRET is set on this server but Vapi is not sending a "
      + "matching one. Either paste the same value as the custom-LLM API key in Vapi, or clear "
      + "VAPI_SECRET here.";
  }
  if (turns === 0) {
    return "Requests arrived but no turn completed — the agent threw before replying. Check the host logs "
      + "for 'custom-llm error'.";
  }
  return "Requests are arriving and turns are completing. Read toolsFromVapi below: if it is empty, the "
    + "Vapi assistant has no endCall/transferCall tools configured and cannot act on ours.";
}

/**
 * Records one turn, in both places: the in-memory trail behind
 * /api/admin/diagnostics, and the host's log — which is the only one of the two
 * that survives a restart.
 *
 * `toolsFromVapi` is the one that settles the open question: Vapi sends the
 * assistant's own tool list on every request, so if endCall and transferCall
 * are not in it, they were never configured on the assistant and no change to
 * this codebase can make them work.
 */
export function logCallControlDiagnostics(
  body: any,
  out: { transfer?: { number: string }; ended?: boolean },
  control: VapiControl,
  callerSaid = "",
  agentSaid = "",
  callId = "",
  failed?: string,
  timing?: { totalMs: number; model: number[]; tools: { name: string; ms: number }[] },
): void {
  const tools = Array.isArray(body?.tools) ? body.tools : [];
  const event = {
    at: new Date().toISOString(),
    callId: String(callId),
    callerSaid: short(callerSaid),
    agentSaid: short(agentSaid),
    decided: { transfer: out.transfer?.number, ended: out.ended },
    sentToVapi: control,
    // The name first: Vapi sends built-ins as {type:"function",function:{name}},
    // so reading `type` first showed "function" three times and hid the answer.
    toolsFromVapi: tools.map((t: any) => t?.function?.name ?? t?.type ?? "?"),
    destinationFromVapi: body?.destination ?? null,
    dialedNumber: body?.call?.phoneNumber?.number ?? body?.call?.to ?? null,
    controlEnabled: env.callControl,
    streaming: Boolean(body?.stream),
    ...(failed ? { failed } : {}),
    // How long the caller waited, and what they waited for. Silence on the line
    // is either a slow turn or a dead one, and they need opposite fixes.
    ...(timing ? { tookMs: timing.totalMs, modelMs: timing.model, toolMs: timing.tools } : {}),
  };
  recordCallEvent(event);
  // Every turn goes to the host's log viewer, not just the ones that move the
  // line. The trail above is in memory, so a restart erases exactly the call
  // you are trying to debug — which has now happened twice. Render keeps logs
  // across restarts, so this line is the copy that survives.
  console.log("CALL-TURN " + JSON.stringify(event));
}

/**
 * Phone numbers are stored the way a receptionist says them out loud —
 * "+1 (704) 387-9775" — but Vapi will only dial strict E.164. Handing it the
 * spoken form fails the transfer, and a failed transfer makes Vapi hang up.
 * Returns null when there is nothing dialable, so the caller keeps the line.
 */
export function toE164(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.length === 10) return "+1" + digits;               // US, no country code
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  if (digits.length >= 11 && digits.length <= 15) return "+" + digits;
  return null;
}

/** Ways a caller asks to stop talking to the agent and reach a human. */
const WANTS_HUMAN =
  /\b(?:(?:speak|talk|connect|put me through)\s+(?:to|with)?\s*(?:a\s+)?(?:real\s+)?(?:person|human|someone|somebody|agent|rep|representative|manager)|transfer\s+(?:me|the\s+call|this\s+call)|get\s+me\s+(?:a\s+)?(?:person|human|someone|somebody|manager)|real\s+person|actual\s+(?:person|human))\b/i;

/**
 * True once the caller has asked for a human more than once. One clarifying
 * question is good service; a second refusal is the agent putting its own
 * objective ahead of what the caller actually asked for.
 */
export function callerInsistsOnHuman(history: { role: string; content: unknown }[]): boolean {
  const asks = history.filter(
    (m) => m.role === "user" && typeof m.content === "string" && WANTS_HUMAN.test(m.content),
  );
  return asks.length >= 2;
}

/** A question is never a goodbye, however politely it is phrased. */
const ASKING = /\?|\b(what|how|why|when|where|who|which|can|could|do|does|did|is|are|will|would|should|tell me|explain|another|also|one more)\b/i;

/** Plain ways a caller signals they are finished. */
const SIGNING_OFF =
  /\b(bye|goodbye|good night|that'?s (all|it|everything)|nothing else|no,? (thanks|thank you)|i'?m (all )?(good|set|done)|we'?re (good|done)|all set|have a (good|great|nice)|take care|talk (to you )?(later|soon)|appreciate it)\b/i;

/**
 * Whether the caller actually signed off. Deliberately strict: hanging up on a
 * live caller is far worse than leaving a finished call open a few seconds
 * longer, so anything ambiguous keeps the line.
 */
export function callerIsLeaving(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (ASKING.test(t)) return false;
  return SIGNING_OFF.test(t);
}

/** The caller's most recent words — what the hang-up guard is judged against. */
function lastCallerText(history: Anthropic.MessageParam[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role === "user" && typeof m.content === "string") return m.content;
  }
  return "";
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}
