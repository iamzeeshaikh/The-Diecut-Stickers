# Security Cutover Checklist

The WordPress installation behind thediecutstickers.com is compromised (see
`MALWARE_AUDIT_REPORT.md`). Replacing the front end removes the malware from what visitors
see, but it does **not** evict the attacker from the hosting account.

**Nothing in this checklist has been performed.** Every item needs account access and your
explicit authorisation. No DNS record, credential or third-party account has been touched.

Host details observed from response headers: **Hostinger** (hPanel), LiteSpeed, PHP 8.1.34,
WordPress 6.9.5, Cloudflare in front.

---

## Before cutover

- [ ] Take one complete backup of the WordPress site and database, and store it **offline**
      for forensics. Label it as infected.
- [ ] **Never import that backup into the Astro project**, or into any live environment.
- [ ] Preserve the current access, error and security logs. Hosting providers rotate these;
      copy them out before they expire. They are the only record of how entry was gained.
- [ ] Note the current DNS records exactly as they stand, so rollback is possible.

## Credential rotation (do all of these — assume everything was exposed)

- [ ] WordPress administrator passwords, for every admin account.
- [ ] Hosting control panel (Hostinger hPanel) password, and enable 2FA.
- [ ] Database user password.
- [ ] FTP / SFTP / SSH credentials and keys.
- [ ] SMTP credentials. These are needed for the new quote form — rotate first, then put
      the new values into Vercel (see `ENVIRONMENT_VARIABLES.md`). Never reuse the old ones.
- [ ] Cloudflare account password, and rotate any Cloudflare API tokens or Global API Key.
- [ ] Any third-party API keys stored in WordPress (Omnisend and the Google Listings &
      Ads plugin were both installed and hold credentials).

## Account review

- [ ] List all WordPress users and delete any administrator you do not recognise. Attackers
      routinely add a backup admin.
- [ ] Review WordPress cron jobs (`wp_cron`) and server cron for unfamiliar scheduled tasks.
- [ ] Review Google Search Console owners and delegated users — an attacker with verified
      ownership can keep monitoring the site and request indexing of spam.
- [ ] Review Google Analytics users.
- [ ] Review Google Tag Manager users and container versions.
- [ ] Review Cloudflare account members and API tokens.
- [ ] Review email forwarding and mailbox rules on the domain.
- [ ] Check for unexpected verification meta tags. Two `google-site-verification` tags are
      present on the live site; confirm both belong to you.

## Cutover

- [ ] Deploy to production on the dedicated Vercel project (`DEPLOYMENT_REPORT.md`).
- [ ] Update DNS only after preview verification passes. **Requires your authorisation.**
- [ ] Purge the Cloudflare cache immediately after the DNS change — Cloudflare will
      otherwise keep serving cached infected HTML, including the service-worker dropper.
- [ ] Confirm the service-worker kill switch is live: load the new homepage, then check
      DevTools → Application → Service Workers shows no registration for the origin.
- [ ] Verify SSL is issued and valid on the new host.

## After cutover

- [ ] **Isolate or terminate the old WordPress server.** Until it is off, the attacker's
      access persists. If it must stay up briefly, block all public traffic to it.
- [ ] Remove DNS records that pointed at the old host once it is decommissioned.
- [ ] Submit `https://thediecutstickers.com/sitemap.xml` in Google Search Console.
- [ ] Use the Removals tool for the highest-visibility injected URLs, in particular
      `/understanding-the-test-e-250-course-benefits-and-considerations/`. The 410s handle
      this eventually; removals make it immediate.
- [ ] Use URL Inspection on the homepage, `/products/`, and a sample of product and
      category URLs to confirm the clean versions are being fetched.
- [ ] Check Search Console → Security & Manual Actions. If a manual action was issued for
      the hidden links or cloaked content, file a reconsideration request once the clean
      site is live, describing the clean-room rebuild.
- [ ] Monitor `site:thediecutstickers.com` weekly for a month. Spam URLs reappearing means
      the attacker still has access somewhere.
- [ ] Watch Search Console coverage for the 410s being processed (expect a rise in
      "Not found (410)" — this is the desired outcome, not an error).

---

## Known accepted risk

`npm audit` reports a high-severity ReDoS advisory in `path-to-regexp`, reached via
`@vercel/routing-utils` → `@astrojs/vercel`. This is a **build-time only** dependency used
to compile route patterns during deployment. It is not part of any client bundle and not
part of the serverless runtime; the validation suite asserts no secrets or unexpected code
ship to the browser. The available `npm audit fix --force` would downgrade the adapter
below the version Astro 7 requires, so it has not been applied. Re-check when
`@astrojs/vercel` publishes a patched release.
