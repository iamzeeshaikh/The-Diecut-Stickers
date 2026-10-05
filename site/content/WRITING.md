# Product page writing brief — thediecutstickers.com

You are writing the copy for ONE JSON file per product in `src/data/product-content/<slug>.json`.
The site is a US custom sticker printer (Phoenix, AZ). Buyers are small businesses, brands,
makers, event organisers and fleet owners. Write for them.

## Canonical facts (never contradict; never invent others)
- Price: from $0.30 per sticker (depends on size, quantity, material).
- Minimum order: 100 stickers. (Never say "no minimum".)
- Production: 5–7 business days after proof approval. Delivery within 8–10 business days. Rush on request.
- Shipping: free within the United States, FedEx.
- Free digital proof before printing; free design support.
- Finishes: Gloss, Matte, Spot UV. Lamination available. Adhesive: permanent or removable.
- Printing: full-color CMYK, Pantone matching; offset or digital depending on run length.
- Sizes: from 0.5" up to 24" x 36". Any shape (die cut to the artwork outline, kiss cut on sheets, rolls).
- Artwork: PDF, AI, EPS, SVG, PNG or JPG; 300 dpi or vector.
- Returns: 10 days by mail per the site policy (defective reprints at no charge).
- Materials offered: white vinyl, clear vinyl, holographic film, metallic/foil vinyl, reflective vinyl,
  glow-in-the-dark vinyl, matte/gloss paper, kraft paper, BOPP, polyester (PET), recyclable paper,
  biodegradable film. Do NOT claim certifications (FSC, ISO, compostable certs) unless already on the page.
- No testimonials, no statistics, no customer names, no competitor names.

## JSON schema (exact keys)
{
  "slug": "...",
  "name": "...",                      // display name; use "Die Cut" (two words, no hyphen) everywhere
  "seoTitle": "...",                  // 48–62 chars. Primary keyword first. May end " | The Die Cut Stickers" if it fits.
  "seoDescription": "...",            // 130–158 chars. Specific to this product, answers the search intent, no price, no "!" spam.
  "h1": "...",                        // normally the name; may add "Custom" if the primary keyword has it.
  "tagline": "...",                   // one plain sentence under the H1, max 20 words, concrete.
  "quickAnswer": "...",               // 45–70 words. A direct definition: what it is, what it's made of, who it suits, from $0.30, 5–7 day production. Written so an AI assistant could quote it verbatim.
  "highlights": ["Material: ...", "Finish: ...", "Minimum: 100 stickers", "Production: 5–7 business days"],   // exactly 4, each ≤ 7 words after the label
  "sections": [ { "h2": "...", "html": "<p>...</p>" } ],   // 5–6 sections, 750–1,100 words TOTAL across sections
  "specs": [ ["Material", "..."], ["Finish", "..."], ... ], // 9–12 rows, specific to this product
  "faqs": [ { "q": "...", "a": "..." } ]                    // 12 FAQs, answers 35–70 words, plain text, no HTML
}

## Section requirements
- Section 1: what this product is good for and how it differs from its nearest sibling (named).
- Exactly ONE section contains a comparison/decision `<table>` (3–5 columns, 3–6 rows, `<thead>` + `<tbody>`), e.g. material vs lifespan vs best use; or sizes vs typical use.
- Exactly ONE section contains an `<ol>` (numbered steps: how to order / how to apply / how to choose).
- At least ONE section contains a `<ul>` with 4–6 concrete bullets.
- Headings: specific and natural ("Where waterproof vinyl beats coated paper"), never "Why choose us", "Call to action", "Explore more", "Benefits of", "Everything you need", "X, Answered".
- Allowed HTML: p, h3, ul, ol, li, table, thead, tbody, tr, th, td, strong, em, a.

## Internal links — STRICT
- Max ONE `<a href>` per section (per h2 block). Some sections have none.
- Anchor text 3–8 words that describe the destination page ("our custom clear sticker range", "the waterproof die cut sticker page"). Never "click here", "learn more", "read more", "here", "explore", "discover", "view", "see more", "shop now".
- The link sits inside a sentence that still reads well without it. Never a sentence invented just to hold a link.
- Only these destinations exist (trailing slash required):
  /  /products/  /get-a-quote/  /contact-us/  /about-us/  /blog/
  /product-category/by-material/  /product-category/features/  /product-category/shape-size/  /product-category/sticker-types/  /product-category/usage/
  /product/<any slug from the list below>/
  /blog/matte-vs-glossy-stickers-which-finish-to-choose/  /blog/how-long-do-outdoor-stickers-last/
  /blog/eco-friendly-and-biodegradable-sticker-materials/  /blog/die-cut-stickers-vs-decals-vs-labels/
  /blog/custom-sticker-sizes-from-mini-to-large-format/
- Each product has REQUIRED link targets (listed in the assignment). Every required target must appear at least once in `sections`. Add 1–2 more only where genuinely useful. Total links per product: 3–5.

## FAQs
- 12 per product. Every question must name the product or a detail unique to it, so no question repeats on another page. Banned generic questions: "What is the minimum order quantity?", "Do you offer free design?", "How long does shipping take?", "Can I order samples?", "What printing methods do you use?", "Do you offer bulk discounts?", "What coating options...?". Fold those facts into product-specific questions instead ("How many waterproof stickers do I have to order?").
- Use the listed Search Console queries as questions where they fit (e.g. "Are die cut stickers waterproof?").
- Answers: direct first sentence, then one or two specifics. 35–70 words.

## Voice
- US spelling (color, customize, gray, catalog, aluminum). Second person. Plain words. Varied sentence length.
- Concrete: surfaces, weather, sizes in inches, use cases, decisions a buyer faces, trade-offs, what to avoid.
- Banned words/phrases: elevate, unlock, seamless, robust, delve, game-changer, look no further, in today's, fast-paced, whether you're, endless possibilities, top-notch, high-quality (overused; prefer the specific property), "stand out" more than once, "design tool", "configurator", "vibrant" more than once per page, emoji, em dashes (use commas or full stops).
- Never start a sentence with "Whether". No paragraph may end with a summary sentence restating the paragraph.
- Do not open with "Custom X stickers are ..." on every page; vary openings (a use case, a question a buyer asks, a material fact).

## Product list (slugs → primary keyword → required links → sibling to compare)
See ASSIGNMENTS.md.
