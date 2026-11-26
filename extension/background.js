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

// Fetches http:// stream files for the TV window (stream-player.js). Chrome
// won't load plain http into a secure page like the window's, but the service
// worker isn't a page. Only answers the TV window itself.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== "stream-fetch") return;
  if (sender.url?.split(/[?#]/)[0] !== chrome.runtime.getURL("stream.html")) return;
  if (typeof msg.url !== "string" || !/^http:\/\/\S+$/i.test(msg.url)) return;
  const headers = typeof msg.range === "string" && /^bytes=\d+-\d*$/.test(msg.range) ? { Range: msg.range } : {};
  fetch(msg.url, { credentials: "omit", headers })
    .then(async (res) => {
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      reply({ status: res.status, url: res.url, data: btoa(bin) });   // messages carry text, not bytes
    })
    .catch((err) => reply({ status: 0, error: String(err) }));
  return true;   // reply is async
});

// The TV window, opened from the TV button on the table (stream.js). Its id is
// kept in session storage (streamPopout), so the button brings an open one to
// the front rather than opening another.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== "tv-open" || !sender.tab) return;
  (async () => {
    const { streamPopout: open } = await chrome.storage.session.get("streamPopout");
    if (open) {
      try { await chrome.windows.update(open, { focused: true }); return; } catch {}   // gone: open a new one
    }
    const win = await chrome.windows.create({
      url: chrome.runtime.getURL("stream.html"), type: "popup", width: 960, height: 540, focused: true
    });
    await chrome.storage.session.set({ streamPopout: win.id });
  })().catch((err) => console.warn("vNBT Poker: couldn't open the TV window", err));
});

chrome.windows.onRemoved.addListener(async (id) => {
  const { streamPopout } = await chrome.storage.session.get("streamPopout");
  if (streamPopout === id) await chrome.storage.session.remove("streamPopout");
});

// Which TV channels work. streamHealth in local storage maps a link to
// { ok, at }: marked by the player (stream-player.js) when a channel plays or
// never starts, and by "Check channels" in the TV window's guide, which tests a
// whole list here so it carries on after the window closes. Only written from here, so two
// updates can't overwrite each other. Marks older than a week are dropped.
const HEALTH_KEEP_MS = 7 * 24 * 3600 * 1000;
let health = null, healthTimer = null;

async function setHealth(url, ok) {
  health ??= chrome.storage.local.get({ streamHealth: {} }).then(({ streamHealth }) => {
    for (const [u, h] of Object.entries(streamHealth)) if (!(Date.now() - h.at < HEALTH_KEEP_MS)) delete streamHealth[u];
    return streamHealth;
  });
  (await health)[url] = { ok, at: Date.now() };
  clearTimeout(healthTimer);
  healthTimer = setTimeout(async () => chrome.storage.local.set({ streamHealth: await health }), 300);
}

// Does a stream work? Its playlist, then (for a list of qualities) the first
// quality's playlist, then the first video segment must all load, and not be a
// "this channel is gone" clip. Many channels
// answer the first and refuse the rest outside their own country.
async function probeStream(url) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 12000);
  const get = (u) => fetch(u, { credentials: "omit", signal: stop.signal });
  // The link on the line after the first line starting with tag.
  const after = (text, tag) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    const i = lines.findIndex((l) => l.startsWith(tag));
    return i < 0 ? null : lines.slice(i + 1).find((l) => l && !l.startsWith("#")) ?? null;
  };
  try {
    let res = await get(url);
    if (!res.ok) return false;
    if (/\.(mp4|m4v|webm|mov|ogv)(\?|#|$)/i.test(url)) return true;   // a video file: it answered
    let text = await res.text();
    if (!text.includes("#EXTM3U")) return false;
    const variant = after(text, "#EXT-X-STREAM-INF");
    if (variant) {
      res = await get(new URL(variant, res.url).href);
      if (!res.ok) return false;
      text = await res.text();
    }
    const segment = after(text, "#EXTINF");
    if (!segment) return false;
    // Pluto TV (and maybe others) answer a channel they've shut off with a
    // "takedown slate": a short clip saying it's gone, which plays fine.
    if (/takedown/i.test(segment)) return false;
    return (await get(new URL(segment, res.url).href)).ok;   // the headers are enough: the rest is cut off below
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    stop.abort();
  }
}

// Checks every channel in a list, several at a time, with progress in local
// storage (streamCheck) for the guide. Starting another check stops this one.
let checkRun = 0;
async function checkStreams(list, urls) {
  const run = ++checkRun;
  let next = 0, done = 0, dead = 0;
  const progress = () => chrome.storage.local.set({ streamCheck: { list, done, dead, total: urls.length, at: Date.now() } });
  await progress();
  const worker = async () => {
    while (run === checkRun && next < urls.length) {
      const url = urls[next++];
      const ok = await probeStream(url);
      if (run !== checkRun) return;
      await setHealth(url, ok);
      done++;
      if (!ok) dead++;
      await progress();
    }
  };
  await Promise.all(Array.from({ length: 16 }, worker));
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  const from = sender.url?.split(/[?#]/)[0];
  if (msg?.type === "stream-health" && from === chrome.runtime.getURL("stream.html") && typeof msg.url === "string") {
    setHealth(msg.url, !!msg.ok);
  } else if (msg?.type === "stream-check" && from === chrome.runtime.getURL("stream.html") && Array.isArray(msg.urls)) {
    const urls = [...new Set(msg.urls.filter((u) => typeof u === "string" && /^https?:\/\/\S+$/i.test(u)))];
    checkStreams(String(msg.list), urls);
  }
});
