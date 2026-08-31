# Calls, SMS, robocalls and AI voice — US

The highest-stakes area in this skill. Damages are **per call or per message**, so a
defective list is a multiplied problem, not a single one.

**Verify before asserting.** Primary sources: 47 U.S.C. § 227 (TCPA), 47 C.F.R. § 64.1200
(FCC rules, on eCFR), 16 C.F.R. § 310 (FTC Telemarketing Sales Rule), and the FCC's own
declaratory rulings. This file is a map of what to check, not a substitute for checking.

## Contents
- [The three questions that set the rules](#the-three-questions)
- [Consent tiers](#consent-tiers)
- [Prior express written consent — the checklist](#prior-express-written-consent)
- [What an artificial or prerecorded voice call must do](#artificial-voice-call-requirements)
- [AI voices are covered](#ai-voices)
- [Revocation and do-not-call](#revocation-and-dnc)
- [Timing](#timing)
- [The B2B trap](#the-b2b-trap)
- [State law](#state-law)
- [Damages](#damages)
- [Audit checklist](#audit-checklist)

## The three questions

Everything downstream follows from these. Establish them first.

1. **Is it marketing?** Telemarketing/advertising triggers the strict tier. Purely
   transactional or relationship calls (an appointment reminder, a delivery notice) sit in a
   lower tier. Mixed-purpose calls are treated as marketing — a "reminder" that pitches an
   upgrade is an ad.
2. **Is it a mobile number?** Mobiles get the strongest protection, and the protection does
   not depend on whether the recipient is a consumer or a business.
3. **Is a machine dialing or speaking?** An autodialer, or an artificial/prerecorded/AI
   voice, escalates the requirements sharply over a human dialing manually.

## Consent tiers

- **No consent needed** — a human manually dialing a non-marketing call to a number the
  person gave you.
- **Prior express consent** — sufficient for *non-marketing* automated/artificial-voice calls
  to a mobile. Giving you the number in connection with the transaction generally supplies it.
- **Prior express WRITTEN consent** — required for *marketing* calls or texts to a mobile
  using an autodialer or artificial/prerecorded voice. This is the demanding one, and it is
  where a signup form matters.

## Prior express written consent

A signed written agreement that authorises the named seller to deliver marketing calls or
texts to a specific number using an autodialer or artificial/prerecorded voice. It must:

- [ ] **Name the seller** — the entity's registered legal name, not a trading shorthand.
- [ ] **Identify the number** it applies to (tie it to the field the person filled in).
- [ ] **Disclose the technology** — "automatic telephone dialing system" and "artificial or
      prerecorded voice", in words, not implied.
- [ ] **State it is not a condition of purchase** — explicitly. This is mandatory language,
      not a courtesy.
- [ ] Be **clear and conspicuous**, and separate/distinguishable from surrounding copy.
- [ ] Carry a **signature**. An electronic signature counts (E-SIGN). **An unticked checkbox
      tied to an unambiguous disclosure is a valid signature; a pre-ticked box or a term
      buried in the T&Cs is not.**

**One-to-one consent is not in force.** The FCC's rule requiring separate consent per seller
was vacated by the Eleventh Circuit in *Insurance Marketing Coalition Ltd. v. FCC* (Jan 24,
2025) as exceeding the agency's authority. Do not design around it — but do not assume the
question is permanently closed either; re-check before relying on bundled multi-seller
consent, which remains the aggressive position.

## Artificial voice call requirements

Under 47 C.F.R. § 64.1200(b), a call using an artificial or prerecorded voice must:

- [ ] **State, at the very beginning**, the identity of the entity responsible for the call —
      for a business, the name it is **registered under**. Not partway in, not on request.
- [ ] **Provide a callback telephone number** during or after the message, reaching the entity
      (not a premium-rate number, and not the dialer itself).
- [ ] For telemarketing: **provide an automated, interactive opt-out** — voice- or
      keypress-activated — announced at the outset and available throughout the call, which
      adds the number to the do-not-call list and disconnects.

These are easy to miss because they feel like etiquette rather than law. They are law.

## AI voices

The FCC's Declaratory Ruling of **February 8, 2024** confirmed that AI-generated and cloned
voices are "artificial" voices under the TCPA. There is no new-technology exemption and no
grey area.

The practical consequence for anyone building an AI phone agent: **an outbound agent cannot
reuse an inbound agent's persona instructions.** Inbound agents are commonly told to sound
human and to deflect "are you a bot?" — which is defensible when the person dialed you, and
is the precise opposite of what an outbound call must do. Outbound needs its own instruction
set that opens with identity and disclosure. Treat any request to make an outbound agent
"sound more human" as a compliance question, not a voice-design one.

## Revocation and DNC

- Honour opt-outs made by **any reasonable method** — the person does not have to use magic
  words or your preferred channel. "Stop calling me", "take me off your list", a reply to a
  text, an email: all count.
- Process within **10 business days** of the request (FCC rules effective April 2025).
- Revocation of consent for marketing is comprehensive — do not treat an SMS opt-out as
  leaving voice consent intact unless the person clearly said so.
- Maintain an **internal do-not-call list** and honour it indefinitely.
- Scrub against the **National Do Not Call Registry** for cold telemarketing to consumers.
- Keep a written DNC policy and train anyone who calls; the TSR requires it.

## Timing

Call only between **8am and 9pm in the recipient's local time**. Their timezone, not yours —
derive it from the number's area code or from stated location, and remember area code is only
a proxy for a mobile that may have moved. Several states narrow this window further.

## The B2B trap

The most commonly believed falsehood in this area is that "we only call businesses, so the
TCPA doesn't apply."

What is true: calls to **business landlines** are largely outside the do-not-call rules.

What is not: there is **no B2B exemption for calls to a wireless number**. Autodialed or
artificial-voice marketing to a mobile requires the same consent whether the person is a
consumer or a purchasing manager. And small businesses — sole traders, plumbers, salons,
contractors — routinely list a personal mobile as the business number.

**Practical rule: for local-business outreach, assume every number is a mobile** unless you
have line-type data proving otherwise. Line-type lookup services exist; use one before any
automated campaign.

## State law

Several states impose stricter regimes than federal law, some with their own private rights
of action — Florida, Oklahoma and Washington are the frequently cited examples, and the list
grows. State mini-TCPAs commonly narrow calling hours, restrict consent bundling, and cover
technology the federal definition may not.

**Always check the recipient's state specifically.** Do not generalise from the federal
answer, and do not assume a national campaign can run on one consent design — the strictest
state in your footprint sets the standard.

## Damages

- **$500 per call or text** for a violation.
- **Up to $1,500 per call or text** where the violation is willful or knowing.
- Private right of action, and a mature plaintiffs' bar. Class exposure on a list of any size
  becomes existential quickly — 1,000 messages is a $500,000–$1,500,000 theoretical exposure.

This arithmetic is the argument for getting consent right before the first campaign, and it
is worth stating to a user who is impatient to launch.

## Audit checklist

- [ ] Consent checkbox separate from terms acceptance, and unticked
- [ ] Form submits successfully with the consent box left unticked
- [ ] Registered legal entity name in the disclosure
- [ ] "Automatic telephone dialing system" and "artificial or prerecorded voice" stated
- [ ] "Not a condition of purchase" stated
- [ ] Consent tied to the specific number captured
- [ ] Consent record stores wording + timestamp + version + the number
- [ ] Outbound script identifies the registered name at the start
- [ ] Outbound script gives a callback number
- [ ] Automated opt-out announced at the outset and available throughout
- [ ] Opt-out honoured by any method, within 10 business days
- [ ] Internal DNC list, and National DNC scrub where applicable
- [ ] Calling window enforced in the recipient's timezone
- [ ] Line-type check before automated calls to a "business" list
- [ ] Recipient-state rules checked, not just federal
