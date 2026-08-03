// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

const SITE = 'https://thediecutstickers.com';

export default defineConfig({
  site: SITE,
  // The WordPress site published every URL with a trailing slash. Preserving
  // that exactly is a hard requirement of the migration.
  trailingSlash: 'always',
  build: { format: 'directory' },
  output: 'static',
  adapter: vercel({ imageService: false }),
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
