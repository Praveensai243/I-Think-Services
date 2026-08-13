import Anthropic from "@anthropic-ai/sdk";
import { env, hasBrain, business } from "./config.js";
import { systemPrompt } from "./prompt.js";
import { tools, runTool } from "./tools.js";
import { getSession } from "./store.js";
import { recordWebTurn } from "./usage.js";

const client = hasBrain ? new Anthropic({ apiKey: env.anthropicKey }) : null;

export interface AgentTurn {
  reply: string;
  actions: { tool: string; result: Record<string, unknown> }[];
  transfer?: { number: string };
  /** The agent decided the conversation is over and the call should hang up. */
  ended?: boolean;
}

export interface RunOptions {
  /**
   * Called with each text fragment as Claude produces it. On a phone call this is
   * what lets speech start on the first few words instead of waiting for the whole
   * reply — the single biggest lever on perceived latency.
   */
  onText?: (delta: string) => void;
}

const MAX_TOOL_ROUNDS = 6;

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
  opts: RunOptions = {},
): Promise<AgentTurn> {
  if (!client) return { reply: NOT_CONNECTED, actions: [] };

  const actions: AgentTurn["actions"] = [];
  let transfer: AgentTurn["transfer"];
  let ended = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const params = {
      model: env.model,
      max_tokens: 1024,
      system: systemPrompt(),
      tools,
      messages: history,
    };
    // Streaming also covers the pre-tool round, so the caller hears "let me check
    // that for you" while a booking lookup runs instead of dead air.
    let res: Anthropic.Message;
    if (opts.onText) {
      const stream = client.messages.stream(params);
      stream.on("text", (delta) => opts.onText!(delta));
      res = await stream.finalMessage();
    } else {
      res = await client.messages.create(params);
    }

    if (res.stop_reason === "refusal") {
      const reply = "I'm sorry, I can't help with that one — let me connect you with someone who can.";
      history.push({ role: "assistant", content: reply });
      return { reply, actions, transfer, ended };
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
      return { reply: reply || "…", actions, transfer, ended };
    }

    // execute every requested tool, return all results in one user turn
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const out = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, sessionId, source);
      actions.push({ tool: tu.name, result: out });
      if (tu.name === "transfer_to_human" && out.number) transfer = { number: String(out.number) };
      if (tu.name === "end_call") ended = true;
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
    }
    history.push({ role: "user", content: results });

    // Nothing useful follows a hang-up — stop the loop instead of asking Claude
    // for another turn the caller will never hear.
    if (ended) {
      const said = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text).join(" ").trim();
      return { reply: said || "Thanks for calling — goodbye!", actions, transfer, ended };
    }
  }

  const reply = "Let me get that sorted for you — one moment.";
  history.push({ role: "assistant", content: reply });
  return { reply, actions, transfer, ended };
}

/** Browser-demo entry point: keeps per-session history and records web usage. */
export async function respond(sessionId: string, userText: string): Promise<AgentTurn> {
  const session = getSession(sessionId);
  session.messages.push({ role: "user", content: userText });
  session.updatedAt = Date.now();
  recordWebTurn(sessionId);
  return runAgent(session.messages, sessionId, "web");
}
