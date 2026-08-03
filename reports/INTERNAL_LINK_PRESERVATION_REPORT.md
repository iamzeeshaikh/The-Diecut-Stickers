# Internal Link Preservation Report

Measured by comparing `OLD_INTERNAL_LINK_BASELINE.csv` (captured from the live
compromised site before any content was edited, and unchanged since) with
`INTERNAL_LINK_MAP.csv` (generated from the built Astro output).

## Summary

| Metric | Count |
| --- | --- |
| Links in the pre-migration baseline | 1520 |
| Old links preserved | 1460 |
| Old links removed (destination did not survive) | 60 |
| Old links updated (destination corrected) | 5 |
| Old links unlinked (unrelated external destination) | 1 |
| Links in the migrated site | 1365 |
| — contextual (inside body copy) | 78 |
| — navigation, breadcrumbs, footer, related products | 1287 |
| Broken internal links | 0 |
| Contextual self-links | 0 |
| Links to malware or excluded pages | 0 |
| Orphan indexable pages | 0 |

## Old links that were changed or removed

| Original destination | Original anchor | Reason | Replacement |
| --- | --- | --- | --- |
| `https://insertshub.com/product-category/product/ (Product )` | (as published) | external link removed | Unlinked; sentence text preserved |
| `/product-category/Usage/` | (category name) | Mis-cased slug would 404 on a static host; WordPress resolved it case-insensitively | `/product-category/usage/` |
| `/product-category/Sticker-Types/` | (category name) | Mis-cased slug would 404 on a static host; WordPress resolved it case-insensitively | `/product-category/sticker-types/` |
| `/product-category/Features/` | (category name) | Mis-cased slug would 404 on a static host; WordPress resolved it case-insensitively | `/product-category/features/` |
| `/product-category/Shape-&amp;-Size/` | (category name) | Mis-cased slug would 404 on a static host; WordPress resolved it case-insensitively | `/product-category/shape-amp;-size/` |
| `/product-category/By-Material/` | (category name) | Mis-cased slug would 404 on a static host; WordPress resolved it case-insensitively | `/product-category/by-material/` |
| `/product/*-burger-boxes/` (29 URLs) | Product names + "Order Now" | Products never existed on this domain; every URL returned 404 | Removed with the Elementor block |
| `/cart/`, `/checkout/`, `/my-account/` | Cart / Checkout / My account | WooCommerce pages retired on a quote-only site | 301 to `/contact-us/` |
| `/category/*`, `/tag/*` | Spam taxonomy names | Injected spam | Removed; URLs return 410 |

## Incoming contextual links per destination

Navigation, breadcrumbs, footer and related-product links are excluded here, as
required. Every page is reachable from navigation regardless.

| Destination | Incoming contextual links |
| --- | --- |
| `/` | 30 |
| `/product-category/by-material/` | 6 |
| `/product-category/features/` | 6 |
| `/product/custom-holographic-stickers/` | 4 |
| `/product-category/usage/` | 3 |
| `/product-category/shape-size/` | 3 |
| `/product/outdoor-stickers/` | 3 |
| `/product/glow-in-the-dark-stickers/` | 3 |
| `/product/custom-packaging-labels/` | 2 |
| `/product/custom-large-stickers/` | 2 |
| `/product/custom-reusable-stickers/` | 2 |
| `/product/waterproof-stickers/` | 2 |
| `/product/custom-metallic-stickers/` | 1 |
| `/product/custom-clear-stickers/` | 1 |
| `/product/custom-small-stickers/` | 1 |
| `/product/custom-vinyl-stickers/` | 1 |
| `/product/custom-car-stickers/` | 1 |
| `/product/die-cut-labels/` | 1 |
| `/product/custom-eco-friendly-stickers/` | 1 |
| `/product/reflective-stickers/` | 1 |
| `/product/die-cut-decals/` | 1 |
| `/product-category/sticker-types/` | 1 |
| `/product/glossy-stickers/` | 1 |
| `/product/custom-promotional-stickers/` | 1 |

## Pages with no incoming contextual link

These are not orphans — each is linked from the main navigation, the product index
and its category grid. They are listed for completeness.

- `/about-us/`
- `/contact-us/`
- `/privacy-policy/`
- `/product/custom-window-stickers/`
- `/product/die-cut-car-stickers/`
- `/product/die-cut-clear-stickers/`
- `/product/die-cut-logo-stickers/`
- `/product/die-cut-paper-stickers/`
- `/product/die-cut-vinyl-stickers/`
- `/product/die-cut-water-proof-stickers/`
- `/product/holographic-die-cut-stickers/`
- `/product/indoor-stickers/`
- `/product/large-die-cut-stickers/`
- `/product/matte-stickers/`
- `/products/`
- `/products/page/2/`
- `/refund_returns/`
- `/terms-conditions/`
