# Ready patterns

Adapt these — do not paste them unchanged. Every one has placeholders in `[BRACKETS]` that
must be replaced with the real entity name and real facts, and a pattern that describes
something the system does not actually do is worse than no pattern at all.

---

## 1. Automated / AI call + SMS consent (US)

The demanding case. Note the structure as much as the words: two boxes, the marketing one
unticked and not `required`, full disclosure visible without expanding anything.

```html
<div class="consent">
  <label>
    <input type="checkbox" name="agreed_terms" value="yes" required>
    <span><b>I agree to the Terms of Use and Privacy Policy.</b>
    I have read the <a href="/legal#terms">Terms of Use</a> and
    <a href="/legal#privacy">Privacy Policy</a>, and I consent to [ENTITY] storing and
    using the details above to respond to this enquiry.</span>
  </label>

  <label>
    <input type="checkbox" name="agreed_automated_calls" value="yes">
    <span><b>Yes — you may call or text me with an automated system.</b>
    By ticking this box I authorise <b>[REGISTERED LEGAL NAME, e.g. Example Services LLC]</b>
    to deliver telemarketing calls and text messages to me at the phone number I entered
    above, using an automatic telephone dialing system and an artificial or prerecorded
    voice, including its AI voice agent, for the purpose of [SPECIFIC PURPOSE].
    <b>I am not required to tick this box as a condition of purchasing any goods or
    services.</b> Message and data rates may apply. I can opt out at any time by saying
    "stop" or asking for a human on a call, replying STOP to a text, or emailing us.
    See <a href="/legal#calls">how we call you</a>.</span>
  </label>

  <p class="fine">Leave the second box unticked and nobody will auto-dial you — we will
  reply by [ALTERNATIVE, e.g. email] instead.</p>
</div>

<input type="hidden" name="consent_text"    value="">
<input type="hidden" name="consent_at"      value="">
<input type="hidden" name="consent_page"    value="">
```

Populate the hidden fields on submit with the exact wording shown, an ISO timestamp, and the
page URL. Storing the wording is the point — a stored `true` cannot tell you later what the
person actually agreed to.

**Verify before shipping:** submit the form with the second box unticked. If it refuses, the
consent is defective and every record it collects is worthless.

---

## 2. Email marketing opt-in

```html
<label>
  <input type="checkbox" name="email_marketing" value="yes">
  <span>Email me occasional tips and offers from [ENTITY]. No more than [FREQUENCY].
  Unsubscribe in one click from any message. We never share your address.</span>
</label>
```

Stating the frequency reduces both unsubscribes and complaints, because the person is
agreeing to something specific rather than to an unknown volume.

---

## 3. Outbound AI call opening

Carries identity, automation disclosure, purpose and opt-out in one breath — the whole
disclosure obligation, said the way a person would say it:

> "Hi, this is an automated assistant calling on behalf of [REGISTERED LEGAL NAME] about the
> demo you asked for on our website. I can book you a time or put you through to someone —
> and just say stop at any point and I won't call again. You can reach us back on
> [CALLBACK NUMBER]."

Do not bury any of this later in the call. The identification is required *at the beginning*,
and an opt-out offered only at the end is not available throughout.

---

## 4. Data-sharing disclosure

```markdown
### Who else touches your data

We use these service providers, and they process your data only on our instructions:

| Provider | What they do | What they receive |
|---|---|---|
| [FORM PROVIDER] | Delivers form submissions | Everything you type in the form |
| [EMAIL PROVIDER] | Sends our email | Your name and email address |
| [HOST] | Runs the website | Standard request logs |
| [CALENDAR] | Holds bookings | Your name, number and appointment time |
| [AI / VOICE VENDOR] | Runs our phone agent | Call audio and transcripts |

We do not sell your personal information and we do not share it with anyone for their own
marketing.
```

The AI/voice row is the one people leave out. If transcripts pass through a model provider,
that provider is a recipient.

Only claim "we do not sell" after enumerating every third-party script the site loads —
advertising and analytics tags can make that sentence false without anyone intending it.

---

## 5. Retention

```markdown
### How long we keep it

| What | How long |
|---|---|
| Enquiries and lead records | [2 years] from your last contact with us |
| Consent records | The length of our relationship plus [PERIOD] |
| Call recordings and transcripts | [12 months] |
| Customer and transaction records | [7 years], as tax rules require |
| Do-not-contact list | Indefinitely — we have to keep it to honour your opt-out |

Ask us to delete yours sooner and we will, unless we are required to keep it.
```

The last row is worth keeping visible: honouring an opt-out requires retaining the identifier,
so a "delete everything" request must not wipe the suppression entry.

---

## 6. Recording / transcription notice

> "Just so you know, this call is recorded and transcribed so we can keep track of what was
> agreed. Let me know if you'd rather I didn't."

Required in two-party-consent states, and cheap goodwill everywhere else.
