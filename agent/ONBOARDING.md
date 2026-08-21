# Onboarding a client — the 2–3 hour runbook

One client = one config file + one Render service + one Vapi assistant + one phone
number. No code changes. If a client ever needs a code change, that is a bug in the
template — fix it for everyone, in `src/`, driven by config.

**Budget the time like this:** 90 minutes writing their knowledge, 30 minutes of clicking,
15 minutes testing. The knowledge is the work; everything else is a checklist.

---

## Before you start — collect these from the client

Ask for all of it in one message, or read it off their website and confirm:

- [ ] Business name, what they do in one line, and their timezone
- [ ] Opening hours, per day
- [ ] Services they book, and how long each takes
- [ ] **A real, answerable phone** to transfer callers to — a mobile, not the line the
      agent answers. A call cannot be transferred to itself; Vapi ends the call if you try.
- [ ] The email that should get bookings and messages
- [ ] What a good call looks like for them ("book the job", "get the address and a photo")
- [ ] 20+ questions their customers actually ask, with the answers. Their FAQ page, their
      Google Business Q&A, and "what do people ring and ask?" — this is the whole product.
- [ ] When a human must take over (upset caller, billing, anything unusual)

---

## Step 1 — their config (60–90 min, mostly the FAQ)

```bash
cd agent
npm run new-client          # writes clients/<slug>.json
```

Then edit `clients/<slug>.json`:

- `services` — every bookable service with a realistic duration.
- `faq` — this is the product. Aim for 20–40 entries. It ships inside the prompt, so the
  agent answers instantly without a lookup. Write answers the way a person would say them
  out loud. **No entry, no answer** — the agent is told never to guess.
- `objective` — one line: what a good call achieves.
- `escalation.toHumanWhen` — their words, not ours.
- `greeting` — say it out loud before you commit to it.

Sanity check it locally:

```bash
BUSINESS_CONFIG=clients/<slug>.json npm start   # then open http://localhost:8787
npm test                                        # the prompt budget test must pass
```

If the latency-budget test trips, the FAQ is too long — **tighten wording or merge
entries, never raise the ceiling.** Every turn of every call pays for that prompt.

## Step 2 — their Render service (10 min)

Each client gets their own service. `BUSINESS_CONFIG` is read once at startup, so one
process serves exactly one business. New Web Service → same repo → these env vars:

| Variable | Value |
|---|---|
| `BUSINESS_CONFIG` | `clients/<slug>.json` |
| `ANTHROPIC_API_KEY` | ours |
| `MODEL` | `claude-haiku-4-5` |
| `PUBLIC_BASE_URL` | the new service's own URL |
| `ADMIN_TOKEN` | a fresh random string, per client |
| `VOICE_CALL_CONTROL` | `on` |
| `NOTIFY_EMAIL` | **the client's** email |
| `SMTP_HOST` / `PORT` / `USER` / `PASS` / `FROM` | ours |
| `CALENDAR` | `google` (see step 3) or leave unset for `mock` |

Cost per client: ~$7/mo Render + ~$2/mo number + usage. Bill the setup fee up front.

## Step 3 — a calendar (15 min)

Most local businesses are on Vagaro, Booksy, Jobber or Housecall Pro, and **we do not
integrate with any of them yet.** For a pilot, do not try:

1. Create a Google Calendar for them (or use one they already have).
2. Share it with the service account's `client_email`, "Make changes to events".
3. Set `CALENDAR=google`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID`.
4. Prove it: `/api/admin/calendar-check?token=<ADMIN_TOKEN>` → `"ok": true`.

Then share that calendar with the client so bookings appear on their phone. If they insist
on their own system, that is a real integration — quote it separately, do not promise it
in the pilot.

## Step 4 — Vapi (20 min)

New assistant. Every one of these matters; each has cost us a live call:

- **Model**: provider `Custom LLM`, URL `https://<their-service>.onrender.com/api/vapi`
  — the **base** URL. Vapi appends `/chat/completions` itself. Pasting the full path
  doubles it and every call fails with the backend looking idle.
- **Tools**: declare `endCall` and `transferCall`. Without them the agent can ask to hang
  up or transfer all it likes and nothing happens on the line.
- **transferCall destination**: the client's real answerable phone. Fill in
  **"Message to Customer"** — we deliberately send no words of our own on a transfer, so
  that field is what the caller hears.
- **Server URL**: `https://<their-service>.onrender.com/api/vapi/function` — this is what
  sends the end-of-call transcript email and records billable minutes. Blank means no
  transcripts, silently.
- **Transcriber**: Deepgram, Nova 2 Phonecall.
- **First Message**: their greeting, word for word. Not "Hello."
- Buy a local number in their area code and attach the assistant.

## Step 5 — test before you hand it over (15 min)

Do all five. Do not skip the call.

1. `/api/health` → brain connected, calendar as expected, message alerts on.
2. `/api/admin/test-email?token=…` → returns ok, and an email actually arrives.
3. `/api/admin/calendar-check?token=…` → `"ok": true`.
4. **Ring the number and book something.** Ask two of their FAQ questions. Ask for a
   person. Say "that's all" and check it hangs up politely.
5. `/api/admin/diagnostics?token=…` → read the last turns. `toolsFromVapi` must list the
   transfer and end-call tools, and `tookMs` should sit around 1–2 seconds a turn.

Confirm the client got: the booking email with the caller's number, and the transcript.

## Step 6 — hand over

Give them: the number, what it can answer, what it escalates, and the email alerts they
will get. Tell them how to reach you for FAQ changes — expect two or three rounds in the
first fortnight, and treat every one as a template improvement if it is not specific to
them.

---

## Known limits — say these out loud before taking money

- **Their booking system.** Google Calendar only. Vagaro / Booksy / Jobber / Housecall
  are not integrated.
- **Everything is in memory.** Bookings, messages and billable minutes reset on every
  deploy. The emails are the durable record until there is a database. Do not promise
  usage reporting yet.
- **Inbound only.** No outbound calling — that is a robocall under TCPA and needs legal
  review first.
- **One service per client.** Fine for the first handful; past five it wants the
  multi-tenant routing that is still on the roadmap.
