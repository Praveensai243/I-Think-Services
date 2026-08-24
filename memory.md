# Project memory — I Think Services

Persistent context + preferences. Read this first when starting a new chat — it's the
handoff doc for the whole project.

---

## 0. Working style — act as the CTO, not a yes-man
- **Be a technical co-founder / CTO, not an agreeable assistant.** Don't reflexively agree
  or cheerlead. The user wants a thinking partner who challenges ideas.
- **Discuss before implementing.** For anything non-trivial, first lay out pros/cons,
  trade-offs, risks (cost, security, legal, maintenance), do's and don'ts, and
  alternatives — then give a clear recommendation with reasoning, and get alignment
  before building.
- **Push back honestly** on premature / over-engineered / low-priority / risky / wrong-
  sequence work, and explain why. **Stay decisive** — give a real recommendation, defend
  it, change it when the argument is better.
- **Keep the business goal in view:** a working product and real customers over polish and
  feature-count. Flag cost/scope creep.

## 0b. Other working preferences
- **NEVER run anything in the background. This has been said more than once.** No background
  processes, no `&` or `run_in_background`, no scheduled check-ins or wake-ups, no cron or
  timers, no self-watching PR loops, no agents left running. If a PR-activity subscription
  is created automatically, unsubscribe from it immediately. Do the work in the foreground,
  finish it, and hand it back — nothing keeps running after the reply.
- **Answer in plain words, then say what to do next. This has been said three times and
  ignored three times — it is the most-broken rule in this file.**

  Every reply has exactly two parts:
  1. **The answer** — 1–3 sentences, plain English. What is going on, or what you did.
  2. **Next steps** — a short numbered list. Each one an action the user can actually take:
     which page to open, which button to click, what to look for, what to send back. If the
     next step is the user's, say so. If it is yours, say what you will do.

  Hard rules:
  - **No tables of possibilities. No decision trees. No "if X then Y, if Z then W".** Pick
    the most likely cause, say it, and say how to check it. One thing at a time.
  - **No lists of everything you considered.** The user does not want your reasoning, only
    your conclusion. Keep the thinking in your head.
  - **No jargon.** Not "instrumentation", "transport layer", "in-memory counters",
    "signature", "deterministic". Say "the page forgets everything when the server
    restarts". If a technical word is unavoidable, explain it in the same sentence in
    ordinary words.
  - **Keep it under ~10 lines** unless the user asks for detail. Long is not thorough —
    long means the user has to hunt for the answer.
  - **Reporting work you shipped:** one line on what changed, one line on what it means for
    the user. Not a changelog, not a list of files.
  - **Do not restate the question, do not recap the history, do not apologise at length.**

  Bad (what keeps happening): four paragraphs, a table of four possible causes, three
  hypotheses, and the actual next step buried at the bottom.
  Good: "The server restarted after your call, so the page lost everything. That's why it's
  empty. Next: 1) Open Render → Events, check for a restart at the time you called.
  2) Tell me if the plan is Free or Starter."

- **Everything we build is a TEMPLATE, not a one-off for us.** Our own business is client
  zero. Onboarding a real client must be: copy a config, replace their business data and
  contact details, point `BUSINESS_CONFIG` at it — nothing else. So:
  - **Never hardcode our name, number, email, domain, or anyone's personal details** in
    `src/`. Every business-specific value comes from the config file. This is checked by
    `test/template.test.ts`, which builds the prompt from a DIFFERENT client and fails if
    anything of ours survives.
  - New behaviour goes in the shared code path, driven by config — never a special case for
    us that a client would have to have removed.
  - If a fix needs a new config field, add it to `agent/examples/*.json` too, or client
    onboarding breaks on the first business that lacks it.
  - Ask of every change: "what does a plumber in Charlotte have to edit to use this?" The
    answer must be "their config file".

---

## 1. What this business is
**I Think Services** — an AI solutions agency that sells **AI receptionists (AI voice
agents)** to **local businesses**, and resells the same product to many clients (one config
per client). Also offers automation + IT/staffing (secondary).

The product: an AI receptionist that answers calls 24/7, handles many calls at once, books/
reschedules/cancels appointments, answers customer questions, takes messages, and transfers
to a human when needed.

- Location: Charlotte, NC · Email: contact@ithinkservices.net · Phone: 704-387-9775
- Tagline: "We Think, We Plan, We Serve." · Repo: `Praveensai243/I-Think-Services`

## 2. Architecture (two parts)
- **Marketing website** — static HTML/CSS/JS at repo root (`index/services/about/
  contact.html`, `css/styles.css`, `js/main.js`). Hosted on **Cloudflare** Pages/Workers,
  deploys from `main`. Domain: ithinkservices.net.
- **Agent backend** — the `agent/` folder. Node/TypeScript (Express + `@anthropic-ai/sdk` +
  googleapis + stripe + zod), run with `tsx`. Hosted on **Render** at
  **https://ithink-ai-agent.onrender.com**, auto-deploys from `main`.
  - **Brain = Claude**, and the backend *is* the brain: it exposes an OpenAI-compatible
    **custom-LLM** endpoint so voice platforms just forward the conversation to it. This
    makes the voice platform swappable (≈ a URL change) and keeps all logic in our code.
  - **Multi-tenant by config:** `agent/business.config.json` holds one business's knowledge
    (hours, services, a 38-entry FAQ, greeting, escalation, `objective`). Run a client with
    `BUSINESS_CONFIG=clients/<slug>.json`. Templates in `agent/examples/` (dental, salon,
    home-services). Scaffold a client with `npm run new-client`.
  - **Booking backends:** `mock` (in-memory, default/demo), `google` (Google Calendar), and
    `calcom` (Cal.com) — pick via `CALENDAR` env. Cal.com adapter is built but unverified.

## 3. Key endpoints (agent backend)
- `/` browser voice demo · `/admin` dashboard (protected by `ADMIN_TOKEN`)
- `/api/agent/turn` (web chat) · `/api/vapi/chat/completions` (**Vapi custom-LLM brain**)
- `/api/vapi/function` (tool webhook + end-of-call minutes) · `/api/vapi/assistant` (config)
- `/api/admin/data` (usage + bookings + messages + transfers) · `/api/billing/checkout`
- `/api/admin/diagnostics` (last 50 turns) · `/api/admin/calendar-check` · `/api/admin/test-email`
- Agent tools: check_availability, book/reschedule/cancel_appointment, take_message,
  transfer_to_human, end_call. **There is no `answer_faq` tool** — the whole FAQ ships
  inside the system prompt instead (see §6).

## 4. Environment variables (Render)
`ANTHROPIC_API_KEY` (set ✅), `MODEL=claude-haiku-4-5` (set ✅ — fast for voice; opus-5 = max
smarts), `ADMIN_TOKEN`, `PUBLIC_BASE_URL` (= the Render URL), `CALENDAR`, `GOOGLE_*`,
`CALCOM_*`, `VAPI_SECRET`, `ELEVENLABS_VOICE_ID`, `STRIPE_*`. No secrets belong in this file.

## 5. Current status
**Live:** marketing site (with real contact info); agent backend on Render (Haiku +
38-topic AI-services knowledge); admin dashboard; usage tracking; Stripe billing
(keyless-safe/off until keys added); multi-client configs; the custom-LLM brain.

**THE PHONE — WORKING END TO END ✅ (2026-08-18).** Answers, knows the business, books to
the real calendar, transfers to a human, and hangs up when the caller signs off.

**⚠️ Vapi's Custom LLM URL is a BASE url.** Vapi appends `/chat/completions` itself. The
field must read `https://ithink-ai-agent.onrender.com/api/vapi` — pasting the full endpoint
makes Vapi call `/chat/completions/chat/completions`, which 404s before reaching any
handler. This cost most of a day: the backend looked idle and innocent while every call
failed, and several rounds of "fixes" went into code that was never executing. Unknown
paths under `/api/vapi` now 404 with an explanation instead of silently.

**Vapi assistant config that has to be right (none of it is code):**
- Model provider **Custom LLM**, URL as above. No Anthropic key on Vapi's side.
- Tools tab must declare **endCall** and **transferCall**, or the agent can ask to hang up
  and transfer all it likes and nothing happens on the line.
- The transfer destination must be a **different, real, answerable phone** — never the
  number the assistant itself answers. A call cannot be transferred to its own line.
- Fill the transfer tool's **"Message to Customer"**; we deliberately send no words of our
  own on a transfer turn (see below), so that field is what the caller hears.
- Transcriber: Deepgram Nova 2 Phonecall. First Message: the real greeting, not "Hello."
- The agent is **Charlotte** everywhere now (#30) — `agentName`, the greeting, and the Vapi
  entry all agree. If a caller ever hears "Ava", it is Vapi's own **First Message** field
  holding an old hardcoded greeting; our backend no longer says it anywhere.

**Talking to Vapi — three rules learned the hard way:**
1. **Tool names come from the dashboard**, e.g. `transfer_call_tool`, not `transferCall`.
   We read the name back out of the request Vapi sends rather than assuming it.
2. **Send the ordinary OpenAI `tool_calls` delta**, closed by `finish_reason: "tool_calls"`,
   arguments as a JSON *string*. Not the bare `function_call` frame from Vapi's proxy
   example. The control frame REPLACES the stop; a frame after a stop is ignored or fatal.
3. **A transfer carries no text of ours.** A message with `content` reads as a finished
   answer and its `tool_calls` never get read. `endCall` keeps its text — the farewell has
   to come from us and Vapi has no field for it.

**A failed transfer is not quiet: Vapi ENDS THE CALL.** Every "it hung up on me" during
debugging was a transfer failing. That one behaviour makes every possible cause look
identical from the handset, which is why this took several rounds. The dashboard's fallback
message does not help — Vapi only fires it on SIP transfers.

**Switches, all live without a redeploy (read per request):**
`VOICE_CALL_CONTROL` (transfer + hang-up; the kill switch), `VAPI_CONTROL_SHAPE`
(`tool_calls` default / `function_call`), `VAPI_CONTROL_SPEAKS` (`vapi` default / `agent`).

**Diagnostics — use these before theorising:**
- `/api/admin/diagnostics?token=…` — last 50 turns: what the caller said, what the agent
  decided, what we sent Vapi, and **the tool list Vapi declared**. Leads with a plain-words
  diagnosis. Request counting happens *before* auth, so "nothing arrived" and "we rejected
  it" are distinguishable.
  **⚠️ The trail and the counters are per-process and in memory — a restart zeroes them.**
  An empty page therefore does NOT mean the assistant is misconfigured; it can equally mean
  the process restarted after the call. Check `serverStartedAt` against the time you called:
  if the process is younger than the call, this page knows nothing about it. Every turn is
  now also written to the host log as a `CALL-TURN` line, and **the Render log is the copy
  that survives a restart** — go there when the trail is empty. A turn that throws is
  recorded too, with the error on it; it used to be the one kind of turn that left no trace.
- `/api/admin/test-email?token=…` — sends a real test alert and returns the mail server's
  own error.
- `/api/admin/calendar-check?token=…` — proves the calendar wiring.

**Message alerts — LIVE ✅.** `take_message` emails the team immediately (name, number,
what they said; number in the subject so it is readable from a lock screen). Any SMTP
provider: `SMTP_HOST/PORT/USER/PASS/FROM` + `NOTIFY_EMAIL`. Keyless-safe — with nothing
configured it logs and the call still completes. This email is also the only durable copy
of a message until there is a database.

**Lead alerts on every booking — LIVE ✅ (#42).** A booking now sends **two separate
emails**: the team gets its own alert (subject `New booking: Name (phone) — Service`, body
with the time, phone, email or "not given", and the booking ref), and the caller gets their
confirmation only if they gave an address. Before this the team was merely CC'd on the
caller's receipt — "Hi Sai, you're booked for…" — which carries **no phone number**, so
whenever a caller gave an email the lead arrived with the one thing the business needs
missing. Both emails carry the .ics.

**Booking confirmations — LIVE ✅.** `book_appointment` takes an optional email and the
agent asks for it once before booking. The caller gets a confirmation with the time in
their own local wording plus an **.ics attachment** that adds it to Google/Apple/Outlook
in one tap. Deliberately NOT done by adding them as a Google attendee: a service account
cannot send invitations without domain-wide delegation, and chasing that would trade a
working booking for a Google admin project. Rides the same SMTP as message alerts, so no
SMTP means no confirmation — the booking still succeeds.

**⚠️ "Sorry, I didn't catch that" is OUR ERROR STRING, not a hearing problem.** If a caller
reports the agent saying it over and over whatever they say, the backend is throwing on
every turn — go to the logs, not the transcriber. This wording cost a whole live call
because it made a server crash look like bad audio; it now says "something went wrong on my
end" and gives the human number. **Any canned fallback must sound like what it actually is.**

**Tool failures are reported, never thrown (#33).** `runTool` had no error handling at all,
so one bad response from Google Calendar or SMTP killed the whole turn — and because the
agent retried the same tool on the caller's next words, the call was stuck repeating the
error forever. A throwing tool now comes back as a result telling the agent to apologise,
NOT retry, and offer a message or a person. `notifyBooking` never throws either: the
appointment is already saved by the time the confirmation is built.

**Three bugs found on live calls in one session, all invisible from the code alone:**
1. **The prompt never said what day it was** (#31). The agent could not resolve "tomorrow"
   or "next Tuesday" and fell back on its training's idea of today. Slot labels also named a
   weekday with no date, so two Thursdays were indistinguishable. Both fixed; a test now
   asserts the prompt names today's real date.
2. **A corrected detail did not win** (#32). A caller spelled their email out, the agent read
   it back correctly, then booked an earlier wrong version it was still holding — so this was
   never a transcriber problem. The prompt now says a correction kills every earlier version,
   and `book_appointment` makes the agent **say the address it actually used out loud**, which
   is the part that catches it while the caller is still on the line.
3. **Emails are worse than phone numbers to take by ear** (#29). Taken in two halves, domain
   guessed rather than spelled, and a hard stop after two failed tries — book without it
   rather than grind the caller down.

**Guards that live in code, not in the prompt.** Each was added after a prompt rule failed
on a live call — Haiku is fast but does not reliably honour a negative instruction buried
in a long prompt:
- Never hang up unless the caller's own last words were a sign-off. A question is never a
  goodbye.
- Connect a caller who asks for a person twice, immediately, whatever the agent decided.
- Never transfer to an undialable number, or to the line the call is already on.

**Still open:**
1. **Latency** — the caller waits for the whole reply before hearing a word. The #10
   post-mortem below still applies. **Prompt caching is the cheaper first move**: the system
   prompt (~3.4k tokens) is byte-identical every turn.
2. **Everything is in memory** (`store.ts`, `usage.ts`) — bookings, messages, transfers and
   **billable minutes all reset on every deploy**. Cannot invoice a client yet.
3. Digit capture still leans on the transcriber.

**Calendar — LIVE ✅ (real Google Calendar, verified 2026-08-13):**
- Bookings write to **contact@ithinkservices.net**'s calendar; availability comes from its
  real free/busy. Verified via `/api/admin/calendar-check?token=<ADMIN_TOKEN>` →
  `{"calendar":"contact@ithinkservices.net","ok":true,"auth":"service-account"}`.
- **Auth = Google service account.** The calendar is shared with the service account's
  `client_email` ("Make changes to events"); Render holds `CALENDAR=google`,
  `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_CALENDAR_ID`. Steps in `agent/README.md` §3.
- Chosen over OAuth because OAuth refresh tokens **expire after 7 days** while the Google
  app is in Testing, and escaping that needs Google's sensitive-scope verification review.
  The OAuth path still works and is kept as a fallback.
- **Account split (non-obvious, don't re-derive):** GitHub / Render / Cloudflare are under
  `santoo.saipraveen@gmail.com`; the **Google Cloud project `psychic-upgrade-505320-v2` and
  the calendar are both under `contact@ithinkservices.net`**. Anything in the Google Cloud
  console (enabling APIs, rotating the service-account key) must be done signed in as
  contact — santoo has no access to that project. Use an incognito window to avoid Google
  bouncing you to the wrong account.
- **Scope note:** this is for **our own** calendar so demo bookings survive restarts
  (`mock` is an in-memory Map — every Render deploy wipes booked sales calls). Client
  calendar onboarding is deliberately NOT built: most local businesses run on Vagaro /
  Booksy / Dentrix / Jobber, not Google, so the right integration is whatever customer #1
  actually uses. Don't guess before then.

**Accounts:** Anthropic ✅ ($5 credit + key). Render ✅ (live; confirm Starter plan).
Google Calendar ✅ (service account, live). **Vapi ✅ (assistant + number live, taking real
calls).** SMTP ✅ (message alerts + booking confirmations). ElevenLabs / Twilio / Stripe /
Cal.com: later.

**The number is a free Vapi test number and is inbound-only.** Fine — inbound *is* the
product. It is not the number to publish: before giving it to prospects, buy a local
**Charlotte, NC** number (~$2/mo) and reassign the assistant. A number is a pointer;
swapping it is a dropdown change, so nothing is stranded by testing on the free one.

## 6. Decisions made
- **⚠️ OPEN DECISION (2026-08-21): speech-to-speech, not Retell, is the real upgrade path.**
  The **Grok Voice Agent API** (xAI) is live: speech-to-speech, **<1s time-to-first-audio**,
  ~**$0.05/min with voices included** (comparable to Vapi + ElevenLabs), 80+ voices,
  tool calling, OpenAI-Realtime-compatible, telephony via LiveKit numbers or Twilio SIP.
  There is also a no-code **Voice Agent Builder** (beta, July 2026).
  **Why it matters:** our silence problem is structural — we run
  transcribe → think → speak in sequence, so the caller waits through the thinking.
  Speech-to-speech removes that sequence; the model talks as it thinks. No amount of
  tuning on the current pipeline gets to that.
  **What we would keep:** the whole backend that earns the money — `tools.ts`, calendar,
  notify/emails, the per-client config template. A realtime model calls those over ordinary
  function calling.
  **What we would lose / re-do:** the guards that live in our turn loop (never hang up
  unless the caller signed off, force a transfer after two asks, the empty-turn fallback,
  the turn deadline) — they would have to be re-expressed. LiveKit's plugin is Python-first
  and we are TypeScript, though the OpenAI-Realtime compatibility gives a direct websocket
  route.
  **The trap to avoid:** none of the bugs that cost us this week — the 10-turn booking, the
  email read-back loop, the missing goodbye — were Vapi's fault or Claude's. A new platform
  fixes the PAUSES, not the FLOW, and re-platforming mid-frustration is how two weeks
  disappear. **Evaluate before migrating:** 30 minutes in the Voice Agent Builder with our
  own FAQ, and judge it by making a call.
  **✅ We do NOT have to leave Vapi to get speech-to-speech.** Vapi supports native
  speech-to-speech assistants (OpenAI Realtime is documented and live in their dashboard;
  Grok is already a Vapi voice partner and its API is OpenAI-Realtime-compatible) as a
  MODE, distinct from its usual transcriber → model → voice pipeline. So the test is a
  config change on the assistant we already have, on the number we already have — not a
  migration. **Confirm in the Vapi dashboard which realtime models are selectable.**
  **What changes if we switch the assistant to speech-to-speech:**
  - KEPT: the number, `/api/vapi/function` (it already serves Vapi tool calls), the booking
    tools, calendar, the emails, and the per-client config template.
  - MOVED: the system prompt and the FAQ go into the assistant's session config instead of
    our custom-LLM endpoint. Still ours, still per-client.
  - LOST: every guard that lives in our turn loop, because we stop being the brain — the
    hang-up guard, the force-transfer-after-two-asks rule, the empty-turn fallback, the turn
    deadline. Each was added after a live call went wrong. Some can be rebuilt tool-side;
    "never hang up unless the caller signed off" cannot. **Re-test all of them.**
  **Grok specifics (verified 2026-08-24):** ~$0.05/min ("Think Fast 2.0" ~$0.08), plus
  ~$0.01/min if using their number; <1s to first audio; 30-min max session; **beta, and
  access is gated — developers report 403s.** Reported concurrency limits conflict across
  sources (10 vs 100 per team) — check before promising a client anything.
- **Voice platform: start on Vapi** (already integrated + deployed + working). **Retell is
  the upgrade path** (more reliable ~99.9% vs ~99.5%, lower out-of-box latency, managed);
  switching later ≈ a URL change because our backend is a portable custom-LLM. **Bland** only
  if outbound-at-scale becomes central; **Synthflow** only if a no-code option is ever
  wanted. **None are agency-native** → our backend + per-client configs + (future) agency
  portal ARE the white-label layer. Don't re-platform before validating demand.
- **Model:** Claude via our backend; the voice platform carries no LLM key.
- **The FAQ lives in the prompt, not behind a tool.** `answer_faq` matched caller wording to
  FAQ keys by substring, so "how much does it cost" never reached the entry keyed `pricing`
  and the agent claimed ignorance with the answer sitting in the config. A keyword scorer was
  tried and lost to neighbouring entries ("cost of missing calls" outscored "pricing" on the
  word *cost*). Inlining it lets Claude match phrasing properly **and removes a tool round
  trip from every factual question**, which the caller hears. Cost: ~1.2k prompt tokens.
  Don't reintroduce a lookup tool without a much larger FAQ than 38 entries.
- **Never ask a caller to recite their phone number.** Vapi sends the caller ID on every
  request; the agent reads it back ("is that the best number?"). Phone audio mangles digits —
  a live call needed ten repeats before this. When digits must be taken by ear: chunked, read
  back per chunk, single unclear digit queried alone, and after two failures stop asking and
  take a message. **A frustrated caller who hangs up is worse than a note with a gap.**
- **The system prompt has a latency budget, enforced by a test (~4k tokens).** The whole FAQ
  ships in it on EVERY turn, so every line is paid for on everything the caller says. When
  the test trips, **tighten wording or merge entries — do not raise the ceiling.** It has
  already caught one careless addition.
- **Read the diagnostics before theorising.** `/api/admin/diagnostics?token=…` shows the last
  50 turns: what the caller said, what the agent decided, what we sent Vapi. Several rounds
  of this project were lost to guessing from the symptom when the answer was one URL away.
- **Ship voice changes one at a time.** #10 bundled two changes, broke the phone, and cost
  us the ability to tell which one did it. The **SSE transport is the danger zone** — a bug
  there produces silence, not a bad answer, and silence is the one failure a caller cannot
  work around. Logic/prompt changes are cheap and safe; transport changes ship alone, and
  **always test by calling the number after deploy.**

## 6b. Onboarding a client — `agent/ONBOARDING.md`
The 2–3 hour delivery checklist: collect their details → `npm run new-client` → write the
FAQ → their own Render service → a calendar → their Vapi assistant → five tests including a
real call. **90 minutes of it is writing their FAQ; the rest is a checklist.**

**One deploy serves ONE business.** `BUSINESS_CONFIG` is read once at startup, so each
client needs their own Render service (~$7/mo) plus a number (~$2/mo). Fine for the first
handful; past about five it wants the multi-tenant routing in §7.4.

**Say these limits out loud before taking money:** Google Calendar only (Vagaro / Booksy /
Jobber / Housecall are NOT integrated); everything is in memory so bookings and minutes
reset on every deploy — the emails are the durable record; inbound only.

## 7. Deferred / roadmap (do later, in this order)
0. ~~Get the phone answering~~ **DONE** — live, taking real calls.
1. **Latency is the last thing standing between this and a sellable demo.** The caller waits
   for the whole reply before hearing a word. In order of cost:
   **(a) prompt caching** — the system prompt is byte-identical every turn and is now ~3.4k
   tokens; cheapest win, no transport risk.
   **(b) real streaming** — the #10 retry. `end_call` already re-landed separately, so this
   ships **alone**, and only after reading Render logs from a call. Do not re-bundle it.
2. ~~Turn on the real calendar~~ **DONE** — live on contact@ithinkservices.net.
2b. **Get the number in front of one real local business.** The product answers calls and
   books to a real calendar; the bottleneck is now demand, not features. Recurring cost is
   stacking with zero revenue — don't add surface area ahead of a paying customer.
3. **Website "Talk to Charlotte" widget** — DEFERRED. If built, it's a public metered endpoint →
   MUST add rate-limiting/abuse protection first (else bots burn Claude/Vapi spend). It's
   polish, not the bottleneck; validate demand first.
4. **Agency control-plane portal** — one login showing every client's usage + setup health;
   needs a multi-tenant DB + routing calls by phone number. (User: "circle back later.")
4b. **Client outreach at scale — see `OUTREACH.md` at the repo root.** Phased: prove the
   message by hand on 50 businesses FIRST (kill criteria: under 3 replies in 50 means the
   message is wrong, not the channel), then the contact list, then a separate sending
   domain, then automation in n8n.
   **⚠️ Read receipts were asked for and do NOT work.** Real read receipts (MDN) are a
   request clients ignore, and asking gets flagged as spam. Tracking pixels are noise since
   Apple Mail Privacy Protection pre-loads every image whether or not anyone looks — and the
   pixel itself is a spam signal, so it trades deliverability for a number you cannot trust.
   **Measure bounces and replies. Never send cold mail from `ithinkservices.net`** — it
   carries the booking confirmations, and getting it flagged breaks a client's customers'
   confirmations.
5. **Outbound calling (~50 calls/day, B2B, leads from web, to book demos)** — DEFERRED and
   **compliance-critical**: AI voice = robocall under FCC/TCPA; cold-calling scraped consumer
   lists risks **$500–$1,500 per call**. Do it as **landline-only B2B** (line-type filter),
   with **AI self-disclosure + instant opt-out + DNC scrub + calling-hours**, ideally warm-up
   by email/LinkedIn first, and **get a lawyer review before scaling**.
6. Stripe live billing; SMS reminders (Twilio).

## 8. Cost discipline (pre-revenue — no customers yet)
Render Starter ~$7/mo · Vapi ~$0.05/min · number ~$2/mo · Claude cents/call · ElevenLabs
later. Recurring cost is stacking with zero revenue — **validate that someone will pay
before adding more surface area/cost.**

## 8a. ⚠️ SIMPLIFY THE STACK — Grok alone can do the whole job (verified 2026-08-24)
Three vendors for one phone line (Render + Vapi + a model) is more moving parts than this
product needs, and every one of them has cost us a live call. **Grok's Voice Agent Builder
covers all of it:** phone numbers (or bring your own over SIP), speech-to-speech brain and
voice, knowledge/RAG for the FAQ, **native Google Calendar and Gmail connectors** for
booking and confirmations, custom APIs and MCP for anything else, and built-in call review
for transcripts. So for a normal receptionist — answer, book, take a message, transfer,
email a confirmation — **Render and Vapi and our backend are all optional.**

**Recommended: build the next test agent Grok-only, and pilot on it.** Cheaper per client
too (no $7/mo Render each), and speech-to-speech removes the silence structurally.

**Do NOT delete anything yet.** Keep the repo running until a Grok-built agent has survived
a real call, because:
- It is in **beta**, access is gated (403s reported), and concurrency limits are unclear.
  A client's phone line on a beta needs a fallback, and ours exists and works.
- It is **lock-in**: everything lives in xAI's console. Our backend was deliberately
  portable, and it is still the answer for a client who needs a real system integration
  (Jobber, Housecall, Vagaro) rather than a Google Calendar.
- The guards we learned the hard way (never hang up unless the caller signed off, connect
  someone who asks twice, never re-read an email back) become **prompt and testing** work
  on any no-code platform. **The list of failure modes is the asset, not the code.**

## 8b. Does a 2-minute no-code builder kill this business? No.
Grok's Voice Agent Builder makes a working agent in about two minutes, and the whole stack
(STT, LLM, TTS, telephony) is now off-the-shelf. That commoditises the DEMO, not the job.
**The market prices the job, not the tool:** agencies serving local businesses charge
roughly **$500–$1,500 setup + $200–$500/mo**, and the hidden cost of the DIY route is
**40–80 hours of the owner's own time**. A plumber will not spend that.
**Our own week is the proof and the sales story:** a working agent took minutes; an agent
that does not embarrass you on a live call took eight rounds of fixes found only by ringing
it — the email spelling loop, the silence after a tool call, the missing goodbye, the
10-turn booking. **What a client buys is the conversation design, the booking integration,
the testing against real callers, and an accountable human when it breaks.** Never sell the
model; sell the calls that get answered.

## 9. How pricing/reselling works (for client conversations)
Setup fee ($250–$1,500) + monthly tiers with included minutes (Starter ~$99–199, Pro
~$299–499) + overage (~$0.40–0.75/min over our ~$0.20 cost). Sell against a receptionist's
salary and the cost of missed calls. The free demo (which the agent performs) is top-of-funnel.

## 10. Deployment workflow
Develop on the branch the session assigns (most recent: `claude/resume-project-memory-7qn1y3`)
→ PR → merge to `main`. A merged
PR is finished; restart the branch from `main` for new work. `main` deploys both Cloudflare
(site) and Render (agent). Commit style + attribution per the session's git rules.

**Branch off `main`, not off another feature branch.** PR #12 was branched off the #11
revert branch, so once #11 squash-merged, both sides carried their own copy of the same
revert and GitHub called it a conflict. Fix is a rebase onto `main`, not a merge.

**Check for open PRs at the start of a session.** #12 sat finished-but-unmerged in draft for
three days because the handoff doc didn't mention it. `memory.md` is only as good as its
last update — update it when the state changes, not just when a task finishes.

**State as of 2026-08-19: no open PRs. Everything through #33 is merged and deployed.**
PR #12 (caller ID, chunked digits, inlined FAQ, `objective`) is merged — earlier roadmap
text told you to merge it; ignore that, it's done.

**Live call, 2026-08-19 — still broken, cause not found yet.**
What happened: the caller booked a time, said "confirmed", and after that the agent said
"I couldn't catch that, could you say it again?" to everything.

What we know:
- The booking worked, so the phone was talking to our server fine up to that point.
- The diagnostics page was empty afterwards. That page forgets everything when the server
  restarts, so the server restarted after the call. It is not proof that anything is
  misconfigured — the page used to claim that, and it was wrong.
- **That "couldn't catch that" line is not ours.** Ours says "something went wrong on my
  end". So the phone system was talking over silence from us — our server was slow, dead,
  or sent nothing back.

**Confirmed the same day: the server RESTARTED, and the plan is Starter.** Starter never
sleeps, so it did not idle out — **it crashed.**

Why one small error killed the whole phone line: nothing was guarding the process. Node
shuts down on a stray failed background job (an unhandled promise rejection), and Express 4
lets any error inside a route's async code become exactly that. So one failure — an email
that would not send, a socket the phone system had already closed — ended EVERY call in
progress and wiped the diagnostics page.

Fixed (#35): the server now logs that kind of error and keeps running, and the code that
sends the reply back to the phone is inside a safety net too. A wrong answer on one turn is
survivable; a dead phone line is not.

**Second live call: it takes the email, then goes quiet.** Silence lands on the booking
turn — the slowest turn in the call. That turn can run up to six model calls plus two
Google Calendar calls before the caller hears one word, and Vapi eventually talks over the
gap with its own "I couldn't catch that". Three fixes in #35:
- **A turn now has a deadline (8s, `VOICE_TURN_DEADLINE_MS`).** Past it the agent stops
  working and says "one moment" instead of leaving the line silent. Work already done stays
  done.
- **Prompt caching is live.** The prompt is now sent as two blocks: the big unchanging half
  (persona + rules + the 38-entry FAQ) is cached, and the clock and caller number moved
  AFTER it. **This is why caching never would have worked before** — the memo said the
  prompt was byte-identical every turn, and it was not: the clock line changes every minute
  and sat in the middle, so nothing could ever be cached.
- **Every turn now records how long it took**, split by model call and tool call, in the
  diagnostics trail and the log. Silence is either a slow turn or a dead one and they need
  opposite fixes; this is the number that tells them apart.

**Third live call (after #35 deployed): still quiet, at the same spot — right after the
caller repeats their email.** Found the actual bug, and it is not latency:
- The prompt tells the agent to **re-book with the same time** when a caller corrects their
  email. `book()` then ran its free/busy check and found **the appointment it had made
  seconds earlier**, called the slot taken, and sent the agent hunting for another time —
  many model calls, no words, while the caller waited.
- Fixed (#36): re-booking the same caller into the same slot returns the appointment they
  already have, instead of clashing with it.
- Also fixed: the Anthropic SDK waits **ten minutes** by default before giving up on a
  request. On a call that is a dead line, and the 8s turn deadline could not save it — the
  deadline only gets a look BETWEEN rounds, never during one. Now bounded to 8s per call.

**Fourth live call — two separate bugs, both fixed in #37:**
1. **"o" comes back from the transcriber as "0" (zero).** The caller spelled "santoo", the
   transcript said "sant0o", and saying "o as in Oscar" could not help — the damage was in
   the text before the agent ever saw it. Now repaired in code: a digit wedged BETWEEN two
   letters in the local part is a letter (0→o, 1→l, 5→s). Deliberately narrow — digits at
   the end of a name are real (praveensai243@…), and inventing an address nobody owns is
   worse than the mishearing.
2. **"…" was our SILENCE STRING.** When the model ended a turn with no words — most often
   right after a tool call, exactly when the caller has just confirmed something — we sent
   an ellipsis, the voice had nothing to say, and the caller heard dead air with no way to
   tell it from a dropped call. Same class of mistake as "Sorry, I didn't catch that": **a
   fallback must sound like what it is.** Now it speaks what the tools actually did.
3. Also: the read-back of an email happens **once per call**, enforced in code (`tools.ts`
   counts bookings per session), not by a prompt rule. A second read-back invites a second
   correction and the caller ends up confirming an appointment that is already booked.

**A booking call was taking 3–5 minutes; it has to be under two.** The cost was never
per-turn speed — it was **turn COUNT**. The old flow asked: which service, which day, which
time, name, number, email first half, domain, confirm email, confirm everything, book. Ten
exchanges × ~15–20s of round trip each = the whole complaint. Rewritten (#38) as a
four-exchange script:
1. "I want to book" → call check_availability immediately and **offer two real times**.
   Never ask which day first.
2. They pick → ask name AND confirm the caller-ID number in one breath.
3. Book. Say day/date/time back once.
4. Only then, once: "want a confirmation emailed?"
**The email moved to AFTER the booking** — it was four exchanges of the ten and the source
of every bug in the last three calls. A bad address now costs nothing: the appointment is
already made. In code, `tools.ts` counts **emails per call, not bookings**, so the address
is read back exactly once.

**Call transcripts by email — LIVE ✅ (#39).** Every finished call emails the team the full
transcript, the caller's number (in the subject, readable from a lock screen), the length,
why it ended, and what was booked. Fires from Vapi's `end-of-call-report` webhook, so
**the assistant's Server URL must be set in the Vapi dashboard** to
`https://ithink-ai-agent.onrender.com/api/vapi/function` — without it Vapi sends no report
and no email arrives. Prefers Vapi's own transcript; falls back to the turns we recorded
ourselves, so a call is never reported with nothing to read. Rides the same SMTP as the
message alerts.

**Timing after the four-exchange rewrite: ~3 minutes, down from 3–5.** The turn count is
now near the floor; what is left is the per-turn wait, and that is streaming.

**⚠️ STREAMING IS NO LONGER THE PRIORITY — the backend is already fast.** First real
timings from a live call (2026-08-19, 20 turns): **every model call 0.6–1.9s**, tools
0.2–0.8s, a whole turn 0.6–2.6s. The single slowest turn in the call was 4.8s (book +
message + three model calls). Our thinking time is NOT what makes a call feel long.
What makes it long is the NUMBER of turns:
- 20 turns for one booking. **Ten of them were the caller spelling an email address**
  (~100 seconds of a 3-minute call), because every read-back invited another correction.
- Fixed (#40): the email is now ONE pass with **no read-back at all**. Ask, take what you
  hear, book, say "if it bounces we'll ring you". The appointment already exists and we
  already have their phone number, so a wrong address costs nothing — and a confirmation
  loop costs the call.
- The caller was spelling in the phonetic alphabet ("Sam alpha Nancy tango Oscar Oscar" =
  santoo) and the agent kept mangling it. `decodePhonetic` now does this in code, and only
  when three or more phonetic words appear together, so a real "oscar@…" is left alone.
- Also fixed: the caller said "Nope, that's all" and heard **"Sorry, I went quiet there for
  a second — where were we?"** as the line closed. The model called end_call and wrote no
  farewell, so our empty-turn fallback spoke. The fallback now matches what the turn did —
  a goodbye when the call is ending, "you're all set" after a booking.

**Template audit done (#41).** Three of our own details had leaked into shipped text and
would have gone out with a client's agent: a personal email address inside the
`book_appointment` instructions, "santoo" as the worked example in the prompt's spelling
rule, and `ithinkservices.net` baked into every calendar (.ics) file. All three now come
from config or a neutral example. `examples/dental.json` is missing `objective` — harmless
(the prompt omits that section) but worth adding when the examples are next touched.

Streaming would buy a fraction of a second per turn. Cutting one unnecessary question buys
fifteen. **Cut questions first; revisit streaming only when a call is under two minutes and
still feels slow.** Read the `tookMs`
numbers from a real call first, then ship it alone per the #10 rule.

Next steps:
1. Merge #35, wait for Render to finish deploying, then call the number and repeat the
   same thing: book a time and confirm it.
2. If it breaks again, open Render → Logs and look for a line starting `UNHANDLED
   REJECTION` or `UNCAUGHT EXCEPTION`. **That line now names the real cause** — the thing
   we have been guessing at for two calls.
3. Also check the diagnostics page for `failed` on a turn, and `serverStartedAt` to see
   whether the server restarted again.

**Where the last session stopped.** #29–#33 all shipped from live-call bug reports: email
capture, the Charlotte rename, the missing date, corrections not winning, and tool failures
killing the turn. **None of them has been verified on a call yet** — the user was going to
test after #33 deployed. Start by asking how that call went, and ask for
`/api/admin/diagnostics?token=…` if anything is still wrong rather than guessing.

**Still unfixed and still the top complaint: the agent goes silent while it works.** It
cannot say "bear with me" first, because we send one reply after all the work is done — the
words and the wait are inseparable without streaming. Do **prompt caching first** (cheap, no
transport risk), and only then retry streaming, alone, per the #10 post-mortem.
