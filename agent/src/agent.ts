import Anthropic from "@anthropic-ai/sdk";
import { env, hasBrain, business } from "./config.js";
import { systemPrompt } from "./prompt.js";
import { tools, runTool } from "./tools.js";
import { getSession } from "./store.js";

const client = hasBrain ? new Anthropic({ apiKey: env.anthropicKey }) : null;

export interface AgentTurn {
  reply: string;
  actions: { tool: string; result: Record<string, unknown> }[];
  transfer?: { number: string };
}

const MAX_TOOL_ROUNDS = 6;

/**
 * Drive one user turn to a spoken reply. Runs the Claude tool-use loop:
 * think -> maybe call booking tools -> read results -> reply. The same brain
 * powers the browser demo and (via the Vapi webhook) live phone calls.
 */
export async function respond(sessionId: string, userText: string): Promise<AgentTurn> {
  const session = getSession(sessionId);
  session.messages.push({ role: "user", content: userText });
  session.updatedAt = Date.now();

  if (!client) {
    return {
      reply:
        `(${business.agentName} is not connected yet.) Add an ANTHROPIC_API_KEY to the server's ` +
        `.env to make the agent think and talk. Your message was received.`,
      actions: [],
    };
  }

  const actions: AgentTurn["actions"] = [];
  let transfer: AgentTurn["transfer"];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Short replies keep the receptionist fast for voice. We avoid model-specific
    // knobs (e.g. effort) so MODEL can be swapped freely — including to
    // claude-haiku-4-5 for the lowest phone latency.
    const res = await client.messages.create({
      model: env.model,
      max_tokens: 1024,
      system: systemPrompt(),
      tools,
      messages: session.messages,
    });

    if (res.stop_reason === "refusal") {
      const reply = "I'm sorry, I can't help with that one — let me connect you with someone who can.";
      session.messages.push({ role: "assistant", content: reply });
      return { reply, actions, transfer };
    }

    // record the assistant turn verbatim (tool_use blocks must be preserved)
    session.messages.push({ role: "assistant", content: res.content });

    const toolUses = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUses.length === 0 || res.stop_reason !== "tool_use") {
      const reply = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim();
      return { reply: reply || "…", actions, transfer };
    }

    // execute every requested tool, return all results in one user turn
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const out = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, sessionId);
      actions.push({ tool: tu.name, result: out });
      if (tu.name === "transfer_to_human" && out.number) transfer = { number: String(out.number) };
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
    }
    session.messages.push({ role: "user", content: results });
  }

  // Safety valve if the model kept calling tools past the cap.
  const reply = "Let me get that sorted for you — one moment.";
  session.messages.push({ role: "assistant", content: reply });
  return { reply, actions, transfer };
}
