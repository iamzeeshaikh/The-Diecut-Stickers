/* ZEE portfolio GA4 conversion events — copy of ~/.claude/tools/ga4/ga4-events.js.
   Loaded after gtag.js on every page. Sends:
     whatsapp_click     any wa.me / api.whatsapp.com / whatsapp:// link or a .whatsapp button
     phone_call         any tel: link
     email_click        any mailto: link
     lead_form_submit   any <form> submit except search forms (fires before JS handlers navigate)
   Each is marked as a key event (conversion) in the site's GA4 property. */
(function () {
  function send(name, params) {
    if (typeof window.gtag === "function") window.gtag("event", name, params || {});
  }
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("a,button") : null;
    if (!el) return;
    var href = (el.getAttribute("href") || "").trim();
    var text = (el.textContent || "").trim().slice(0, 80);
    var hint = (el.className || "") + " " + (el.id || "") + " " + (el.getAttribute("aria-label") || "");
    if (/^tel:/i.test(href)) send("phone_call", { link_url: href, link_text: text });
    else if (/wa\.me|api\.whatsapp\.com|whatsapp:\/\/|whatsapp\.com\/send/i.test(href) || /whatsapp/i.test(hint))
      send("whatsapp_click", { link_url: href, link_text: text });
    else if (/^mailto:/i.test(href)) send("email_click", { link_url: href });
  }, true);
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!f || f.tagName !== "FORM") return;
    var meta = (f.id || "") + " " + (f.className || "") + " " + (f.getAttribute("action") || "") + " " + (f.getAttribute("role") || "");
    if (/search/i.test(meta)) return;
    send("lead_form_submit", {
      form_id: f.id || "",
      form_name: f.getAttribute("name") || "",
      form_action: (f.getAttribute("action") || "").slice(0, 120),
      page_path: location.pathname
    });
  }, true);
})();
