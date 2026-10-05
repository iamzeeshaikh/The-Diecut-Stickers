/**
 * Rewritten product copy (2026-10): one JSON per product in
 * src/data/product-content, validated by scripts/check-product-content.mjs.
 * Products without a file fall back to the migrated WordPress copy so a
 * half-finished rewrite never blanks a page.
 */
import type { Faq, Product } from './catalogue';
import type { ContentSection } from './category-content';

export interface ProductContent {
  slug: string;
  name: string;
  seoTitle: string;
  seoDescription: string;
  h1: string;
  tagline: string;
  quickAnswer: string;
  highlights: string[];
  sections: ContentSection[];
  specs: [string, string][];
  faqs: Faq[];
}

const modules = import.meta.glob<{ default: ProductContent }>('/src/data/product-content/*.json', {
  eager: true,
});

const bySlug = new Map<string, ProductContent>();
for (const mod of Object.values(modules)) bySlug.set(mod.default.slug, mod.default);

export function productContent(slug: string): ProductContent | undefined {
  return bySlug.get(slug);
}

/** Display name: the rewritten name when present, else the catalogue name. */
export function displayName(p: Product): string {
  return bySlug.get(p.slug)?.name ?? p.name;
}

export function hasRewrite(slug: string): boolean {
  return bySlug.has(slug);
}
