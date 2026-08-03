/**
 * Canonical site configuration.
 *
 * PRODUCTION_ORIGIN is the only origin ever emitted in canonicals, schema,
 * Open Graph tags or the sitemap. Preview deployments must never leak their
 * own hostname into any of those, so nothing here reads from Vercel's
 * per-deployment URL variables.
 */
export const PRODUCTION_ORIGIN = 'https://thediecutstickers.com';

export const SITE = {
  name: 'The Die Cut Stickers',
  legalName: 'The Die Cut Stickers',
  tagline: 'Stickers That Stick Out',
  email: 'info@thediecutstickers.com',
  phone: '+1-929-2141-874',
  phoneHref: '+19292141874',
  phoneDisplay: '929-2141-874',
  address: {
    street: '3409 N 7th Ave Unit #529',
    locality: 'Phoenix',
    region: 'AZ',
    postalCode: '85013',
    country: 'US',
  },
  addressLine: '3409 N 7th Ave Unit #529 Phoenix, AZ 85013',
  copyright: 'Copyright © The Diecut Stickers by TDCS',
  social: {
    facebook: 'https://www.facebook.com/',
    linkedin: 'https://www.linkedin.com/',
  },
} as const;

/**
 * Indexability is an explicit, auditable opt-in: a build is only treated as
 * production when PUBLIC_SITE_ENV is set to "production".
 *
 * Deliberately NOT keyed off Vercel's own VERCEL_ENV. A first deploy of a new
 * project, or any deploy promoted to the production target, sets
 * VERCEL_ENV=production while still being served from a *.vercel.app hostname —
 * which would make a staging copy indexable and create duplicate content
 * against the real domain. Requiring the flag means a build can only become
 * indexable when someone intends it.
 */
export const IS_PREVIEW = process.env.PUBLIC_SITE_ENV !== 'production';

export function absoluteUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${PRODUCTION_ORIGIN}${p}`;
}
