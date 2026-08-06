# I Think Services — AI Receptionist (voice + web)

A real, working AI receptionist you can **demo in the browser today** and put on a
**live phone number** when you're ready. One brain (Claude) + one set of booking
tools power both. It answers questions, books/reschedules/cancels appointments in
your calendar, takes messages, and hands off to a human when it should.

```
                     ┌─────────────────────────────┐
  Browser mic  ─────▶│                             │
  (Web Speech)       │   Claude brain (agent.ts)   │──▶ Google Calendar
                     │   + booking tools (tools.ts)│    (or keyless mock)
  Phone call ───────▶│                             │──▶ Messages / human transfer
  (Vapi + Twilio)    └─────────────────────────────┘
```

**It runs with zero paid accounts in demo mode** (mock calendar + typed chat), and
lights up feature-by-feature as you add keys. Nothing here is a stub — availability,
booking, conflict-checking, rescheduling and cancellation all actually work.

---

## 1. Run it now (60 seconds, no accounts)

```bash
cd agent
npm install
npm start          # http://localhost:8787
```

Open the URL, click the mic (Chrome works best) or just type. In this **demo mode**
the agent uses a keyless in-memory calendar. Add the Claude key below to make it
actually think and talk.

---

## 2. Make the agent talk — add Claude (the only key that matters first)

1. Go to **https://console.anthropic.com → API Keys → Create Key**.
2. `cp .env.example .env` and paste it into `ANTHROPIC_API_KEY`.
3. Restart (`npm start`). Now the browser demo is a real conversation with the
   receptionist — it answers, books into the mock calendar, and speaks back.

Cost is tiny: a full booking conversation is a few cents. For the **lowest phone
latency**, set `MODEL=claude-haiku-4-5` in `.env` (fastest); `claude-opus-5` (the
default) is the smartest but slower.

---

## 3. Book into a real calendar — Google

Set `CALENDAR=google` and fill the Google vars in `.env`:

1. **console.cloud.google.com** → create a project → enable the **Google Calendar API**.
2. **APIs & Services → Credentials → Create OAuth client ID → Web application.**
   Add redirect URI `http://localhost:8787/oauth2/callback`. Copy the client ID/secret
   into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
3. Generate a **refresh token** for the account that owns the calendar (use the
   [OAuth Playground](https://developers.google.com/oauthplayground/) with scope
   `https://www.googleapis.com/auth/calendar`, "Use your own OAuth credentials"),
   and paste it into `GOOGLE_REFRESH_TOKEN`.
4. Set `GOOGLE_CALENDAR_ID` (`primary`, or a specific calendar's id).

The agent now reads live availability and writes real events — no double-booking.

---

## 4. Put it on a real phone number — Vapi + Twilio + ElevenLabs

The **same tools** serve the phone; the agent config is generated for you.

1. Deploy this server somewhere public (Render/Fly/Railway/a VM). Set
   `PUBLIC_BASE_URL` to its https URL and a `VAPI_SECRET` of your choosing.
2. **vapi.ai** → sign up → **buy/import a phone number** (Vapi resells Twilio, or
   bring your own Twilio number).
3. Create an **Assistant**. Fetch a ready-made config from your running server:
   `GET {PUBLIC_BASE_URL}/api/vapi/assistant` — it already contains the system
   prompt, the tool/function definitions pointed at
   `{PUBLIC_BASE_URL}/api/vapi/function`, a Deepgram transcriber, and an ElevenLabs
   voice slot (set `ELEVENLABS_VOICE_ID` for a specific voice). Paste it in.
4. Set the assistant's **tool server secret** to match `VAPI_SECRET`, attach the
   phone number, and call it. Vapi handles the realtime speech; this server answers
   every tool call (check availability, book, etc.) exactly like the web demo.

### Roughly what it costs to run the phone agent
Per-minute, all pay-as-you-go (no minimums): **Vapi** platform ~$0.05/min, **Twilio**
number ~$1–2/mo + ~$0.014/min, **Deepgram** speech-to-text ~$0.01/min, **ElevenLabs**
voice from ~$0.10/min, **Claude** a few cents per call. Ballpark **$0.15–0.30 per call
minute**, versus a receptionist you can't scale to hundreds of simultaneous calls.

---

## What's in here

| File | What it is |
|---|---|
| `business.config.json` | **The one file you edit per client** — name, hours, services, FAQ, greeting, escalation rules. Everything else reads from it. |
| `src/prompt.ts` | The receptionist persona (warm, human, one question at a time, no "I'm an AI"). |
| `src/tools.ts` | The tools the agent can call: `check_availability`, `book/reschedule/cancel_appointment`, `answer_faq`, `take_message`, `transfer_to_human`. |
| `src/calendar.ts` | Booking backend — Google Calendar or the keyless mock, with real availability + conflict checks. |
| `src/agent.ts` | The Claude tool-use loop that turns speech into actions. |
| `src/server.ts` | HTTP: web voice endpoint, Vapi webhook, assistant-config generator, static demo. |
| `public/demo.html` | The browser "talk to our receptionist" widget (Web Speech in, natural voice out). |

## Handy endpoints
- `GET /` — the browser voice demo
- `GET /api/health` — what's connected (brain / calendar)
- `POST /api/agent/turn` `{sessionId, text}` — one conversational turn (web)
- `POST /api/vapi/function` — the phone agent's tool webhook
- `GET /api/vapi/assistant` — copy-paste Vapi assistant config (no secrets)
- `GET /api/inbox` — messages + human-transfer log the agent captured

## Develop
```bash
npm run dev        # auto-reload
npm run typecheck  # tsc --noEmit
npm test           # booking/availability/conflict tests
```

## Make it your business
Edit `business.config.json` (hours, services, FAQ, greeting). That's it — the prompt,
the tools, the availability logic, and the Vapi config all read from it. To trial a
second client, copy the folder and swap that one file.
