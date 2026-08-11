import express, { type Request, type Response, type NextFunction } from "express";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { business, env, hasBrain, usingGoogle, usingCalcom } from "./config.js";
import { systemPrompt } from "./prompt.js";
import { tools, runTool } from "./tools.js";
import { respond } from "./agent.js";
import { resetSession, messageLog, handoffLog, bookingLog } from "./store.js";
import { getUsage, recordPhoneCall } from "./usage.js";
import { billingEnabled, createCheckout, verifyWebhook } from "./billing.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function calendarLabel(): string {
  return usingGoogle ? "google" : usingCalcom ? "calcom" : "mock";
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

  app.get("/api/vapi/assistant", (_req, res) => {
    res.json({
      name: `${business.name} — Receptionist`,
      firstMessage: business.greeting,
      model: {
        provider: "anthropic",
        model: env.model,
        temperature: 0.4,
        messages: [{ role: "system", content: systemPrompt() }],
        tools: tools.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.input_schema },
          server: { url: `${env.publicBaseUrl}/api/vapi/function` },
        })),
      },
      voice: env.elevenLabsVoiceId
        ? { provider: "11labs", voiceId: env.elevenLabsVoiceId }
        : { provider: "vapi", voiceId: "Elliot" },
      transcriber: { provider: "deepgram", model: "nova-2" },
      server: { url: `${env.publicBaseUrl}/api/vapi/function` },
      _note:
        "Create this assistant in Vapi, attach a phone number, and set the tool server secret to match VAPI_SECRET.",
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
