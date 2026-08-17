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
- **Do not run anything in the background.** No scheduled check-ins, background agents, or
  self-watching PR loops. Complete work in the foreground and hand it back.

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

**THE PHONE — LIVE ✅ (first real calls 2026-08-13/14).** Vapi assistant → Model provider
**Custom LLM** → `https://ithink-ai-agent.onrender.com/api/vapi/chat/completions` → voice →
number. Vapi carries **no** Anthropic key (our backend is the brain). Keep Render on
**Starter** (a sleeping Free instance drops the first call); `VAPI_SECRET` pastes in as the
custom-LLM "API key"; assistant Server URL = `/api/vapi/function` to capture billable minutes.

**What the live calls exposed (this is the current work):**
1. **Latency** — the caller waits for Claude to finish the whole reply before hearing a
   word. Still unfixed; see the #10 post-mortem below.
2. **Digit capture** — the agent could not get a phone number right (ten repeats, still
   wrong). Root cause is the cheap transcriber, not the prompt.
3. **Fumbled its own FAQ** — `answer_faq` matched by substring, so *"how much does it
   cost"* never reached the entry keyed `pricing`.

**⚠️ #10 post-mortem — a silent phone (read before touching the voice path):**
PR #10 shipped SSE token streaming **and** an `end_call` tool together. On deploy the phone
went **completely silent** — no greeting, no response to speech. Reverted same day (#11);
production is back on the slow-but-working single-chunk SSE. **The cause was never
diagnosed** — and because the two changes shipped as one commit, we still don't know which
one caused it. Diagnose from Render logs first, and put them back **separately**.

**Next up:** PR #12 (caller-ID read-back, chunked digits, FAQ inlined into the prompt,
per-call `objective`) — rebased onto main, conflict-free, typecheck clean, 13/13 tests,
**ready to merge**. Deliberately touches no SSE transport code. After it merges, switch the
Vapi transcriber to **Deepgram Nova** (console work, fixes misheard digits at the source).

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
