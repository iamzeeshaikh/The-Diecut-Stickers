# Migration Conflicts

Where sources disagreed, the resolution order was: current legitimate live page →
WordPress XML → WooCommerce CSV → Elementor JSON → screenshot/PDF. Malware-contaminated
live content never overrode a clean export.

---

## 1. Product specification and FAQ fields were swapped — Custom Window Stickers

**Conflict.** For `custom-window-stickers`, `_bhww_specifications_wysiwyg` contained
`<h3>`-formatted FAQ content, and `_bhww_faqs_wysiwyg` contained the specification
`<table>`. Every other product has them the right way round.

**Resolution.** Detected programmatically (specs field has headings but no table while the
FAQ field has a table but no headings) and swapped back. Both blocks are preserved
verbatim; nothing was rewritten. Without this the product would have rendered 0 FAQs and a
specification section full of questions.

**Source of truth.** WooCommerce CSV, corrected for the field-assignment error.

---

## 2. Fabricated review and rating schema on all 29 products

**Conflict.** Every live product page emitted:

```json
"aggregateRating": { "ratingValue": "5", "reviewCount": 1 },
"review": [{ "author": { "name": "an administrator email address" },
             "description": "<the product's meta description>",
             "reviewRating": { "ratingValue": "5" } }]
```

The WooCommerce export sets `Allow customer reviews? = 0` on all 29 products, so no
customer review exists or can exist. The single "review" is authored by an administrator
email address and its body is a verbatim copy of the meta description.

**Resolution.** Not migrated. This is plugin-generated self-serving markup, it violates
Google's structured-data policy for review snippets, and the brief prohibits inventing
ratings or reviews. Product schema now carries only name, SKU, description, brand,
category, images, canonical URL and — where a real price exists — an Offer.

**Impact.** Star ratings will disappear from any search result currently showing them.
That is the correct outcome; they were never real.

---

## 3. Offer price of "0" contradicted the visible price

**Conflict.** Live Product schema declared `"price": "0"` with `"availability": "InStock"`
on all 29 products. The WooCommerce export shows 21 products priced at **$0.20** and 8
(`die-cut-*` and `holographic-die-cut-stickers`) with **no price at all**.

**Resolution.** Offer schema is emitted only from real price data, never invented. The 21
products priced in the export use $0.20.

**Update — prices supplied by the owner.** Omitting the Offer node on the 8 unpriced
products left them failing Google's Product snippet validation with *"Either 'offers',
'review', or 'aggregateRating' should be specified"*, so they were ineligible for rich
results. The site owner supplied **$0.30** for that group, and it is now set in
`tools/extract.py` under `OWNER_PRICES`. All 29 products therefore carry a visible price
and a matching Offer.

This is the owner pricing their own catalogue, which is theirs to decide. It is a
different thing from the fabricated `aggregateRating` and `Review` in section 2, which
stay removed: a price is the merchant's own statement about their product, whereas a
review impersonates a customer who does not exist. Owner consent cannot make that
legitimate.

Validation still asserts the two must agree — a priced product must have an Offer whose
price equals the price rendered on the page.

---

## 4. `/products/` advertised a burger-box catalogue

**Conflict.** The page opened with an Elementor block listing 29 burger-box products
("Red Burger Boxes", "Corrugated Burger Boxes", …), each linking to a `/product/*-burger-boxes/`
URL that returns 404. Its `og:description` read *"All Products Red Burger Boxes Order Now
Corrugated Burger Boxes…"* and its `og:image` was `Red-Burger-Boxes-1-300x300.jpg`.

Neither the WooCommerce CSV (29 rows, all stickers) nor the WordPress XML (29 products,
all stickers) contains a single burger product.

**Resolution.** The block, its links and its Open Graph metadata are excluded. The clean
export is authoritative over the contaminated live page. `/products/` now leads with the
real sticker range grouped by category, with a written intro and its own title and
description. The 29 burger URLs stay 404 — they never existed on this domain, so 410 would
be the wrong signal.

---

## 5. Quote form listed candle-box products

**Conflict.** The Elementor "Instant Quote" form on every product page had a Product
dropdown whose options were *Candle Gift Boxes, Christmas Candle Boxes, White Candle Box,
Tealight Candle…* — leftovers from a candle-packaging site previously run on this install.
The popup form also had mismatched fields (a `tel` input labelled "phone" with `id=email`,
an `email` input labelled "email" with `id=message`).

**Resolution.** The dropdown now lists the 29 real sticker products, alphabetically, with
the current product preselected on each product page. Field labels, types and ids are
consistent.

---

## 6. Footer heading read "Box Categories"

**Conflict.** The footer column listing sticker categories was headed "Box Categories" — a
leftover from the burger/candle era, on a site that sells no boxes.

**Resolution.** Changed to "Sticker Categories". The links themselves are unchanged.

---

## 7. Five category links used mis-cased slugs

**Conflict.** Five product descriptions linked to `/product-category/Usage/`,
`/product-category/Sticker-Types/`, `/product-category/Features/`,
`/product-category/By-Material/` and `/product-category/Shape-&-Size/`. WordPress resolved
these case-insensitively and returned 200; a static host returns 404.

**Resolution.** Normalised to the real lowercase slugs. Anchor text and sentence wording
are untouched. Recorded in `INTERNAL_LINK_PRESERVATION_REPORT.md` as *updated*, not removed.

---

## 8. WooCommerce transactional pages on a quote-only business

**Conflict.** `/cart/`, `/checkout/` and `/my-account/` were published and in the sitemap,
but the site's own custom CSS hides `.add_to_cart_button` and `.single_add_to_cart_button`
site-wide, and the conversion path everywhere is the quote form. The pages are functional
scaffolding with no role.

**Resolution.** 301 to `/contact-us/`, one hop, no chains. Removed from the sitemap. The
"Add To Cart" button on the product template is replaced with "Request a quote", which
targets the on-page quote form — same placement and prominence, a destination that works.

---

## 9. `/main-page/` was an unused duplicate homepage

**Conflict.** In the sitemap and returning 200, but holds 301 characters of content, has no
inbound links, and carries 25 outbound links to `thecandlepackaging.com`.

**Resolution.** 301 to `/`. Excluded from the sitemap.

---

## 10. Page content was stored twice

**Conflict.** Elementor pages keep a copy of their text in both `_elementor_data` and
`post_content`. Concatenating both duplicated every paragraph — the privacy policy and
terms pages came out at roughly double length.

**Resolution.** The two are compared after normalisation; when one contains the other only
the richer copy is kept. Verified: zero duplicated paragraphs across all pages, asserted in
the validation suite.

---

## 11. Anchor text that was a full URL

**Conflict.** The privacy policy and terms pages contain
`<a href="https://thediecutstickers.com/">https://thediecutstickers.com/</a>`. An early
pass rewrote the production origin everywhere to make links relative, which also rewrote
the *visible* text to `/`.

**Resolution.** Origin rewriting is now scoped to `href`, `src`, `srcset`, `action` and
`content` attributes. The href is relative; the visible anchor text still reads
`https://thediecutstickers.com/` exactly as published.

---

## 12. Brand colours failed contrast

**Conflict.** The published palette pairs white text with `#35a887` teal (2.96:1) and
`#b068f8` purple (3.40:1). Both are below the 4.5:1 WCAG AA minimum for normal text, so the
header bar, phone button, primary buttons and the CTA panel were all failing.

**Resolution.** Each was darkened to the nearest shade of the same hue that passes:
`#24856a` (4.53:1) and `#9a4cec` (4.55:1). The original lighter purple is retained as
`--purple-accent` for decorative use that carries no text (the active gallery thumbnail
border). The design reads the same; the text is legible. Accessibility scores 100.

This is a deliberate, documented departure from pixel-exact colour preservation, made
because the brief also requires an accessibility score of 95+.
