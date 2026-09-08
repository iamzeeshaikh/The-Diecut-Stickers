/**
 * Inquiry / quote endpoint.
 *
 * Runs on demand (never prerendered). Every submission is validated on the
 * server regardless of what the browser did. Uploaded artwork is inspected but
 * never written to disk and never executed.
 */
import type { APIRoute } from 'astro';
import { PRODUCTION_ORIGIN, SITE } from '../../lib/site';

const LEAD_RECIPIENTS = ['shanimazhar82@gmail.com', 'dev@zeecustomboxes.com'] as const;

export const prerender = false;

/**
 * Reads configuration from either source.
 *
 * On Vercel the values are real process environment variables. Locally they
 * come from site/.env, which Astro loads into import.meta.env but NOT into
 * process.env — reading only process.env meant a local .env was silently
 * ignored and the form always reported "not configured".
 */
function env(key: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  const fromVite = (import.meta.env as Record<string, string | undefined>)[key];
  const value = fromProcess ?? fromVite;
  return value === '' ? undefined : value;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_FIELD = 4000;

const ALLOWED_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'ai', 'eps', 'svg', 'zip']);
const DANGEROUS_EXT = new Set([
  'php', 'php3', 'php4', 'php5', 'php7', 'phtml', 'phar', 'exe', 'dll', 'sh',
  'bash', 'bat', 'cmd', 'com', 'cgi', 'pl', 'py', 'rb', 'jsp', 'asp', 'aspx',
  'js', 'mjs', 'htaccess', 'html', 'htm', 'jar', 'msi', 'scr',
]);

/** Magic-byte signatures for the formats we accept. */
const SIGNATURES: Array<[string, number[]]> = [
  ['pdf', [0x25, 0x50, 0x44, 0x46]],
  ['png', [0x89, 0x50, 0x4e, 0x47]],
  ['jpg', [0xff, 0xd8, 0xff]],
  ['zip', [0x50, 0x4b]], // also covers .ai/.eps saved as compressed bundles
];

const EXECUTABLE_MARKERS = [
  '<?php', '<?=', '<script', '<%', '#!/', 'base64_decode', 'shell_exec',
  'passthru', 'eval(', 'system(', 'MZ',
];

/** Header injection guard: no CR/LF may reach a mail header. */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function clean(value: FormDataEntryValue | null, max = 300): string {
  if (typeof value !== 'string') return '';
  // Drop control characters (NUL, stray CR/LF, escapes) but keep ordinary text.
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function isEmail(value: string): boolean {
  return /^[^\s@<>",;]+@[^\s@<>",;]+\.[a-z]{2,}$/i.test(value) && value.length <= 180;
}

// Simple in-process rate limit. Serverless instances are short-lived, so this
// throttles bursts from a single address rather than acting as a hard quota.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_MAX;
}

const THANK_YOU = '/thank-you/';

/**
 * The form posts via fetch and asks for JSON. A browser with JavaScript
 * disabled posts natively and asks for HTML, so the two are answered
 * differently: JSON for fetch, real redirects and a rendered page otherwise.
 */
function wantsJson(request: Request): boolean {
  const accept = request.headers.get('accept') || '';
  return accept.includes('application/json');
}

function json(status: number, ok: boolean, message: string, redirect?: string): Response {
  return new Response(JSON.stringify({ ok, message, ...(redirect ? { redirect } : {}) }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

/** Plain HTML failure page for submissions made without JavaScript. */
function htmlError(status: number, message: string): Response {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Your enquiry could not be sent | ${SITE.name}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
line-height:1.7;color:#292929;background:#f9fbfe;margin:0;padding:48px 20px}
.w{max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:28px 30px;
box-shadow:0 1px 3px rgba(16,24,40,.08)}h1{font-size:1.5rem;margin:0 0 12px}
a{color:#1b5cbf}.btn{display:inline-block;margin-top:18px;background:#9a4cec;color:#fff;
padding:12px 26px;border-radius:999px;text-decoration:none;font-weight:700}</style>
</head><body><div class="w"><h1>Your enquiry could not be sent</h1>
<p>${escapeHtml(message)}</p>
<p>You can email <a href="mailto:${SITE.email}">${SITE.email}</a> or call
<a href="tel:${SITE.phoneHref}">${SITE.phone}</a> instead.</p>
<a class="btn" href="/contact-us/">Back to the form</a></div></body></html>`;
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** 303 so the browser re-issues the follow-up as a GET, not a repeat POST. */
function seeOther(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location, 'cache-control': 'no-store' },
  });
}

function fail(request: Request, status: number, message: string): Response {
  return wantsJson(request) ? json(status, false, message) : htmlError(status, message);
}

function succeed(request: Request, message: string): Response {
  return wantsJson(request) ? json(200, true, message, THANK_YOU) : seeOther(THANK_YOU);
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // --- origin check --------------------------------------------------------
  const origin = request.headers.get('origin');
  if (origin) {
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      return fail(request, 403, 'Invalid request origin.');
    }
    const selfHost = new URL(request.url).host;
    const allowed =
      host === selfHost ||
      host === new URL(PRODUCTION_ORIGIN).host ||
      host.endsWith('.vercel.app');
    if (!allowed) return fail(request, 403, 'Invalid request origin.');
  }

  const ip = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
  if (rateLimited(ip)) {
    return fail(request, 429, 'Too many submissions. Please wait a minute and try again.');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(request, 400, 'Could not read the submitted form.');
  }

  // --- honeypot ------------------------------------------------------------
  if (clean(form.get('website'))) {
    // Silently accept so bots get no signal, but nothing is sent.
    return succeed(request, 'Thank you. Your enquiry has been sent.');
  }

  // --- field validation ----------------------------------------------------
  const name = clean(form.get('name'), 120);
  const email = clean(form.get('email'), 180);
  const phone = clean(form.get('phone'), 40);
  const company = clean(form.get('company'), 140);
  const product = clean(form.get('product'), 140);
  const quantity = clean(form.get('quantity'), 40);
  const size = clean(form.get('size'), 80);
  const shape = clean(form.get('shape'), 80);
  const material = clean(form.get('material'), 80);
  const finish = clean(form.get('finish'), 80);
  const printing = clean(form.get('printing'), 200);
  const message = clean(form.get('message'), MAX_FIELD);
  const sourcePage = clean(form.get('sourcePage'), 300);

  const errors: string[] = [];
  if (name.length < 2) errors.push('a name');
  if (!isEmail(email)) errors.push('a valid email address');
  if (phone.replace(/\D/g, '').length < 6) errors.push('a contact number');
  if (errors.length) {
    return fail(request, 400, `Please provide ${errors.join(', ')}.`);
  }

  // --- upload validation ---------------------------------------------------
  const upload = form.get('artwork');
  let attachment: { filename: string; content: Buffer; contentType: string } | null = null;

  if (upload instanceof File && upload.size > 0) {
    if (upload.size > MAX_UPLOAD_BYTES) {
      return fail(request, 413, 'That file is larger than 10 MB. Please send a smaller file.');
    }
    const original = upload.name.replace(/[\r\n ]/g, '');
    const parts = original.toLowerCase().split('.');
    const ext = parts[parts.length - 1] ?? '';

    if (parts.length < 2 || !ALLOWED_EXT.has(ext)) {
      return fail(request, 415, 'That file type is not accepted.');
    }
    // Reject polyglot / double extensions such as artwork.php.jpg
    if (parts.slice(1, -1).some((p) => DANGEROUS_EXT.has(p))) {
      return fail(request, 415, 'That file name is not accepted.');
    }

    const bytes = Buffer.from(await upload.arrayBuffer());

    // Binary formats must match their magic bytes.
    const expect = SIGNATURES.find(([e]) => e === (ext === 'jpeg' ? 'jpg' : ext));
    if (expect && !expect[1].every((b, i) => bytes[i] === b)) {
      return fail(request, 415, 'That file does not match its extension.');
    }

    // Text-ish formats (svg, eps, ai) are scanned for executable content.
    const head = bytes.subarray(0, 8192).toString('latin1');
    const tail = bytes.subarray(-2048).toString('latin1');
    if (!expect || ext === 'svg') {
      const lowered = (head + tail).toLowerCase();
      if (EXECUTABLE_MARKERS.some((m) => lowered.includes(m.toLowerCase()))) {
        return fail(request, 415, 'That file contains embedded code and was rejected.');
      }
    }

    // Stored in memory and forwarded as a mail attachment only. Never written
    // to the filesystem, never executed, and the name is fully sanitised.
    attachment = {
      filename: original.replace(/[^A-Za-z0-9._-]/g, '_').slice(-120),
      content: bytes,
      contentType: upload.type && /^[\w.+-]+\/[\w.+-]+$/.test(upload.type)
        ? upload.type
        : 'application/octet-stream',
    };
  }

  // --- compose -------------------------------------------------------------
  const rows: Array<[string, string]> = ([
    ['Name', name],
    ['Email', email],
    ['Phone', phone],
    ['Company', company],
    ['Product', product],
    ['Quantity', quantity],
    ['Size', size],
    ['Shape', shape],
    ['Material', material],
    ['Finish', finish],
    ['Printing', printing],
    ['Source page', sourcePage ? `${PRODUCTION_ORIGIN}${sourcePage}` : ''],
  ] as Array<[string, string]>).filter(([, v]) => v.length > 0);

  const text =
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    (message ? `\n\nMessage:\n${message}` : '') +
    (attachment ? `\n\nArtwork attached: ${attachment.filename}` : '');

  const host = env('SMTP_HOST');
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');
  const port = Number(env('SMTP_PORT') || 465);
  /*
   * Derived from the port rather than defaulted to true: 465 is implicit TLS,
   * 587 is STARTTLS and must be opened insecure. Hard-defaulting to true made
   * a port-587 setup fail to connect. An explicit SMTP_SECURE still wins.
   */
  const secure =
    env('SMTP_SECURE') !== undefined
      ? env('SMTP_SECURE') === 'true'
      : port === 465;

  /*
   * Most providers, Gmail included, only allow the envelope sender to be the
   * authenticated mailbox or a verified alias — anything else is rewritten or
   * rejected. Fall back to the authenticated user unless a valid address is
   * configured, so a typo cannot silently break delivery.
   */
  const configuredFrom = (env('SMTP_FROM_EMAIL') || env('SMTP_FROM') || '').trim();
  const fromEmail = isEmail(configuredFrom) ? configuredFrom : user;
  const fromName = (env('SMTP_FROM_NAME') || `${SITE.name} website`).replace(/["\r\n]/g, '');
  if (configuredFrom && !isEmail(configuredFrom)) {
    console.warn('[inquiry] SMTP_FROM_EMAIL is not a valid address; using SMTP_USER instead');
  }

  if (!host || !user || !pass) {
    // Never report success when delivery could not be attempted.
    console.error('[inquiry] SMTP is not configured; submission was not delivered');
    return fail(
      request,
      503,
      `Our enquiry form is not available right now. Please email ${SITE.email} or call ${SITE.phone}.`,
    );
  }

  try {
    const { default: nodemailer } = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: [...LEAD_RECIPIENTS],
      replyTo: `${headerSafe(name)} <${headerSafe(email)}>`,
      subject: headerSafe(
        product ? `Quote request: ${product}` : 'Website enquiry',
      ),
      text,
      attachments: attachment
        ? [{ filename: attachment.filename, content: attachment.content, contentType: attachment.contentType }]
        : [],
    });
  } catch (err) {
    // Log the failure reason, never the submitted content.
    console.error('[inquiry] delivery failed:', err instanceof Error ? err.message : 'unknown');
    return fail(
      request,
      502,
      `Sorry, your enquiry could not be sent. Please email ${SITE.email} or call ${SITE.phone}.`,
    );
  }

  return succeed(request, 'Thank you. Your enquiry has been sent and we will be in touch shortly.');
};

/** Anything other than POST is not useful here. */
export const GET: APIRoute = () =>
  new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
