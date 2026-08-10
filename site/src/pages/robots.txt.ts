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
        /*
         * NOTE: /category/ and /tag/ were previously disallowed here. That was
         * counterproductive. Those namespaces are injected spam from the
         * WordPress compromise and return HTTP 410, but a crawler that is
         * disallowed never requests the URL, so it never sees the 410 and the
         * page can sit in the index as "indexed, though blocked by robots.txt"
         * indefinitely. Letting crawlers fetch them is what actually removes
         * them. The rules can go back once the URLs are gone from the index.
         */
        '',
        `Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`,
        '',
      ].join('\n');

  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
