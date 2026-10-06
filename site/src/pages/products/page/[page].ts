import type { APIRoute } from 'astro';

/**
 * The archive used to paginate at 16 per page; all 29 products now sit on one
 * page, so /products/page/N/ sends a single 301 to /products/.
 */
export const prerender = false;

export const GET: APIRoute = () =>
  new Response(null, {
    status: 301,
    headers: { location: '/products/', 'cache-control': 'public, max-age=3600' },
  });
