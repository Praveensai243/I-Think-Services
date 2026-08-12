# Deploying the AI receptionist (going live)

The backend just needs to run somewhere public 24/7 so it can serve the browser
demo and answer phone webhooks. Two easy options — pick one.

## Option A — Render (simplest, has a free tier)

1. Push this repo to GitHub (already done).
2. Go to **render.com** → **New → Blueprint** → connect this repo. Render reads
   `render.yaml` and creates the service (root dir `agent/`).
3. In the service's **Environment**, set the secrets:
   - `ANTHROPIC_API_KEY` — from console.anthropic.com (this makes it talk)
   - `ADMIN_TOKEN` — any strong string (protects `/admin`)
   - After the first deploy, copy the service URL and set `PUBLIC_BASE_URL` to it.
4. Open the service URL → the voice demo. Open `…/admin` → the dashboard.

> **Free vs paid:** Render's **free** web service sleeps when idle (a few seconds of
> cold-start on the next hit) — fine for the browser demo. For a **phone number**, use
> the **starter** (always-on) plan so calls are answered instantly. The blueprint is
> set to `starter`; change to `free` if you only want the demo for now.

## Option B — Railway / Fly / any Docker host

There's a `Dockerfile` in this folder. On **Railway**: New Project → Deploy from GitHub
→ it builds the Dockerfile. Set the same env vars. Same for Fly.io (`fly launch`) or any
container host.

## Environment variables (what to set)

| Variable | When | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | always | Makes the agent think/talk |
| `MODEL` | optional | `claude-opus-5` (default) or `claude-haiku-4-5` (lowest phone latency) |
| `ADMIN_TOKEN` | recommended | Protects `/admin`; without it the dashboard is open |
| `PUBLIC_BASE_URL` | after deploy | Your service's https URL (used in the Vapi config it generates) |
| `CALENDAR` | booking | `mock` (default, in-memory — lost on restart) · `google` · `calcom` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Calendar | Base64 of the service-account key; share the calendar with its `client_email`. See README §3 |
| `GOOGLE_CALENDAR_ID` | Google Calendar | The shared calendar's id — not `primary` when using a service account |
| `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN` | Google Calendar | OAuth fallback only. See README §3 |
| `CALCOM_API_KEY`, `CALCOM_EVENT_TYPE_ID` | Cal.com | See main README |
| `VAPI_SECRET` | phone | Shared secret for the Vapi tool webhook |
| `ELEVENLABS_VOICE_ID` | phone voice | Optional premium voice |
| `STRIPE_*` | billing | See main README §Billing |

## After it's live
- **Browser demo:** `https://<your-url>/` — talk to it.
- **Admin dashboard:** `https://<your-url>/admin` — bookings, messages, usage.
- **Calendar wiring:** `https://<your-url>/api/admin/calendar-check?token=<ADMIN_TOKEN>`
  — confirms the agent can read/write the real calendar before you rely on a call.
- **Phone:** point a Vapi assistant at `https://<your-url>/api/vapi/function` (grab the
  ready config from `https://<your-url>/api/vapi/assistant`), attach a number, call it.

## Serving multiple clients
Run one instance per client with its own config + number:
`BUSINESS_CONFIG=clients/their-name.json` (create it with `npm run new-client`).
On Render, duplicate the service and change that one env var; on Docker hosts, set it per
container.
