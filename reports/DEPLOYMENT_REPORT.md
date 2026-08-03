# Deployment Report

## Current state

| Item | Value |
| --- | --- |
| Vercel project | `thediecutstickers` (dedicated, created for this migration) |
| Project ID | `prj_NkNKw5OjPv99SMOP9cjTxXcdgjll` |
| Team | `iamzeeshaikhs-projects` |
| Preview URL | https://thediecutstickers-botbzs0zw-iamzeeshaikhs-projects.vercel.app |
| Production URL (not yet domain-mapped) | https://thediecutstickers.vercel.app |
| Framework preset | Astro (auto-detected) |
| Node runtime | 24.x |
| DNS | **Unchanged. Not touched.** |
| Live site | **Still the compromised WordPress install.** |

A dedicated project was created rather than reusing an existing one. Note that the source
directory is named `site`, and an unrelated Vercel project called `site` already exists in
this team — the project name was set explicitly at link time so that project was not
overwritten.

## Preview access

The project has SSO Deployment Protection set to `all_except_custom_domains`: every
`*.vercel.app` URL requires a Vercel login, and Vercel additionally serves
`x-robots-tag: noindex` on them. Custom domains, once attached, are public.

You can open the preview URL directly while logged in to Vercel.

An automation bypass secret was generated to test the deployment from the command line,
and **has since been revoked** — it is not recorded here because this repository is
public, and the secret granted unauthenticated access to protected deployments.

If you need one again for CI or scripted checks, generate a fresh one under
Project Settings → Deployment Protection → Protection Bypass for Automation, keep it in
an environment variable, and never commit it.

## What was verified on the deployed preview

Not localhost — these were run against the live Vercel deployment.

| Check | Result |
| --- | --- |
| All 41 sitemap URLs | 200 |
| `/cart/`, `/checkout/`, `/my-account/` | 301 → `/contact-us/`, single hop |
| `/main-page/` | 301 → `/`, single hop |
| `/category/*`, `/tag/*` | 410 |
| `/understanding-the-test-e-250-course-benefits-and-considerations/` | 410 |
| Unknown URL | 404 with the custom page |
| `robots.txt` | `Disallow: /` (preview) |
| Canonicals | `https://thediecutstickers.com/...` — production origin, never the preview host |
| Robots meta | `noindex,nofollow` |
| `vercel.app` references in page bodies | 0 |
| Images, gallery, mobile menu, FAQ accordion | Render and work |

### Form endpoint (`/api/inquiry/`)

Tested against the deployed serverless function:

| Case | Response |
| --- | --- |
| `GET` | 405 Method Not Allowed |
| Cross-origin POST from another host | 403 |
| POST with no `Origin` header | 403 (Astro's built-in CSRF check) |
| Missing required fields | 400 with a field-specific message |
| Invalid email | 400 |
| Honeypot filled | 200, silently discarded — nothing sent |
| Upload `evil.php` | 415 "That file type is not accepted." |
| Upload `evil.php.jpg` (double extension) | 415 "That file name is not accepted." |
| Upload `.jpg` with wrong magic bytes | 415 "That file does not match its extension." |
| Sixth request within a minute | 429 |
| Valid submission, SMTP unconfigured | **503** with an honest failure message |

The last row matters: with no SMTP credentials the endpoint refuses and tells the visitor
to email or call. It never reports success without confirmed delivery.

**Email delivery is unverified.** No SMTP credentials were available. Add them per
`ENVIRONMENT_VARIABLES.md` and submit a real test on the deployed preview before cutover.

## Before promoting to production

1. Rotate SMTP credentials (the old ones must be assumed exposed — see
   `SECURITY_CUTOVER_CHECKLIST.md`), then add them to the Vercel project.
2. Set `PUBLIC_SITE_ENV=production` on the **Production** environment only.
   Without it production stays `noindex`. With it set on Preview, staging becomes
   crawlable — don't.
3. Submit the quote form on the deployed preview and confirm the email arrives.
4. Deploy to production:

   ```bash
   cd site
   vercel deploy --prod
   ```

5. Confirm `https://thediecutstickers.vercel.app/robots.txt` now reads `Allow: /` and the
   homepage meta robots reads `index,follow`.

---

## DNS cutover

**Not performed. Requires your explicit authorisation.** DNS is managed at Cloudflare.

### Step 1 — add the domains in Vercel

Project → Settings → Domains → add `thediecutstickers.com` and `www.thediecutstickers.com`.
Set the apex as primary and let Vercel redirect `www` to it, matching the current setup.

### Step 2 — Cloudflare DNS records

Replace the records currently pointing at Hostinger:

| Type | Name | Value | Proxy | TTL |
| --- | --- | --- | --- | --- |
| A | `@` | `76.76.21.21` | **DNS only (grey cloud)** | Auto |
| CNAME | `www` | `cname.vercel-dns.com` | **DNS only (grey cloud)** | Auto |

Set the proxy to **DNS only** for the initial cutover. Cloudflare's orange-cloud proxy in
front of Vercel causes certificate-issuance failures and double-caching. You can re-enable
it later once the certificate is issued, with SSL/TLS mode set to **Full (strict)**.

Confirm the exact target values in the Vercel dashboard when you add the domain — Vercel
occasionally issues a project-specific CNAME instead of the shared apex A record.

**Leave alone:** MX records, SPF/DKIM/DMARC TXT records, and any other verification TXT
records. Changing these breaks email for `info@thediecutstickers.com`.

**Remove after cutover:** any A/AAAA/CNAME records still pointing at the Hostinger IP,
once the old server is decommissioned.

### Step 3 — immediately after

1. Wait for Vercel to report the domain as Valid and the certificate as issued.
2. **Purge the Cloudflare cache in full.** Cloudflare is caching infected HTML, including
   the service-worker dropper on the homepage. Skipping this means visitors keep getting
   the compromised page.
3. Load the homepage and confirm in DevTools → Application → Service Workers that no
   worker is registered for the origin. The kill switch runs on every page.
4. Re-check the response codes in the table above, now on the real domain.
5. Submit the clean sitemap in Search Console.

---

## Rollback

The old WordPress site stays untouched and running throughout, so rollback is a DNS
revert.

### If something is wrong after cutover

1. In Cloudflare, restore the previous A/CNAME records pointing at the Hostinger IP.
   (Record them before you change anything — Cloudflare does not keep history on the free
   plan.)
2. Purge the Cloudflare cache.
3. Propagation is usually minutes at Auto TTL.

**Understand what rollback means here:** reverting DNS puts the compromised WordPress
site back in front of visitors, including the service-worker dropper. Treat it as a
short-term measure only, and prefer fixing forward on Vercel.

### Rolling back a bad Vercel deploy (not DNS)

Instant, and does not touch DNS:

```bash
cd site
vercel ls thediecutstickers          # find the last good deployment
vercel promote <deployment-url>      # promote it to production
```

Or use Instant Rollback in the Vercel dashboard under Deployments.

### Lowering TTL beforehand

If you want a faster escape hatch, set the TTL on the apex and `www` records to 300
seconds at least an hour before cutover, then restore Auto afterwards.
