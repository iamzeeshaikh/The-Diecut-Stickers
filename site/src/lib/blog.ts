/**
 * Blog post loader.
 *
 * Posts are markdown files in src/data/blog/; the filename (minus .md) is the
 * slug. Sorted newest first so the listing, the sitemap and the "related
 * reading" block all agree on order.
 *
 * `image` in the frontmatter is a bare filename resolved through lib/images.ts,
 * which only sees media that passed the security scan in tools/media.py. A post
 * can therefore never reference a file from the compromised WordPress media
 * library, even by accident.
 */
import type { ImageMetadata } from 'astro';
import { resolveImage } from './images';

export interface BlogFrontmatter {
  title: string;
  metaTitle: string;
  metaDescription: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Filename under src/assets/img. */
  image: string;
  imageAlt: string;
  excerpt: string;
}

interface BlogPostModule {
  frontmatter: BlogFrontmatter;
  Content: unknown;
}

const files = import.meta.glob<BlogPostModule>('../data/blog/*.md', { eager: true });

export interface BlogPost extends BlogFrontmatter {
  slug: string;
  url: string;
  hero: ImageMetadata;
  Content: unknown;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[blog] ${message}`);
}

export const BLOG_POSTS: BlogPost[] = Object.entries(files)
  .map(([path, mod]) => {
    const slug = path.split('/').pop()!.replace(/\.md$/, '');
    const fm = mod.frontmatter;

    assert(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug), `invalid slug: ${slug}`);
    assert(fm?.title?.trim(), `post ${slug} has no title`);
    assert(fm.metaTitle?.trim(), `post ${slug} has no metaTitle`);
    assert(fm.metaDescription?.trim(), `post ${slug} has no metaDescription`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(fm.date ?? ''), `post ${slug} has no valid date`);
    assert(fm.imageAlt?.trim(), `post ${slug} has no imageAlt`);

    const hero = resolveImage(fm.image);
    assert(hero, `post ${slug} references unscanned image: ${fm.image}`);

    return { slug, url: `/blog/${slug}/`, ...fm, hero, Content: mod.Content };
  })
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));

const seen = new Set<string>();
for (const p of BLOG_POSTS) {
  assert(!seen.has(p.metaTitle), `duplicate blog SEO title: ${p.metaTitle}`);
  seen.add(p.metaTitle);
}

/** Long-form US date, rendered the same way everywhere. */
export function formatPostDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
