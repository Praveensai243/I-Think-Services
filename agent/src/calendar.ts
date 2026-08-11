import { google } from "googleapis";
import { business, env, usingGoogle, usingCalcom } from "./config.js";

export interface Slot {
  startISO: string;
  label: string; // human, e.g. "Thursday at 2:30 PM"
}

export interface Booking {
  id: string;
  name: string;
  phone: string;
  service: string;
  startISO: string;
  endISO: string;
  status: "confirmed" | "cancelled";
}

// ── timezone helpers (no external date lib) ──────────────────────
function partsInTz(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) if (p.type !== "literal") map[p.type] = p.value;
  return { y: +map.year, m: +map.month, d: +map.day, hh: +map.hour, mm: +map.minute, ss: +map.second };
}
/** ms to add to a UTC instant to read it as wall-clock time in `tz`. */
function tzOffset(date: Date, tz: string): number {
  const p = partsInTz(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - date.getTime();
}
/** Convert a wall-clock time in `tz` to a real UTC Date. */
function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  return new Date(guess - tzOffset(new Date(guess), tz));
}
function labelFor(startISO: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: business.timezone,
    weekday: "long", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(startISO));
}
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function serviceMinutes(service?: string): number {
  const s = business.services.find(
    (x) => x.id === service || x.name.toLowerCase() === (service ?? "").toLowerCase(),
  );
  return s?.minutes ?? business.slotMinutes;
}

// ── mock backend (keyless demo mode) ─────────────────────────────
const mockBookings = new Map<string, Booking>();

// ── Cal.com backend (v1 API; best-effort, validate with your key) ──
async function calcom(path: string, init?: RequestInit): Promise<any> {
  const base = "https://api.cal.com/v1";
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${base}${path}${sep}apiKey=${env.calcom.apiKey}`, init);
  if (!res.ok) throw new Error(`calcom ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}
function phoneEmail(phone: string): string {
  // Cal.com requires an attendee email; synthesize a stable placeholder for phone-only callers.
  return `caller-${phone.replace(/\D/g, "") || "unknown"}@phone.invalid`;
}

// ── Google backend ───────────────────────────────────────────────
function googleClient() {
  const oauth = new google.auth.OAuth2(
    env.google.clientId, env.google.clientSecret, env.google.redirectUri,
  );
  oauth.setCredentials({ refresh_token: env.google.refreshToken });
  return google.calendar({ version: "v3", auth: oauth });
}

async function busyIntervals(fromISO: string, toISO: string): Promise<[number, number][]> {
  if (usingCalcom) {
    const data = await calcom(`/bookings`);
    return (data.bookings ?? [])
      .filter((b: any) => !/cancel/i.test(String(b.status ?? "")))
      .map((b: any) => [Date.parse(b.startTime), Date.parse(b.endTime)] as [number, number])
      .filter(([s, e]: [number, number]) => !isNaN(s) && !isNaN(e));
  }
  if (!usingGoogle) {
    return [...mockBookings.values()]
      .filter((b) => b.status === "confirmed")
      .map((b) => [Date.parse(b.startISO), Date.parse(b.endISO)] as [number, number]);
  }
  const cal = googleClient();
  const res = await cal.freebusy.query({
    requestBody: {
      timeMin: fromISO, timeMax: toISO, timeZone: business.timezone,
      items: [{ id: env.google.calendarId }],
    },
  });
  const busy = res.data.calendars?.[env.google.calendarId]?.busy ?? [];
  return busy.map((b) => [Date.parse(b.start!), Date.parse(b.end!)] as [number, number]);
}

// ── public API used by the tools ─────────────────────────────────

/** Real open slots over the next `days`, honoring business hours + existing bookings. */
export async function getAvailability(opts: {
  service?: string;
  onISODate?: string; // limit to one YYYY-MM-DD (business-local)
  days?: number;
  limit?: number;
}): Promise<Slot[]> {
  const days = opts.days ?? 5;
  const limit = opts.limit ?? 6;
  const step = business.slotMinutes;
  const need = serviceMinutes(opts.service);
  const now = new Date();
  const fromISO = now.toISOString();
  const toISO = new Date(now.getTime() + (days + 1) * 864e5).toISOString();
  const busy = await busyIntervals(fromISO, toISO);
  const overlaps = (s: number, e: number) => busy.some(([bs, be]) => s < be && e > bs);

  const slots: Slot[] = [];
  for (let i = 0; i < days + 1 && slots.length < limit * 3; i++) {
    const probe = new Date(now.getTime() + i * 864e5);
    const p = partsInTz(probe, business.timezone);
    const dateStr = `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
    if (opts.onISODate && dateStr !== opts.onISODate) continue;
    // weekday of this business-local date (noon avoids DST edges)
    const dow = DOW[zonedToUtc(p.y, p.m, p.d, 12, 0, business.timezone).getUTCDay()];
    const open = business.hours[dow];
    if (!open) continue;
    const [oh, om] = open[0].split(":").map(Number);
    const [ch, cm] = open[1].split(":").map(Number);
    const closeMin = ch * 60 + cm;
    for (let t = oh * 60 + om; t + need <= closeMin; t += step) {
      const start = zonedToUtc(p.y, p.m, p.d, Math.floor(t / 60), t % 60, business.timezone);
      const end = new Date(start.getTime() + need * 60000);
      if (start.getTime() <= now.getTime() + 60 * 60000) continue; // at least 1h out
      if (overlaps(start.getTime(), end.getTime())) continue;
      slots.push({ startISO: start.toISOString(), label: labelFor(start.toISOString()) });
      if (slots.length >= limit) return slots;
    }
  }
  return slots;
}

export async function book(input: {
  name: string; phone: string; service: string; startISO: string;
}): Promise<{ ok: boolean; booking?: Booking; reason?: string }> {
  const need = serviceMinutes(input.service);
  const start = new Date(input.startISO);
  if (isNaN(start.getTime())) return { ok: false, reason: "invalid_time" };
  const end = new Date(start.getTime() + need * 60000);
  const busy = await busyIntervals(start.toISOString(), end.toISOString());
  if (busy.some(([bs, be]) => start.getTime() < be && end.getTime() > bs)) {
    return { ok: false, reason: "slot_taken" };
  }
  const svc = business.services.find((s) => s.id === input.service || s.name.toLowerCase() === input.service.toLowerCase());
  const summary = `${svc?.name ?? input.service} — ${input.name}`;

  if (usingCalcom) {
    const data = await calcom(`/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventTypeId: Number(env.calcom.eventTypeId),
        start: start.toISOString(),
        timeZone: business.timezone,
        language: "en",
        metadata: { phone: input.phone, service: svc?.name ?? input.service },
        responses: { name: input.name, email: phoneEmail(input.phone) },
      }),
    });
    const b = data.booking ?? data;
    return {
      ok: true,
      booking: {
        id: String(b.uid ?? b.id ?? "calcom"), name: input.name, phone: input.phone,
        service: svc?.name ?? input.service, startISO: start.toISOString(),
        endISO: end.toISOString(), status: "confirmed",
      },
    };
  }

  if (usingGoogle) {
    const cal = googleClient();
    const res = await cal.events.insert({
      calendarId: env.google.calendarId,
      requestBody: {
        summary,
        description: `Booked by AI receptionist.\nCaller: ${input.name}\nPhone: ${input.phone}`,
        start: { dateTime: start.toISOString(), timeZone: business.timezone },
        end: { dateTime: end.toISOString(), timeZone: business.timezone },
      },
    });
    return {
      ok: true,
      booking: {
        id: res.data.id ?? "google-event", name: input.name, phone: input.phone,
        service: svc?.name ?? input.service, startISO: start.toISOString(),
        endISO: end.toISOString(), status: "confirmed",
      },
    };
  }

  const booking: Booking = {
    id: "bk_" + Math.random().toString(36).slice(2, 9),
    name: input.name, phone: input.phone, service: svc?.name ?? input.service,
    startISO: start.toISOString(), endISO: end.toISOString(), status: "confirmed",
  };
  mockBookings.set(booking.id, booking);
  return { ok: true, booking };
}

/** Find the caller's upcoming booking by phone (last 4 digits) or name. */
async function findBooking(match: { phone?: string; name?: string }): Promise<Booking | undefined> {
  const last4 = (match.phone ?? "").replace(/\D/g, "").slice(-4);
  const name = (match.name ?? "").trim().toLowerCase();
  if (usingCalcom) {
    const data = await calcom(`/bookings`);
    const ev = (data.bookings ?? []).find((b: any) => {
      if (/cancel/i.test(String(b.status ?? ""))) return false;
      const blob = `${b.title ?? ""} ${JSON.stringify(b.metadata ?? {})} ${JSON.stringify(b.attendees ?? [])}`.toLowerCase();
      return (last4 && blob.includes(last4)) || (name && blob.includes(name));
    });
    if (!ev) return undefined;
    return {
      id: String(ev.uid ?? ev.id), name: match.name ?? "", phone: match.phone ?? "",
      service: ev.title ?? "", startISO: ev.startTime ?? "", endISO: ev.endTime ?? "", status: "confirmed",
    };
  }
  if (usingGoogle) {
    const cal = googleClient();
    const res = await cal.events.list({
      calendarId: env.google.calendarId,
      timeMin: new Date().toISOString(),
      singleEvents: true, orderBy: "startTime", maxResults: 20,
    });
    const ev = (res.data.items ?? []).find((e) => {
      const blob = `${e.summary ?? ""} ${e.description ?? ""}`.toLowerCase();
      return (last4 && blob.includes(last4)) || (name && blob.includes(name));
    });
    if (!ev) return undefined;
    return {
      id: ev.id!, name: match.name ?? "", phone: match.phone ?? "",
      service: ev.summary ?? "", startISO: ev.start?.dateTime ?? "",
      endISO: ev.end?.dateTime ?? "", status: "confirmed",
    };
  }
  return [...mockBookings.values()].find((b) => {
    if (b.status !== "confirmed") return false;
    const blob = `${b.name} ${b.phone}`.toLowerCase();
    return (last4 && b.phone.replace(/\D/g, "").endsWith(last4)) || (name && blob.includes(name));
  });
}

export async function reschedule(input: {
  phone?: string; name?: string; newStartISO: string;
}): Promise<{ ok: boolean; booking?: Booking; reason?: string }> {
  const existing = await findBooking(input);
  if (!existing) return { ok: false, reason: "not_found" };
  const cancelled = await cancel({ phone: input.phone, name: input.name });
  if (!cancelled.ok) return { ok: false, reason: "not_found" };
  return book({
    name: existing.name || input.name || "Caller",
    phone: existing.phone || input.phone || "",
    service: existing.service,
    startISO: input.newStartISO,
  });
}

export async function cancel(input: {
  phone?: string; name?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const existing = await findBooking(input);
  if (!existing) return { ok: false, reason: "not_found" };
  if (usingCalcom) {
    await calcom(`/bookings/${existing.id}/cancel`, { method: "POST" });
    return { ok: true };
  }
  if (usingGoogle) {
    const cal = googleClient();
    await cal.events.delete({ calendarId: env.google.calendarId, eventId: existing.id });
    return { ok: true };
  }
  const b = mockBookings.get(existing.id);
  if (b) b.status = "cancelled";
  return { ok: true };
}
