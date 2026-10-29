// Untappd: a player whose Poker Now name is also their Untappd username gets
// their latest check-in on their seat sign - beer, brewery and rating over the
// check-in photo (or the beer label if there's no photo). background.js fetches
// the profile pages; results are cached so each is re-read every few minutes.

(() => {
  if (!/^\/games\//.test(location.pathname)) return;

  const TICK_MS = 1000;
  const FRESH_MS = 5 * 60000;     // re-read a profile this often
  const MISSING_MS = 60 * 60000;  // no such Untappd user: try again much later
  const CACHE_KEY = "untappd";
  const USERNAME_RE = /^[\w.-]{2,40}$/;
  // Images go into a CSS url(), so only plain Untappd image links are allowed.
  const IMAGE_RE = /^https:\/\/([\w-]+\.)*(untappd\.com|untp\.beer)\/[^"'\\\s()]*$/;

  // lowercased name -> { next: ms to re-read at, checkin: {...} | null }
  let cache = {};
  let enabled = false, timer = null, busy = false;

  // ---------- Reading a profile ----------
  // Each check-in in the feed is <div class="item" data-checkin-id="...">, with
  // "is drinking a <a href="/b/...">Beer</a> by <a href="/w/...">Brewery</a>".

  function parseCheckin(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const item = doc.querySelector("#main-stream .item[data-checkin-id]");
    const beer = item?.querySelector('.checkin .text a[href^="/b/"]');
    if (!beer) return null;   // no check-ins yet, or a private profile
    const image = (sel) => {
      const src = item.querySelector(sel)?.getAttribute("src");
      return src && IMAGE_RE.test(src) ? src : null;
    };
    const link = item.querySelector(".bottom a.time")?.getAttribute("href");
    return {
      id: item.dataset.checkinId,
      beer: beer.textContent.trim(),
      brewery: item.querySelector('.checkin .text a[href^="/w/"]')?.textContent.trim() || "",
      rating: Number(item.querySelector(".caps[data-rating]")?.dataset.rating) || 0,
      image: image(".photo img") || image("a.label img"),
      url: link?.startsWith("/") ? `https://untappd.com${link}` : null
    };
  }

  async function refresh(name) {
    const key = name.toLowerCase();
    busy = true;
    try {
      const res = await chrome.runtime.sendMessage({ type: "untappd", user: name });
      if (res?.status === 200) cache[key] = { next: Date.now() + FRESH_MS, checkin: parseCheckin(res.html) };
      else if (res?.status === 404) cache[key] = { next: Date.now() + MISSING_MS, checkin: null };
      else throw new Error(`status ${res?.status}`);
    } catch {
      // Rate limited or offline: keep what we had and try again later.
      cache[key] = { checkin: null, ...cache[key], next: Date.now() + FRESH_MS };
    } finally {
      busy = false;
    }
    chrome.storage.local.set({ [CACHE_KEY]: cache });
  }

  // ---------- Seat signs ----------
  // The sign (.table-player-infos-ctn) is a positioned box with its own stacking
  // context; the name and stack sit in its right half and the avatar/status in
  // its left, leaving a band along the top and the corner under the stack free.
  // Our layer sits at z-index -1: over the sign's own background, under its contents.

  const style = document.createElement("style");
  style.id = "clean-poker-untappd";
  style.textContent = `
    .cp-beer { position: absolute; inset: 0; z-index: -1; container-type: size; pointer-events: none;
      background-size: cover; background-position: center; color: #f0efec; }
    .cp-beer > * { position: absolute; display: flex; align-items: center; gap: 4cqw; white-space: nowrap;
      font: 600 14cqh/1.2 system-ui, -apple-system, "Segoe UI", sans-serif; }   /* cq units: sized to the sign */
    .cp-beer-top { left: 4cqw; right: 4cqw; top: 3cqh; height: 22cqh; }
    .cp-beer-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
      color: inherit !important; text-decoration: none; pointer-events: auto; }
    .cp-beer-name:hover { text-decoration: underline; }
    .cp-beer-rating { color: #f5b82e; }
    .cp-beer-brewery { left: 52cqw; right: 4cqw; bottom: 3cqh; height: 20cqh; overflow: hidden;
      text-overflow: ellipsis; display: block; line-height: 20cqh; color: #c3c2b7; font-weight: 400; }`;

  const playerName = (seat) => seat.querySelector(".table-player-name a")?.textContent.trim() || "";

  function span(className, text) {
    const el = document.createElement("span");
    el.className = className;
    el.textContent = text;
    return el;
  }

  function decorate(seat, checkin) {
    const box = seat.querySelector(".table-player-infos-ctn");
    let sign = box?.querySelector(":scope > .cp-beer");
    if (!checkin) { sign?.remove(); return; }
    if (!box || sign?.dataset.id === checkin.id) return;
    if (!sign) {
      sign = document.createElement("div");
      sign.className = "cp-beer";
      box.appendChild(sign);
    }
    sign.dataset.id = checkin.id;
    sign.style.backgroundImage = checkin.image
      ? `linear-gradient(rgba(20,20,20,0.55), rgba(20,20,20,0.82)), url("${checkin.image}")` : "";

    const name = document.createElement(checkin.url ? "a" : "span");
    name.className = "cp-beer-name";
    name.textContent = checkin.beer;
    name.title = checkin.brewery ? `${checkin.beer} by ${checkin.brewery}` : checkin.beer;
    if (checkin.url) { name.href = checkin.url; name.target = "_blank"; name.rel = "noopener"; }
    const top = document.createElement("div");
    top.className = "cp-beer-top";
    top.append(name);
    if (checkin.rating) top.append(span("cp-beer-rating", `★ ${checkin.rating}`));
    sign.replaceChildren(top, span("cp-beer-brewery", checkin.brewery));
  }

  function tick() {
    if (!style.isConnected) document.head.appendChild(style);
    let due = null;
    for (const seat of document.querySelectorAll(".table-player:not(.table-player-seat)")) {
      const name = playerName(seat);
      const entry = USERNAME_RE.test(name) ? cache[name.toLowerCase()] : null;
      decorate(seat, entry?.checkin);
      if (USERNAME_RE.test(name) && !(entry?.next > Date.now())) due ??= name;
    }
    if (due && !busy) refresh(due);   // one profile at a time
  }

  // ---------- Lifecycle ----------

  async function setEnabled(on) {
    if (on === enabled) return;
    enabled = on;
    clearInterval(timer);
    if (on) {
      cache = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {};
      if (enabled) timer = setInterval(tick, TICK_MS);   // unless switched off meanwhile
    } else {
      style.remove();
      document.querySelectorAll(".cp-beer").forEach((el) => el.remove());
    }
  }

  chrome.storage.sync.get({ untappd: true }, (s) => setEnabled(s.untappd));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.untappd) setEnabled(changes.untappd.newValue);
  });
})();
