#!/usr/bin/env node
// Validates src/data/product-content/*.json against content/WRITING.md. Usage: node scripts/check-product-content.mjs [slug ...]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
const DIR = 'src/data/product-content';
const products = JSON.parse(readFileSync('src/data/products.json', 'utf8'));
const slugs = new Set(products.map((p) => p.slug));
const VALID = new Set(['/', '/products/', '/get-a-quote/', '/contact-us/', '/about-us/', '/blog/', '/sitemap/',
  ...['by-material', 'features', 'shape-size', 'sticker-types', 'usage'].map((s) => `/product-category/${s}/`),
  ...[...slugs].map((s) => `/product/${s}/`),
  ...['matte-vs-glossy-stickers-which-finish-to-choose', 'how-long-do-outdoor-stickers-last', 'eco-friendly-and-biodegradable-sticker-materials', 'die-cut-stickers-vs-decals-vs-labels', 'custom-sticker-sizes-from-mini-to-large-format'].map((s) => `/blog/${s}/`)]);
const REQUIRED = {};
for (const line of readFileSync('content/ASSIGNMENTS.md', 'utf8').split('\n')) {
  const m = line.match(/^- ([a-z0-9-]+) .*REQUIRED: ([^·]+)/); if (m) REQUIRED[m[1]] = m[2].split(',').map((s) => s.trim()).filter(Boolean);
}
const GENERIC = /^(click here|learn more|read more|here|explore|discover|view|see more|shop now|this page|more)$/i;
const BANNED = /\b(elevate|unlock|seamless|robust|delve|game-changer|look no further|in today'?s|fast-paced|endless possibilities|top-notch|design tool|configurator|no minimum)\b/i;
const BRITISH = /\b(colou?r(?!ado)|colours?|favour\w*|jewellery|centre|fibre|moulded|labour|catalogue|programme|whilst|organis\w+|customis\w+|personalis\w+|millimetre|metre|grey|labelled|recognis\w+|minimis\w+)\b/i;
const BRIT_WORDS = /\b(colour\w*|favour\w*|jewellery|centre|fibre|moulded|labour|catalogue|programme|whilst|organis\w+|customis\w+|personalis\w+|millimetre|metre|grey|labelled|recognis\w+|minimis\w+)\b/gi;
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => text(s).split(' ').filter(Boolean).length;
const files = process.argv.length > 2 ? process.argv.slice(2).map((s) => `${s}.json`) : (existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : []);
let errors = 0; const allQs = new Map();
const err = (f, m) => { errors++; fileErrs++; console.log(`✗ ${f}: ${m}`); };
let fileErrs = 0;
for (const f of files) {
  fileErrs = 0;
  const p = path.join(DIR, f); if (!existsSync(p)) { err(f, 'missing'); continue; }
  let d; try { d = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { err(f, 'invalid JSON ' + e.message); continue; }
  const slug = f.replace(/\.json$/, '');
  if (d.slug !== slug) err(f, `slug mismatch ${d.slug}`);
  if (!slugs.has(slug)) err(f, 'unknown product');
  for (const k of ['name', 'seoTitle', 'seoDescription', 'h1', 'tagline', 'quickAnswer']) if (typeof d[k] !== 'string' || !d[k].trim()) err(f, `missing ${k}`);
  if (d.seoTitle && (d.seoTitle.length < 45 || d.seoTitle.length > 65)) err(f, `seoTitle ${d.seoTitle.length} chars`);
  if (d.seoDescription && (d.seoDescription.length < 125 || d.seoDescription.length > 160)) err(f, `seoDescription ${d.seoDescription.length} chars`);
  if (/\$\d/.test(d.seoDescription || '')) err(f, 'price in meta description');
  const qa = words(d.quickAnswer || ''); if (qa < 40 || qa > 80) err(f, `quickAnswer ${qa} words`);
  if (!Array.isArray(d.highlights) || d.highlights.length !== 4) err(f, 'highlights must be 4');
  if (!Array.isArray(d.sections) || d.sections.length < 4 || d.sections.length > 7) err(f, `sections ${d.sections?.length}`);
  let total = 0, tables = 0, ols = 0, uls = 0, links = 0; const targets = new Set();
  for (const s of d.sections || []) {
    if (!s.h2 || !s.html) { err(f, 'section missing h2/html'); continue; }
    if (/<h[12]|<script|<img|<div/i.test(s.html)) err(f, `disallowed tag in "${s.h2}"`);
    total += words(s.html);
    tables += (s.html.match(/<table/g) || []).length; ols += (s.html.match(/<ol/g) || []).length; uls += (s.html.match(/<ul/g) || []).length;
    const as = [...s.html.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
    if (as.length > 1) err(f, `${as.length} links in section "${s.h2}" (max 1)`);
    for (const a of as) {
      links++; targets.add(a[1]);
      if (!VALID.has(a[1])) err(f, `invalid link ${a[1]}`);
      const n = text(a[2]).split(' ').length; if (n < 3 || n > 8) err(f, `anchor "${text(a[2])}" has ${n} words`);
      if (GENERIC.test(text(a[2]))) err(f, `generic anchor "${text(a[2])}"`);
    }
    if (/why choose us|call to action|explore more|everything you need|, answered|benefits of /i.test(s.h2)) err(f, `weak heading "${s.h2}"`);
  }
  if (total < 700 || total > 1250) err(f, `sections total ${total} words`);
  if (tables !== 1) err(f, `${tables} tables (need 1)`); if (ols !== 1) err(f, `${ols} <ol> (need 1)`); if (uls < 1) err(f, 'no <ul>');
  for (const r of REQUIRED[slug] || []) if (!targets.has(r)) err(f, `required link missing ${r}`);
  if (links < 3 || links > 5) err(f, `${links} links total (3–5)`);
  if (!Array.isArray(d.specs) || d.specs.length < 8 || d.specs.length > 13) err(f, `specs ${d.specs?.length}`);
  if (!Array.isArray(d.faqs) || d.faqs.length < 12 || d.faqs.length > 15) err(f, `faqs ${d.faqs?.length}`);
  for (const q of d.faqs || []) {
    const n = words(q.a || ''); if (n < 30 || n > 80) err(f, `faq answer ${n} words: "${q.q}"`);
    if (/<[a-z]/i.test(q.a)) err(f, `html in faq answer "${q.q}"`);
    const key = (q.q || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (allQs.has(key)) err(f, `duplicate FAQ question also in ${allQs.get(key)}: "${q.q}"`); else allQs.set(key, f);
  }
  const blob = JSON.stringify(d);
  const b = blob.match(BANNED); if (b) err(f, `banned phrase "${b[0]}"`);
  const br = blob.match(BRIT_WORDS); if (br) err(f, `British spelling ${[...new Set(br)].join(', ')}`);
  if (/—/.test(blob)) err(f, 'em dash');
  if (/\bWhether\b/.test(blob)) err(f, 'sentence starting with Whether');
  const vib = (blob.match(/vibrant/gi) || []).length; if (vib > 1) err(f, `"vibrant" x${vib}`);
  const so = (blob.match(/stand out/gi) || []).length; if (so > 1) err(f, `"stand out" x${so}`);
  if (/Die-Cut/.test(blob)) err(f, 'use "Die Cut" without hyphen');
  if (!fileErrs) console.log(`✓ ${f} (${total} words, ${links} links, ${d.faqs.length} faqs)`);
}
console.log(errors ? `${errors} problem(s)` : `all ${files.length} files pass`);
process.exit(errors ? 1 : 0);
