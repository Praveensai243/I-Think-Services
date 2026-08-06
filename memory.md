# Project memory — I Think Services

Persistent preferences and notes for this project.

## Working preferences
- **Do not run anything in the background.** No scheduled check-ins, no background agents,
  no long-running background processes, no automatic PR-watching/self check-in loops.
  Complete work in the foreground and hand it back.

## Deployment
- Production deploys from the `main` branch via Cloudflare Workers/Pages.
- "Push it to prod" means merge the working branch into `main` and push.
