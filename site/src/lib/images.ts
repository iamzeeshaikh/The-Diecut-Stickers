/**
 * Resolves a migrated image filename to its bundled asset.
 *
 * Every file under src/assets/img passed the security scan in tools/media.py.
 * Anything not present there is unresolvable by design, so a page can never
 * silently fall back to hotlinking the compromised WordPress media library.
 */
import type { ImageMetadata } from 'astro';

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/img/*.{jpg,jpeg,png,webp,gif,JPG,JPEG,PNG,WEBP,GIF}',
  { eager: true },
);

const byName = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(modules)) {
  const name = path.replace(/^.*\//, '');
  // Skip macOS AppleDouble sidecars (._foo.jpg) that leak in from exFAT drives.
  if (name.startsWith('._')) continue;
  byName.set(name, mod.default);
}

/** Accepts either a bare filename or the original WordPress URL. */
export function resolveImage(ref: string): ImageMetadata | undefined {
  const name = ref.replace(/^.*\//, '').replace(/[^A-Za-z0-9._-]/g, '-');
  return byName.get(name);
}

export function hasImage(ref: string): boolean {
  return resolveImage(ref) !== undefined;
}

/**
 * Descriptive alt text derived from the product it belongs to. The source
 * media library carried no alt attributes, so alt is generated from real
 * product data rather than invented or left empty.
 */
export function productAlt(productName: string, index: number, total: number): string {
  if (index === 0) return `${productName} printed by The Die Cut Stickers`;
  if (total <= 2) return `${productName} alternate view`;
  return `${productName} — view ${index + 1} of ${total}`;
}
