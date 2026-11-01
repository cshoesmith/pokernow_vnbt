// Fetches Untappd profile and beer pages for untappd.js. Content scripts can't
// read cross-origin pages, but the extension can (host_permissions in the
// manifest). Only builds profile and beer URLs itself, so a page can't use it to
// fetch anything else.

const USERNAME_RE = /^[\w.-]{2,40}$/;
const BEER_RE = /^\/b\/\w[\w.-]{0,120}\/\d{1,12}$/;   // e.g. /b/kizakura-co-lucky-dog/2100739

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== "untappd") return;
  // Cloudflare keeps a copy of each profile URL for up to 4 hours, so a new
  // check-in can be missing from it. A query string that changes each minute
  // gets a fresh copy, shared by everyone who asks within that minute.
  const minute = Math.floor(Date.now() / 60000);
  const valid = (re, s) => typeof s === "string" && re.test(s);   // test(undefined) checks "undefined"
  const path = valid(USERNAME_RE, msg.user) ? `/user/${msg.user}?v=${minute}`
    : valid(BEER_RE, msg.beer) ? msg.beer : null;
  if (!path) return;
  fetch(`https://untappd.com${path}`, { credentials: "omit" })
    .then(async (res) => reply({ status: res.status, html: res.ok ? await res.text() : "" }))
    .catch(() => reply({ status: 0, html: "" }));
  return true;   // reply is async
});

// Saves a screenshot for capture.js into Downloads\vNBT Poker. captureVisibleTab
// takes whichever tab is in front, so only runs while that's still the game. It
// needs <all_urls>: the narrower activeTab only comes from clicking the extension.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== "capture" || !sender.tab?.active) return;
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  const stamp = local.toISOString().slice(0, 19).replace("T", " ").replace(/:/g, ".");
  const hand = String(msg.hand).replace(/[^\w -]/g, "");
  chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" })
    .then((url) => chrome.downloads.download({ url, filename: `vNBT Poker/${stamp} ${hand}.png`, conflictAction: "uniquify" }))
    .catch((err) => console.warn("vNBT Poker: screenshot failed", err));
});
