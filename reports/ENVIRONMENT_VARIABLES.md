# Environment Variables

Set these in the Vercel project (**Settings → Environment Variables**). None of them are
committed to the repository, and none reach the browser — the quote endpoint runs
server-side only. The validation suite asserts that no secret appears in any client bundle.

---

## Required for the quote form to deliver email

| Variable | Example | Environments | Notes |
| --- | --- | --- | --- |
| `SMTP_HOST` | `smtp.hostinger.com` | Production, Preview | Mail server hostname. |
| `SMTP_PORT` | `465` | Production, Preview | `465` for implicit TLS, `587` for STARTTLS. Defaults to `465`. |
| `SMTP_SECURE` | *(omit)* | Production, Preview | Optional. Derived from the port when unset: 465 → implicit TLS, 587 → STARTTLS. Only set it to override. |
| `SMTP_USER` | `info@thediecutstickers.com` | Production, Preview | SMTP username. |
| `SMTP_PASS` | *(secret)* | Production, Preview | SMTP password. **Rotate the old value first** — see `SECURITY_CUTOVER_CHECKLIST.md`. |
| `SMTP_FROM_EMAIL` | `info@thediecutstickers.com` | Production, Preview | Envelope sender. **Must be the authenticated mailbox or a verified alias** — Gmail and most providers rewrite or reject anything else. If it is not a valid address the code falls back to `SMTP_USER` and logs a warning. `SMTP_FROM` is accepted as an alias for this. |
| `SMTP_FROM_NAME` | `The Die Cut Stickers` | Production, Preview | Display name on the From header. |
| `SMTP_TO` | `info@thediecutstickers.com` | Production, Preview | Where enquiries are delivered. `INQUIRY_TO` is accepted as an alias. Falls back to the address in `src/lib/site.ts`. |

## Controls indexability

| Variable | Value | Environments | Notes |
| --- | --- | --- | --- |
| `PUBLIC_SITE_ENV` | `production` | **Production only** | Switches `robots.txt` to `Allow: /` and page meta to `index,follow`. |

**Leave `PUBLIC_SITE_ENV` unset on Preview.** Without it — and whenever Vercel's own
`VERCEL_ENV` is not `production` — every page emits `noindex,nofollow` and `robots.txt`
serves `Disallow: /`. That is what keeps preview deployments out of the index.

Canonicals, Open Graph URLs, schema URLs and the sitemap always use
`https://thediecutstickers.com` regardless of environment. No preview hostname can leak
into them; this is asserted by the validation suite.

---

## Gmail specifics

If you use `smtp.gmail.com`:

- **Port 587** needs STARTTLS. Leave `SMTP_SECURE` unset and the code derives it from the
  port; setting it to `true` on 587 will fail to connect.
- **`SMTP_PASS` must be a Google App Password**, not the account password. Generate one at
  <https://myaccount.google.com/apppasswords> (requires 2-Step Verification). It is 16
  characters; paste it without spaces.
- **Gmail ignores a From address it does not own.** Mail will appear to come from the
  authenticated account unless you add the address under Gmail → Settings → Accounts →
  "Send mail as" and verify it.
- Gmail's free tier caps outbound mail at roughly 500 messages a day, which is ample for a
  quote form but worth knowing.

## Behaviour when SMTP is not configured

The endpoint does not pretend to succeed. If `SMTP_HOST`, `SMTP_USER` or `SMTP_PASS` is
missing it returns **HTTP 503** and the visitor sees:

> Our enquiry form is not available right now. Please email info@thediecutstickers.com or
> call +1-929-2141-874.

A success message is shown **only** after the SMTP server has accepted the message. If
delivery throws, the endpoint returns 502 with a failure message and the reason is logged
server-side — the submitted content is never logged.

---

## Setting them

```bash
cd site

vercel env add SMTP_HOST production
vercel env add SMTP_PORT production
vercel env add SMTP_SECURE production
vercel env add SMTP_USER production
vercel env add SMTP_PASS production
vercel env add SMTP_FROM production
vercel env add INQUIRY_TO production
vercel env add PUBLIC_SITE_ENV production   # value: production

# Repeat for preview, but do NOT set PUBLIC_SITE_ENV there.
vercel env add SMTP_HOST preview
# ...
```

Redeploy after changing any of them — Vercel bakes build-time variables such as
`PUBLIC_SITE_ENV` into the output.

---

## Verifying delivery

Email delivery has **not** been tested; no SMTP credentials were available during the
migration. To verify on the deployed preview:

1. Add the SMTP variables to the Preview environment and redeploy.
2. Submit the form on the deployed preview URL — not localhost, so the real serverless
   function runs.
3. On success the browser is redirected to `/thank-you/`. Confirm the mail arrived at
   `SMTP_TO`, and that Reply-To is the enquirer's address.
4. Attach a test file to confirm artwork uploads arrive intact.
5. Check the function logs in Vercel for `[inquiry]` errors.

Until step 3 passes, treat the form as unverified.
