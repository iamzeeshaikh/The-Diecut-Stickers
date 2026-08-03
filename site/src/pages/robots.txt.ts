import type { APIRoute } from 'astro';
import { PRODUCTION_ORIGIN, IS_PREVIEW } from '../lib/site';

/**
 * Preview deployments disallow everything so a staging copy can never be
 * crawled. Production allows crawling and points at the clean sitemap.
 */
export const GET: APIRoute = () => {
  const body = IS_PREVIEW
    ? ['User-agent: *', 'Disallow: /', ''].join('\n')
    : [
        'User-agent: *',
        'Allow: /',
        '',
        '# Injected spam namespaces from the previous WordPress compromise.',
        '# These return HTTP 410; the rules stop crawlers re-requesting them.',
        'Disallow: /category/',
        'Disallow: /tag/',
        '',
        `Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`,
        '',
      ].join('\n');

  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
