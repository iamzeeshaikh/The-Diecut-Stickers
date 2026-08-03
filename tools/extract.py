#!/usr/bin/env python3
"""
Clean-room extraction for The Die Cut Stickers migration.

Reads WordPress XML, WooCommerce CSV, Elementor JSON and mirrored live HTML
STRICTLY AS INERT DATA. Nothing from the exports is ever executed.

Outputs structured JSON for the Astro build plus the immutable baseline CSVs.
"""
import csv, html, json, os, re, sys, hashlib
import xml.etree.ElementTree as ET
from collections import OrderedDict

csv.field_size_limit(10 ** 9)

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIRROR = "/private/tmp/claude-501/-Users-sajjadahmad/3ed0644e-d346-4367-95c8-e402082c014f/scratchpad/dcs/live"
OUT_DATA = os.path.join(SRC, "site", "src", "data")
OUT_REP = os.path.join(SRC, "reports")
ORIGIN = "https://thediecutstickers.com"

NS = {
    "wp": "http://wordpress.org/export/1.2/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "excerpt": "http://wordpress.org/export/1.2/excerpt/",
}

# --- Contamination vocabularies -------------------------------------------------
BURGER_RE = re.compile(r"burger|clamshell|bagasse|styrofoam|polystyrene", re.I)
CANDLE_RE = re.compile(r"candle|tealight", re.I)
SPAM_TOPIC = [
    (re.compile(r"casino|slot|spin|bet|gambl|pokie|jack|riches|bonanza|mostbet|giros|deposito|promocional|dorado|sportium", re.I), "gambling/casino spam"),
    (re.compile(r"forex|trading", re.I), "finance spam"),
    (re.compile(r"test-e-250|testoster|steroid|anabolic", re.I), "pharmaceutical/steroid spam"),
    (re.compile(r"adobe-generative-ai|computers-games|spiele|blues-and-jazz|heclectik", re.I), "off-topic injected content"),
    (re.compile(r"%e[0-9a-f]", re.I), "foreign-language (Korean) spam"),
]


# Outbound links are allowed only to the brand's own social profiles. Anything
# else in the source is either injected spam or a leftover from a previous
# business that used this WordPress install.
ALLOWED_EXTERNAL = (
    "facebook.com", "web.facebook.com", "www.facebook.com",
    "linkedin.com", "www.linkedin.com",
    "instagram.com", "www.instagram.com",
    "api.whatsapp.com", "m.me",
)

# Off-screen / invisible containers are the classic hidden-link SEO injection.
HIDDEN_STYLE = re.compile(
    r"(?:position\s*:\s*absolute[^\"']*(?:left|top)\s*:\s*-\s*\d{3,}px)"
    r"|(?:(?:left|top)\s*:\s*-\s*\d{3,}px)"
    r"|(?:display\s*:\s*none)"
    r"|(?:visibility\s*:\s*hidden)"
    r"|(?:text-indent\s*:\s*-\s*\d{3,}px)"
    r"|(?:font-size\s*:\s*0(?:px)?\s*[;\"'])",
    re.I,
)


def strip_hidden(s: str, slug: str, findings: list) -> str:
    """Remove elements hidden from users but visible to crawlers."""
    for tag in ("div", "span", "p", "a", "section"):
        pattern = re.compile(
            rf"<{tag}\b[^>]*style\s*=\s*([\"'])(.*?)\1[^>]*>.*?</{tag}\s*>",
            re.I | re.S,
        )

        def repl(m):
            if HIDDEN_STYLE.search(m.group(2)):
                findings.append((slug, "hidden element removed",
                                 re.sub(r"\s+", " ", m.group(0))[:200]))
                return ""
            return m.group(0)

        prev = None
        while prev != s:
            prev = s
            s = pattern.sub(repl, s)
    return s


def strip_external(s: str, slug: str, findings: list) -> str:
    """Unlink outbound links to domains that are not the brand's own."""
    def repl(m):
        href, inner = m.group(1), m.group(2)
        host = re.sub(r"^https?://", "", href).split("/")[0].lower()
        if any(host == d or host.endswith("." + d) for d in ALLOWED_EXTERNAL):
            return m.group(0)
        findings.append((slug, "external link removed", f"{href} ({re.sub('<[^>]+>', '', inner)[:60]})"))
        return inner

    return re.sub(r'(?is)<a\b[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>', repl, s)


def clean_html(s: str) -> str:
    """Normalise WooCommerce-exported HTML into safe, tidy markup."""
    if not s:
        return ""
    # WooCommerce CSV escapes newlines as a literal backslash-n
    s = s.replace("\\n", "\n")
    # Strip ChatGPT authoring artefacts left in the source content
    s = re.sub(r'\s*data-(start|end)="\d+"', "", s)
    # Defence in depth: no executable or embedded content survives extraction
    s = re.sub(r"(?is)<(script|style|iframe|object|embed|form|noscript)\b.*?</\1\s*>", "", s)
    s = re.sub(r"(?is)<(script|style|iframe|object|embed|form|link|meta)\b[^>]*/?>", "", s)
    s = re.sub(r'(?i)\son[a-z]+\s*=\s*"[^"]*"', "", s)
    s = re.sub(r"(?i)\son[a-z]+\s*=\s*'[^']*'", "", s)
    s = re.sub(r'(?i)(href|src)\s*=\s*"\s*javascript:[^"]*"', 'href="#"', s)
    # Site-relative internal links (no hard-coded origin in the new build)
    # Rewrite the origin inside attributes only. Rewriting the whole string
    # would also mangle visible text: an anchor reading
    # "https://thediecutstickers.com/" would collapse to "/".
    s = re.sub(
        r'((?:href|src|srcset|action|content)\s*=\s*")' + re.escape(ORIGIN) + r'(/|(?="))',
        lambda m: m.group(1) + "/",
        s,
    )
    s = re.sub(r'\s*target="_new"', "", s)
    # WordPress block comments carry no meaning outside WordPress.
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    # The page template owns the single H1; demote any H1 inside body copy.
    s = re.sub(r"(?i)<(/?)h1(\s|>)", r"<\1h2\2", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


CAT_SLUGS = {"by-material", "features", "shape-size", "sticker-types", "usage"}


def normalise_links(s: str, slug: str, fixes: list) -> str:
    """Repair internal link defects inherited from the source content."""
    def fix_cat(m):
        raw = m.group(1)
        target = html.unescape(raw).lower().replace("&", "").replace("--", "-").strip("-")
        target = re.sub(r"-+", "-", target)
        if target in CAT_SLUGS and raw != target:
            fixes.append((slug, f"/product-category/{raw}/", f"/product-category/{target}/",
                          "updated", "Mis-cased/malformed category slug would 404 on a static host"))
            return f'href="/product-category/{target}/"'
        return m.group(0)

    s = re.sub(r'href="/product-category/([^"/]+)/"', fix_cat, s)

    # Hidden injected links and unrelated outbound links are stripped; the
    # surrounding sentence is always preserved.
    findings: list = []
    s = strip_hidden(s, slug, findings)
    s = strip_external(s, slug, findings)
    for _slug, kind, detail in findings:
        fixes.append((_slug, detail, "", "removed", kind))
    return s


def text_of(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def slugify(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", (s or "").lower())).strip("-")


# --- WordPress XML --------------------------------------------------------------
def load_xml():
    root = ET.parse(os.path.join(SRC, "thediecutstickers.WordPress.2026-08-03 (1).xml")).getroot()
    ch = root.find("channel")
    items, terms, spam_tax = [], [], []
    for it in ch.findall("item"):
        metas = {}
        for m in it.findall("wp:postmeta", NS):
            k = m.find("wp:meta_key", NS)
            v = m.find("wp:meta_value", NS)
            if k is not None and k.text:
                metas[k.text] = (v.text or "") if v is not None else ""
        c = it.find("content:encoded", NS)
        items.append({
            "id": it.find("wp:post_id", NS).text,
            "type": it.find("wp:post_type", NS).text,
            "status": it.find("wp:status", NS).text,
            "slug": it.find("wp:post_name", NS).text or "",
            "title": (it.find("title").text or ""),
            "link": (it.find("link").text or ""),
            "content": (c.text or "") if c is not None else "",
            "date": (it.find("wp:post_date", NS).text or ""),
            "meta": metas,
            "attachment_url": (it.find("wp:attachment_url", NS).text
                               if it.find("wp:attachment_url", NS) is not None else ""),
        })
    for t in ch.findall("wp:term", NS):
        terms.append({
            "id": t.find("wp:term_id", NS).text,
            "tax": t.find("wp:term_taxonomy", NS).text,
            "slug": t.find("wp:term_slug", NS).text,
            "name": html.unescape(t.find("wp:term_name", NS).text or ""),
            "desc": (t.find("wp:term_description", NS).text or "")
                    if t.find("wp:term_description", NS) is not None else "",
        })
    for c in ch.findall("wp:category", NS):
        spam_tax.append(("category", c.find("wp:category_nicename", NS).text))
    for t in ch.findall("wp:tag", NS):
        spam_tax.append(("tag", t.find("wp:tag_slug", NS).text))
    return items, terms, spam_tax


# --- WooCommerce CSV ------------------------------------------------------------
def parse_faqs(raw: str):
    raw = clean_html(raw)
    out = []
    parts = re.split(r"(?is)<h3[^>]*>(.*?)</h3>", raw)
    for i in range(1, len(parts), 2):
        q = text_of(parts[i])
        q = re.sub(r"^\s*\d+\s*[\.\)]\s*", "", q).strip()
        body = parts[i + 1] if i + 1 < len(parts) else ""
        answers = re.findall(r"(?is)<p[^>]*>(.*?)</p>", body)
        a = " ".join(text_of(x) for x in answers).strip() or text_of(body)
        if q and a:
            if not q.endswith("?"):
                q += "?"
            out.append({"q": q, "a": a})
    return out


def looks_like_table(s):
    return "<table" in (s or "").lower()


def looks_like_faq(s):
    return bool(re.search(r"(?is)<h3[^>]*>", s or ""))


def resolve_spec_faq(spec_raw, faq_raw, name, conflicts):
    """The source has at least one record where the two meta fields were swapped."""
    if looks_like_faq(spec_raw) and not looks_like_table(spec_raw) \
       and looks_like_table(faq_raw) and not looks_like_faq(faq_raw):
        conflicts.append((
            name,
            "_bhww_specifications_wysiwyg held FAQ markup and _bhww_faqs_wysiwyg held the "
            "specification table",
            "Fields swapped back to their correct roles; both blocks preserved verbatim",
        ))
        return faq_raw, spec_raw
    return spec_raw, faq_raw


def load_products(terms, conflicts, link_fixes):
    cat_by_name = {t["name"]: t for t in terms if t["tax"] == "product_cat"}
    rows = list(csv.DictReader(
        open(os.path.join(SRC, "wc-product-export-3-8-2026-1785751183853.csv"), encoding="utf-8-sig")))
    products = []
    for r in rows:
        name = r["Name"].strip()
        if BURGER_RE.search(name) or CANDLE_RE.search(name):
            continue  # unrelated legacy catalogue — never migrated
        cat_name = html.unescape(r["Categories"].split(",")[0].strip())
        cat = cat_by_name.get(cat_name)
        imgs = [u.strip() for u in r["Images"].split(",") if u.strip()]
        price = (r["Regular price"] or "").strip()
        spec_raw, faq_raw = resolve_spec_faq(
            r["Meta: _bhww_specifications_wysiwyg"], r["Meta: _bhww_faqs_wysiwyg"], name, conflicts)
        products.append(OrderedDict(
            id=int(r["ID"]),
            slug=slugify(name) if name != "Die-Cut Decals" else "die-cut-decals",
            name=name,
            sku=r["ID"],
            category=cat_name,
            categorySlug=cat["slug"] if cat else "",
            price=price or None,
            shortDescription=normalise_links(clean_html(r["Short description"]), name, link_fixes),
            description=normalise_links(clean_html(r["Description"]), name, link_fixes),
            specifications=clean_html(spec_raw),
            faqs=parse_faqs(faq_raw),
            images=imgs,
            seoTitle=r["Meta: _yoast_wpseo_title"].strip(),
            seoDescription=r["Meta: _yoast_wpseo_metadesc"].strip(),
            focusKeyword=r["Meta: _yoast_wpseo_focuskw"].strip(),
        ))
    return products


def main():
    os.makedirs(OUT_DATA, exist_ok=True)
    os.makedirs(OUT_REP, exist_ok=True)
    conflicts, link_fixes = [], []
    items, terms, spam_tax = load_xml()
    products = load_products(terms, conflicts, link_fixes)

    # slugs must come from the authoritative XML records, never re-derived
    xml_slug = {int(i["id"]): i["slug"] for i in items if i["type"] == "product"}
    for p in products:
        if p["id"] in xml_slug:
            p["slug"] = xml_slug[p["id"]]

    cats = []
    order = ["by-material", "features", "shape-size", "sticker-types", "usage"]
    for t in terms:
        if t["tax"] != "product_cat" or t["slug"] == "uncategorized":
            continue
        cats.append(OrderedDict(
            id=int(t["id"]), slug=t["slug"], name=t["name"],
            description=clean_html(t["desc"]),
            order=order.index(t["slug"]) if t["slug"] in order else 99,
        ))
    cats.sort(key=lambda c: c["order"])

    json.dump(products, open(os.path.join(OUT_DATA, "products.json"), "w"), indent=1, ensure_ascii=False)
    json.dump(cats, open(os.path.join(OUT_DATA, "categories.json"), "w"), indent=1, ensure_ascii=False)

    # ---- SPAM_URL_MAP.csv ------------------------------------------------------
    status = {}
    tp = os.path.join(os.path.dirname(MIRROR), "taxstatus.csv")
    if os.path.exists(tp):
        for line in open(tp):
            code, u = line.strip().split(",", 1)
            status[u] = code
    with open(os.path.join(OUT_REP, "SPAM_URL_MAP.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["spam_url", "source", "detected_topic", "existing_status", "evidence",
                    "final_status", "response_decision", "notes"])
        w.writerow(["/understanding-the-test-e-250-course-benefits-and-considerations/",
                    "search engine index (reported)", "pharmaceutical/steroid spam", "404",
                    "Off-topic pharma URL on a sticker site; no matching record in XML/CSV exports",
                    "excluded", "410",
                    "Previously indexed; 410 signals permanent removal"])
        for kind, slug in spam_tax:
            url = f"/{kind}/{slug}/"
            topic = "off-topic injected taxonomy"
            for rx, lbl in SPAM_TOPIC:
                if rx.search(slug):
                    topic = lbl
                    break
            if slug == "uncategorized":
                topic = "WordPress default taxonomy (no legitimate posts exist)"
            w.writerow([url, "WordPress XML export (wp:category / wp:tag)", topic,
                        status.get(url, "unknown"),
                        "Injected taxonomy term; zero legitimate posts of type 'post' exist in the export",
                        "excluded", "410",
                        "Archive served HTTP 200 with 'Nothing Found' and index,follow — soft-404 spam surface"
                        if status.get(url) == "200" else "Already returning 410 on the compromised host"])
        for slug in ["red-burger-boxes", "corrugated-burger-boxes", "tall-burger-boxes",
                     "styrofoam-burger-boxes", "brown-burger-boxes", "burger-parcel-boxes",
                     "double-burger-boxes", "white-burger-boxes", "polystyrene-burger-boxes",
                     "cheap-burger-boxes", "printed-burger-boxes", "burger-and-chip-boxes",
                     "disposable-burger-boxes", "large-burger-boxes", "premium-burger-boxes",
                     "branded-burger-boxes", "paper-burger-boxes", "slider-burger-boxes",
                     "pink-burger-boxes", "burger-patty-boxes", "frozen-burger-boxes",
                     "bagasse-burger-boxes", "cardboard-burger-boxes", "takeaway-burger-boxes",
                     "clamshell-burger-boxes", "personalised-burger-boxes", "mini-burger-boxes",
                     "black-burger-boxes", "kraft-burger-boxes"]:
            w.writerow([f"/product/{slug}/", "Elementor block on /products/", "unrelated legacy catalogue (burger boxes)",
                        "404", "Linked from /products/ but absent from WooCommerce CSV and WordPress XML",
                        "excluded", "404",
                        "Never existed as a product on this domain; broken link removed from /products/"])
    json.dump(conflicts, open(os.path.join(OUT_REP, "_conflicts.json"), "w"), indent=1)
    json.dump(link_fixes, open(os.path.join(OUT_REP, "_link_fixes.json"), "w"), indent=1)
    print(f"products={len(products)} categories={len(cats)} spam_rows={len(spam_tax)+30} "
          f"conflicts={len(conflicts)}")


if __name__ == "__main__":
    main()
