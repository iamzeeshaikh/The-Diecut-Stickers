import type { APIRoute } from 'astro';

/**
 * WooCommerce cart retired on a quote-only site.
 * A single 301 hop to the closest equivalent page — no chains, no loops.
 */
export const prerender = false;

export const GET: APIRoute = () =>
  new Response(null, {
    status: 301,
    headers: { location: '/contact-us/', 'cache-control': 'public, max-age=3600' },
  });
