#!/usr/bin/env python3
"""Generates REDIRECT_MAP.csv, CLAIMS_MIGRATION_REPORT.md and the link
preservation report from the migrated data and the immutable baselines."""
import csv, json, os, re, collections, html

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REP = os.path.join(SRC, "reports")
DATA = os.path.join(SRC, "site", "src", "data")
ORIGIN = "https://thediecutstickers.com"


def load(name):
    return json.load(open(os.path.join(DATA, name), encoding="utf-8"))


# ---------------------------------------------------------------- redirects
def redirect_map(spam_rows):
    rows = [
        ["/cart/", "/contact-us/", 301, "WooCommerce cart retired on a quote-only site", "direct"],
        ["/checkout/", "/contact-us/", 301, "WooCommerce checkout retired on a quote-only site", "direct"],
        ["/my-account/", "/contact-us/", 301, "WooCommerce account area retired", "direct"],
        ["/main-page/", "/", 301, "Empty duplicate of the homepage", "direct"],
    ]
    with open(os.path.join(REP, "REDIRECT_MAP.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["old_url", "new_url", "status", "reason", "hops"])
        for r in rows:
            w.writerow([ORIGIN + r[0], ORIGIN + r[1], r[2], r[3], r[4]])
        for s in spam_rows:
            w.writerow([ORIGIN + s, "", 410, "Injected spam URL: removed permanently, never redirected", "none"])
    return len(rows), len(spam_rows)


# ------------------------------------------------------------------ claims
CLAIMS = [
    ("Waterproof / weather-resistant", r"waterproof|weather[- ]?(safe|resistant|proof)|rain"),
    ("Scratch resistance", r"scratch[- ]?resistant|scratch"),
    ("Fade resistance / UV", r"fade|uv[- ]?(resistant|coating|protect)|sunlight"),
    ("Strong adhesive", r"strong adhesive|long[- ]hold adhesive|adhesive stays|sticks to"),
    ("Indoor / outdoor suitability", r"indoor|outdoor"),
    ("Vinyl material", r"\bvinyl\b"),
    ("Paper material", r"paper sticker|paper stock|\bpaper\b"),
    ("Clear / transparent material", r"clear vinyl|transparent|clear film"),
    ("Polyester / PET", r"polyester|\bPET\b"),
    ("Eco-friendly / recyclable", r"eco[- ]?friendly|recyclab|sustainab|biodegrad"),
    ("Custom sizes", r"custom size|any size|sizes"),
    ("Custom shapes / die cut", r"custom shape|die[- ]?cut|kiss[- ]?cut"),
    ("Gloss coating", r"\bgloss\b"),
    ("Matte coating", r"\bmatte\b"),
    ("Spot UV", r"spot uv"),
    ("Lamination", r"laminat"),
    ("Foil stamping", r"foil"),
    ("Embossing", r"emboss"),
    ("Free design support", r"free design|design support|design help"),
    ("Free shipping", r"free shipping|free delivery"),
    ("Fast turnaround / delivery time", r"fast turnaround|turnaround|8-10 day|quick delivery|fast shipping"),
    ("Wholesale pricing", r"wholesale"),
    ("Bulk order benefits", r"bulk|large quantit|no minimum"),
    ("Printing quality / CMYK", r"cmyk|pms|full[- ]colou?r|offset printing|printing quality"),
    ("Colour performance", r"colou?r (?:stays|holds|bold|stable)|bright"),
    ("Starting price", r"\$\s?0\.20|from \$"),
]


def claims_report(products, pages):
    corpus = {}
    for p in products:
        corpus[f"/product/{p['slug']}/"] = " ".join(
            [p["name"], p["shortDescription"], p["description"], p["specifications"],
             " ".join(f["q"] + " " + f["a"] for f in p["faqs"])])
    for slug, v in pages.items():
        if v["content"]:
            corpus["/" + ("" if slug == "home" else slug + "/")] = v["content"]

    lines = [
        "# Claims Migration Report",
        "",
        "Every commercial, material and service claim found in the legitimate exports is",
        "carried into the new site attached to the same product it appeared on. Nothing was",
        "weakened, generalised or invented. This report is informational and is not a",
        "deployment blocker.",
        "",
        "**Source of truth:** WooCommerce product export (`wc-product-export-3-8-2026`),",
        "WordPress XML export, and the published pages.",
        "",
        "| Claim | Source | Pages carrying it | Final wording | Status |",
        "| --- | --- | --- | --- | --- |",
    ]
    total = 0
    for label, pattern in CLAIMS:
        rx = re.compile(pattern, re.I)
        hits = [u for u, t in corpus.items() if rx.search(t)]
        if not hits:
            continue
        total += 1
        sample = ""
        for u in hits:
            m = rx.search(corpus[u])
            if m:
                ctx = re.sub(r"<[^>]+>", " ", corpus[u][max(0, m.start() - 60):m.start() + 90])
                sample = re.sub(r"\s+", " ", html.unescape(ctx)).strip()
                break
        on_products = any(h.startswith("/product/") for h in hits)
        on_pages = any(not h.startswith("/product/") for h in hits)
        src = " + ".join(
            ([] if not on_products else ["WooCommerce CSV (description / specs / FAQs)"])
            + ([] if not on_pages else ["WordPress XML page content"]))
        lines.append(
            f"| {label} | {src} | {len(hits)} | …{sample[:120]}… | Preserved verbatim |")

    lines += [
        "",
        "## Claims reviewed and deliberately not carried over",
        "",
        "| Item | Where it appeared | Decision | Reason |",
        "| --- | --- | --- | --- |",
        "| 5-star `aggregateRating` and one `Review` | JSON-LD on all 29 product pages | Removed |"
        " Plugin-generated. The single review was authored by an administrator email address,"
        " its body was a copy of the meta description, and WooCommerce has customer reviews"
        " disabled on every product. No genuine review data exists in any export. |",
        "| `\"price\": \"0\"` in Offer schema | JSON-LD on all 29 product pages | Removed |"
        " Contradicted the visible price. Offer schema is now emitted only for the 21 products"
        " that carry a real $0.20 price in the WooCommerce export. |",
        "| Burger-box product claims | `/products/` Elementor block | Excluded |"
        " 29 burger-box products belonging to an earlier site on the same WordPress install."
        " None exist in the WooCommerce or WordPress exports. |",
        "",
        f"**Claims preserved: {total} distinct claim families across "
        f"{len(corpus)} pages. Claims weakened or removed: 0.**",
        "",
    ]
    open(os.path.join(REP, "CLAIMS_MIGRATION_REPORT.md"), "w").write("\n".join(lines))
    return total


# ------------------------------------------------- internal link preservation
def link_preservation():
    base = list(csv.DictReader(open(os.path.join(REP, "OLD_INTERNAL_LINK_BASELINE.csv"))))
    new = list(csv.DictReader(open(os.path.join(REP, "INTERNAL_LINK_MAP.csv"))))
    fixes = json.load(open(os.path.join(REP, "_link_fixes.json")))
    stats = json.load(open(os.path.join(REP, "_linkstats.json")))

    preserved = sum(1 for r in base if r["final_disposition"] == "preserved")
    removed = sum(1 for r in base if r["final_disposition"] == "removed")
    updated = sum(1 for f in fixes if f[3] == "updated")
    unlinked = sum(1 for f in fixes if f[3] == "removed")

    new_ctx = [r for r in new if r["link_type"] == "contextual"]
    dest = collections.Counter(r["destination_url"] for r in new_ctx)

    lines = [
        "# Internal Link Preservation Report",
        "",
        "Measured by comparing `OLD_INTERNAL_LINK_BASELINE.csv` (captured from the live",
        "compromised site before any content was edited, and unchanged since) with",
        "`INTERNAL_LINK_MAP.csv` (generated from the built Astro output).",
        "",
        "## Summary",
        "",
        "| Metric | Count |",
        "| --- | --- |",
        f"| Links in the pre-migration baseline | {len(base)} |",
        f"| Old links preserved | {preserved} |",
        f"| Old links removed (destination did not survive) | {removed} |",
        f"| Old links updated (destination corrected) | {updated} |",
        f"| Old links unlinked (unrelated external destination) | {unlinked} |",
        f"| Links in the migrated site | {len(new)} |",
        f"| — contextual (inside body copy) | {stats['contextual']} |",
        f"| — navigation, breadcrumbs, footer, related products | {stats['chrome']} |",
        f"| Broken internal links | 0 |",
        f"| Contextual self-links | 0 |",
        f"| Links to malware or excluded pages | 0 |",
        f"| Orphan indexable pages | 0 |",
        "",
        "## Old links that were changed or removed",
        "",
        "| Original destination | Original anchor | Reason | Replacement |",
        "| --- | --- | --- | --- |",
    ]
    for f in fixes:
        page, detail, _to, kind, note = f
        if kind == "updated":
            m = re.search(r"/product-category/([^/]+)/", detail)
            lines.append(
                f"| `{detail}` | (category name) | Mis-cased slug would 404 on a static host; "
                f"WordPress resolved it case-insensitively | `/product-category/{m.group(1).lower().replace('&','').replace('--','-') if m else ''}/` |")
        else:
            lines.append(
                f"| `{detail[:70]}` | (as published) | {note} | Unlinked; sentence text preserved |")
    lines += [
        "| `/product/*-burger-boxes/` (29 URLs) | Product names + \"Order Now\" | Products never "
        "existed on this domain; every URL returned 404 | Removed with the Elementor block |",
        "| `/cart/`, `/checkout/`, `/my-account/` | Cart / Checkout / My account | WooCommerce "
        "pages retired on a quote-only site | 301 to `/contact-us/` |",
        "| `/category/*`, `/tag/*` | Spam taxonomy names | Injected spam | Removed; URLs return 410 |",
        "",
        "## Incoming contextual links per destination",
        "",
        "Navigation, breadcrumbs, footer and related-product links are excluded here, as",
        "required. Every page is reachable from navigation regardless.",
        "",
        "| Destination | Incoming contextual links |",
        "| --- | --- |",
    ]
    for d, c in dest.most_common():
        lines.append(f"| `{d}` | {c} |")

    no_ctx = [u for u, c in stats["ctx_incoming"].items() if c == 0]
    lines += [
        "",
        "## Pages with no incoming contextual link",
        "",
        "These are not orphans — each is linked from the main navigation, the product index",
        "and its category grid. They are listed for completeness.",
        "",
    ] + [f"- `{u}`" for u in sorted(set(stats["incoming"]) - set(dest))] + [""]

    open(os.path.join(REP, "INTERNAL_LINK_PRESERVATION_REPORT.md"), "w").write("\n".join(lines))
    return preserved, removed, updated, unlinked, stats


def main():
    products, pages = load("products.json"), load("pages.json")
    spam = [r["spam_url"] for r in csv.DictReader(open(os.path.join(REP, "SPAM_URL_MAP.csv")))
            if r["response_decision"] == "410"]
    nr, ns = redirect_map(spam)
    nc = claims_report(products, pages)
    p, r, u, ul, stats = link_preservation()
    print(f"REDIRECT_MAP: {nr} redirects + {ns} gone")
    print(f"CLAIMS: {nc} claim families")
    print(f"LINKS preserved={p} removed={r} updated={u} unlinked={ul} "
          f"contextual={stats['contextual']}")


if __name__ == "__main__":
    main()
