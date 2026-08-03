# Responsive QA and Visual Comparison Report

Tested with headless Chromium at 320, 375, 768, 1024 and 1440 px across eight
representative pages, then re-checked against the deployed preview.

---

## Horizontal overflow

`document.documentElement.scrollWidth - clientWidth`, measured after network idle.
Any value above 0 means the page scrolls sideways.

| Page | 320 | 375 | 768 | 1024 | 1440 |
| --- | --- | --- | --- | --- | --- |
| Homepage | 0 | 0 | 0 | 0 | 0 |
| Products index (paginated) | 0 | 0 | 0 | 0 | 0 |
| Product (standard) | 0 | 0 | 0 | 0 | 0 |
| Product (longest — Custom Car Stickers) | 0 | 0 | 0 | 0 | 0 |
| Category | 0 | 0 | 0 | 0 | 0 |
| About | 0 | 0 | 0 | 0 | 0 |
| Contact (full quote form) | 0 | 0 | 0 | 0 | 0 |
| Products page 2 | 0 | 0 | 0 | 0 | 0 |
| Homepage with hero slider | 0 | 0 | 0 | 0 | 0 |

**No horizontal overflow at any breakpoint on any page.**

The migrated specification tables are the main risk here — several are six to ten columns
wide. Each is wrapped in an `overflow-x: auto` container at extraction time, so the table
scrolls inside its own box and the page body never moves. Grids use
`repeat(n, minmax(0, 1fr))` rather than `1fr`, which is what stops a wide child forcing
the track open.

## Layout behaviour by breakpoint

| Component | 320–767 | 768–1023 | 1024+ |
| --- | --- | --- | --- |
| Header | Logo + hamburger; nav and phone pill hidden | same | Logo, inline nav, phone pill |
| Top contact bar | Wraps to two lines, font drops to 0.82 rem below 420 px | Single line | Single line |
| Mobile menu | Off-canvas drawer, focus-trapped, Esc to close | same | Not rendered |
| Product grid | 2 columns | 2 columns | 3 columns |
| USP cards | 2 columns | 2 columns | 4 columns |
| Product page | Single column: gallery → summary → form | Gallery + summary side by side, form full width below | Three columns |
| Contact form | Single column | Two columns | Two columns |
| Spec tables | Scroll inside their container | same | Usually fit |
| CTA block | Stacked: copy above form | Stacked | Side by side |
| Footer | Single column | Two columns | Three columns |
| FAQ accordion | Full width, `<details>` — works without JavaScript | same | same |

## Headings

Exactly one `<h1>` on every page at every breakpoint. Verified by counting in the DOM
rather than reading source, so anything injected at runtime would be caught.

## Touch targets

Measured against WCAG 2.5.8 (AA), which requires 24 × 24 px.

| Element | Before | After |
| --- | --- | --- |
| Mobile menu button | 35 px | 44 px |
| Breadcrumb links | 23 px | 31 px |
| Footer links | 18 px | 28 px |
| Top-bar email/phone | 22 px | 28 px |
| Form inputs, selects, textareas | 44 px | 44 px |
| Buttons | 44 px+ | 44 px+ |
| Mobile menu items | 44 px | 44 px |

Remaining sub-24 px targets are inline links inside sentences (contextual links in product
descriptions, the email address in the privacy policy text). WCAG 2.5.8 explicitly exempts
targets whose size is constrained by the line-height of surrounding text, so these are
compliant as they stand. Enlarging them would break the typography of the migrated copy.

## Other checks

| Check | Result |
| --- | --- |
| Broken grids | None |
| Overlapping elements | None |
| Cropped or clipped text | None |
| Unusable buttons | None |
| Oversized images | None — every image is width/height constrained with `max-width: 100%` |
| Layout shift | CLS 0 on every page tested; all images carry explicit dimensions |
| Keyboard navigation | Full site reachable; skip link, visible focus rings, drawer focus trap |
| Reduced motion | `prefers-reduced-motion` disables transitions and smooth scrolling |

---

## Visual comparison against the source

Compared against `screencapture-thediecutstickers-2026-08-03-15_02_44.pdf` (homepage,
6 pages), `screencapture-thediecutstickers-product-die-cut-vinyl-stickers-...pdf`
(product page), the Elementor templates, and the mirrored live HTML.

| Element | Match | Notes |
| --- | --- | --- |
| Top contact bar | Match | Teal bar, email + phone left of centre, Facebook and LinkedIn pills right |
| Header | Match | Circular logo left, centred nav (Home, Products, By Material, Shape & Size, Sticker Types), purple italic phone pill right |
| Homepage USP row | Match | Four animated cards, first two on the cream tint, same order and copy |
| "Our Products" button | Match | Centred purple pill |
| Product grid | Match | 3-up cards, image, price, centred name |
| Homepage body copy | Match | Same headings and paragraphs, hidden spam link removed |
| CTA block | Match | Purple panel left with contact details, socials and SSL/DHL/ISO badges; quote form right |
| Footer | Match | Dark, three columns, contact / Company / categories, badges in the base bar |
| Breadcrumbs | Match | `Home › Products › By Material › <product>` |
| Product H1 and gallery | Match | Main image with four thumbnails below |
| Trust badge block | Match | Six badges in a 3 × 2 grid beside the short description |
| Product quote form | Match | Teal-bordered inputs, teal Submit, same field order |
| Description / Specifications / Faqs tabs | Match | Same three labels, centred, underlined on hover |
| Specification tables | Match | Same columns and content; now scroll on narrow screens |
| Related products | Added | Present in the Elementor template but not rendering on the live site; implemented as required |

### Pixel measurements taken from the captures

The two supplied PDFs were rendered at the original 1348–1349 px capture width and the
layout was measured pixel by pixel, then matched:

| Element | Original | Rebuilt |
| --- | --- | --- |
| Homepage product card | 283 px wide, first card at x=227 | 283 px, x=227 |
| Homepage product grid | 895 px wide, 23 px gap | 895 px, 23 px gap |
| Homepage USP card | 234 px wide, first at x=163 | 234 px, x=163 |
| Hero slider | not rendered on the published site | added on request, above the USP row |
| Homepage USP row | 1023 px wide, 29 px gap | 1023 px, 29 px gap |
| Product gallery column | 424 px | 424 px |
| Product summary column | 483 px | 483 px |
| Product quote form column | 279 px | 279 px |
| Product page content width | 1296 px | 1296 px |

Both rows on the homepage and the whole product template sat narrower or wider than the
1200 px theme container, so each is constrained to its measured width. Before this the
product cards rendered ~32% larger than the original.

### Order and pagination

Two structural mismatches were found on re-check against the PDFs and corrected:

- **Homepage product order.** The published gallery ran newest-first
  (`post_date` descending), opening with Die Cut Paper Stickers. The rebuild had been
  showing the CSV order, which is the exact reverse. Now sorted by publish date
  descending, which reproduces the captured order exactly — including the one place it
  departs from strict ID order (Die Cut Logo Stickers publishes 12 minutes after
  Holographic Die Cut Stickers).
- **`/products/` structure.** The published archive was a flat alphabetical grid of 16 per
  page with a second page at `/products/page/2/` — a live URL carrying `rel="next"`. The
  rebuild had grouped products by category on a single page, which dropped that URL. It is
  now a paginated alphabetical archive again, with the result count ("Showing 1–16 of 29
  results"), numbered pagination, `rel="next"`/`rel="prev"`, and the category label above
  each card as the WooCommerce loop showed it.

### Intentional differences

1. **"Add To Cart" → "Request a quote"** on product pages. Cart and checkout are retired,
   so the original button led nowhere. Same position, same styling, a destination that
   works.
2. **Footer heading "Box Categories" → "Sticker Categories"**. Leftover from the
   burger/candle-box era.
3. **Burger-box block removed from `/products/`**. 29 unrelated products linking to 404s.
4. **Teal `#35a887` → `#24856a`, purple `#b068f8` → `#9a4cec`.** Both original shades
   failed WCAG AA contrast against white text (2.96:1 and 3.40:1). Darkened to the nearest
   passing shades of the same hue. Side by side the difference is slight; the text is now
   legible. The original purple is retained for the active gallery thumbnail border, which
   carries no text.
5. **USP animations converted from GIF to animated WebP** and re-encoded at rendered size.
   Visually identical, 3.2 MB → 460 kB.
6. **Hero slider added on request.** Three slide templates exist in the Elementor exports
   (`elementor-2722/2730/2736`) but neither the live homepage nor the supplied PDF rendered
   them, so the first build followed the published layout and opened on the USP cards. The
   slider has since been built from those templates and now sits above the USP row. Copy,
   button labels and images are migrated verbatim; slide one's button had no link in the
   export and points at the on-page quote form.

   It is a CSS scroll-snap carousel, not a library: no third-party JavaScript, all three
   slides present and the track still scrollable with JavaScript disabled, arrow-key and
   tab operable, dots exposed as tabs, autoplay paused on hover/focus and off-screen,
   disabled entirely under `prefers-reduced-motion`, and a visible Pause/Play control for
   WCAG 2.2.2. Homepage mobile scores after adding it: Performance 93, Accessibility 100,
   Best Practices 100, SEO 100, CLS 0.
