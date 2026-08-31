# Disclosing that an AI or bot is involved

A fast-moving area with an unusual property: what is *legally* required and what is
*reputationally* survivable have drifted apart, and the second is often the binding constraint.

**Verify before asserting** — state AI statutes are being passed and amended continuously, and
any list of "which states require what" ages badly. Check the specific state.

## The landscape

- **Federal telecom:** the FCC confirmed (Feb 8, 2024) that AI-generated voices are
  "artificial" voices under the TCPA. That does not itself mandate saying "I am an AI", but
  the artificial-voice rules require identifying the responsible entity at the start of the
  call — see `us-calls-sms.md`.
- **State bot-disclosure laws:** California's bot law requires disclosure where a bot is used
  to incentivise a sale or influence a vote. Others require disclosure on request, or in
  specific sectors.
- **Sector rules:** healthcare, insurance, employment screening and lending increasingly carry
  their own AI notice and appeal requirements.
- **Recording consent:** an AI agent that transcribes is recording. Two-party-consent states
  require all parties' consent — disclose and capture it. This is frequently missed because
  "transcript" does not sound like "recording".

## Inbound and outbound are different problems

**Inbound** — the person dialed you. A light-touch persona is generally defensible, and many
deployed agents are told to deflect "are you a bot?" gracefully. Even here, the safer pattern
is a truthful, unembarrassed answer: *"I'm the virtual receptionist — but I can book you in."*
It costs nothing and removes the risk of a caller feeling deceived, which is the reputational
failure mode that no statute needs to exist for.

**Outbound** — you dialed them. Identity and disclosure at the top of the call, every time.
The artificial-voice rules require the entity's registered name at the start, an automated
opt-out, and a callback number.

**The design consequence, stated plainly: an outbound agent must not reuse the inbound
agent's instructions.** "Never say you are an AI" is a rule some inbound agents ship with and
is exactly wrong outbound. When someone asks to point an existing inbound agent at an outbound
list, flag this as the first blocker — it is invisible in testing, because the agent will
happily do the wrong thing convincingly.

## What good disclosure sounds like

Natural, early, and not apologetic:

> "Hi, this is an automated assistant calling on behalf of [Registered Name]. I can book you
> in or pass you to someone — and just say stop at any time and I won't call again."

That single sentence carries identity, automation disclosure, purpose and opt-out. Compare
with a disclosure buried at the end, which satisfies nobody and reads as concealment.

## Checklist

- [ ] Outbound: registered entity name and automated nature stated at the start
- [ ] Opt-out offered early and honoured immediately
- [ ] Inbound: truthful answer available when asked whether it is a bot
- [ ] Recording/transcription disclosed; consent captured in two-party states
- [ ] Recipient's state AI rules checked, not assumed
- [ ] Separate instruction sets for inbound and outbound agents
- [ ] Human escalation always reachable
