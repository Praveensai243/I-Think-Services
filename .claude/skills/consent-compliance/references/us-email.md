# Marketing email — US (CAN-SPAM) and adjacent rules

CAN-SPAM is often described as lax because it does not require opt-in. That framing misleads:
it has hard mechanical requirements, per-message penalties, and — unlike the opt-in question —
they apply to every commercial message you ever send.

**Verify before asserting.** Primary sources: 15 U.S.C. §§ 7701–7713, and the FTC's rule at
16 C.F.R. Part 316.

## What CAN-SPAM actually requires

- [ ] **No false or misleading header information.** From, To, Reply-To and routing must
      identify the real sender.
- [ ] **No deceptive subject lines.** The subject must reflect the content.
- [ ] **Identify the message as an advertisement.** Clear and conspicuous; it can be done
      through context, but it must be evident.
- [ ] **A valid physical postal address.** A real street address, a registered PO box, or a
      private mailbox registered with a commercial mail receiving agency. This one is skipped
      constantly and is trivially provable against you.
- [ ] **A clear, conspicuous opt-out mechanism** in every commercial message.
- [ ] **Honour opt-outs within 10 business days**, and keep honouring them.
- [ ] **The opt-out must not cost anything or demand anything** — no login, no fee, no
      "tell us why", no requiring more than an email address and a click.
- [ ] **You remain responsible when someone else sends for you.** Hiring an agency or a
      platform does not transfer liability.

Opt-out lists must be honoured indefinitely, and a suppressed address may not be sold or
transferred except to help with compliance.

## Where opt-in becomes mandatory anyway

CAN-SPAM sets the floor, not the ceiling. Opt-in is effectively required when:

- **The recipient is in the EU/UK** — see `intl-privacy.md`. GDPR/ePrivacy demand consent for
  most marketing email, and the sender's location does not change that.
- **Canada (CASL)** — consent-based, with penalties far above CAN-SPAM's, and it reaches
  anyone emailing into Canada.
- **The platform requires it.** Every reputable ESP contractually requires opt-in and will
  terminate for purchased lists regardless of what the statute permits.

## Deliverability is the practical constraint

Compliance and deliverability are separate problems, and the second one bites first. A
technically legal cold campaign that lands in spam has cost the sender their domain
reputation, which is much harder to repair than a policy.

- Send cold outreach from a **separate domain** from transactional mail. If the domain that
  carries password resets, receipts and appointment confirmations gets flagged, the damage
  falls on existing customers, not prospects.
- Authenticate: SPF, DKIM, DMARC. Bulk senders at the major mailbox providers are required to,
  and unauthenticated mail is increasingly rejected outright.
- Warm new domains gradually; volume spikes look like compromise.

## Open tracking does not measure what people think

Tracking pixels are widely assumed to prove a human read the message. They no longer do.
Apple Mail Privacy Protection pre-fetches images regardless of whether anyone opened the
message, and other providers proxy images similarly, so "opens" register for mechanical
reasons. Meanwhile a tracking pixel in an otherwise plain message is itself a spam signal.

Read receipts (MDN) fare no better: they are a request the client may ignore, and on cold
mail the prompt itself invites a spam complaint.

**Measure delivery acceptance, bounces, replies and unsubscribes.** Advise users against
building process on open rates — it is a number that moves for reasons unrelated to anyone
reading anything, and chasing it trades deliverability for a metric you cannot trust.

## Audit checklist

- [ ] Accurate From/Reply-To identifying the real sender
- [ ] Subject line matches content
- [ ] Message identifiable as advertising
- [ ] Valid physical postal address in every commercial message
- [ ] One-click unsubscribe, no login or fee, no interrogation
- [ ] Opt-outs processed within 10 business days and honoured permanently
- [ ] Suppression list maintained across all sending tools
- [ ] Consent obtained where the recipient's jurisdiction requires it
- [ ] Cold outreach on a domain separate from transactional mail
- [ ] SPF, DKIM and DMARC configured
- [ ] Success measured on replies and bounces, not opens
