// Spam signals for form submissions. Nothing here blocks: the handler only
// labels the email "[Possible spam]" and lists the reasons, so a real enquiry
// written in an odd way still reaches the inbox (owner's rule, 2026-09-30).
//
// Three bot families hit the forms in Oct 2026:
//  1. random letters in every box: "Znhqp Gshsu", "HxSOcEuSvuKdnMgsYrFGkjl"
//  2. one canned sentence pasted into every box ("I would like more
//     information. Please contact me by email") under a name that does not
//     match the email address (Richard Garcia / silas.hachmann@gmail.com).
//  3. link-drop spam: a casino/SEO paragraph with [url=...] BBCode under a
//     joined name ("ElaineWromy"), the name pasted into other boxes too.
// A person can produce one odd word (Schmidt, Nguyen) or one odd habit, so a
// single signal is never enough; the label needs a score of two.

const VOWELS = /[aeiouy]/gi;

// Signals a single word of letters can show.
function wordSignals(word) {
  const w = word.replace(/[^A-Za-z]/g, '');
  if (w.length < 5) return 0;
  let n = 0;
  const vowels = (w.match(VOWELS) || []).length;
  if (vowels / w.length < 0.2) n++;                  // Znhqp (Smith and kraft sit at exactly 0.2)
  if (/[^aeiouyAEIOUY]{5,}/.test(w)) n++;            // Uzngfxuq, vcltvv
  const switches = (w.match(/[a-z][A-Z]|[A-Z]{2,}[a-z]/g) || []).length;
  if (switches >= 3) n++;                            // HxSOcEuSvuKdnMgsYrFGkjl
  return n;
}

function textSignals(text) {
  let n = 0;
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  for (const w of words) n += wordSignals(w);
  return n;
}

// Canned sentences the enquiry bots paste. Each one is worth two on its own.
const CANNED = [
  /\bi would like more information\b[\s\S]{0,40}\bplease contact me\b/i,
  /\bplease contact me by (e-?mail|phone)\b/i,
  /\bi am interested in your (products?|services?)\b[\s\S]{0,60}\b(contact|get back to) me\b/i,
];

// Subjects no packaging or sportswear customer writes about.
const TOPICS = /\b(casino|gambling|slot machines?|betting|poker|roulette|viagra|cialis|crypto(currency)?|bitcoin|forex|escorts?|backlinks?|seo services?|guest posts?|payday loans?|adult (sites?|content)|porn)\b/i;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Returns the reasons a submission looks automated; an empty list means none.
 *
 *  names   - the name field(s)
 *  email   - the email field
 *  message - the free-text message
 *  fields  - other visible text boxes as { label: value } (product, quantity,
 *            company, subject...), used to spot one text pasted into every box
 *            and a quantity that is a sentence instead of a number
 *  phone   - the phone field, if the form has one
 *  sentAt  - the timestamp the page wrote when it loaded (ms); pass
 *            `undefined` and set `timing: false` on forms that have no stamp
 *  timing  - false when the form sends no load timestamp, so its absence is
 *            not held against the visitor (default true)
 */
export function spamReasons({ names = [], message = '', email = '', phone = '', fields = {}, sentAt, timing = true, now = Date.now() }) {
  const reasons = [];
  let score = 0;

  for (const name of names) {
    const s = textSignals(name);
    if (s) { score += s; reasons.push(`name looks random (${String(name).trim()})`); }
  }

  // "ElaineWromy": two capitalised parts of four or more letters run together.
  // McDonald, DeSouza and MacKenzie keep a short prefix, so they do not match.
  for (const name of names) {
    const w = String(name || '').trim();
    if (/^[A-Z][a-z]{3,}[A-Z][a-z]{3,}$/.test(w)) { score++; reasons.push(`name has no space (${w})`); break; }
  }

  const msg = String(message || '').trim();
  if (msg) {
    // A long message with one odd word is a real message; a short one made of
    // odd words is not.
    const s = textSignals(msg);
    const words = msg.split(/\s+/).length;
    if (s && (words <= 3 || s >= 2)) { score += s; reasons.push('message looks random'); }
    if (!/\s/.test(msg) && msg.length >= 12 && /^[A-Za-z]+$/.test(msg)) { score++; if (!reasons.includes('message looks random')) reasons.push('message is one random word'); }

    // Links and forum markup. One link can be a customer's own website, so it
    // is worth one; BBCode or several links are worth two.
    const links = (msg.match(/https?:\/\/|www\./gi) || []).length;
    if (/\[\/?url\b|\[url=|\[\/?link\b/i.test(msg)) { score += 2; reasons.push('forum link markup in message'); }
    else if (links >= 2) { score += 2; reasons.push(`${links} links in message`); }
    else if (links === 1) { score++; reasons.push('link in message'); }
  }

  // Off-topic subject, wherever it was pasted.
  const everything = [msg, ...Object.values(fields)].map((v) => String(v || '')).join('\n');
  const topic = everything.match(TOPICS);
  if (topic) { score += 2; reasons.push(`off-topic wording (${topic[0].toLowerCase()})`); }

  // Canned wording, wherever it was pasted.
  if (CANNED.some((re) => re.test(everything))) { score += 2; reasons.push('canned enquiry wording'); }

  // The same text in more than one box: bots fill every field with one string.
  // The boxes have different max lengths, so one value may be a cut-off copy
  // of another (quantity is capped at 40 characters on some sites).
  const texts = [['message', msg], ...Object.entries(fields)]
    .map(([k, v]) => [k, norm(v)])
    .filter(([, v]) => v.length >= 15);
  const dup = new Set();
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const [a, b] = [texts[i][1], texts[j][1]];
      if (a === b || a.startsWith(b) || b.startsWith(a)) { dup.add(texts[i][0]); dup.add(texts[j][0]); }
    }
  }
  if (dup.size >= 2) { score += dup.size >= 3 ? 2 : 1; reasons.push(`same text in ${dup.size} boxes (${[...dup].join(', ')})`); }

  // The name typed into a box that is not the name box (Depth: ElaineWromy).
  const nameNorm = norm(names.join(' '));
  if (nameNorm.length >= 6) {
    const hit = Object.entries(fields).find(([, v]) => norm(v) === nameNorm);
    if (hit) { score++; reasons.push(`name pasted into ${hit[0]}`); }
  }

  // A quantity that is a sentence rather than a number.
  for (const [label, value] of Object.entries(fields)) {
    const v = String(value || '').trim();
    if (/quantity|qty|how many|units|pieces/i.test(label) && v.split(/\s+/).length >= 4 && !/\d/.test(v)) {
      score++; reasons.push(`${label} is a sentence, not a number`); break;
    }
  }

  // 555-0100 to 555-0199 is reserved for fiction in the North American plan: no real customer has one.
  const digits = String(phone || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (/^\d{3}55501\d\d$/.test(digits)) { score += 2; reasons.push(`fictional 555-01xx phone (${String(phone).trim()})`); }

  const local = String(email || '').split('@')[0] || '';
  if ((local.match(/\./g) || []).length >= 3) { score++; reasons.push('email uses many dots'); }

  // first.last@ under a different person's name. Only counts when the
  // address itself is clearly a person's name, so sales@ and info@ never match.
  const parts = local.toLowerCase().split(/[._-]/).filter((p) => /^[a-z]{3,}$/.test(p));
  const nameWords = nameNorm.split(' ').filter((w) => w.length >= 3);
  if (parts.length >= 2 && nameWords.length) {
    const shared = nameWords.some((w) => local.toLowerCase().includes(w)) || parts.some((p) => nameWords.some((w) => w.includes(p)));
    if (!shared) { score++; reasons.push(`name does not match the email address (${names.join(' ').trim()} / ${local})`); }
  }

  // The page sets a timestamp when it loads; a post without one did not come
  // through the page, and one within three seconds was not typed by a person.
  if (timing) {
    const ts = Number(sentAt);
    if (!ts) { score += 2; reasons.push('no timing token'); }
    else if (now - ts < 3000) { score += 2; reasons.push('sent in under 3 seconds'); }
  }

  // One odd word is a surname; two signals is a bot.
  return score >= 2 ? reasons : [];
}
