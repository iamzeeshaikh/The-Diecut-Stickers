/**
 * Category hub copy: one JSON per category in src/data/category-content.
 * Loaded eagerly so a missing or malformed file fails the build.
 */
import type { Faq } from './catalogue';

export interface ContentSection {
  h2: string;
  html: string;
}

export interface CategoryContent {
  slug: string;
  navLabel: string;
  name: string;
  h1: string;
  seoTitle: string;
  seoDescription: string;
  tagline: string;
  quickAnswer: string;
  sections: ContentSection[];
  faqs: Faq[];
}

const modules = import.meta.glob<{ default: CategoryContent }>('/src/data/category-content/*.json', {
  eager: true,
});

const bySlug = new Map<string, CategoryContent>();
for (const mod of Object.values(modules)) bySlug.set(mod.default.slug, mod.default);

export function categoryMeta(slug: string): CategoryContent {
  const c = bySlug.get(slug);
  if (!c) throw new Error(`[category-content] no content file for category "${slug}"`);
  if (c.faqs.length < 10) throw new Error(`[category-content] ${slug} has ${c.faqs.length} FAQs (need 10)`);
  return c;
}
