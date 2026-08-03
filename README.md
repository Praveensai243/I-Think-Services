# I Think Services — Website (v2, elevated UI)

Static website with an AI-automation-forward, conversion-focused design. No framework, no dependencies, no build step — just HTML files you can host anywhere. Built to deploy on **Cloudflare Pages** via **GitHub**.

## What's new in this version
- **Boot sequence** on the home page ("system initializing") that sets the automation tone
- **Live pipeline dashboard** in the hero — manual tasks flip to *automated* with a filling progress bar
- **Flowing node-network** background in every hero
- **Automation-log terminal** that streams tasks completing themselves (shows the product working)
- **Count-up capability metrics** (24/7, 6 areas, 0 manual steps, 3-step process)
- **Micro-interactions**: hover pulses across cards, animated CTA sheen, sliding nav states
- **Primary conversion hook**: a free automation audit CTA throughout
- Fully responsive (desktop + mobile), keyboard-accessible, and reduced-motion-safe

All animation is pure CSS + a small amount of vanilla JavaScript — **zero libraries**.

## Files
- `index.html`, `services.html`, `about.html`, `contact.html` — the four pages (each self-contained)
- `_headers` — Cloudflare Pages security headers
- `robots.txt`, `sitemap.xml` — basic SEO
- `build.py` — optional generator; regenerates all pages from shared components if you'd rather edit in one place

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
- Text lives in the `.html` files; change the words, save, re-upload. Cloudflare redeploys on every commit.
- Swap the placeholder email `info@ithinkservices.net` for your real address (appears in the footer and contact page).
- To tweak the streaming terminal lines or metrics, edit the small script at the bottom of `index.html` (or edit `build.py` and re-run `python3 build.py`).

## Still to confirm before launch
- **Real contact email** (currently a placeholder).
- **Web3Forms key** for the contact form.
- Optional: add real client logos or a testimonial when you have them — there's room in the design.
