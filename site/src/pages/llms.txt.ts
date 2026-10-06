import type { APIRoute } from 'astro';
import { products, categories, productsInCategory } from '../lib/catalogue';
import { categoryMeta } from '../lib/category-content';
import { productContent, displayName } from '../lib/product-content';
import { BLOG_POSTS } from '../lib/blog';
import { absoluteUrl, SITE } from '../lib/site';
import { FACTS } from '../lib/facts';

/** Plain-text site summary for AI assistants and answer engines. */
export const GET: APIRoute = () => {
  const lines: string[] = [
    `# ${SITE.name}`,
    '',
    `> Custom die cut stickers, decals and labels printed in full color and cut to any shape, from ${SITE.address.locality}, ${SITE.address.region}. From ${FACTS.unitPriceFromLabel} per sticker, minimum ${FACTS.minOrderLabel}, production ${FACTS.productionDays}, delivered in ${FACTS.deliveryDays}. ${FACTS.proof}. ${FACTS.shipping}.`,
    '',
    `Contact: ${SITE.phoneDisplay}, ${SITE.email}, ${SITE.addressLine}.`,
    '',
    '## Key facts',
    `- Materials: white vinyl, clear vinyl, paper and kraft, BOPP, polyester, holographic, metallic, reflective, glow-in-the-dark, recyclable paper, biodegradable film`,
    `- Finishes: ${FACTS.finishes.join(', ')}; laminate for outdoor or washed items`,
    `- Sizes: ${FACTS.minSize} to ${FACTS.maxSize}; die cut, kiss cut sheets or rolls`,
    `- Printing: ${FACTS.printing}`,
    `- Artwork: ${FACTS.artworkFormats}`,
    `- Returns: ${FACTS.returnsDays} days by mail for defects; custom work matching the approved proof is not returnable`,
    '',
    '## Pages',
    `- [All products](${absoluteUrl('/products/')})`,
    `- [Design your custom stickers (quote form)](${absoluteUrl('/get-a-quote/')})`,
    `- [About](${absoluteUrl('/about-us/')})`,
    `- [Contact](${absoluteUrl('/contact-us/')})`,
    '',
  ];
  for (const c of categories) {
    const m = categoryMeta(c.slug);
    lines.push(`## ${m.name}`, `[${m.navLabel}](${absoluteUrl(`/product-category/${c.slug}/`)}): ${m.quickAnswer}`, '');
    for (const p of productsInCategory(c.slug)) {
      const r = productContent(p.slug);
      lines.push(`- [${displayName(p)}](${absoluteUrl(`/product/${p.slug}/`)}): ${r?.quickAnswer ?? p.seoDescription}`);
    }
    lines.push('');
  }
  lines.push('## Guides');
  for (const b of BLOG_POSTS) lines.push(`- [${b.title}](${absoluteUrl(b.url)}): ${b.excerpt}`);
  lines.push('', `Total products: ${products.length}.`, '');
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
