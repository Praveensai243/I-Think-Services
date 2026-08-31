#!/usr/bin/env python3
"""Scan an HTML page for the consent defects that are mechanically detectable.

The point of this script is to take the boring half of a consent audit off the
reviewer's hands. Pre-ticked boxes, mandatory marketing consent, bundled
decisions and missing disclosure phrases are all structural: they can be found
by looking at the markup, they are found the same way every time, and they are
exactly the sort of thing a human reviewer's eye slides over on the third pass.

What it cannot do is read. It does not know whether a retention period is
truthful, whether the vendor list is complete, or whether the disclosure
describes what the system actually does. Those need a person, and the report
says so rather than letting a clean run be mistaken for a clean bill.

Usage:
    python3 audit_consent.py page.html [more.html ...]
    python3 audit_consent.py --json page.html

Exit codes: 0 = nothing blocking, 1 = at least one BLOCKING finding, 2 = usage error.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict, field
from html.parser import HTMLParser
from pathlib import Path

BLOCKING = "BLOCKING"
SERIOUS = "SERIOUS"
IMPROVEMENT = "IMPROVEMENT"
INFO = "INFO"

SEVERITY_ORDER = {BLOCKING: 0, SERIOUS: 1, IMPROVEMENT: 2, INFO: 3}

# Words that mark a checkbox as being about marketing permission rather than,
# say, a newsletter preference or a shipping option. Deliberately broad: a false
# positive costs the reviewer a glance, a false negative costs them the finding.
MARKETING_HINTS = (
    "marketing", "promotional", "offers", "newsletter", "subscribe",
    "call me", "text me", "sms", "autodial", "automated", "prerecorded",
    "pre-recorded", "artificial", "robocall", "telemarketing", "contact me",
    "may call", "may contact", "voice agent", "ai agent",
)

TERMS_HINTS = (
    "terms", "privacy policy", "conditions", "agreement", "acceptable use",
)

# Phrases the written-consent rules expect to actually appear.
#
# These are matched loosely on purpose. The rule's own wording is "not required
# to sign the agreement as a condition of purchasing any property, goods, or
# services", and drafters legitimately render that as "consent is not a
# condition of purchase", "you are not required to agree in order to buy", and
# a dozen other shapes. An early version of this pattern matched only the
# shortest form and flagged a page that was quoting the regulation more closely
# than the pattern was — so accept the family, not one phrasing.
REQUIRED_CONSENT_PHRASES = {
    r"not a condition|not required to (tick|check|sign|agree|consent)|"
    r"isn't a condition|is not required (as|in order)": (
        'the "not a condition of purchase" statement',
        'Add: "Consent is not a condition of purchase."',
    ),
    "automatic telephone dialing system|autodialer|automated telephone dialing": (
        "the dialing-technology disclosure",
        'Name the technology: "using an automatic telephone dialing system".',
    ),
    "artificial or prerecorded voice|artificial or pre-recorded voice": (
        "the artificial/prerecorded voice disclosure",
        'Name the voice technology: "and an artificial or prerecorded voice".',
    ),
}

RETENTION_WEASEL = (
    "as long as necessary", "as long as needed", "for as long as we deem",
    "indefinitely as required", "a reasonable period",
)


@dataclass
class Finding:
    severity: str
    title: str
    detail: str
    fix: str
    where: str = ""


@dataclass
class Checkbox:
    name: str = ""
    checked: bool = False
    required: bool = False
    label: str = ""
    line: int = 0
    has_label_element: bool = False


class FormParser(HTMLParser):
    """Collects checkboxes plus the label text sitting around them.

    Consent markup in the wild puts the text inside the <label>, after the
    input, or in a sibling <span>, so the parser tracks whatever text arrives
    while a label or checkbox is open rather than assuming one shape.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.checkboxes: list[Checkbox] = []
        self.forms_seen = 0
        self.has_form = False
        self._label_depth = 0
        self._current: Checkbox | None = None
        self._pending_text: list[str] = []
        self._links: list[str] = []
        self.text_chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs_list) -> None:
        attrs = dict(attrs_list)
        line = self.getpos()[0]

        if tag == "form":
            self.forms_seen += 1
            self.has_form = True

        if tag == "label":
            self._label_depth += 1
            self._pending_text = []

        if tag == "a" and attrs.get("href"):
            self._links.append(attrs["href"])

        if tag == "input" and (attrs.get("type") or "").lower() == "checkbox":
            cb = Checkbox(
                name=attrs.get("name", "") or attrs.get("id", ""),
                checked="checked" in attrs,
                required="required" in attrs,
                line=line,
                has_label_element=self._label_depth > 0,
            )
            # A hidden honeypot is not a consent control; skip the obvious ones.
            style = (attrs.get("style") or "").replace(" ", "").lower()
            if "display:none" in style or attrs.get("name", "").lower() in {"botcheck", "honeypot"}:
                return
            self.checkboxes.append(cb)
            self._current = cb

    def handle_endtag(self, tag: str) -> None:
        if tag == "label":
            self._label_depth = max(0, self._label_depth - 1)
            text = " ".join(" ".join(self._pending_text).split())
            if self._current is not None and not self._current.label:
                self._current.label = text
            self._pending_text = []
            if self._label_depth == 0:
                self._current = None

    def handle_data(self, data: str) -> None:
        stripped = data.strip()
        if not stripped:
            return
        self.text_chunks.append(stripped)
        if self._label_depth > 0 or self._current is not None:
            self._pending_text.append(stripped)
            if self._current is not None:
                self._current.label = " ".join(
                    " ".join(self._pending_text).split()
                )

    @property
    def links(self) -> list[str]:
        return self._links


def classify(cb: Checkbox) -> str:
    """Marketing consent, terms acceptance, or something else entirely."""
    blob = f"{cb.name} {cb.label}".lower()
    if any(h in blob for h in MARKETING_HINTS):
        return "marketing"
    if any(h in blob for h in TERMS_HINTS):
        return "terms"
    return "other"


def audit_html(html: str, source: str) -> list[Finding]:
    parser = FormParser()
    parser.feed(html)
    findings: list[Finding] = []
    text = " ".join(parser.text_chunks).lower()

    if not parser.has_form:
        findings.append(Finding(
            INFO, "No <form> found",
            "This page has no form, so the form checks below were skipped. "
            "Policy-text checks still ran.",
            "If you expected a form here, check the file.", source,
        ))

    marketing = [c for c in parser.checkboxes if classify(c) == "marketing"]
    terms = [c for c in parser.checkboxes if classify(c) == "terms"]

    # --- pre-ticked consent -------------------------------------------------
    for cb in parser.checkboxes:
        if cb.checked and classify(cb) in {"marketing", "terms"}:
            findings.append(Finding(
                BLOCKING, "Consent checkbox is pre-ticked",
                f"'{cb.name or cb.label[:40]}' (line {cb.line}) ships with `checked`. "
                "A pre-ticked box records the site's preference, not the person's "
                "choice, so it collects no valid consent at all.",
                "Remove the `checked` attribute so the box starts empty.",
                source,
            ))

    # --- mandatory marketing consent ---------------------------------------
    for cb in marketing:
        if cb.required:
            findings.append(Finding(
                BLOCKING, "Marketing consent is mandatory",
                f"'{cb.name or cb.label[:40]}' (line {cb.line}) is `required`, so the "
                "form cannot be submitted without agreeing to marketing contact. "
                "Consent that is a condition of using the form is not consent, and "
                "this voids every record the form collects.",
                "Remove `required` from the marketing checkbox and let the form "
                "submit without it. Handle the declined case explicitly — "
                "e.g. follow up by email instead.",
                source,
            ))

    # --- bundling -----------------------------------------------------------
    for cb in parser.checkboxes:
        blob = f"{cb.name} {cb.label}".lower()
        marketingish = any(h in blob for h in MARKETING_HINTS)
        termsish = any(h in blob for h in TERMS_HINTS)
        if marketingish and termsish and "privacy policy" not in blob[:60]:
            findings.append(Finding(
                SERIOUS, "One checkbox covers two different decisions",
                f"'{cb.name or cb.label[:40]}' (line {cb.line}) appears to bundle "
                "terms acceptance with marketing permission. Someone ticking it is "
                "agreeing to the first and being handed the second.",
                "Split into two checkboxes: terms acceptance (may be required) and "
                "marketing consent (must be optional).",
                source,
            ))

    # --- missing required phrases ------------------------------------------
    if marketing:
        consent_text = " ".join(c.label.lower() for c in marketing)
        mentions_calls = any(
            w in consent_text for w in ("call", "phone", "sms", "text", "voice")
        )
        if mentions_calls:
            for pattern, (what, fix) in REQUIRED_CONSENT_PHRASES.items():
                if not re.search(pattern, consent_text):
                    findings.append(Finding(
                        SERIOUS, f"Consent text is missing {what}",
                        "Written consent for automated marketing calls is expected to "
                        f"state this explicitly; it is not implied. Missing: {what}.",
                        fix, source,
                    ))
            if not re.search(r"\bllc\b|\binc\b|\bltd\b|\bcorp|\bl\.l\.c", consent_text):
                findings.append(Finding(
                    SERIOUS, "Consent text may not name the registered entity",
                    "The consent should name the seller by its registered legal name "
                    "(the one with the corporate suffix), not a trading shorthand.",
                    "Name the entity exactly as registered, e.g. 'Example Services LLC'.",
                    source,
                ))

    # --- no marketing consent box at all, but the page takes a phone --------
    if parser.has_form and not marketing:
        if re.search(r'type=["\']tel["\']|name=["\'][^"\']*phone', html, re.I):
            findings.append(Finding(
                SERIOUS, "Phone collected with no calling consent",
                "The form captures a phone number but has no separate, optional "
                "consent for automated or marketing calls. That is fine if nobody "
                "will ever auto-dial this list — and a problem the day someone does.",
                "Add an optional, unticked consent checkbox naming the entity, the "
                "technology and the purpose. See assets/consent-blocks.md.",
                source,
            ))

    # --- consent record -----------------------------------------------------
    if marketing and not re.search(r"consent_(text|at|version|page)|consent_record", html, re.I):
        findings.append(Finding(
            IMPROVEMENT, "No consent record captured",
            "Nothing in the form appears to store the wording shown, a timestamp, "
            "or a version. A stored 'true' shows someone ticked something but not "
            "what they agreed to, which is the part that matters if it is questioned.",
            "Add hidden fields carrying the exact consent wording, an ISO timestamp, "
            "and the page URL or form version, populated on submit.",
            source,
        ))

    # --- policy links -------------------------------------------------------
    joined_links = " ".join(parser.links).lower()
    if parser.has_form and not re.search(r"privacy|legal|terms", joined_links):
        findings.append(Finding(
            SERIOUS, "No link to a privacy policy or terms",
            "The form collects personal data without linking to a policy explaining "
            "what happens to it. The consent has nothing to point at.",
            "Link the privacy policy and terms from the consent block.",
            source,
        ))

    # --- accessibility ------------------------------------------------------
    unlabelled = [c for c in parser.checkboxes if not c.has_label_element and not c.label]
    if unlabelled:
        findings.append(Finding(
            SERIOUS, "Checkbox without an associated label",
            f"{len(unlabelled)} checkbox(es) have no <label>. Consent that cannot be "
            "perceived cannot be informed, and a screen-reader user cannot give it.",
            "Wrap each checkbox in a <label>, or link them with for/id.",
            source,
        ))

    # --- retention weasel words --------------------------------------------
    for phrase in RETENTION_WEASEL:
        if phrase in text:
            findings.append(Finding(
                IMPROVEMENT, "Retention period is not actually stated",
                f'The text says "{phrase}", which commits to nothing and answers no '
                "one's question about how long their data is kept.",
                "State a period per category of data, e.g. 'Enquiries: 2 years from "
                "last contact.' See references/us-privacy.md for a pattern.",
                source,
            ))
            break

    # --- unverifiable claims ------------------------------------------------
    if re.search(r"we (do not|don't|never) (sell|share)", text):
        findings.append(Finding(
            INFO, 'Page claims it does not sell or share data',
            "Worth verifying by hand: several state laws treat advertising and "
            "analytics trackers as a 'sale' or 'share' even with no money involved, "
            "so this claim can be untrue because of a pixel nobody remembered.",
            "Enumerate every third-party script the site loads and confirm the claim "
            "still holds.",
            source,
        ))

    return findings


def render_text(all_findings: list[Finding]) -> str:
    if not all_findings:
        return ("No mechanical defects found.\n\n"
                "This scanner reads structure, not meaning. It cannot tell whether the "
                "disclosures are accurate, complete, or true of the system they describe "
                "— read the page yourself before calling it clean.\n")

    lines: list[str] = []
    ordered = sorted(all_findings, key=lambda f: SEVERITY_ORDER.get(f.severity, 9))
    counts: dict[str, int] = {}
    for f in ordered:
        counts[f.severity] = counts.get(f.severity, 0) + 1

    summary = ", ".join(f"{n} {sev.lower()}" for sev, n in sorted(
        counts.items(), key=lambda kv: SEVERITY_ORDER.get(kv[0], 9)))
    lines.append(f"Consent audit — {summary}\n")

    for i, f in enumerate(ordered, 1):
        lines.append(f"{i}. [{f.severity}] {f.title}")
        if f.where:
            lines.append(f"   file: {f.where}")
        lines.append(f"   what: {f.detail}")
        lines.append(f"   fix:  {f.fix}")
        lines.append("")

    lines.append("This scanner reads structure, not meaning. Accuracy of the disclosures, "
                 "completeness of the vendor list, and whether the text matches what the "
                 "system really does all still need a human.")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Audit HTML for consent defects.")
    ap.add_argument("files", nargs="+", help="HTML file(s) to scan")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of text")
    args = ap.parse_args()

    all_findings: list[Finding] = []
    for raw in args.files:
        path = Path(raw)
        if not path.is_file():
            print(f"error: not a file: {path}", file=sys.stderr)
            return 2
        all_findings.extend(audit_html(path.read_text(encoding="utf-8", errors="replace"),
                                       str(path)))

    if args.json:
        print(json.dumps([asdict(f) for f in all_findings], indent=2))
    else:
        print(render_text(all_findings))

    return 1 if any(f.severity == BLOCKING for f in all_findings) else 0


if __name__ == "__main__":
    sys.exit(main())
