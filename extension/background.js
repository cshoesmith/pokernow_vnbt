// Fetches Untappd profile pages for untappd.js. Content scripts can't read
// cross-origin pages, but the extension can (host_permissions in the manifest).
// Only builds profile URLs itself, so a page can't use it to fetch anything else.

const USERNAME_RE = /^[\w.-]{2,40}$/;

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== "untappd" || !USERNAME_RE.test(msg.user)) return;
  fetch(`https://untappd.com/user/${msg.user}`, { credentials: "omit" })
    .then(async (res) => reply({ status: res.status, html: res.ok ? await res.text() : "" }))
    .catch(() => reply({ status: 0, html: "" }));
  return true;   // reply is async
});
