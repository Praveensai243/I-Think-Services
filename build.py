#!/usr/bin/env python3
"""
build.py — tiny, zero-dependency site helper for I Think Services.

The site itself is plain static HTML and needs NO build step to run.
This script only (re)generates the two files that must know the live
domain — robots.txt and sitemap.xml — so you keep them in sync from a
single place.

Usage:
    python3 build.py                          # uses SITE_URL below
    python3 build.py https://ithinkservices.com   # override the domain

After changing your real domain, run this once and commit the result.
"""
import sys
from datetime import date

# ── Edit this to your live domain (no trailing slash) ────────────────
SITE_URL = "https://www.ithinkservices.net"

# Pages to include in the sitemap: (path, change frequency, priority)
PAGES = [
    ("/",              "weekly",  "1.0"),
    ("/services.html", "monthly", "0.9"),
    ("/about.html",    "monthly", "0.7"),
    ("/contact.html",  "monthly", "0.8"),
]


def build_sitemap(base: str) -> str:
    today = date.today().isoformat()
    urls = []
    for path, freq, prio in PAGES:
        urls.append(
            "  <url>\n"
            f"    <loc>{base}{path}</loc>\n"
            f"    <lastmod>{today}</lastmod>\n"
            f"    <changefreq>{freq}</changefreq>\n"
            f"    <priority>{prio}</priority>\n"
            "  </url>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )


def build_robots(base: str) -> str:
    return (
        "User-agent: *\n"
        "Allow: /\n\n"
        f"Sitemap: {base}/sitemap.xml\n"
    )


def main() -> None:
    base = (sys.argv[1] if len(sys.argv) > 1 else SITE_URL).rstrip("/")
    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write(build_sitemap(base))
    with open("robots.txt", "w", encoding="utf-8") as f:
        f.write(build_robots(base))
    print(f"Generated sitemap.xml and robots.txt for {base}")


if __name__ == "__main__":
    main()
