# Outreach roadmap — finding clients at scale

The goal is a paying customer, not a sending machine. Everything below is ordered so the
cheap thing that could kill the plan happens before the expensive thing built on top of it.

---

## ⚠️ Read this before building anything: read receipts do not work

The ask was "read receipts so we know the email was delivered". Three separate things get
mixed up here, and only two of them are knowable:

| What you want to know | Can you? | How |
|---|---|---|
| Did their mail server accept it? | **Yes, reliably** | The SMTP response, plus bounce handling |
| Did it land in inbox vs spam? | **No** | Nobody can see this from outside. Only inbox-placement tests approximate it |
| Did a human open it? | **No, not any more** | See below |
| Did a human reply? | **Yes** | The only signal that means anything |

**Why "opened" is dead as a metric.** Two mechanisms, both broken:

1. **Real read receipts (MDN)** are a polite request the recipient's email client can
   ignore, and almost all of them do — or they show the recipient a prompt asking whether
   to tell you they read it. On a cold email that prompt is a great way to be marked as
   spam.
2. **Tracking pixels** (the invisible image every cold-email tool uses) are now mostly
   noise. Apple Mail Privacy Protection has been on by default since iOS 15 and
   **pre-loads every image whether or not the person looks at the mail** — so those all
   register as opens. Gmail proxies images too. Your "open rate" becomes a number that
   moves for reasons unrelated to anyone reading anything.

**And the pixel actively costs you.** An image loaded from a tracking domain, in an email
that is otherwise plain text, is a spam signal. You would be trading deliverability — the
thing that decides whether the email arrives — for a number you cannot trust.

**So: no pixels, no read receipts. Measure bounces and replies.** A 2% reply rate is worth
more than a 40% "open rate", because you can bank a reply.

---

## Phase 0 — prove the message by hand (this week, £0, no code)

**Do not skip this.** Automation multiplies a message; it does not invent one. If the pitch
does not work on 50 businesses done by hand, automating it just makes a bad message arrive
faster and burns a domain doing it.

1. 50 Charlotte home-services businesses, by hand, from Google Maps. Name, phone, website.
2. Ring all 50 in their busy hours. Log who did not answer — that is the qualified list.
3. Same afternoon, email the non-answerers by hand from your normal address. 50 emails sent
   by hand will not hurt your domain.
4. Write down the exact words that got a reply, and the exact objection that killed one.

**Kill criteria:** fewer than 3 replies out of 50 means the message is wrong, not the
channel. Fix the message before building anything below.

## Phase 1 — the contact list at scale (week 2)

Scraping Google Maps directly breaks their terms and gets IPs blocked. Two better routes:

- **Google Places API** — official, pays per lookup (roughly $30 per 1,000 place details),
  gives name, phone, website, address. **It does not give email.**
- **A B2B data provider** — one is already connected to this workspace (Explorium, via the
  prospecting tool). Filters by city and industry and returns contacts directly. Costs
  credits per record.

Emails are the hard part for local trades: most publish a contact form, not an address.
Realistically you get an address for perhaps half of them, by pulling `mailto:` links off
their own website. **A phone number you already have beats an email you had to guess.**

## Phase 2 — sending infrastructure (week 2, before a single cold email)

1. **A separate domain.** Never send cold mail from `ithinkservices.net` — it carries the
   booking confirmations and client alerts. Getting it flagged means a client's customer
   stops receiving their appointment confirmation. Buy something close, e.g.
   `ithinkservices.co`.
2. **Authenticate it**: SPF, DKIM, DMARC. Without all three, cold mail from a new domain
   goes straight to spam.
3. **Warm it up for 2–3 weeks** before real sending — a few mails a day, climbing. New
   domains sending 100 mails on day one look exactly like a spammer, because that is what
   spammers do.
4. **Verify every address before sending** (NeverBounce, ZeroBounce, MillionVerifier —
   fractions of a cent each). Bounces are what wreck a sender reputation, and this is the
   real answer to "did it get delivered".
5. **Cap at 20–30 a day per mailbox.** More mailboxes, not more per mailbox.

## Phase 3 — the automation (week 3)

n8n is already connected to this workspace but **needs authorising before it can be used**
— do that in the connector settings. The workflow:

```
list (Phase 1)
  → verify addresses
  → personalise: business name, the day/time you rang, whether it went to voicemail
  → send from the outreach domain, 20–30/day, business hours only
  → wait 3 days
  → one follow-up, then stop
  → watch the inbox: replies go to you, bounces mark the record dead, "no" unsubscribes
```

Non-negotiable in every email: honest subject, a real reply-to, your physical address, and
a working opt-out honoured within 10 days. That is CAN-SPAM, and it is not optional.

## Phase 4 — measure the two things that are real

- **Bounce rate** — over 3% and pause everything; the list is bad and the domain is at risk.
- **Reply rate** — the only number that matters. Target 2–5% for a local, specific message.
- **Calls to the demo number** — the strongest signal of all, and it needs no tracking:
  every call already lands in the diagnostics trail and the transcript email.

## Later — outbound calling

Deferred and legally loaded. The FCC treats an AI voice as an artificial voice under the
TCPA: $500–$1,500 per call without consent. The exception is business landlines, and local
trades mostly use mobiles. **Calling people who asked to be called** — a web form, a
callback request — is the version that is both legal and effective, and it is worth
building after there is a paying customer.
