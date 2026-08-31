# Keeping and sharing personal data — US state privacy law

There is no general federal privacy statute. A growing set of state laws — California
(CCPA/CPRA), Virginia, Colorado, Connecticut, Utah, Texas, Oregon, Montana and more each year
— each apply based on **where the person lives**, not where the business sits. A Charlotte
business with California customers is in scope for California.

**Verify before asserting**, especially thresholds and effective dates: these change every
legislative session, and a list of "which states are live" goes stale within months. Check
the state attorney general's own site.

## Applicability — check before assuming

Most state laws have thresholds (revenue, number of residents' records processed, or share of
revenue from selling data). A small local business may fall under them entirely. **But:**

- Thresholds drop over time and vary by state.
- Selling or sharing data can pull a small business in regardless of size.
- Contracts often impose these obligations anyway — a client or platform may require
  compliance the statute does not.

Do not tell a user they are exempt without checking the specific state and current threshold.
"Probably too small to be covered" is a reasonable working assumption to state as an
assumption, never as a conclusion.

## The rights to support

Broadly consistent across states, with local variation in deadlines and exceptions:

- **Know / access** — what you hold about them, and where it came from.
- **Delete** — subject to exceptions (legal obligations, security, completing a transaction).
- **Correct** — fix inaccurate data.
- **Portability** — a copy in a usable format.
- **Opt out of sale or sharing** — including targeted advertising.
- **Opt out of profiling** with legal or similarly significant effects.
- **Non-discrimination** — no worse price or service for exercising a right.

Typical response deadline is **45 days**, commonly extendable once. Build the request channel
before you need it; a policy promising rights with no way to exercise them is its own defect.

## "Sale" and "sharing" are broader than money

The trap: most definitions cover disclosure for **valuable consideration**, not just cash.
Under several states, letting an advertising or analytics vendor collect data through your
site — ad pixels, retargeting tags, some analytics — counts as a sale or share even though no
one wrote a cheque.

Consequences when it applies: a conspicuous **"Do Not Sell or Share My Personal Information"**
link, honouring the **Global Privacy Control** browser signal, and opt-*in* for minors.

When auditing a site, enumerate every third-party script actually loading. Users routinely
have no idea a pixel is present, and it is the single most common cause of an inaccurate
"we do not sell your data" claim.

## Sensitive data

Health, precise geolocation, biometrics, race, religion, sexual orientation, immigration
status, children's data, and financial account details attract heightened rules — often opt-in
consent, and sometimes a separate regime entirely (HIPAA, GLBA, COPPA, state biometric laws
such as Illinois BIPA, which carries a private right of action). **Route any of these to a
lawyer.** Do not improvise disclosures for regulated categories.

## Retention — say a period, not a sentiment

"We keep data as long as necessary" communicates nothing and satisfies no one. State a period
per category, and be able to honour it:

| Category | A defensible pattern |
|---|---|
| Enquiry / lead records | 2–3 years from last contact |
| Consent records | Term of the relationship + the limitation period (consent must outlive any claim about it) |
| Call recordings / transcripts | 6–24 months, shorter unless there is a reason |
| Customer/transaction records | As tax and accounting rules require, commonly 7 years |
| Marketing suppression list | Indefinitely — deleting it would resurrect contact |

The last row surprises people: honouring an opt-out **requires** retaining the identifier
forever. A blanket "delete everything" request must not wipe a suppression entry.

## Vendors and subprocessors

Anyone who touches personal data on your behalf — form handler, email provider, CRM, hosting,
calendar, transcription, and any **AI/LLM provider** — is a recipient.

- [ ] Maintain a current list; it is the basis of an honest privacy policy.
- [ ] Have a data processing agreement with each.
- [ ] Check whether the vendor trains models on your data or retains it beyond processing.
- [ ] Disclose the **categories** of recipients in the policy; naming them is better practice.
- [ ] Confirm sub-vendor onward transfers.

AI vendors are the ones users forget. If call transcripts pass through a model provider, that
provider is a recipient and belongs in the policy.

## Breach notification

All fifty states have breach notification laws with differing definitions and deadlines. When
a user asks about an actual or suspected breach, that is **immediate counsel**, not a drafting
exercise. Notification clocks may already be running.

## Audit checklist

- [ ] Policy states categories collected, purposes, and recipients — matching reality
- [ ] Retention periods stated per category, not "as long as necessary"
- [ ] Rights listed with a working channel to exercise them, and a response deadline
- [ ] Every third-party script on the site enumerated and disclosed
- [ ] "Do not sell or share" link where applicable; GPC signal honoured
- [ ] Sensitive categories identified and routed to counsel
- [ ] Vendor/subprocessor list current, with DPAs
- [ ] AI providers treated as recipients
- [ ] Suppression list carved out of deletion routines
- [ ] Policy has a last-updated date and a change process
