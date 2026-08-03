import type { APIRoute } from 'astro';
import { products, categories } from '../lib/catalogue';
import { absoluteUrl } from '../lib/site';

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
    ...categories.map((c) => ({
      loc: absoluteUrl(`/product-category/${c.slug}/`),
      priority: '0.8',
    })),
    ...products.map((p) => ({ loc: absoluteUrl(`/product/${p.slug}/`), priority: '0.8' })),
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
