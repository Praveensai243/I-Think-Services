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
- **Keep replies short and direct.** Lead with the answer or the action. No long preambles,
  no restating the question, no exhaustive option surveys — give the recommendation.

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
    (hours, services, ~23-entry FAQ, greeting, escalation). Run a client with
    `BUSINESS_CONFIG=clients/<slug>.json`. Templates in `agent/examples/` (dental, salon,
    home-services). Scaffold a client with `npm run new-client`.
  - **Booking backends:** `mock` (in-memory, default/demo), `google` (Google Calendar), and
    `calcom` (Cal.com) — pick via `CALENDAR` env. Cal.com adapter is built but unverified.

## 3. Key endpoints (agent backend)
- `/` browser voice demo · `/admin` dashboard (protected by `ADMIN_TOKEN`)
- `/api/agent/turn` (web chat) · `/api/vapi/chat/completions` (**Vapi custom-LLM brain**)
- `/api/vapi/function` (tool webhook + end-of-call minutes) · `/api/vapi/assistant` (config)
- `/api/admin/data` (usage + bookings + messages + transfers) · `/api/billing/checkout`
- Agent tools: check_availability, book/reschedule/cancel_appointment, answer_faq,
  take_message, transfer_to_human.

## 4. Environment variables (Render)
`ANTHROPIC_API_KEY` (set ✅), `MODEL=claude-haiku-4-5` (set ✅ — fast for voice; opus-5 = max
smarts), `ADMIN_TOKEN`, `PUBLIC_BASE_URL` (= the Render URL), `CALENDAR`, `GOOGLE_*`,
`CALCOM_*`, `VAPI_SECRET`, `ELEVENLABS_VOICE_ID`, `STRIPE_*`. No secrets belong in this file.

## 5. Current status
**Live:** marketing site (with real contact info); agent backend on Render (Haiku +
23-topic AI-services knowledge); admin dashboard; usage tracking; Stripe billing
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
- `/api/admin/test-email?token=…` — sends a real test alert and returns the mail server's
  own error.
- `/api/admin/calendar-check?token=…` — proves the calendar wiring.

**Message alerts — LIVE ✅.** `take_message` emails the team immediately (name, number,
what they said; number in the subject so it is readable from a lock screen). Any SMTP
provider: `SMTP_HOST/PORT/USER/PASS/FROM` + `NOTIFY_EMAIL`. Keyless-safe — with nothing
configured it logs and the call still completes. This email is also the only durable copy
of a message until there is a database.

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
Google Calendar ✅ (service account, live). Vapi: in setup. ElevenLabs / Twilio / Stripe /
Cal.com: later.

## 6. Decisions made
- **Voice platform: start on Vapi** (already integrated + deployed + working). **Retell is
  the upgrade path** (more reliable ~99.9% vs ~99.5%, lower out-of-box latency, managed);
  switching later ≈ a URL change because our backend is a portable custom-LLM. **Bland** only
  if outbound-at-scale becomes central; **Synthflow** only if a no-code option is ever
  wanted. **None are agency-native** → our backend + per-client configs + (future) agency
  portal ARE the white-label layer. Don't re-platform before validating demand.
- **Model:** Claude via our backend; the voice platform carries no LLM key.
- **Ship voice changes one at a time.** #10 bundled two changes, broke the phone, and cost
  us the ability to tell which one did it. The **SSE transport is the danger zone** — a bug
  there produces silence, not a bad answer, and silence is the one failure a caller cannot
  work around. Logic/prompt changes are cheap and safe; transport changes ship alone, and
  **always test by calling the number after deploy.**

## 7. Deferred / roadmap (do later, in this order)
0. ~~Get the phone answering~~ **DONE** — live, taking real calls.
1. **Make the live phone good enough to demo:** merge PR #12 → switch the transcriber to
   Deepgram Nova → then fix latency by re-attempting #10 **as two separate commits**
   (`end_call` first, streaming second), diagnosing the silence from Render logs first.
2. ~~Turn on the real calendar~~ **DONE** — live on contact@ithinkservices.net.
2b. **Get the number in front of one real local business.** The product answers calls and
   books to a real calendar; the bottleneck is now demand, not features. Recurring cost is
   stacking with zero revenue — don't add surface area ahead of a paying customer.
3. **Website "Talk to Ava" widget** — DEFERRED. If built, it's a public metered endpoint →
   MUST add rate-limiting/abuse protection first (else bots burn Claude/Vapi spend). It's
   polish, not the bottleneck; validate demand first.
4. **Agency control-plane portal** — one login showing every client's usage + setup health;
   needs a multi-tenant DB + routing calls by phone number. (User: "circle back later.")
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
