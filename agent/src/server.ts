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
    if (env.vapiSecret) {
      const bearer = (req.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const tok = bearer || req.get("x-vapi-secret");
      if (tok !== env.vapiSecret) return res.status(401).json({ error: "unauthorized" });
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
    let reply = "…";
    try {
      const out = await runAgent(history, "vapi:" + callId, "phone");
      reply = out.reply || "…";
    } catch (err) {
      console.error("custom-llm error", err);
      reply = "Sorry, I didn't catch that — could you say it again?";
    }

    const id = "chatcmpl-" + Date.now();
    const created = Math.floor(Date.now() / 1000);
    const model = body.model || env.model;

    if (body.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const chunk = (delta: object, finish: string | null) =>
        `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
      res.write(chunk({ role: "assistant", content: reply }, null));
      res.write(chunk({}, "stop"));
      res.write("data: [DONE]\n\n");
      return res.end();
    }
    res.json({
      id, object: "chat.completion", created, model,
      choices: [{ index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
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

  app.get("/api/admin/data", requireAdmin, (_req, res) => {
    res.json({
      usage: getUsage(),
      bookings: bookingLog.slice(0, 50),
      messages: messageLog.slice(-50).reverse(),
      handoffs: handoffLog.slice(0, 50),
      billing: billingEnabled(),
    });
  });

  app.get("/admin", (_req, res) => res.sendFile(resolve(__dirname, "../public/admin.html")));

  // ── static: the browser voice demo ─────────────────────────────
  app.use(express.static(resolve(__dirname, "../public")));
  app.get("/", (_req, res) => res.sendFile(resolve(__dirname, "../public/demo.html")));

  return app;
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
