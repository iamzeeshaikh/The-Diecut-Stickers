/**
 * Typed access to the migrated catalogue.
 *
 * The JSON is produced by tools/extract.py from the WooCommerce CSV and the
 * WordPress XML. It is validated at build time so a malformed record fails the
 * build rather than shipping a broken page.
 */
import productsRaw from '../data/products.json';
import categoriesRaw from '../data/categories.json';

export interface Faq {
  q: string;
  a: string;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  sku: string;
  category: string;
  categorySlug: string;
  price: string | null;
  shortDescription: string;
  description: string;
  specifications: string;
  faqs: Faq[];
  images: string[];
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  order: number;
}

export const products = productsRaw as Product[];
export const categories = categoriesRaw as Category[];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[catalogue] ${message}`);
}

const seenSlugs = new Set<string>();
const seenTitles = new Set<string>();
for (const p of products) {
  assert(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug), `invalid slug: ${p.slug}`);
  assert(!seenSlugs.has(p.slug), `duplicate product slug: ${p.slug}`);
  seenSlugs.add(p.slug);
  assert(p.name.trim().length > 0, `product ${p.slug} has no name`);
  assert(p.images.length > 0, `product ${p.slug} has no images`);
  assert(p.seoTitle.trim().length > 0, `product ${p.slug} has no SEO title`);
  assert(p.seoDescription.trim().length > 0, `product ${p.slug} has no meta description`);
  assert(!seenTitles.has(p.seoTitle), `duplicate SEO title: ${p.seoTitle}`);
  seenTitles.add(p.seoTitle);
  assert(
    categories.some((c) => c.slug === p.categorySlug),
    `product ${p.slug} references unknown category ${p.categorySlug}`,
  );
}

export function productsInCategory(slug: string): Product[] {
  return products.filter((p) => p.categorySlug === slug);
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

/**
 * Related products: same category first, then the nearest siblings by shared
 * words in the name, so every product gets a meaningful set without falling
 * back to a mechanical reciprocal pairing.
 */
export function relatedProducts(product: Product, limit = 4): Product[] {
  const sameCat = products.filter(
    (p) => p.slug !== product.slug && p.categorySlug === product.categorySlug,
  );
  if (sameCat.length >= limit) return sameCat.slice(0, limit);

  const words = new Set(
    product.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
  );
  const scored = products
    .filter((p) => p.slug !== product.slug && !sameCat.includes(p))
    .map((p) => ({
      p,
      score: p.name
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => words.has(w)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.p);

  return [...sameCat, ...scored].slice(0, limit);
}

/** Product image filenames map to the vetted files in src/assets/img. */
export function imageFile(url: string): string {
  return url.replace(/^.*\//, '').replace(/[^A-Za-z0-9._-]/g, '-');
}
