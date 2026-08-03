#!/usr/bin/env node
/**
 * Post-build validation for The Die Cut Stickers migration.
 *
 * Runs against the built output in site/.vercel/output/static plus the
 * baseline CSVs, and fails loudly on anything that would damage SEO, leak the
 * preview origin, or carry compromised content into production.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site', '.vercel', 'output', 'static');
const REPORTS = path.join(ROOT, 'reports');
const ORIGIN = 'https://thediecutstickers.com';

const results = [];
const pass = (name, detail = '') => results.push({ ok: true, name, detail });
const fail = (name, detail) => results.push({ ok: false, name, detail });

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

const text = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const attr = (h, re) => {
  const m = h.match(re);
  return m ? m[1] : '';
};

async function main() {
  if (!existsSync(OUT)) {
    console.error('Build output not found. Run `npm run build` in site/ first.');
    process.exit(1);
  }

  const files = await walk(OUT);
  const htmlFiles = files.filter((f) => f.endsWith('.html'));
  const pages = new Map();

  for (const f of htmlFiles) {
    const rel = f.replace(OUT, '').replace(/\/index\.html$/, '/').replace(/\\/g, '/');
    pages.set(rel === '/404.html' ? '/404.html' : rel, await readFile(f, 'utf8'));
  }

  const isNoindex = (html) => /<meta name="robots" content="[^"]*noindex/i.test(html);
  const indexable = [...pages.entries()].filter(
    ([u, h]) => u !== '/404.html' && !isNoindex(h),
  );
  const noindexPages = [...pages.entries()].filter(([u, h]) => u !== '/404.html' && isNoindex(h));

  // ---------------------------------------------------------------- routes
  const productSlugs = JSON.parse(
    await readFile(path.join(ROOT, 'site/src/data/products.json'), 'utf8'),
  ).map((p) => p.slug);
  const catSlugs = JSON.parse(
    await readFile(path.join(ROOT, 'site/src/data/categories.json'), 'utf8'),
  ).map((c) => c.slug);

  const missingProducts = productSlugs.filter((s) => !pages.has(`/product/${s}/`));
  missingProducts.length
    ? fail('every legitimate product is represented', missingProducts.join(', '))
    : pass('every legitimate product is represented', `${productSlugs.length} products`);

  const missingCats = catSlugs.filter((s) => !pages.has(`/product-category/${s}/`));
  missingCats.length
    ? fail('every legitimate category is represented', missingCats.join(', '))
    : pass('every legitimate category is represented', `${catSlugs.length} categories`);

  // Old URL inventory: every legitimate URL is either built or redirected.
  const inv = (await readFile(path.join(REPORTS, 'OLD_URL_INVENTORY.csv'), 'utf8'))
    .split('\n')
    .slice(1)
    .filter(Boolean);
  const redirected = new Set(['/cart/', '/checkout/', '/my-account/', '/main-page/']);
  const unmapped = [];
  for (const line of inv) {
    const m = line.match(/^(https:\/\/thediecutstickers\.com[^,]*)/);
    if (!m) continue;
    const p = m[1].replace(ORIGIN, '') || '/';
    if (!pages.has(p) && !redirected.has(p)) unmapped.push(p);
  }
  unmapped.length
    ? fail('every legitimate old URL is mapped', unmapped.join(', '))
    : pass('every legitimate old URL is mapped', `${inv.length} URLs`);

  // ------------------------------------------------------------ trailing slash
  const badSlash = [...pages.keys()].filter((u) => u !== '/404.html' && !u.endsWith('/'));
  badSlash.length
    ? fail('trailing slashes are correct', badSlash.join(', '))
    : pass('trailing slashes are correct');

  // ------------------------------------------------------------------ titles
  const titles = new Map();
  const descs = new Map();
  const dupT = [];
  const dupD = [];
  for (const [u, h] of indexable) {
    const t = attr(h, /<title>([^<]*)<\/title>/);
    const d = attr(h, /<meta name="description" content="([^"]*)"/);
    if (titles.has(t)) dupT.push(`${u} == ${titles.get(t)}`);
    else titles.set(t, u);
    if (descs.has(d)) dupD.push(`${u} == ${descs.get(d)}`);
    else descs.set(d, u);
  }
  dupT.length ? fail('no duplicate titles', dupT.join('; ')) : pass('no duplicate titles');
  dupD.length
    ? fail('no duplicate meta descriptions', dupD.join('; '))
    : pass('no duplicate meta descriptions');

  const noDesc = indexable.filter(([, h]) => !/<meta name="description" content="[^"]+"/.test(h));
  noDesc.length
    ? fail('every page has a meta description', noDesc.map(([u]) => u).join(', '))
    : pass('every page has a meta description');

  // ---------------------------------------------------------------------- H1
  const h1Problems = [];
  for (const [u, h] of pages) {
    const n = (h.match(/<h1[\s>]/g) || []).length;
    if (n !== 1) h1Problems.push(`${u} has ${n}`);
  }
  h1Problems.length
    ? fail('exactly one H1 per page', h1Problems.join(', '))
    : pass('exactly one H1 per page');

  // --------------------------------------------------------------- canonicals
  const canonProblems = [];
  for (const [u, h] of indexable) {
    const c = attr(h, /rel="canonical" href="([^"]*)"/);
    if (!c) canonProblems.push(`${u}: missing`);
    else if (!c.startsWith(ORIGIN)) canonProblems.push(`${u}: ${c}`);
    else if (c !== ORIGIN + u) canonProblems.push(`${u}: points to ${c}`);
  }
  canonProblems.length
    ? fail('canonicals are self-referencing and on the production origin', canonProblems.join('; '))
    : pass('canonicals are self-referencing and on the production origin');

  // ------------------------------------------------- preview-origin leakage
  const previewHits = [];
  for (const f of files.filter((x) => /\.(html|xml|txt|js|json)$/.test(x))) {
    const c = await readFile(f, 'utf8');
    if (/vercel\.app|localhost:\d+|127\.0\.0\.1/.test(c)) {
      previewHits.push(f.replace(OUT, ''));
    }
  }
  previewHits.length
    ? fail('no preview/localhost origins in output', previewHits.join(', '))
    : pass('no preview/localhost origins in output');

  // ------------------------------------------------------------ malware scan
  const MAL = [
    'serviceWorker', '4a7e6354', 'wp-content/cache', '<?php', 'base64_decode',
    'gzinflate', 'str_rot13', 'shell_exec', 'passthru', 'eval(', 'document.write',
    'casino', 'mostbet', 'test-e-250', 'testosterone', 'insertshub',
  ];
  const malHits = [];
  for (const f of files.filter((x) => /\.(html|xml|txt|js|css|json)$/.test(x))) {
    const c = await readFile(f, 'utf8');
    for (const m of MAL) {
      if (c.includes(m)) {
        // The kill switch legitimately references serviceWorker to unregister it.
        if (m === 'serviceWorker' && c.includes('getRegistrations')) continue;
        malHits.push(`${f.replace(OUT, '')}: ${m}`);
      }
    }
  }
  malHits.length
    ? fail('no malware strings or WordPress PHP in output', malHits.slice(0, 12).join('; '))
    : pass('no malware strings or WordPress PHP in output');

  // --------------------------------------------------------- burger contamination
  // Matches the unrelated legacy CATALOGUE, not incidental vocabulary: stickers
  // are legitimately sold for jars, candles and soaps, so a bare "candle" is
  // fine while "candle boxes" or any burger-box product is not.
  const LEGACY = /burger\s*(?:box|boxes|parcel|patty)|clamshell\s*box|bagasse\s*box|styrofoam\s*box|polystyrene\s*box|candle\s*(?:box|boxes|packaging)|tealight\s*(?:box|candle\s*box)|thecandlepackaging/i;
  const burger = [];
  for (const [u, h] of pages) {
    if (LEGACY.test(text(h))) burger.push(u);
  }
  burger.length
    ? fail('no unrelated legacy catalogue content', burger.join(', '))
    : pass('no unrelated legacy catalogue content');

  // ------------------------------------------------------------ internal links
  const broken = [];
  const selfLinks = [];
  const spamLinks = [];
  let internalCount = 0;
  const known = new Set([...pages.keys()]);
  for (const [u, h] of pages) {
    const body = h.slice(h.indexOf('<body'));
    // Contextual links are judged separately from site chrome: a header or
    // footer link to the current page is normal navigation (and is marked with
    // aria-current), whereas a self-link inside body copy is a defect.
    const mainStart = body.indexOf('<main');
    const mainEnd = body.indexOf('</main>');
    const mainHtml = mainStart >= 0 && mainEnd > mainStart ? body.slice(mainStart, mainEnd) : '';
    for (const m of body.matchAll(/href="([^"]+)"/g)) {
      let href = m[1];
      if (href.startsWith(ORIGIN)) href = href.replace(ORIGIN, '') || '/';
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      const clean = href.split('#')[0].split('?')[0];
      if (!clean) continue;
      internalCount++;
      if (/^\/(category|tag)\//.test(clean) || /burger|test-e-250/i.test(clean)) {
        spamLinks.push(`${u} -> ${clean}`);
      }
      if (clean === u && href === clean && mainHtml.includes(`href="${m[1]}"`)) {
        selfLinks.push(`${u}`);
      }
      const isAsset = /\.(png|jpe?g|webp|gif|svg|css|js|xml|txt|ico)$/.test(clean);
      if (!isAsset && !known.has(clean) && !redirected.has(clean) && !existsSync(path.join(OUT, clean))) {
        broken.push(`${u} -> ${clean}`);
      }
    }
  }
  broken.length
    ? fail('no broken internal links', [...new Set(broken)].slice(0, 12).join('; '))
    : pass('no broken internal links', `${internalCount} internal hrefs checked`);
  selfLinks.length
    ? fail('no self-links', [...new Set(selfLinks)].join(', '))
    : pass('no self-links');
  spamLinks.length
    ? fail('no links to malware or excluded pages', [...new Set(spamLinks)].slice(0, 8).join('; '))
    : pass('no links to malware or excluded pages');

  // ------------------------------------------------------------------ sitemap
  const sitemap = await readFile(path.join(OUT, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const badLocs = locs.filter(
    (l) =>
      !l.startsWith(ORIGIN) ||
      /\/(category|tag)\//.test(l) ||
      /burger|test-e-250|\?/.test(l) ||
      /\/(cart|checkout|my-account|main-page|404)\//.test(l),
  );
  badLocs.length
    ? fail('sitemap excludes spam, redirects and query URLs', badLocs.join(', '))
    : pass('sitemap excludes spam, redirects and query URLs', `${locs.length} URLs`);

  const notBuilt = locs.filter((l) => !pages.has(l.replace(ORIGIN, '')));
  notBuilt.length
    ? fail('every sitemap URL exists', notBuilt.join(', '))
    : pass('every sitemap URL exists');

  const missingFromSitemap = indexable
    .map(([u]) => u)
    .filter((u) => !locs.includes(ORIGIN + u));
  missingFromSitemap.length
    ? fail('every indexable page is in the sitemap', missingFromSitemap.join(', '))
    : pass('every indexable page is in the sitemap');

  // ------------------------------------------------------------- orphan pages
  const linkedTo = new Set();
  for (const [, h] of pages) {
    const body = h.slice(h.indexOf('<body'));
    for (const m of body.matchAll(/href="([^"]+)"/g)) {
      let href = m[1].startsWith(ORIGIN) ? m[1].replace(ORIGIN, '') : m[1];
      linkedTo.add(href.split('#')[0].split('?')[0]);
    }
  }
  // Intentionally noindex pages (the thank-you confirmation) are reached by
  // redirect after a POST, so having no inbound link is expected.
  const orphans = indexable.map(([u]) => u).filter((u) => u !== '/' && !linkedTo.has(u));
  orphans.length
    ? fail('no orphan indexable pages', orphans.join(', '))
    : pass('no orphan indexable pages');

  // ------------------------------------------------------------- FAQ parity
  const products = JSON.parse(
    await readFile(path.join(ROOT, 'site/src/data/products.json'), 'utf8'),
  );
  const faqMismatch = [];
  for (const p of products) {
    const h = pages.get(`/product/${p.slug}/`);
    if (!h) continue;
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((m) => JSON.parse(m[1]))
      .find((o) => o['@type'] === 'FAQPage');
    if (!p.faqs.length) continue;
    if (!ld) {
      faqMismatch.push(`${p.slug}: no FAQPage schema`);
      continue;
    }
    if (ld.mainEntity.length !== p.faqs.length) {
      faqMismatch.push(`${p.slug}: ${ld.mainEntity.length} vs ${p.faqs.length}`);
      continue;
    }
    const visible = text(h);
    for (const q of ld.mainEntity) {
      const needle = q.name.replace(/\s+/g, ' ').replace(/\?$/, '');
      if (!visible.includes(needle.slice(0, 60))) {
        faqMismatch.push(`${p.slug}: "${needle.slice(0, 40)}" not visible`);
        break;
      }
    }
  }
  faqMismatch.length
    ? fail('FAQ visible/schema parity', faqMismatch.slice(0, 6).join('; '))
    : pass('FAQ visible/schema parity', `${products.length} products`);

  // ------------------------------------------------------- product schema truth
  const schemaProblems = [];
  for (const p of products) {
    const h = pages.get(`/product/${p.slug}/`);
    if (!h) continue;
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((m) => JSON.parse(m[1]))
      .find((o) => o['@type'] === 'Product');
    if (!ld) {
      schemaProblems.push(`${p.slug}: missing Product schema`);
      continue;
    }
    if (ld.name !== p.name) schemaProblems.push(`${p.slug}: name mismatch`);
    if (ld.aggregateRating || ld.review) schemaProblems.push(`${p.slug}: fabricated rating/review`);
    if (p.price && !ld.offers) schemaProblems.push(`${p.slug}: priced product without Offer`);
    if (!p.price && ld.offers) schemaProblems.push(`${p.slug}: invented Offer`);
    if (ld.offers && ld.offers.price !== Number(p.price).toFixed(2)) {
      schemaProblems.push(`${p.slug}: price mismatch`);
    }
  }
  schemaProblems.length
    ? fail('product schema matches visible content', schemaProblems.slice(0, 8).join('; '))
    : pass('product schema matches visible content');

  // ------------------------------------------------------------- robots.txt
  const robots = await readFile(path.join(OUT, 'robots.txt'), 'utf8');
  const robotsOk =
    robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`) &&
    robots.includes('Disallow: /category/') &&
    robots.includes('Disallow: /tag/') &&
    !/vercel\.app/.test(robots);
  robotsOk ? pass('robots.txt is correct') : fail('robots.txt is correct', robots.slice(0, 200));

  // ------------------------------------------------------------- indexability
  const robotsMeta = [];
  for (const [u, h] of indexable) {
    const r = attr(h, /<meta name="robots" content="([^"]*)"/);
    if (!r.includes('index') || r.includes('noindex')) robotsMeta.push(`${u}: ${r}`);
  }
  robotsMeta.length
    ? fail('production pages are indexable', robotsMeta.slice(0, 6).join('; '))
    : pass('production pages are indexable');

  const notFound = pages.get('/404.html');
  notFound && /noindex/.test(notFound)
    ? pass('custom 404 exists and is noindex')
    : fail('custom 404 exists and is noindex', 'missing or indexable');

  // Noindex pages must stay out of the sitemap.
  const leaked = noindexPages
    .map(([u]) => u)
    .filter((u) => sitemap.includes(ORIGIN + u));
  leaked.length
    ? fail('noindex pages are absent from the sitemap', leaked.join(', '))
    : pass('noindex pages are absent from the sitemap',
           noindexPages.map(([u]) => u).join(', ') || 'none');

  // ------------------------------------------------- retired contact details
  // The business phone number changed; the old one must not survive anywhere,
  // including inside migrated body copy and tel: links.
  const OLD_PHONE = /\+?1?[\s.\-]?\(?929\)?[\s.\-]?2141[\s.\-]?874/;
  const stalePhone = [];
  for (const f of files.filter((x) => /\.(html|xml|txt|js|json)$/.test(x))) {
    const c = await readFile(f, 'utf8');
    if (OLD_PHONE.test(c)) stalePhone.push(f.replace(OUT, ''));
  }
  stalePhone.length
    ? fail('retired phone number is absent', stalePhone.slice(0, 8).join(', '))
    : pass('retired phone number is absent');

  // And the current one must actually be reachable.
  const NEW_PHONE = 'tel:+15033580443';
  const missingPhone = [...pages.entries()].filter(([, h]) => !h.includes(NEW_PHONE));
  missingPhone.length
    ? fail('current phone number is present sitewide', missingPhone.map(([u]) => u).slice(0, 6).join(', '))
    : pass('current phone number is present sitewide');

  // ------------------------------------------------------------ mixed content
  const mixed = [];
  for (const [u, h] of pages) {
    if (/(?:src|href)="http:\/\/(?!localhost)/.test(h)) mixed.push(u);
  }
  mixed.length ? fail('no mixed content', mixed.join(', ')) : pass('no mixed content');

  // -------------------------------------------------------- secrets in bundles
  const secretPat = /(SMTP_PASS|SMTP_USER|SMTP_HOST|password['"]?\s*[:=]\s*['"][^'"]{6,})/;
  const leaks = [];
  for (const f of files.filter((x) => /\.(js|html|css|json)$/.test(x))) {
    const c = await readFile(f, 'utf8');
    if (secretPat.test(c)) leaks.push(f.replace(OUT, ''));
  }
  leaks.length
    ? fail('no secrets in client bundles', leaks.join(', '))
    : pass('no secrets in client bundles');

  // ------------------------------------------------- images have dimensions
  const noDims = [];
  for (const [u, h] of pages) {
    for (const m of h.matchAll(/<img\b([^>]*)>/g)) {
      const tag = m[1];
      if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) {
        noDims.push(`${u}: ${tag.slice(0, 70)}`);
      }
    }
  }
  noDims.length
    ? fail('all images have explicit dimensions', noDims.slice(0, 6).join('; '))
    : pass('all images have explicit dimensions');

  // --------------------------------------------------------- duplicate copy
  const paraCount = new Map();
  for (const [u, h] of pages) {
    for (const m of h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
      const t = text(m[1]);
      if (t.length < 160) continue;
      if (!paraCount.has(t)) paraCount.set(t, new Set());
      paraCount.get(t).add(u);
    }
  }
  const repeated = [...paraCount.entries()].filter(([, us]) => us.size > 1);
  repeated.length
    ? fail(
        'no large paragraphs repeated across pages',
        repeated.slice(0, 3).map(([t, us]) => `${[...us].join('/')}: "${t.slice(0, 50)}"`).join('; '),
      )
    : pass('no large paragraphs repeated across pages');

  // ------------------------------------------------------------------ report
  const failed = results.filter((r) => !r.ok);
  const width = Math.max(...results.map((r) => r.name.length));
  console.log('\nValidation results\n' + '='.repeat(width + 12));
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.detail}`);
  }
  console.log('='.repeat(width + 12));
  console.log(`${results.length - failed.length}/${results.length} checks passed\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
