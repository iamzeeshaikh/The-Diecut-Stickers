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
  redirects: {
    // Retired WooCommerce transactional pages -> the quote path. One hop only.
    '/cart/': { status: 301, destination: '/contact-us/' },
    '/checkout/': { status: 301, destination: '/contact-us/' },
    '/my-account/': { status: 301, destination: '/contact-us/' },
    // Empty duplicate of the homepage.
    '/main-page/': { status: 301, destination: '/' },
  },
});
