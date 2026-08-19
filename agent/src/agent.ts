import Anthropic from "@anthropic-ai/sdk";
import { env, hasBrain, business } from "./config.js";
import { systemPromptStable, systemPromptLive } from "./prompt.js";
import { tools, runTool } from "./tools.js";
import { getSession } from "./store.js";
import { recordWebTurn } from "./usage.js";

/**
 * The SDK waits TEN MINUTES by default before giving up on a request. On a
 * phone call that is not a timeout, it is a dead line: the caller hears
 * nothing, hangs up, and the turn deadline below never fires because it only
 * gets a look in between rounds, never during one. Bound it hard, and prefer
 * an honest apology over silence.
 */
const client = hasBrain
  ? new Anthropic({ apiKey: env.anthropicKey, timeout: 8000, maxRetries: 1 })
  : null;

export interface AgentTurn {
  reply: string;
  actions: { tool: string; result: Record<string, unknown> }[];
  /** Set when the caller should be connected to a person; the phone endpoint acts on it. */
  transfer?: { number: string };
  /** Set when the agent decided the conversation is over and the line should close. */
  ended?: boolean;
  /** Where the seconds went. The only way to tell a slow turn from a dead one. */
  timing?: TurnTiming;
}

const MAX_TOOL_ROUNDS = 6;

/**
 * How long one turn may spend thinking and calling tools before it must say
 * something.
 *
 * A caller hears a long turn as the line going dead — they have no way to tell
 * "still working" from "crashed", and the phone platform eventually gives up
 * and talks over us. Six tool rounds against a calendar API can run far past
 * anyone's patience, so the loop stops at the deadline and speaks a holding
 * line instead. Whatever the tools already did is done and stays done; the
 * caller's next words carry on from there.
 */
const TURN_DEADLINE_MS = Number(process.env.VOICE_TURN_DEADLINE_MS ?? 8000);

/** Wall-clock cost of each thing a turn did, for the diagnostics trail. */
export interface TurnTiming { totalMs: number; model: number[]; tools: { name: string; ms: number }[] }

const NOT_CONNECTED =
  `(${business.agentName} is not connected yet.) Add an ANTHROPIC_API_KEY to the ` +
  `server so the agent can think and talk.`;

/**
 * The core brain. Runs the Claude tool-use loop over a message history:
 * think -> maybe call booking tools -> read results -> reply. Mutates `history`
 * in place (appends assistant + tool turns). Shared by the browser demo and the
 * phone agent so there is exactly one brain.
 */
export async function runAgent(
  history: Anthropic.MessageParam[], sessionId: string, source: "web" | "phone",
  ctx: { callerPhone?: string } = {},
): Promise<AgentTurn> {
  if (!client) return { reply: NOT_CONNECTED, actions: [] };

  const actions: AgentTurn["actions"] = [];
  let transfer: AgentTurn["transfer"];
  let ended = false;
  const startedAt = Date.now();
  const timing: TurnTiming = { totalMs: 0, model: [], tools: [] };
  const done = (reply: string): AgentTurn => {
    timing.totalMs = Date.now() - startedAt;
    return { reply, actions, transfer, ended, timing };
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (round > 0 && Date.now() - startedAt > TURN_DEADLINE_MS) {
      // Out of time, not out of rounds. Say something rather than leave the
      // line silent — silence is the one failure a caller cannot work around.
      console.warn(`turn deadline hit after ${Date.now() - startedAt}ms and ${round} round(s)`);
      const reply = "Let me get that sorted for you — one moment.";
      history.push({ role: "assistant", content: reply });
      return done(reply);
    }

    const calledAt = Date.now();
    const res = await client.messages.create({
      model: env.model,
      max_tokens: 1024,
      // Two blocks, not one string. The first is byte-identical on every turn
      // and every call, so it can be cached; the clock and the caller's number
      // go after it, because a cache is a prefix match and the clock line
      // changes every minute.
      system: [
        { type: "text", text: systemPromptStable(), cache_control: { type: "ephemeral" } },
        { type: "text", text: systemPromptLive(ctx) },
      ],
      tools,
      messages: history,
    });
    timing.model.push(Date.now() - calledAt);

    if (res.stop_reason === "refusal") {
      const reply = "I'm sorry, I can't help with that one — let me connect you with someone who can.";
      history.push({ role: "assistant", content: reply });
      return done(reply);
    }

    // record the assistant turn verbatim (tool_use blocks must be preserved)
    history.push({ role: "assistant", content: res.content });

    const toolUses = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUses.length === 0 || res.stop_reason !== "tool_use") {
      const reply = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim();
      return done(reply || "…");
    }

    // execute every requested tool, return all results in one user turn
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      // A tool that throws must not take the call down with it. Google Calendar,
      // SMTP and Cal.com are all network calls that fail sometimes; letting the
      // exception escape killed the whole turn, and because the agent then
      // retried the same tool on the next thing the caller said, the call was
      // stuck repeating a canned error forever. Hand the failure back as a tool
      // result instead so the agent can apologise and take a message.
      let out: Record<string, unknown>;
      const toolAt = Date.now();
      try {
        out = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, sessionId, source);
      } catch (err) {
        console.error(`tool ${tu.name} failed:`, err);
        out = {
          ok: false,
          error: "tool_failed",
          tell_caller:
            "Something went wrong saving that. Apologise briefly, do NOT try the same thing again, and offer to take a message or put them through to a person.",
        };
      }
      timing.tools.push({ name: tu.name, ms: Date.now() - toolAt });
      actions.push({ tool: tu.name, result: out });
      if (tu.name === "transfer_to_human" && out.number) transfer = { number: String(out.number) };
      if (tu.name === "end_call") ended = true;
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
    }
    history.push({ role: "user", content: results });
  }

  const reply = "Let me get that sorted for you — one moment.";
  history.push({ role: "assistant", content: reply });
  return done(reply);
}

/** Browser-demo entry point: keeps per-session history and records web usage. */
export async function respond(sessionId: string, userText: string): Promise<AgentTurn> {
  const session = getSession(sessionId);
  session.messages.push({ role: "user", content: userText });
  session.updatedAt = Date.now();
  recordWebTurn(sessionId);
  return runAgent(session.messages, sessionId, "web");
}
