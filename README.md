# I Think Services — Website (v3, AI voice agents)

Static, premium marketing site built around the flagship product — **AI voice agents** that answer every call 24/7, handle hundreds of calls at once, book and manage appointments, and answer customer questions in a natural voice. No framework, no build step — just HTML/CSS/JS you can host anywhere. Built to deploy on **Cloudflare Pages** via **GitHub**.

## What's new in this version
- **Interactive voice-agent demo** — pick a scenario (book, hours, reschedule, question, transfer to human) and watch a realistic call play out, complete with a live booking confirmation
- **Live operations console** in the hero — concurrent call lines cycle through *ringing → answered → booking → resolved*, with an animated waveform, rotating transcript, and a ticking "calls handled today" counter
- **Concurrent-calls visualizer** — a grid of lines lighting up simultaneously to show unlimited call handling with a live count
- **Self-booking calendar** — the AI fills open slots in real time with a running activity log
- **Four core capabilities** front and centre: voice agents · concurrent calls · appointment booking · instant answers
- **Premium craft**: cursor spotlight, scroll progress bar, film-grain texture, gradient hairline "glass" cards, single-open FAQ, count-up metrics, marquee of integrations
- Fully responsive (desktop + mobile), keyboard-accessible, and **reduced-motion-safe**

All animation is pure CSS + vanilla JavaScript — **zero libraries**.

## Files
- `index.html`, `services.html`, `about.html`, `contact.html` — the four pages
- `css/styles.css` — the shared design system (linked by every page)
- `js/main.js` — the shared interactions (linked by every page)
- `_headers` — Cloudflare Pages security headers
- `robots.txt`, `sitemap.xml` — basic SEO
- `build.py` — optional generator for `sitemap.xml` / `robots.txt` (keeps the live domain in sync)
- `agent/` — the **AI receptionist backend** (Claude brain + booking tools) that powers a browser voice demo and a real phone number via Vapi. Runs keyless in demo mode; see [`agent/README.md`](agent/README.md).

---

## 1. Put it on GitHub
1. Create a free github.com account → **New repository** → name it `ithink-website` → **Create**.
2. **Add file → Upload files** → drag in every file from this folder → **Commit changes**.

## 2. Deploy on Cloudflare Pages
1. dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick the repo. Build settings: **Framework preset = None**, **Build command = empty**, **Output directory = `/`**. **Save and Deploy**.
3. You get a live `…pages.dev` URL in about a minute — confirm it looks right.

## 3. Point your domain (ithinkservices.net)
1. Cloudflare → **Add a site** → `ithinkservices.net` → change your **nameservers** at your registrar to the two Cloudflare gives you (DNS can take a few hours).
2. Pages project → **Custom domains** → add `ithinkservices.net` and `www.ithinkservices.net`.
3. Once verified and live, **cancel Squarespace**. (Keep Squarespace up until then so the site never goes dark.)

## 4. Turn the contact form on (free, ~2 min)
1. web3forms.com → enter your email → copy your **Access Key**.
2. In `contact.html`, replace `YOUR-WEB3FORMS-ACCESS-KEY` with your key.
3. Re-upload `contact.html` — Cloudflare redeploys automatically. Submissions land in your inbox.

## 5. Editing later
- Page copy lives in the `.html` files; change the words, save, re-upload. Cloudflare redeploys on every commit.
- Styling lives in `css/styles.css` and all interactions in `js/main.js` — edit once and every page updates.
- Swap the placeholder email `info@ithinkservices.net` for your real address (appears in the footer and contact page).
- To tweak the interactive **voice-agent demo** conversations, edit the `scripts` object near the top of the `INTERACTIVE voice demo` module in `js/main.js`. The hero console's caller snippets and the booking calendar names live in the same file.

## Still to confirm before launch
- **Real contact email** (currently a placeholder).
- **Web3Forms key** for the contact form.
- Optional: swap the demo scenarios and calendar for your own real examples, and add client logos or a testimonial when you have them — there's room in the design.
