#!/usr/bin/env python3
"""
Generates the post-migration link reports from the built output.

Distinguishes contextual links (inside migrated body copy) from site chrome
(header, footer, breadcrumbs, related products, forms), as the brief requires
them to be reported separately.
"""
import csv, html, json, os, re, collections

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SRC, "site", ".vercel", "output", "static")
REP = os.path.join(SRC, "reports")
ORIGIN = "https://thediecutstickers.com"


def pages():
    for root, _dirs, files in os.walk(OUT):
        for f in files:
            if f != "index.html":
                continue
            p = os.path.join(root, f)
            url = p.replace(OUT, "").replace("/index.html", "/") or "/"
            yield url, open(p, encoding="utf-8").read()


DIV_TAG = re.compile(r"<(/?)div\b[^>]*?(/?)>", re.I)


def regions(body):
    """
    Offset ranges of the .rich-text blocks holding migrated editorial copy.

    Ranges rather than extracted text: two links can share an identical href
    (a breadcrumb and a body link both pointing at "/"), so classification has
    to be positional, not a substring test.
    """
    out = []
    for m in re.finditer(r'<div\b[^>]*class="[^"]*\brich-text\b[^"]*"[^>]*>', body):
        depth, end = 1, len(body)
        for t in DIV_TAG.finditer(body, m.end()):
            if t.group(2) == "/":
                continue  # self-closing, does not change depth
            depth += -1 if t.group(1) else 1
            if depth == 0:
                end = t.start()
                break
        out.append((m.end(), end))
    return out


def in_regions(pos, ranges):
    return any(a <= pos < b for a, b in ranges)


def main():
    docs = dict(pages())
    known = set(docs)

    rows = []
    incoming = collections.Counter()
    contextual_incoming = collections.Counter()

    for url, h in sorted(docs.items()):
        body = h[h.find("<body"):]
        main_s, main_e = body.find("<main"), body.find("</main>")
        main_html = body[main_s:main_e] if main_s >= 0 else ""
        # Editorial copy only: exclude related products, forms and CTA blocks.
        editorial = regions(body)

        for m in re.finditer(r'(?is)<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', body):
            href, inner = html.unescape(m.group(1)), m.group(2)
            anchor = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", inner))).strip()
            if href.startswith(ORIGIN):
                href = href.replace(ORIGIN, "") or "/"
            if not href.startswith("/") or href.startswith("//"):
                continue
            dest = href.split("#")[0].split("?")[0]
            if not dest or re.search(r"\.(png|jpe?g|webp|gif|svg|css|js|xml|txt|ico)$", dest):
                continue

            is_ctx = in_regions(m.start(), editorial)
            ltype = "contextual" if is_ctx else "navigation/chrome"

            heads = re.findall(r"(?is)<h[23][^>]*>(.*?)</h[23]>", body[:m.start()])
            section = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", heads[-1]))).strip() if heads else ""

            status = "200" if dest in known else (
                "301" if dest in ("/cart/", "/checkout/", "/my-account/", "/main-page/") else "404")
            rows.append([url, dest, anchor, section, ltype, status,
                         "yes" if dest == url else "no"])
            incoming[dest] += 1
            if is_ctx:
                contextual_incoming[dest] += 1

    with open(os.path.join(REP, "INTERNAL_LINK_MAP.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["source_url", "destination_url", "anchor_text", "section_heading",
                    "link_type", "destination_status", "is_self_link"])
        w.writerows(rows)

    # ---- ORPHAN_PAGE_REPORT.csv -------------------------------------------
    with open(os.path.join(REP, "ORPHAN_PAGE_REPORT.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["url", "total_incoming_links", "contextual_incoming_links",
                    "in_sitemap", "orphan", "notes"])
        for url in sorted(docs):
            total = incoming[url]
            ctx = contextual_incoming[url]
            orphan = "yes" if total == 0 and url != "/" else "no"
            note = ""
            if ctx == 0 and url not in ("/",):
                note = "reachable from navigation and the product grids; no contextual link"
            w.writerow([ORIGIN + url, total, ctx, "yes", orphan, note])

    ctx_rows = [r for r in rows if r[4] == "contextual"]
    print(f"INTERNAL_LINK_MAP rows={len(rows)} contextual={len(ctx_rows)} "
          f"chrome={len(rows) - len(ctx_rows)}")
    print(f"orphans={sum(1 for u in docs if incoming[u] == 0 and u != '/')}")
    print(f"pages with >=1 contextual incoming={sum(1 for u in docs if contextual_incoming[u] > 0)}"
          f"/{len(docs)}")
    json.dump({"total": len(rows), "contextual": len(ctx_rows),
               "chrome": len(rows) - len(ctx_rows),
               "incoming": dict(incoming), "ctx_incoming": dict(contextual_incoming)},
              open(os.path.join(REP, "_linkstats.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
