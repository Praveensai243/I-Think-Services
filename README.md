# I Think Services

Marketing website for **I Think Services** — an AI automation studio that builds
AI agents, workflow automation, and intelligent integrations.

A self-contained **static site**: plain HTML with inline CSS. No framework, no
build step, no dependencies required to run it.

## Pages

| File | Page |
|------|------|
| `index.html` | Home — hero, services overview, process, stats, CTA |
| `services.html` | Detailed service list |
| `about.html` | About the studio + values |
| `contact.html` | Contact form (opens the visitor's email client) + details |

## Supporting files

| File | Purpose |
|------|---------|
| `_headers` | Cloudflare Pages security & cache headers (CSP, HSTS, etc.) |
| `robots.txt` | Crawler rules + sitemap pointer |
| `sitemap.xml` | XML sitemap for search engines |
| `build.py` | Optional helper — regenerates `robots.txt` + `sitemap.xml` for your domain |

## Run it locally

No tooling needed — just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Set your domain

`robots.txt`, `sitemap.xml`, and the `<link rel="canonical">` / Open Graph tags
in the HTML use `https://www.ithinkservices.com` as a placeholder. To switch to
your real domain:

1. Edit `SITE_URL` at the top of `build.py`.
2. Run `python3 build.py` (or `python3 build.py https://your-domain.com`) to
   regenerate `robots.txt` and `sitemap.xml`.
3. Find-and-replace the placeholder domain in the four HTML files' canonical /
   `og:url` tags.

## Deploy — Cloudflare Pages

This site is built to deploy on Cloudflare Pages with **no build step**:

- **Framework preset:** None
- **Build command:** *(leave empty)*
- **Build output directory:** `/` (the repo root)

Connect the GitHub repo, and every push to `main` auto-deploys. The `_headers`
file is applied automatically by Pages.

## Contact form

The contact form is intentionally backend-free: on submit it opens the visitor's
email client with the message pre-filled to `hello@ithinkservices.com`. To route
submissions through a form backend instead (e.g. Formspree, or a Cloudflare
Pages Function), replace the `mailto:` handler at the bottom of `contact.html`.
