// Fetches Untappd profile and beer pages for untappd.js. Content scripts can't
// read cross-origin pages, but the extension can (host_permissions in the
// manifest). Only builds profile and beer URLs itself, so a page can't use it to
// fetch anything else.

const USERNAME_RE = /^[\w.-]{2,40}$/;
const BEER_RE = /^\/b\/\w[\w.-]{0,120}\/\d{1,12}$/;   // e.g. /b/kizakura-co-lucky-dog/2100739

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== "untappd") return;
  const path = USERNAME_RE.test(msg.user) ? `/user/${msg.user}`
    : BEER_RE.test(msg.beer) ? msg.beer : null;
  if (!path) return;
  fetch(`https://untappd.com${path}`, { credentials: "omit" })
    .then(async (res) => reply({ status: res.status, html: res.ok ? await res.text() : "" }))
    .catch(() => reply({ status: 0, html: "" }));
  return true;   // reply is async
});
