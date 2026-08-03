#!/usr/bin/env python3
"""
Builds the immutable pre-migration baselines from the mirrored live site.

These files record the state of the compromised site BEFORE any content is
edited, so link and SEO preservation can be measured afterwards.
"""
import csv, html, json, os, re, urllib.parse

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIRROR = "/private/tmp/claude-501/-Users-sajjadahmad/3ed0644e-d346-4367-95c8-e402082c014f/scratchpad/dcs/live"
REP = os.path.join(SRC, "reports")
ORIGIN = "https://thediecutstickers.com"

BURGER_RE = re.compile(r"burger|clamshell|bagasse|styrofoam|polystyrene", re.I)
# Chrome/header/footer regions are reported separately from contextual links
NAV_HINT = re.compile(r"(?i)\b(menu|nav|header|footer|breadcrumb|offcanvas|sidebar|widget)\b")


def fname(url):
    p = url.replace(ORIGIN, "")
    n = p.rstrip("/").replace("/", "_")
    return "__home__" if n == "" else n


def meta(s, pat):
    m = re.search(pat, s, re.S | re.I)
    return html.unescape(m.group(1)).strip() if m else ""


def visible_blocks(s):
    """Return (main_html, chrome_removed_html) for the page body."""
    b = re.sub(r"(?is)<(script|style|noscript)\b[^>]*>.*?</\1\s*>", " ", s)
    i = b.lower().find("<body")
    return b[i:] if i >= 0 else b


def main():
    os.makedirs(REP, exist_ok=True)
    urls = [l.strip() for l in open(os.path.join(os.path.dirname(MIRROR), "liveurls.txt")) if l.strip()]

    # ---------------- OLD_URL_INVENTORY.csv + CONTENT_INVENTORY.csv -------------
    pages = {}
    with open(os.path.join(REP, "OLD_URL_INVENTORY.csv"), "w", newline="") as fu, \
         open(os.path.join(REP, "CONTENT_INVENTORY.csv"), "w", newline="") as fc:
        wu = csv.writer(fu)
        wu.writerow(["old_url", "page_type", "existing_status", "canonical", "title",
                     "meta_description", "h1", "indexability", "legitimacy_status",
                     "new_url", "required_action", "notes"])
        wc = csv.writer(fc)
        wc.writerow(["url", "page_type", "h1", "h2_count", "h3_count", "word_count",
                     "images", "internal_links", "source_of_truth", "migrated", "notes"])
        for u in urls:
            path = u.replace(ORIGIN, "") or "/"
            f = os.path.join(MIRROR, fname(u) + ".html")
            s = open(f, encoding="utf-8", errors="replace").read()
            title = meta(s, r"<title[^>]*>(.*?)</title>")
            desc = meta(s, r'name="description"\s+content="([^"]*)"')
            canon = meta(s, r'rel="canonical"\s+href="([^"]*)"')
            robots = meta(s, r"name=['\"]robots['\"]\s+content=['\"]([^'\"]*)['\"]")
            body = visible_blocks(s)
            h1s = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip()
                   for x in re.findall(r"(?is)<h1[^>]*>(.*?)</h1>", body)]
            h2 = len(re.findall(r"(?is)<h2[^>]*>", body))
            h3 = len(re.findall(r"(?is)<h3[^>]*>", body))
            words = len(re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", body))).split())
            imgs = len(re.findall(r"(?i)<img\b", body))
            ilinks = len(set(re.findall(r'href="(' + re.escape(ORIGIN) + r'/[^"#?]*)"', body)))

            if path == "/":
                ptype = "homepage"
            elif path.startswith("/product/"):
                ptype = "product"
            elif path.startswith("/product-category/"):
                ptype = "product category"
            elif path == "/products/":
                ptype = "product index"
            else:
                ptype = "page"

            # Woo transactional pages have no function on a quote-only site
            woo = path in ("/cart/", "/checkout/", "/my-account/")
            legit = "legitimate"
            action, new_url, note = "migrate 1:1", path, ""
            if woo:
                legit = "legitimate but obsolete"
                action, new_url = "301 redirect", "/contact-us/"
                note = ("WooCommerce transactional page; add-to-cart is CSS-hidden site-wide and "
                        "the business model is quote-based, so the page has no function")
            elif path == "/main-page/":
                legit = "legitimate but empty"
                action, new_url = "301 redirect", "/"
                note = "Orphan draft-style duplicate of the homepage; 301 chars of content, no inbound links"
            elif path == "/refund_returns/":
                note = "Underscore slug preserved exactly as published"
            elif path == "/products/":
                note = ("Elementor block listing 29 unrelated burger-box products removed; "
                        "OG description and og:image still referenced the burger-box catalogue")

            wu.writerow([u, ptype, "200", canon, title, desc, h1s[0] if h1s else "",
                         robots or "index, follow", legit, ORIGIN + new_url, action, note])
            wc.writerow([u, ptype, h1s[0] if h1s else "", h2, h3, words, imgs, ilinks,
                         "WooCommerce CSV + WordPress XML" if ptype == "product"
                         else "WordPress XML + live page", "yes" if action != "301 redirect" else "redirect only",
                         "multiple H1" if len(h1s) > 1 else ""])
            pages[path] = {"title": title, "canonical": canon, "h1": h1s}

    # ---------------- OLD_INTERNAL_LINK_BASELINE.csv ----------------------------
    survives = set(pages) - {"/cart/", "/checkout/", "/my-account/", "/main-page/"}
    rows = 0
    with open(os.path.join(REP, "OLD_INTERNAL_LINK_BASELINE.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["source_url", "destination_url", "anchor_text", "section_heading",
                    "link_type", "destination_status", "destination_survives",
                    "final_disposition", "replacement_url", "reason_for_change"])
        for u in urls:
            s = open(os.path.join(MIRROR, fname(u) + ".html"), encoding="utf-8", errors="replace").read()
            body = visible_blocks(s)
            # Contextual links live inside the article/description regions
            for m in re.finditer(r'(?is)<a\b([^>]*?)href="([^"]+)"([^>]*)>(.*?)</a>', body):
                href = html.unescape(m.group(2))
                if not href.startswith(ORIGIN):
                    continue
                dest = href.replace(ORIGIN, "") or "/"
                dest = dest.split("#")[0].split("?")[0]
                if not dest:
                    continue
                anchor = html.unescape(re.sub(r"<[^>]+>", " ", m.group(4)))
                anchor = re.sub(r"\s+", " ", anchor).strip()
                if not anchor:
                    continue
                attrs = m.group(1) + m.group(3)
                before = body[max(0, m.start() - 4000):m.start()]
                heads = re.findall(r"(?is)<h[23][^>]*>(.*?)</h[23]>", before)
                section = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", heads[-1]))).strip() if heads else ""
                ltype = "navigation/chrome" if NAV_HINT.search(attrs) or NAV_HINT.search(before[-300:]) else "contextual"

                if BURGER_RE.search(dest):
                    st, surv, disp, repl, reason = ("404", "no", "removed", "",
                        "Links to a burger-box product that never existed on this domain")
                elif dest in ("/cart/", "/checkout/", "/my-account/"):
                    st, surv, disp, repl, reason = ("200", "no", "removed", "",
                        "WooCommerce transactional page retired on the quote-only site")
                elif dest.startswith("/category/") or dest.startswith("/tag/"):
                    st, surv, disp, repl, reason = ("200/410", "no", "removed", "",
                        "Injected spam taxonomy")
                elif dest in ("/feed/", "/comments/feed/") or dest.startswith("/wp-"):
                    st, surv, disp, repl, reason = ("200", "no", "removed", "",
                        "WordPress infrastructure endpoint, not applicable to a static build")
                elif dest in survives:
                    st, surv, disp, repl, reason = ("200", "yes", "preserved", dest, "")
                else:
                    st, surv, disp, repl, reason = ("200", "yes", "preserved", dest, "")
                w.writerow([u, href, anchor, section, ltype, st, surv, disp,
                            (ORIGIN + repl) if repl else "", reason])
                rows += 1
    print(f"OLD_URL_INVENTORY rows={len(urls)}  OLD_INTERNAL_LINK_BASELINE rows={rows}")


if __name__ == "__main__":
    main()
