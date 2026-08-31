---
name: consent-compliance
description: >-
  Draft and audit the legal language around signup, consent and personal data — consent
  checkboxes for marketing or sales calls, SMS and email opt-ins, privacy policies, terms,
  cookie banners, retention and data-sharing disclosures, and opt-out flows. Returns findings
  with severity, the rule behind each, and literal replacement text. Use whenever work touches
  how a business gets permission from a person or explains what it does with their data:
  building or reviewing a signup, lead, contact or checkout form; writing or checking a privacy
  policy, terms or cookie notice; setting up automated, AI-voice or outbound calling, SMS or
  cold email; deciding what data to keep, how long, or who to share it with; or questions on
  TCPA, CAN-SPAM, DNC, GDPR, CCPA, robocalls, opt-in, unsubscribe, or "is this legal to
  send/call/store". Trigger it even when the user only asks for "a contact form" and never
  mentions law — consent defects are invisible in a working form and expensive later. Not a
  substitute for a lawyer.
---

# Consent & data compliance

Permission and privacy language fails quietly. A consent checkbox that is pre-ticked, or a
form that makes consent mandatory, still submits perfectly — the defect only surfaces as a
demand letter, a class action, or a platform ban, often years later and multiplied by every
person who ever used the form. That gap between "it works" and "it holds up" is what this
skill closes.

## The one rule that matters most: verify, don't recall

**Look up the actual rule text before you assert what it requires.** Consent rules are
unusually dense in specific, easily-forgotten obligations — an identification that must come
at the *start* of a call, a callback number, an interactive opt-out, a ten-business-day
deadline — and they change: agency rules get vacated by courts, states pass their own
versions, effective dates slip.

This is not a theoretical concern. A carefully written consent page, drafted from memory by a
competent drafter, was checked against the source rules and was **missing four separate
mandatory requirements**. Every one was a thing the drafter "knew" and had simply not
recalled at the moment of writing. Recall produces confident, plausible, incomplete text.

So: use WebSearch/WebFetch against primary sources (eCFR, the agency's own rulings, the
statute) before stating a requirement, and cite what you relied on. When you cannot reach a
source, say the requirement is unverified rather than presenting it as settled. A finding the
user can check beats a finding they must trust.

## Establish the facts before quoting any rule

Which rules apply is decided almost entirely by facts the user has not volunteered. Ask for
whatever is missing and material — usually two or three of these, not all of them:

- **Channel:** phone call, SMS, email, postal, in-app, cookie/tracker?
- **Automation:** is a machine dialing, or an artificial/AI/prerecorded voice speaking? This
  is usually the single biggest escalation in obligations.
- **Purpose:** marketing/telemarketing, or transactional/relationship? Marketing is strictly
  harder; the boundary is where most mistakes live.
- **Who is contacted:** consumers, businesses, or both? Mobile or landline? ("B2B" is a much
  weaker defence than people assume — see `references/us-calls-sms.md`.)
- **Where they are:** the recipient's location drives it, not the sender's. State and country.
- **Data:** what is collected, how long it is kept, and who else receives it — including
  analytics, ad pixels and AI vendors, which people forget are recipients.
- **Who the legal entity is:** the exact registered name, which several rules require you to
  state verbatim.

If the user cannot answer one, note the assumption you made in the output rather than stalling.

## Pick the reference files you need

Read only what the task touches. Each file carries the checklist, the traps, and the source
citations for its domain.

| The work involves | Read |
|---|---|
| Calls, SMS, robocalls, AI voice agents, DNC, outbound dialing | `references/us-calls-sms.md` |
| Marketing email, newsletters, cold outreach, unsubscribe | `references/us-email.md` |
| Privacy policy, data retention, selling/sharing data, US state privacy law | `references/us-privacy.md` |
| EU/UK/Canada users, international transfers, GDPR | `references/intl-privacy.md` |
| Checkbox design, dark patterns, subscriptions, cancellation flows | `references/consent-ux.md` |
| Disclosing that a bot or AI is involved | `references/ai-disclosure.md` |

`assets/consent-blocks.md` has ready patterns — call/SMS consent, email opt-in, data-sharing
notice, retention table — to adapt rather than write from scratch.

## Auditing an existing form or page

Run the scanner first; it catches the mechanical defects deterministically so your attention
goes to the judgement calls:

```bash
python3 scripts/audit_consent.py path/to/page.html
```

It flags pre-ticked consent, consent made mandatory, bundled consent, missing
"not a condition of purchase", absent policy links, vague retention language and similar.
It reads structure, not meaning — it cannot tell you whether the disclosure is *accurate*,
so read the page yourself as well.

## Writing the consent itself

Four properties make consent hold up, and they are worth understanding rather than copying:

1. **Separate.** One decision per checkbox. Bundling "I accept the terms" with "you may call
   me with a robot" means the person never actually agreed to the second thing — they agreed
   to the first and were handed the second.
2. **Unticked.** A pre-ticked box records the site's preference, not the person's choice.
3. **Genuinely optional.** The moment marketing consent is required to submit, it stops being
   consent and becomes a toll. Several regimes say this outright; all of them treat coerced
   consent as no consent. **This is the most common serious defect and the easiest to
   introduce by accident** — a `required` attribute added later during a "make the form
   stricter" pass quietly destroys every consent the form collects.
4. **Specific.** Name the legal entity, the channel, the technology (autodialer, artificial
   or prerecorded voice), the purpose, and the number or address it applies to. "We may
   contact you" grants nothing anyone can rely on.

Write the disclosure at the reading level of the person signing, not of the regulator. Plain
language is not a compliance risk; it is evidence the person understood.

### Keep the evidence, not just the answer

A stored `consent = true` proves nothing later, because it does not show *what* was agreed
to. Capture, at minimum: the exact wording displayed, a timestamp, the page or form version,
and the identifier consented for (the phone number, the email). Recommend this whenever you
build a consent flow — it is the difference between a defensible record and a bare assertion,
and it costs one hidden field.

## Output format

Lead with the verdict, then the findings, ordered by severity — someone should be able to act
on the first item without reading to the end.

```markdown
## Verdict
[One or two sentences: is this safe to ship, and if not, what is the blocking issue?]

## Findings

### 1. [Short title] — [Blocking | Serious | Improvement]
**What's wrong:** [the defect, in plain words]
**Why it matters:** [the rule or exposure, with the citation]
**Fix:** [literal replacement text, ready to paste]

## Assumptions I made
[Facts you inferred because they weren't given — each one the user should confirm]

## What needs a lawyer
[The specific questions counsel should answer, not a blanket disclaimer]
```

Severity means: **Blocking** — do not ship, this creates live liability. **Serious** — ship
only with a deadline to fix. **Improvement** — better practice, no clear violation.

Give fixes as complete replacement text. "Add a disclosure about retention" is a task; a
written paragraph they can paste is a fix, and it is what makes this skill worth invoking.

## Boundaries — where honesty serves the user better than confidence

Say plainly that this is **not legal advice** and that you are not a lawyer. Do it once,
clearly, without hedging every sentence into uselessness — a report smothered in disclaimers
gets skimmed, and the reader misses the blocking finding.

Then be specific about what actually needs counsel, because "consult an attorney" as a blanket
line is noise. Route these to a lawyer every time:

- Anything going live at scale before review — outbound calling programs especially, where
  statutory damages are per-call and multiply fast.
- Regulated categories: health, financial services, credit, children under 13/16, biometrics,
  insurance, debt collection.
- Multi-state or multi-country programs, where the strictest jurisdiction governs the design.
- Anything already contested — a complaint, a demand letter, a regulator's inquiry.

And when the user pushes for a definitive "is this legal?", give them the honest shape:
what is clearly required, what is genuinely unsettled, and what the realistic exposure is.
A calibrated answer they can act on is more useful than either a refusal or false certainty.
