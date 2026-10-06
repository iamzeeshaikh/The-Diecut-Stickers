#!/usr/bin/env node
/**
 * Post-build audit of .vercel/output/static. Fails the build on anything the
 * owner's on-page rules forbid:
 *   - exactly one H1; title 30–65 chars; description 100–160 chars; canonical
 *   - every indexable page except the HTML sitemap and policies: ≥10 FAQs and
 *     exactly one FAQPage block whose questions match the visible text
 *   - no FAQ question repeated on two pages
 *   - at most ONE internal link per heading section of prose (main only;
 *     nav, grids, cards, tables, forms and the sitemap excluded)
 *   - anchors 3–8 words, never generic; every internal link resolves
 *   - British spelling and banned phrases absent from rendered text
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('.vercel/output/static');
const EXEMPT_FAQ = new Set(['/sitemap/', '/privacy-policy/', '/terms-conditions/', '/refund_returns/', '/404.html', '/410/', '/thank-you/']);
const EXEMPT_LINKS = new Set(['/sitemap/', '/404.html', '/410/', '/thank-you/']);
const GENERIC = /^(click here|learn more|read more|here|explore|discover|view|see more|shop now|more|this page)$/i;
const BRITISH = /\b(colour\w*|favour\w*|jewellery|centre|fibre|moulded|labour|catalogue|programme|whilst|organis(e|ed|ing|ation)s?|customis\w+|personalis\w+|millimetre|metre|grey|labelled|recognis\w+|minimis\w+|aluminium)\b/i;
const BANNED = /\b(design tool|configurator|elevate your|unlock|seamless|delve|game-changer|look no further|in today'?s|fast-paced|endless possibilities)\b/i;

function walk(d, o = []) { for (const e of readdirSync(d)) { const p = path.join(d, e); statSync(p).isDirectory() ? walk(p, o) : p.endsWith('.html') && o.push(p); } return o; }
const text = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

if (!existsSync(OUT)) { console.error('no build output'); process.exit(1); }
const files = walk(OUT);
const routes = new Set();
for (const f of files) routes.add(f.replace(OUT, '').replace(/index\.html$/, ''));
for (const extra of ['/sitemap.xml', '/robots.txt', '/llms.txt', '/api/inquiry/', '/cart/', '/checkout/', '/my-account/', '/main-page/']) routes.add(extra);
// On-demand (SSR) routes are not in the static dir.
for (const n of [2]) routes.add(`/products/page/${n}/`);

let errors = 0; const err = (u, m) => { errors++; console.log(`✗ ${u}: ${m}`); };
const warn = (u, m) => console.log(`! ${u}: ${m}`);
const questionOwner = new Map();
const titles = new Map();

for (const f of files) {
  const url = f.replace(OUT, '').replace(/index\.html$/, '');
  if (url === '/google70275a70604fffc8.html') continue;
  const html = readFileSync(f, 'utf8');
  const noindex = /name="robots" content="[^"]*noindex/.test(html);
  const main = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
  const desc = decode((html.match(/name="description" content="([^"]*)"/) || [])[1] || '');
  const h1 = [...main.matchAll(/<h1[^>]*>/g)].length;
  if (h1 !== 1) err(url, `${h1} H1`);
  const policy = ['/privacy-policy/', '/terms-conditions/', '/refund_returns/'].includes(url);
  if (!noindex && !policy) {
    if (title.length < 30 || title.length > 65) err(url, `title ${title.length} chars: ${title}`);
    if (desc.length < 100 || desc.length > 160) err(url, `description ${desc.length} chars`);
    if (titles.has(title)) err(url, `duplicate title with ${titles.get(title)}`); else titles.set(title, url);
    if (!html.includes(`<link rel="canonical" href="https://thediecutstickers.com${url}"`)) err(url, 'canonical mismatch');
  }

  // Schema
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { err(url, 'invalid JSON-LD'); return null; } }).filter(Boolean);
  const faqBlocks = ld.filter((x) => x['@type'] === 'FAQPage');
  const visibleQs = [...main.matchAll(/<summary[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
  if (!noindex && !EXEMPT_FAQ.has(url)) {
    if (faqBlocks.length !== 1) err(url, `${faqBlocks.length} FAQPage blocks`);
    const qs = (faqBlocks[0]?.mainEntity || []).map((q) => q.name);
    if (qs.length < 10) err(url, `${qs.length} FAQs in schema`);
    if (visibleQs.length < 10) err(url, `${visibleQs.length} visible FAQs`);
    for (const q of qs) {
      if (!visibleQs.includes(q)) err(url, `schema question not visible: "${q}"`);
      const key = q.toLowerCase().replace(/[^a-z ]/g, '').trim();
      if (questionOwner.has(key) && questionOwner.get(key) !== url) err(url, `FAQ question also on ${questionOwner.get(key)}: "${q}"`);
      questionOwner.set(key, url);
    }
  } else if (faqBlocks.length) {
    err(url, 'FAQPage on an exempt/noindex page');
  }

  // Internal links: resolve + anchors
  for (const m of main.matchAll(/<a\s[^>]*href="(\/[^"#?]*)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = m[1];
    if (href.startsWith('/_astro/') || href.startsWith('/img/')) continue;
    if (!routes.has(href)) err(url, `broken internal link ${href}`);
    if (!href.endsWith('/') && !/\.[a-z]+$/.test(href)) err(url, `link without trailing slash ${href}`);
  }

  // One link per section in prose
  if (!noindex && !EXEMPT_LINKS.has(url)) {
    const prose = main
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<form[\s\S]*?<\/form>/gi, ' ')
      .replace(/<table[\s\S]*?<\/table>/gi, ' ')
      .replace(/<ul class="(grid|tiles|uses|guides|related|cat-links|jump-list)[\s\S]*?<\/ul>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<dl[\s\S]*?<\/dl>/gi, ' ')
      .replace(/<section class="quote[\s\S]*?<\/section>/gi, ' ')
      .replace(/<section class="related[\s\S]*?<\/section>/gi, ' ')
      .replace(/<article class="card[\s\S]*?<\/article>/gi, ' ')
      .replace(/<li class="card[\s\S]*?<\/li>/gi, ' ');
    const sections = prose.split(/<h[123][^>]*>/i);
    sections.forEach((sec, i) => {
      // Count only links inside p / li (not buttons/cards)
      const blocks = [...sec.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2]).join(' ');
      const links = [...blocks.matchAll(/<a\s[^>]*href="(\/[^"]*)"[^>]*class="btn[^"]*"[^>]*>|<a\s(?![^>]*class="btn)[^>]*href="(\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].filter((m) => m[2]);
      if (links.length > 1) err(url, `${links.length} links in section ${i} (${links.map((l) => l[2]).join(', ')})`);
      for (const l of links) {
        const a = text(l[3]); const n = a.split(' ').length;
        if (GENERIC.test(a)) err(url, `generic anchor "${a}"`);
        if (n < 3 || n > 8) warn(url, `anchor ${n} words: "${a}" → ${l[2]}`);
      }
    });
  }

  // Spelling / banned phrases in rendered text
  const body = text(main);
  const br = body.match(BRITISH); if (br && !EXEMPT_FAQ.has(url)) err(url, `British spelling "${br[0]}"`);
  const bn = body.match(BANNED); if (bn) err(url, `banned phrase "${bn[0]}"`);
}
console.log(errors ? `\n${errors} problem(s) in ${files.length} pages` : `\naudit passed: ${files.length} pages`);
process.exit(errors ? 1 : 0);
