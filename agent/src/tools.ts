import type Anthropic from "@anthropic-ai/sdk";
import { business } from "./config.js";
import { getAvailability, book, reschedule, cancel } from "./calendar.js";
import { messageLog, handoffLog } from "./store.js";

/**
 * Tool definitions shared by BOTH surfaces:
 *  - the browser demo (Claude calls these in a manual agent loop), and
 *  - the phone agent (Vapi calls the same functions over the webhook).
 * Descriptions are prescriptive about WHEN to call each — this drives good behavior.
 */
export const tools: Anthropic.Tool[] = [
  {
    name: "check_availability",
    description:
      "Get real open appointment slots before offering any time to the caller. Always call this first when the caller wants to book or asks what's available. Returns a list of slots, each with a human label and an exact start_iso to pass to book_appointment.",
    input_schema: {
      type: "object",
      properties: {
        service: {
          type: "string",
          description: `Service id or name if known. One of: ${business.services.map((s) => s.id).join(", ")}. Optional.`,
        },
        on_date: {
          type: "string",
          description: "Optional YYYY-MM-DD to limit results to one day (business-local date).",
        },
      },
    },
  },
  {
    name: "book_appointment",
    description:
      "Book a slot once you have the caller's full name, a callback phone number, the service, and a start_iso from check_availability. Returns a confirmation.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Caller's full name." },
        phone: { type: "string", description: "Callback phone number." },
        service: { type: "string", description: "Service id or name." },
        start_iso: { type: "string", description: "Exact slot start (ISO 8601) from check_availability." },
      },
      required: ["name", "phone", "service", "start_iso"],
    },
  },
  {
    name: "reschedule_appointment",
    description:
      "Move the caller's existing appointment to a new slot. Call check_availability first to get the new start_iso. Identify the booking by phone or name.",
    input_schema: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Phone on the existing booking." },
        name: { type: "string", description: "Name on the existing booking." },
        new_start_iso: { type: "string", description: "New slot start (ISO 8601) from check_availability." },
      },
      required: ["new_start_iso"],
    },
  },
  {
    name: "cancel_appointment",
    description: "Cancel the caller's existing appointment, identified by phone or name.",
    input_schema: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Phone on the existing booking." },
        name: { type: "string", description: "Name on the existing booking." },
      },
    },
  },
  {
    name: "answer_faq",
    description:
      "Look up a factual answer about the business (hours, location, insurance, parking, payment, new patients). Call this for factual questions instead of guessing.",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "What the caller asked about, e.g. 'insurance', 'parking', 'address'." },
      },
      required: ["topic"],
    },
  },
  {
    name: "take_message",
    description:
      "Record a message for the team when the caller wants to leave a note rather than book, or when the right person isn't available.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Caller's name." },
        phone: { type: "string", description: "Callback number." },
        message: { type: "string", description: "The message to pass along." },
      },
      required: ["name", "message"],
    },
  },
  {
    name: "transfer_to_human",
    description:
      "Hand the call to a person when the caller asks for one, is upset, has a billing dispute, or the situation is beyond scheduling. Returns the number/instructions to connect them.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Short reason for the transfer." },
      },
      required: ["reason"],
    },
  },
];

type Json = Record<string, unknown>;

/** Execute a tool by name and return a compact JSON-serializable result. */
export async function runTool(name: string, input: Json, sessionId: string): Promise<Json> {
  switch (name) {
    case "check_availability": {
      const slots = await getAvailability({
        service: input.service as string | undefined,
        onISODate: input.on_date as string | undefined,
      });
      return {
        slots: slots.map((s) => ({ start_iso: s.startISO, when: s.label })),
        note: slots.length ? "Offer only these times." : "No open slots in that window; suggest another day.",
      };
    }
    case "book_appointment": {
      const r = await book({
        name: String(input.name), phone: String(input.phone),
        service: String(input.service), startISO: String(input.start_iso),
      });
      if (!r.ok) return { ok: false, reason: r.reason ?? "could_not_book" };
      return {
        ok: true, confirmation: r.booking!.id,
        when: new Date(r.booking!.startISO).toISOString(),
        service: r.booking!.service, reminder: "A text/email reminder will be sent.",
      };
    }
    case "reschedule_appointment": {
      const r = await reschedule({
        phone: input.phone as string | undefined, name: input.name as string | undefined,
        newStartISO: String(input.new_start_iso),
      });
      if (!r.ok) return { ok: false, reason: r.reason ?? "could_not_reschedule" };
      return { ok: true, confirmation: r.booking!.id, when: r.booking!.startISO, service: r.booking!.service };
    }
    case "cancel_appointment": {
      const r = await cancel({ phone: input.phone as string | undefined, name: input.name as string | undefined });
      return r.ok ? { ok: true } : { ok: false, reason: r.reason ?? "not_found" };
    }
    case "answer_faq": {
      const topic = String(input.topic ?? "").toLowerCase();
      const hit = business.faq.find(
        (f) => topic.includes(f.q) || f.q.includes(topic) || f.a.toLowerCase().includes(topic),
      );
      return hit ? { answer: hit.a } : { answer: null, note: "No exact match; offer to take a message or transfer." };
    }
    case "take_message": {
      messageLog.push({
        name: String(input.name), phone: input.phone ? String(input.phone) : undefined,
        message: String(input.message), at: new Date().toISOString(), sessionId,
      });
      return { ok: true };
    }
    case "transfer_to_human": {
      handoffLog.push({ reason: String(input.reason ?? ""), at: new Date().toISOString(), sessionId });
      return { ok: true, number: business.phoneForHumans, action: "connect_to_human" };
    }
    default:
      return { ok: false, reason: `unknown_tool:${name}` };
  }
}
