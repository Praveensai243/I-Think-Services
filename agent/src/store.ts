import type Anthropic from "@anthropic-ai/sdk";

/** A conversation turn history keyed by session id (in-memory; swap for Redis in prod). */
export interface Session {
  id: string;
  messages: Anthropic.MessageParam[];
  createdAt: number;
  updatedAt: number;
}

const sessions = new Map<string, Session>();

export function getSession(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = { id, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    sessions.set(id, s);
  }
  return s;
}

export function resetSession(id: string): void {
  sessions.delete(id);
}

// Simple durable-ish logs the front desk would want to see.
export interface MessageNote { name: string; phone?: string; message: string; at: string; sessionId: string }
export interface Handoff { reason: string; at: string; sessionId: string }

export const messageLog: MessageNote[] = [];
export const handoffLog: Handoff[] = [];

// prune old sessions occasionally so memory doesn't grow unbounded
setInterval(() => {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000; // 6h
  for (const [id, s] of sessions) if (s.updatedAt < cutoff) sessions.delete(id);
}, 30 * 60 * 1000).unref?.();
