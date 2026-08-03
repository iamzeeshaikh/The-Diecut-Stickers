# Migration Report — thediecutstickers.com

WordPress + WooCommerce + Elementor → Astro 7, clean-room rebuild.

**Date:** 3 August 2026
**Status:** Built, validated, deployed to a preview. **DNS unchanged; the live site is
still the compromised WordPress install.**

---

## Headline numbers

| Metric | Count |
| --- | --- |
| Pages migrated | 42 (41 + paginated archive page 2) |
| Products migrated | 29 (of 29 legitimate) |
| Categories migrated | 5 (of 5 legitimate) |
| Legitimate URLs preserved 1:1 | 41 |
| Redirects (301, single hop) | 4 |
| Malware/spam URLs returning 410 | 89 |
| Unrelated URLs returning 404 | 29 |
| Images migrated | 133 |
| Images excluded | 30 |
| FAQs migrated | 435 |
| Claim families preserved | 25 |
| Internal links in baseline | 1,520 |
| Internal links preserved | 1,460 |
| Internal links updated | 5 |
| Internal links unlinked | 1 |
| Internal links removed | 60 |
| Contextual links in the new site | 78 |
| Orphan indexable pages | 0 |
| Broken internal links | 0 |
| Validation checks passing | 28 / 28 |
| Lighthouse (mobile, all pages) | Perf 90–94, A11y 100, Best Practices 100, SEO 100 |

---

## What was migrated

**29 products**, every one in the WooCommerce export, at their exact existing slugs and
trailing slashes under `/product/<slug>/`. Each keeps its name, four images, short
description, full description with its editorial internal links, specification table,
15 FAQs, Yoast title and meta description, and its category. 21 carry the real $0.20
price; the 8 `die-cut-*` products have no price in the source and none was invented.

**5 categories** at `/product-category/<slug>/` — By Material, Features, Shape & Size,
Sticker Types, Usage — each with its existing description, a product grid, breadcrumbs,
and a unique title and meta description written for it (the archives had none).

**7 pages**: homepage, `/products/`, `/about-us/`, `/contact-us/`, `/privacy-policy/`,
`/terms-conditions/`, `/refund_returns/` (underscore preserved exactly as published).

**Layout matched to the captures.** The two supplied PDFs were rendered at the original
1348 px capture width and measured pixel by pixel. The homepage USP row (1023 px, 4 cards
of 234 px) and product gallery (895 px, 3 cards of 283 px) both sat narrower than the
1200 px theme container, and the product template sat wider at 1296 px. Each is now
constrained to its measured width, and the homepage grid is sorted newest-first as
published. `/products/` is a paginated alphabetical archive again, preserving
`/products/page/2/`.

**Design** rebuilt from the supplied PDFs, the Elementor templates and the live markup:
teal contact bar, circular logo with centred nav and purple phone pill, animated USP
cards, product grid, product page with gallery + trust badges + quote form + tabbed
description/specifications/FAQs, purple CTA block, dark three-column footer. No CSS or
JavaScript was copied from the WordPress theme.

**Components** built as required: `SiteHeader`, `MobileNavigation`, `SiteFooter`,
`SEOHead`, `Breadcrumbs`, `ProductCard`, `ProductGrid`, `ProductGallery`,
`ProductSpecifications`, `InquiryForm`, `ContentSection`, `FAQSection`,
`RelatedProducts`, `CTASection`, `GonePage`.

Products are generated from one template plus structured data, not duplicated per file.

---

## What was removed

The WordPress installation is compromised. Full detail in `MALWARE_AUDIT_REPORT.md`.

**A persistent service-worker backdoor.** The homepage served a hex-obfuscated script
registering a service worker at scope `/` from `wp-content/cache/4a7e6354.php`, then
executing arbitrary base64 JavaScript pushed from it via `new Function(atob(v.c))()`. A
remote code execution channel in every visitor's browser, cloaked to the homepage only.
The new site ships a **kill switch** on every page that unregisters any service worker
bound to this origin and clears its caches, so returning visitors are disinfected — a
clean server alone would not have fixed them.

**Three hidden spam links** positioned off-screen in page content: `888sportcasino.it`,
`chickenroadfrance.uk.net`, and `roman-peschanoe.ru` ("7 казино"). The extractor now
strips any element hidden by inline style and unlinks outbound links to hosts outside an
allow-list of the brand's own profiles.

**87 injected spam taxonomy terms** — 34 categories and 53 tags, all of them injected
(the export contains no legitimate post). Spanish, Portuguese, Italian, Polish and Korean
gambling spam, plus forex and off-topic filler. 55 were still live and indexable at audit
time. The whole `/category/` and `/tag/` namespace now returns 410.

**One injected pharmaceutical URL**,
`/understanding-the-test-e-250-course-benefits-and-considerations/`, now 410.

**Fabricated review schema** on all 29 products: a 5-star `aggregateRating` and one
`Review` authored by an administrator's email address with the meta description as its
body, on products where WooCommerce has reviews disabled. Also a contradictory
`"price": "0"`. Neither migrated.

**Two earlier businesses' leftovers**: a 29-product burger-box catalogue on `/products/`
linking to 404s (with matching Open Graph tags), 25 outbound links to
`thecandlepackaging.com`, a quote-form dropdown listing candle boxes, and a footer heading
reading "Box Categories".

---

## URL handling

| Treatment | Count | Detail |
| --- | --- | --- |
| Preserved 1:1 | 41 | Exact path and trailing slash |
| 301 redirect | 4 | `/cart/`, `/checkout/`, `/my-account/` → `/contact-us/`; `/main-page/` → `/` |
| 410 Gone | 89 | Injected spam taxonomy and the pharma page |
| 404 | 29 | Burger-box products that never existed here |

Spam URLs are never redirected to commercial pages, never canonicalised to a legitimate
page, never in the sitemap, and never linked. 410 rather than 404 for anything that was
indexed while the site was infected, so the removal reads as permanent.

Redirects are implemented as on-demand routes rather than adapter config: with
`trailingSlash: 'always'` the Vercel adapter emitted `^/cart$`, but its own normalisation
308s `/cart` → `/cart/` first, so the redirect never matched and the URL 404'd on the
deployed preview. Caught by testing the deployment, not localhost.

---

## Security posture of the new site

- Static output. No PHP, no database, no admin surface, no plugin update path.
- Nothing from the exports was executed. XML, CSV, JSON and HTML were parsed as inert data.
- All migrated HTML is sanitised at extraction: scripts, styles, iframes, objects, forms,
  event-handler attributes and `javascript:` URLs are stripped.
- 133 images were MIME-sniffed from magic bytes, hashed, measured and scanned for payloads
  in header, trailer and any bytes past the image terminator. No SVG is served.
- The quote endpoint validates server-side regardless of the browser: origin check,
  honeypot, rate limiting, field length caps, control-character stripping, mail-header
  injection guard, extension allow-list, double-extension rejection, magic-byte
  verification, and an executable-content scan of text-based formats. Uploads are held in
  memory and forwarded as attachments — never written to disk, never executed.
- SMTP credentials live only in environment variables; no secret reaches a client bundle.
- Success is reported only after the SMTP server accepts the message.

---

## Known limitations

1. **Email delivery is unverified.** No SMTP credentials were available. The integration
   is complete and the endpoint fails honestly (503) until they are configured. Test on
   the deployed preview before cutover.
2. **The compromised host is untouched.** Credential rotation, admin review and server
   isolation need account access and your authorisation. See
   `SECURITY_CUTOVER_CHECKLIST.md`. Until that is done the attacker's access persists.
3. **DNS is unchanged**, as instructed.
4. **Star ratings will disappear** from any search results currently showing them. The
   markup was fabricated; keeping it would risk a structured-data manual action.
5. **Build-time advisory**: `npm audit` flags a ReDoS in `path-to-regexp` via
   `@vercel/routing-utils`. Build-time only, not in any client bundle or the runtime. The
   available fix downgrades the adapter below what Astro 7 needs, so it was not applied.
6. **The Elementor hero slider was not built.** Three slide templates exist in the exports
   but neither the live site nor the supplied homepage PDF renders them. The published
   layout was followed; the content is preserved in the exports if you want it added.

---

## Reports

| File | Contents |
| --- | --- |
| `MALWARE_AUDIT_REPORT.md` | Full findings, decoded payloads, handling |
| `SECURITY_CUTOVER_CHECKLIST.md` | Credential rotation and host isolation (not performed) |
| `MIGRATION_CONFLICTS.md` | 12 source conflicts and how each was resolved |
| `OLD_URL_INVENTORY.csv` | 45 pre-migration URLs with metadata and disposition |
| `REDIRECT_MAP.csv` | 4 redirects + 89 gone URLs |
| `SPAM_URL_MAP.csv` | 118 excluded URLs with topic, evidence and decision |
| `EXCLUDED_FILES_REPORT.csv` | 30 files excluded, with reason |
| `IMAGE_INVENTORY.csv` | 133 images with hash, MIME, dimensions, security status |
| `CONTENT_INVENTORY.csv` | Per-page heading, word and link counts |
| `CLAIMS_MIGRATION_REPORT.md` | 25 claim families and where each is carried |
| `OLD_INTERNAL_LINK_BASELINE.csv` | 1,520 links captured pre-edit — immutable |
| `INTERNAL_LINK_MAP.csv` | 1,338 links in the built site |
| `INTERNAL_LINK_PRESERVATION_REPORT.md` | Preserved / updated / removed, with reasons |
| `ORPHAN_PAGE_REPORT.csv` | Incoming links per page; zero orphans |
| `SEO_VALIDATION_REPORT.md` | 28 checks + Lighthouse |
| `RESPONSIVE_QA_REPORT.md` | 5 breakpoints + visual comparison |
| `DEPLOYMENT_REPORT.md` | Preview URL, DNS cutover, rollback |
| `ENVIRONMENT_VARIABLES.md` | SMTP and indexability configuration |

## Tooling

| Script | Purpose |
| --- | --- |
| `tools/extract.py` | Products and categories from CSV + XML; sanitising; spam stripping |
| `tools/pages.py` | Static page content from XML and Elementor JSON |
| `tools/baseline.py` | Immutable pre-migration URL, content and link baselines |
| `tools/media.py` | Image download, verification and security scanning |
| `tools/linkmap.py` | Post-migration link map and orphan report |
| `tools/reports.py` | Redirect map, claims report, link preservation report |
| `tools/validate.mjs` | 28-check validation suite against the build output |

Re-run everything:

```bash
python3 tools/extract.py && python3 tools/pages.py && python3 tools/media.py
cd site && PUBLIC_SITE_ENV=production npx astro build && npx astro check
node ../tools/validate.mjs
cd .. && python3 tools/linkmap.py && python3 tools/reports.py
```
