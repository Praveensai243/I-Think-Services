# Consent UX — checkboxes, dark patterns, subscriptions

Consent is a user-interface problem as much as a drafting one. Language that is impeccable on
its own becomes invalid through layout: a valid disclosure inside a pre-ticked box collects
nothing.

## Patterns that invalidate consent

**Pre-ticked boxes.** Record the site's preference, not the person's choice. Invalid under
GDPR outright; fatal to the "signature" requirement for written consent in the US.

**Bundling.** One checkbox covering terms acceptance *and* marketing consent means the person
agreed to the first and was handed the second. Split them — one decision per box.

**Required consent.** The single most common serious defect, and the easiest to introduce by
accident. When marketing consent is mandatory to submit, it is a toll, not a choice.

Watch for this specifically during "make the form stricter" or "reduce junk leads" changes: a
`required` attribute added to the marketing checkbox in a later pass silently voids every
consent the form has ever collected, and nothing about the form looks broken afterwards.
**Test it by submitting the form with the marketing box unticked** — if it refuses, the
consent is defective.

**Asymmetric effort.** One click to accept, five to reject. Under GDPR, withdrawal must be as
easy as consent; more generally, regulators treat asymmetry as evidence of manipulation.

**Confirmshaming.** "No thanks, I like missing calls." Pressure through shame is a documented
dark pattern and increasingly named in enforcement.

**Buried terms.** Consent inside a scrolling terms box is not clear and conspicuous. It must
be separate and distinguishable from surrounding copy.

**Vague language.** "We may contact you about offers" identifies no entity, no channel, no
technology, and grants nothing anyone can rely on later.

## What a sound consent block looks like

- Marketing consent visually distinct from the submit button and from terms acceptance
- Unticked by default
- Optional, and the form provably submits without it
- Full disclosure visible without expanding anything — no accordion, no hover
- Links to the policies open without losing entered data
- Plain language at the reader's level, not the regulator's
- The consequence of declining stated honestly ("we'll email instead")

That last one is worth the space. Telling people what happens if they say no makes the choice
real, and a person who understands the trade is far less likely to complain about the outcome.

## Subscriptions, auto-renewal, cancellation

Where an ongoing charge is involved, additional rules apply — federal negative-option rules
and a growing set of state auto-renewal statutes.

- [ ] Material terms disclosed **before** payment: price, frequency, renewal, how to cancel
- [ ] Express informed consent to the recurring charge, separate from the purchase
- [ ] Renewal reminders where required
- [ ] **Cancellation as easy as signup** — if it was bought online, it must be cancellable
      online, without a retention call
- [ ] Free-trial-to-paid conversion disclosed clearly, before the trial starts

The click-to-cancel area is actively litigated and rules have shifted; **verify the current
federal and state position before advising**, rather than relying on recall.

## Accessibility

Consent that cannot be perceived cannot be informed. Real checkboxes with real `<label>`
elements, keyboard operable, visible focus, sufficient contrast, and text that survives
zooming. Custom-styled checkboxes are fine if the underlying input remains a focusable
control — a `<div>` with a click handler is not a checkbox, and a screen-reader user cannot
consent through it.

## Records

Store the wording displayed, the timestamp, the form version, and the identifier consented
for. A boolean `true` proves someone ticked something; it does not prove what.

## Checklist

- [ ] Marketing consent separate from terms acceptance
- [ ] Nothing pre-ticked
- [ ] Form submits with marketing consent unticked (test this, don't assume)
- [ ] Rejecting is no harder than accepting
- [ ] No confirmshaming
- [ ] Disclosure visible without expanding
- [ ] Real, labelled, keyboard-operable inputs
- [ ] Consequence of declining stated
- [ ] Consent record captures wording, time, version, identifier
- [ ] Recurring charges: terms before payment, cancellation as easy as signup
