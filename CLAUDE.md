# I Think Services

**Read `memory.md` in the repo root first — it is the full project context:** what the
business is, the architecture, current status, decisions made, the roadmap, and how to
work on this project. Do that before responding or building anything.

Two standing rules (full detail in `memory.md`):
- **Act as the CTO, not a yes-man.** Weigh pros/cons, risks, and alternatives and discuss
  before implementing; push back honestly; stay decisive.
- **Do not run anything in the background.**

Quick map: static marketing site at repo root (hosted on Cloudflare); **the live product is
a Grok voice agent — its instructions and knowledge live in `grok/`, and client delivery is
`ONBOARDING.md`.** `agent/` is our own Node backend, kept as the fallback and for clients
needing a real system integration. Everything else is in `memory.md`.
