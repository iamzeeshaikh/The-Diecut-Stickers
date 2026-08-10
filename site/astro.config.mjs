// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

const SITE = 'https://thediecutstickers.com';

/**
 * Namespaces that are permanently dead and must answer 410 for EVERY path
 * under them, including paths ending in a file extension.
 *
 * Why this cannot be an Astro route: `trailingSlash: 'always'` makes the
 * adapter emit every route pattern with a mandatory trailing slash
 * (`^/wp-content(?:/(.*?))?/$`). Vercel's own normalisation adds a trailing
 * slash only when the last path segment has no dot in it, and actively strips
 * one from paths that do. So `/wp-content/uploads/2024/10/Die-Cut-Decals.jpg`
 * can never match an Astro route on this site — it falls through to the 404
 * handler no matter what is placed under src/pages.
 *
 * Google has ~86 of those old media URLs indexed. They return 404 today, which
 * de-indexes eventually; 410 says the removal is permanent. The same namespace
 * also carried the compromise's service-worker dropper
 * (/wp-content/cache/4a7e6354.php — see reports/MALWARE_AUDIT_REPORT.md), and
 * nothing on the rebuilt site is served from it: images are bundled under
 * /_astro/ with content hashes.
 */
const GONE_NAMESPACES = ['^/wp-content/.*$'];

/**
 * Injects the 410 routes into the adapter's Build Output API config.
 *
 * Runs inside `astro build`, so it applies to every build — a CLI deploy, a
 * `vercel build`, or a future git-push deploy — rather than being a manual
 * post-deploy step that would silently stop being applied.
 *
 * The routes are spliced in immediately before the `{"handle":"filesystem"}`
 * marker, which puts them in the initial routing phase — after Vercel's own
 * trailing-slash normalisation, and before anything that could serve 404.html.
 * Nothing real is served from these namespaces, so shadowing a live asset is
 * not a risk.
 *
 * Anchoring on `filesystem`, not on `{"handle":"error"}`: the adapter writes
 * its config during `astro build` and the error handler is appended later by
 * the Vercel CLI, so the error marker is not present yet when this runs.
 *
 * @returns {import('astro').AstroIntegration}
 */
function goneNamespaces() {
  return {
    name: 'gone-namespaces',
    hooks: {
      'astro:build:done': async ({ logger }) => {
        const configPath = fileURLToPath(new URL('.vercel/output/config.json', import.meta.url));

        /** @type {{ routes: any[] }} */
        let config;
        try {
          config = JSON.parse(await readFile(configPath, 'utf8'));
        } catch {
          // The adapter has not written its config yet, or this is not a Vercel
          // build. Fail loudly rather than shipping silent 404s.
          throw new Error(
            `[gone-namespaces] ${configPath} not found. The Vercel adapter must write ` +
              'its config before this integration runs; if the hook order changed, the ' +
              '410 routes for wp-content will be missing.',
          );
        }

        const fsIndex = config.routes.findIndex((r) => r.handle === 'filesystem');
        if (fsIndex === -1) {
          throw new Error(
            '[gone-namespaces] no {"handle":"filesystem"} marker in the Vercel config.',
          );
        }

        const routes = GONE_NAMESPACES.map((src) => ({
          src,
          status: 410,
          dest: '/410/index.html',
          headers: { 'x-robots-tag': 'noindex, nofollow' },
        }));

        config.routes.splice(fsIndex, 0, ...routes);
        await writeFile(configPath, JSON.stringify(config, null, 2));
        logger.info(`injected ${routes.length} permanent-410 route(s): ${GONE_NAMESPACES.join(', ')}`);
      },
    },
  };
}

export default defineConfig({
  site: SITE,
  // The WordPress site published every URL with a trailing slash. Preserving
  // that exactly is a hard requirement of the migration.
  trailingSlash: 'always',
  build: { format: 'directory' },
  output: 'static',
  adapter: vercel({ imageService: false }),
  integrations: [goneNamespaces()],
  image: {
    // Only first-party media that passed the security scan is ever processed.
    remotePatterns: [],
  },
  devToolbar: { enabled: false },
  /*
   * Redirects are NOT declared here. With trailingSlash: 'always' the Vercel
   * adapter emits them as `^/cart$` (no trailing slash), but its own
   * normalisation rule 308s `/cart` to `/cart/` first, so the redirect never
   * matches and the URL 404s. They are implemented as on-demand routes under
   * src/pages instead, which return a genuine 301. See src/lib/gone.ts.
   */
});
