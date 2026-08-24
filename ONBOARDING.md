# Onboarding a client — the 2-hour runbook (Grok)

One client = one Grok agent + one phone number + their calendar connected. **No code, no
server, no deploy.** If a client ever needs a code change, that is the exception — see
"When a client needs more than this" at the end.

**Budget the time like this:** 60–90 minutes writing their knowledge, 20 minutes of
clicking, 15 minutes testing. The knowledge is the work; the rest is a checklist.

---

## Before you start — collect these from the client

Ask for all of it in one message, or read it off their website and confirm:

- [ ] Business name, what they do in one line, and their timezone
- [ ] Opening hours, per day
- [ ] Services they book, and how long each takes
- [ ] **A real, answerable phone** to transfer callers to — a mobile, not the line the agent
      answers. A call cannot be transferred to itself.
- [ ] Which Google account holds the calendar the bookings must land in
- [ ] What a good call achieves for them ("book the job", "get the address and a photo")
- [ ] 20+ questions their customers actually ask, with answers. Their FAQ page, their Google
      Business Q&A, and "what do people ring and ask?" — **this is the whole product.**
- [ ] When a human must take over (upset caller, billing, anything unusual)

---

## Step 1 — their knowledge file (60–90 min, the real work)

Copy `grok/knowledge.md` and rewrite it for them. Aim for 20–40 Q&As, written the way a
person would say them **out loud**. No entry, no answer — the agent is told never to guess.

Use `agent/examples/*.json` for a starting question list per trade if it helps. The FAQ is
what separates a demo from a receptionist worth paying for.

## Step 2 — their agent (10 min)

In the Grok Voice Agent Builder:

1. **New agent**, named for the business.
2. **Instructions**: copy `grok/agent-instructions.md` and change the business name, the
   receptionist's name, the human transfer number, the hours and the services. Everything
   else in that file is there because a live call went wrong — **do not trim it.**
3. **Knowledge**: upload their file from step 1.
4. **First message**: their real greeting, in their words. Never "Hello."
5. **Voice**: pick a warm one that suits the trade. Listen to two or three — it is the first
   thing a caller judges.

## Step 3 — connectors (10 min, and the step that bites)

- **Google Calendar**, with event creation enabled.
  **⚠️ Connect it in an incognito window, signed in as the CLIENT'S Google account.**
  Google silently reuses whatever account the browser is already logged into. We lost a
  booking to exactly this — it went to the wrong calendar and looked like it had vanished.
  After connecting, confirm the account shown is theirs.
- **Transfer**: their real answerable phone.
- Leave email connectors off unless they ask. The agent books with the caller's number from
  caller ID; taking an email by ear broke three of our own test calls.

## Step 4 — the number (5 min)

Buy one in their area code, or bring their existing number over by SIP. If they want their
existing business line answered, that is a SIP/forwarding job — agree it explicitly, do not
assume.

## Step 5 — test before you hand it over (15 min)

Ring the number and run this. **Any FAIL means it is not ready.**

| # | Do this | PASS looks like |
|---|---|---|
| 1 | "I'd like to book" | Offers two real times straight away |
| 2 | Pick one | Asks your name, confirms your number from caller ID |
| 3 | Give a name | Books it. Says day, date and time back ONCE |
| 4 | Ask two of their FAQ questions | Answers in its own words, instantly, no web search |
| 5 | Ask something not in the FAQ | Says it would rather not guess. Does NOT invent |
| 6 | "Can I speak to someone?" twice | Second ask connects immediately |
| 7 | Ask a question, then pause | Answers. Does NOT hang up |
| 8 | "No thanks, that's all" | Says goodbye properly, then ends |
| 9 | Check the calendar | The appointment is on **their** calendar, right time |

## Step 6 — hand over

Give them: the number, what it answers, what it escalates, and where bookings appear. Tell
them how to reach you for FAQ changes — expect two or three rounds in the first fortnight,
and treat each one as a template improvement unless it is specific to them.

---

## Limits — say these out loud before taking money

- **Bookings go to Google or Outlook Calendar.** Vagaro, Booksy, Jobber and Housecall are
  not connected. If they need their own system, that is custom work — quote it separately.
- **Inbound only.** No outbound calling; that is a robocall under TCPA and needs legal
  review first.
- **The platform is in beta.** Fine for a pilot. Before it is a business's only line, say so
  plainly and agree what happens if it goes down.

## When a client needs more than this

`agent/` is the fallback: our own Node backend, which was the product until Grok replaced
it. It still runs, it still books to Google Calendar, and it emails booking alerts and
transcripts. Reach for it when a client needs a real integration with their own system, or
custom logic Grok's connectors cannot express. Its own setup steps are in `agent/README.md`.
