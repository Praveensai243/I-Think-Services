# Grok demo — build sheet

Everything needed to stand up the demo agent on Grok's Voice Agent Builder, with no Render
and no Vapi. Three files here: this one, `agent-instructions.md` (paste into the
instructions field), `knowledge.md` (upload as the knowledge base), `first-message.txt`.

---

## Rule for this build: Grok ONLY. Nothing of ours is connected.

**Do not wire our backend into this agent.** No Render, no Vapi, no custom API, no MCP
pointing at `ithink-ai-agent.onrender.com`. Booking goes through Grok's own Google Calendar
connector; confirmations through its email connector; transcripts through its own call
review.

The reason is the whole point of the test: if any of our stack is in the loop and a call
goes wrong, we cannot tell whether Grok is at fault or we are — and we would be back to
guessing, which is what cost us most of a week. **A clean result is worth more than a
feature.** This is the same rule as "ship voice changes one at a time"; it failed us once
already when two changes went out together and broke the phone.

If something can only be done by calling our server, **leave it out of this test and write
it down** as a gap. That list is the real output of the exercise: it tells us exactly what
Grok alone cannot do, which is the thing we actually need to know before selling on it.

---

## What I need from you

Only four things, and none of them take long. **Everything else is written below.**

1. **Access to the Voice Agent Builder.** It is in beta and gated — you may hit a 403. Tell
   me if you do; there is a fallback (our existing stack still works).
2. **The Google account for the calendar** — `contact@ithinkservices.net`. You will have to
   click through the connector's OAuth consent yourself; I cannot do that for you.
3. **A phone number**: buy one in their console (Charlotte area code, 704 or 980), or point
   your existing Vapi number at it over SIP.
4. **One test call, and the recording or transcript afterwards.** This is the part that
   actually decides whether we ship — nothing else substitutes for it.

If you want the demo to sound like the caller's own trade rather than our agency, tell me
the vertical (I would pick plumbing) and I will write a second instruction set and knowledge
file for a fake "Charlotte Plumbing Co". A plumber hearing his own business handled sells
far harder than hearing ours.

---

## Build steps

1. **Create the agent.** Name it "Charlotte — I Think Services".
2. **Instructions**: paste `agent-instructions.md` whole.
3. **Knowledge**: upload `knowledge.md` (38 entries — our whole FAQ).
4. **First message**: paste `first-message.txt`. Not "Hello."
5. **Voice**: pick a warm American English voice. Listen to two or three; this is the first
   thing a caller judges.
6. **Connectors** (Grok's own — never ours):
   - **Google Calendar** on `contact@ithinkservices.net`, with Create Event enabled.
     Bookings are 30 minutes, or 45 for a technical deep-dive.
   - **Gmail / email** for the confirmation to the caller, and — importantly — **an alert to
     us on every booking with the caller's phone number in it**. The number is the one thing
     the business actually needs from a booking.
7. **Transfer**: destination `+1 (704) 387-9775`. It must be a real, answerable phone, and
   never the number the agent itself answers — a call cannot be transferred to its own line.
8. **Number**: attach it, Charlotte area code.
9. **Guardrails**: if there is a confirm-before-acting setting for calendar writes, leave it
   ON until the booking flow has been tested end to end.

---

## The test that decides it — 10 minutes, do all of it

Ring the number and work through this. **Any FAIL means it is not customer-ready.**

| # | Do this | PASS looks like |
|---|---|---|
| 1 | "I'd like to book a demo" | Offers two real times straight away. Does NOT ask which day you'd prefer first |
| 2 | Pick one | Asks your name and confirms your number in one breath |
| 3 | Give a name | Books it. Says the day, date and time back ONCE |
| 4 | Say yes to the email, then spell it | Takes it in one pass. **Does not read it back. Does not ask you to confirm it** |
| 5 | Ask "what does it cost?" | Answers from the knowledge base, in its own words, sounding like a person |
| 6 | Ask something not in the FAQ | Says it would rather not guess, offers a follow-up. Does NOT invent an answer |
| 7 | "Can I speak to someone?" then ask again | Second ask connects you immediately, no more questions |
| 8 | Ask a question, then pause | Answers it. Does NOT hang up on you |
| 9 | "No thanks, that's all" | Says goodbye properly, then ends |
| 10 | Check the calendar and inbox | Appointment is there. Booking alert has your phone number. Confirmation reached you |

**Also judge, with your ear, the thing we switched for:** does it answer quickly, or is there
dead air after you speak? That is the whole reason for this move. If it still goes quiet,
Grok has not solved our problem and we stop.

Rows 4, 7, 8 and 9 are the ones that cost us real calls on the old stack. They are the most
likely to fail here too — a new platform fixes the pauses, not the flow.

---

## When something fails

Tighten the instructions, not the platform. Every rule in `agent-instructions.md` exists
because a live call went wrong; if one is not being honoured, make it shorter, louder and
earlier in the instructions rather than adding a paragraph. Re-run the whole 10-row test
after each change — fixing row 4 has broken row 9 before.

Keep `agent/` running until this passes. It is the fallback, and it is still the answer for
a client whose bookings live in Jobber, Housecall or Vagaro rather than Google Calendar.
