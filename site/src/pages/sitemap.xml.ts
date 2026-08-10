import type { APIRoute } from 'astro';
import { products, categories, PRODUCTS_PER_PAGE } from '../lib/catalogue';
import { BLOG_POSTS } from '../lib/blog';
import { absoluteUrl } from '../lib/site';

// Pages two and up of the product archive. Indexable, so they belong here.
const archivePages = Array.from(
  { length: Math.ceil(products.length / PRODUCTS_PER_PAGE) - 1 },
  (_, i) => ({ loc: absoluteUrl(`/products/page/${i + 2}/`), priority: '0.5' }),
);

/**
 * Hand-built so the contents are explicit and auditable.
 *
 * Excluded by design: malware and spam URLs, 404/410 responses, the retired
 * WooCommerce cart/checkout/account pages, /main-page/, the 404 page, the form
 * endpoint, and anything with a query string.
 */
export const GET: APIRoute = () => {
  const urls: Array<{ loc: string; priority: string }> = [
    { loc: absoluteUrl('/'), priority: '1.0' },
    { loc: absoluteUrl('/products/'), priority: '0.9' },
    ...archivePages,
    ...categories.map((c) => ({
      loc: absoluteUrl(`/product-category/${c.slug}/`),
      priority: '0.8',
    })),
    ...products.map((p) => ({ loc: absoluteUrl(`/product/${p.slug}/`), priority: '0.8' })),
    { loc: absoluteUrl('/blog/'), priority: '0.7' },
    ...BLOG_POSTS.map((p) => ({ loc: absoluteUrl(p.url), priority: '0.6' })),
    { loc: absoluteUrl('/about-us/'), priority: '0.5' },
    { loc: absoluteUrl('/contact-us/'), priority: '0.6' },
    { loc: absoluteUrl('/privacy-policy/'), priority: '0.3' },
    { loc: absoluteUrl('/terms-conditions/'), priority: '0.3' },
    { loc: absoluteUrl('/refund_returns/'), priority: '0.3' },
  ];

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${u.loc}</loc>\n    <priority>${u.priority}</priority>\n  </url>`,
      )
      .join('\n') +
    '\n</urlset>\n';

  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
