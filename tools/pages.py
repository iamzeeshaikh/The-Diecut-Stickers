#!/usr/bin/env python3
"""
Extracts the legitimate static-page content from the WordPress export.

Elementor payloads are parsed as inert JSON for their text content only; no
Elementor runtime, CSS or shortcode is carried across.
"""
import html, json, os, re, sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import clean_html, normalise_links, NS, SRC  # noqa: E402

OUT = os.path.join(SRC, "site", "src", "data")

WANT = {
    "home": 41,
    "about-us": 429,
    "contact-us": 431,
    "privacy-policy": 426,
    "terms-conditions": 424,
    "refund_returns": 10,
    "products": 786,
}

BURGER_RE = re.compile(r"burger|clamshell|bagasse|styrofoam|polystyrene", re.I)


def elementor_text(data):
    """Collect text-editor / heading content from an Elementor tree, in order."""
    out = []

    def walk(els):
        for e in els:
            wt = e.get("widgetType") or e.get("elType")
            s = e.get("settings", {}) or {}
            if wt == "text-editor" and isinstance(s.get("editor"), str):
                out.append(s["editor"])
            elif wt == "heading" and isinstance(s.get("title"), str):
                out.append(f"<h2>{s['title']}</h2>")
            walk(e.get("elements", []) or [])

    walk(data)
    return "\n".join(out)


def main():
    ch = ET.parse(os.path.join(SRC, "thediecutstickers.WordPress.2026-08-03 (1).xml")) \
        .getroot().find("channel")
    by_id = {}
    for it in ch.findall("item"):
        pid = int(it.find("wp:post_id", NS).text)
        metas = {}
        for m in it.findall("wp:postmeta", NS):
            k = m.find("wp:meta_key", NS)
            v = m.find("wp:meta_value", NS)
            if k is not None and k.text:
                metas[k.text] = (v.text or "") if v is not None else ""
        c = it.find("content:encoded", NS)
        by_id[pid] = {
            "title": it.find("title").text or "",
            "content": (c.text or "") if c is not None else "",
            "meta": metas,
        }

    fixes = []
    pages = {}
    for slug, pid in WANT.items():
        rec = by_id.get(pid)
        if not rec:
            continue
        classic = rec["content"]
        el_text = ""
        el = rec["meta"].get("_elementor_data", "")
        if el:
            try:
                el_text = elementor_text(json.loads(el))
            except Exception:
                el_text = ""

        # Elementor pages keep a copy of the same copy in post_content. Joining
        # both would publish every paragraph twice, so keep the richer one and
        # only concatenate when they genuinely differ.
        def norm(x):
            return re.sub(r"\W+", "", html.unescape(re.sub(r"<[^>]+>", " ", x))).lower()

        a, b = norm(classic), norm(el_text)
        if a and b and (a in b or b in a):
            body = classic if len(a) >= len(b) else el_text
        else:
            body = "\n".join(x for x in (el_text, classic) if x.strip())

        body = clean_html(body)
        # Drop Elementor/WordPress shortcodes -- the runtime does not exist here.
        body = re.sub(r"\[[^\]\[]{0,120}\]", "", body)
        # Remove any paragraph or heading left over from the burger-box catalogue.
        kept = []
        for block in re.split(r"(?i)(?=<h[1-4][\s>])", body):
            if BURGER_RE.search(block):
                fixes.append((slug, "removed burger-box block", block[:120]))
                continue
            kept.append(block)
        body = "".join(kept)
        body = normalise_links(body, slug, fixes)

        # The page template renders the single H1. clean_html() has already
        # demoted any source H1 to H2, so lift a leading heading out of the body
        # when it simply repeats the page title -- otherwise it renders twice.
        h1 = ""
        m = re.match(r"(?is)\s*<h[12][^>]*>(.*?)</h[12]>", body)
        if m:
            candidate = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", m.group(1)))).strip()
            page_title = re.sub(r"\W+", "", html.unescape(rec["title"])).lower()
            if re.sub(r"\W+", "", candidate).lower() == page_title:
                h1 = candidate
                body = body[m.end():]

        # Cloudflare's email obfuscation stripped the mailto: target on export.
        body = re.sub(
            r'(?is)<a([^>]*)>\s*([\w.+-]+@[\w.-]+\.\w+)\s*</a>',
            lambda mm: f'<a href="mailto:{mm.group(2)}">{mm.group(2)}</a>',
            body,
        )
        body = re.sub(r"\n{3,}", "\n\n", body).strip()

        pages[slug] = {
            "title": html.unescape(rec["title"]),
            "h1": h1,
            "seoTitle": rec["meta"].get("_yoast_wpseo_title", "").strip(),
            "seoDescription": rec["meta"].get("_yoast_wpseo_metadesc", "").strip(),
            "content": body,
        }

    json.dump(pages, open(os.path.join(OUT, "pages.json"), "w"), indent=1, ensure_ascii=False)
    json.dump(fixes, open(os.path.join(SRC, "reports", "_page_fixes.json"), "w"),
              indent=1, ensure_ascii=False)
    for k, v in pages.items():
        print(f"{k:18} content={len(v['content']):6} seoTitle={'yes' if v['seoTitle'] else '-'}")
    print("fixes:", len(fixes))


if __name__ == "__main__":
    main()
