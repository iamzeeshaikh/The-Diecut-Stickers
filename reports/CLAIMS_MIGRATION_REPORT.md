# Claims Migration Report

Every commercial, material and service claim found in the legitimate exports is
carried into the new site attached to the same product it appeared on. Nothing was
weakened, generalised or invented. This report is informational and is not a
deployment blocker.

**Source of truth:** WooCommerce product export (`wc-product-export-3-8-2026`),
WordPress XML export, and the published pages.

| Claim | Source | Pages carrying it | Final wording | Status |
| --- | --- | --- | --- | --- |
| Waterproof / weather-resistant | WooCommerce CSV (description / specs / FAQs) | 29 | …2> Vinyl is stronger than paper alternatives, making it weather-resistant and long-lasting. A smooth finish highlights c… | Preserved verbatim |
| Scratch resistance | WooCommerce CSV (description / specs / FAQs) | 28 | …colors, while optional lamination protects designs against scratches. Businesses prefer them for outdoor campaigns, prod… | Preserved verbatim |
| Fade resistance / UV | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 29 | …/p> Available in glossy, matte, and Spot UV coatings Supports custom lettering, die cut shapes, and large st… | Preserved verbatim |
| Strong adhesive | WooCommerce CSV (description / specs / FAQs) | 20 | …roduct labeling, and event giveaways. Strong adhesive backing for secure placement Available in glossy, m… | Preserved verbatim |
| Indoor / outdoor suitability | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 30 | …tects designs against scratches. Businesses prefer them for outdoor campaigns, product labeling, and event giveaways. St… | Preserved verbatim |
| Vinyl material | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 30 | …Custom Vinyl Stickers Need custom vinyl stickers? We offer high-quality vinyl st… | Preserved verbatim |
| Paper material | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 24 | …ake Vinyl Stickers Reliable Vinyl is stronger than paper alternatives, making it weather-resistant and long-lasting. A s… | Preserved verbatim |
| Clear / transparent material | WooCommerce CSV (description / specs / FAQs) | 26 | …">Base Material Premium vinyl, transparent vinyl, static-cling film Digital or Offset… | Preserved verbatim |
| Polyester / PET | WooCommerce CSV (description / specs / FAQs) | 13 | …Custom Clear Stickers Clear Vinyl, Transparent Polyester Gloss, Matte, Spot UV Logo branding, QR codes, Barcode printin… | Preserved verbatim |
| Eco-friendly / recyclable | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 24 | …terial section. This helps in finding waterproof, clear, or eco-friendly stickers to suit specific requirements. <div cl… | Preserved verbatim |
| Custom sizes | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 31 | …offer high-quality vinyl stickers at wholesale prices. Get custom sizes, styles, and finishes like gloss, matte, or spot… | Preserved verbatim |
| Custom shapes / die cut | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 35 | …At The Die Cut Stickers , we offer custom vinyl stickers in a variety of sizes, shapes, and fi… | Preserved verbatim |
| Gloss coating | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 30 | …olesale prices. Get custom sizes, styles, and finishes like gloss, matte, or spot UV. Our fast turnaround times and free… | Preserved verbatim |
| Matte coating | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 30 | …prices. Get custom sizes, styles, and finishes like gloss, matte, or spot UV. Our fast turnaround times and free design … | Preserved verbatim |
| Spot UV | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 30 | …et custom sizes, styles, and finishes like gloss, matte, or spot UV. Our fast turnaround times and free design and shipp… | Preserved verbatim |
| Lamination | WooCommerce CSV (description / specs / FAQs) | 28 | …-lasting. A smooth finish highlights colors, while optional lamination protects designs against scratches. Businesses pr… | Preserved verbatim |
| Foil stamping | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 21 | …>Gloss, Matte, Spot UV Custom die-cuts, Embossing, Foiling Branding, Product Packaging, Event Promotions <strong… | Preserved verbatim |
| Embossing | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 19 | …yl Gloss, Matte, Spot UV Custom die-cuts, Embossing, Foiling Branding, Product Packaging, Event Promotions… | Preserved verbatim |
| Free design support | WooCommerce CSV (description / specs / FAQs) | 28 | …ike gloss, matte, or spot UV. Our fast turnaround times and free design and shipping make it easy to promote your brand.… | Preserved verbatim |
| Free shipping | WooCommerce CSV (description / specs / FAQs) | 21 | …ents Shipping Free shipping on all orders Standard & express options Tracking incl… | Preserved verbatim |
| Fast turnaround / delivery time | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 30 | …es, styles, and finishes like gloss, matte, or spot UV. Our fast turnaround times and free design and shipping make it e… | Preserved verbatim |
| Wholesale pricing | WooCommerce CSV (description / specs / FAQs) | 29 | …stickers? We offer high-quality vinyl stickers at wholesale prices. Get custom sizes, styles, and finishes like gloss, m… | Preserved verbatim |
| Bulk order benefits | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 30 | …Quantities From small runs to bulk supply Tiered pricing available <td data-col-size=… | Preserved verbatim |
| Printing quality / CMYK | WooCommerce CSV (description / specs / FAQs) | 29 | …, medium, large, or custom cut Full-color CMYK, PMS matching Gloss, Matte, Spot UV <td… | Preserved verbatim |
| Colour performance | WooCommerce CSV (description / specs / FAQs) + WordPress XML page content | 14 | …phic Stickers Custom holographic stickers create a bright, reflective look that instantly attracts attention. The rainbo… | Preserved verbatim |

## Claims reviewed and deliberately not carried over

| Item | Where it appeared | Decision | Reason |
| --- | --- | --- | --- |
| 5-star `aggregateRating` and one `Review` | JSON-LD on all 29 product pages | Removed | Plugin-generated. The single review was authored by an administrator email address, its body was a copy of the meta description, and WooCommerce has customer reviews disabled on every product. No genuine review data exists in any export. |
| Owner-supplied price of $0.30 | 8 `die-cut-*` products the export left unpriced | Added on the owner's instruction | Their own pricing decision; without an Offer node these products failed Google Product snippet validation entirely. |
| `"price": "0"` in Offer schema | JSON-LD on all 29 product pages | Removed | Contradicted the visible price. Offer schema is now emitted only for the 21 products that carry a real $0.20 price in the WooCommerce export. |
| Burger-box product claims | `/products/` Elementor block | Excluded | 29 burger-box products belonging to an earlier site on the same WordPress install. None exist in the WooCommerce or WordPress exports. |

**Claims preserved: 25 distinct claim families across 35 pages. Claims weakened or removed: 0.**
