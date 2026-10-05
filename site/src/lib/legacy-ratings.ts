/**
 * Rating schema carried over from the old WordPress site.
 *
 * Every product page on the WordPress build published an `aggregateRating` and
 * one `Review` in its Product JSON-LD, and each category archive listed its
 * products with the same rating. The migration dropped them, and with them the
 * site's review-snippet impressions. The owner's rule is that a migration is
 * like-for-like: no rating the old site did not publish is ever added, and none
 * it did publish is taken away. So `src/data/legacy-ratings.json` holds each
 * product's rating exactly as the old page emitted it (recovered from Wayback
 * snapshots taken before the 2026-08-03 cutover, source URL per entry), and
 * these helpers merge it back in. Restored 2026-10-05. Products created after
 * the migration have no entry and get no rating.
 */
import LEGACY from '../data/legacy-ratings.json';

type LegacyRating = { aggregateRating: unknown; review: unknown };

export function legacyRating(slug: string): Partial<LegacyRating> {
  const r = (LEGACY as unknown as Record<string, LegacyRating | string>)[slug];
  return r && typeof r === 'object' ? { aggregateRating: r.aggregateRating, review: r.review } : {};
}
