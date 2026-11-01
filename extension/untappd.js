// Untappd: a player whose Poker Now name is also their Untappd username gets a
// card in a banner on the felt, just above the table title - their avatar, latest beer,
// brewery, rating and ABV, and the check-in photo (or the beer label if there's
// no photo). background.js fetches the profile pages; results are cached so each
// is re-read every few minutes. The profile doesn't show ABV, so each new beer's
// page is read once.

(() => {
  if (!/^\/games\//.test(location.pathname)) return;

  const TICK_MS = 1000;
  const FRESH_MS = 5 * 60000;     // re-read a profile this often
  const MISSING_MS = 60 * 60000;  // no such Untappd user: try again much later
  const CACHE_KEY = "untappd3";   // v3 check-ins carry the avatar; older entries are re-read
  const ABV_KEY = "untappdAbv";
  const USERNAME_RE = /^[\w.-]{2,40}$/;
  const SCROLL_PX_PER_S = 40;
  // Only plain image links from Untappd (avatars are often on Gravatar) are allowed.
  const IMAGE_RE = /^https:\/\/([\w-]+\.)*(untappd\.com|untp\.beer|gravatar\.com)\/[^"'\\\s()]*$/;

  // lowercased name -> { next: ms to re-read at, checkin: {...} | null }
  let cache = {};
  // beer page path -> "5%" ("" if the page has none); ABV doesn't change, so kept for good
  let abvs = {};
  let enabled = false, timer = null, busy = false, bannerKey = "";

  // ---------- Reading a profile ----------
  // Each check-in in the feed is <div class="item" data-checkin-id="...">, with
  // "is drinking a <a href="/b/...">Beer</a> by <a href="/w/...">Brewery</a> at <a>Venue</a>".

  function parseCheckin(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const item = doc.querySelector("#main-stream .item[data-checkin-id]");
    const beer = item?.querySelector('.checkin .text a[href^="/b/"]');
    if (!beer) return null;   // no check-ins yet, or a private profile
    const image = (root, sel) => {
      const src = root.querySelector(sel)?.getAttribute("src");
      return src && IMAGE_RE.test(src) ? src : null;
    };
    const link = item.querySelector(".bottom a.time")?.getAttribute("href");
    return {
      id: item.dataset.checkinId,
      beer: beer.textContent.trim(),
      beerPath: beer.getAttribute("href"),
      // The brewery link follows the beer's; it's /w/... or a vanity link like /shoesmith_brews.
      brewery: beer.nextElementSibling?.matches("a") ? beer.nextElementSibling.textContent.trim() : "",
      rating: Number(item.querySelector(".caps[data-rating]")?.dataset.rating) || 0,
      image: image(item, ".photo img") || image(item, "a.label img"),
      avatar: image(doc, ".user-avatar .avatar-holder img"),
      url: link?.startsWith("/") ? `https://untappd.com${link}` : null
    };
  }

  // A beer page has <div class="details"><p class="abv">5% ABV</p>...
  async function fetchAbv(path) {
    try {
      const res = await chrome.runtime.sendMessage({ type: "untappd", beer: path });
      if (res?.status !== 200) return;   // try again on the next profile read
      const doc = new DOMParser().parseFromString(res.html, "text/html");
      abvs[path] = doc.querySelector(".details .abv")?.textContent.match(/\d+(\.\d+)?%/)?.[0] || "";
      chrome.storage.local.set({ [ABV_KEY]: abvs });
    } catch { /* offline: same */ }
  }

  async function refresh(name) {
    const key = name.toLowerCase();
    busy = true;
    try {
      const res = await chrome.runtime.sendMessage({ type: "untappd", user: name });
      if (res?.status === 200) {
        const checkin = parseCheckin(res.html);
        if (checkin?.beerPath && !(checkin.beerPath in abvs)) await fetchAbv(checkin.beerPath);
        cache[key] = { next: Date.now() + FRESH_MS, checkin };
      }
      else if (res?.status === 404) cache[key] = { next: Date.now() + MISSING_MS, checkin: null };
      else throw new Error(`status ${res?.status}`);
    } catch {
      // Rate limited or offline: keep what we had and try again later.
      cache[key] = { checkin: null, ...cache[key], next: Date.now() + FRESH_MS };
    } finally {
      busy = false;
    }
    if (chrome.runtime?.id) chrome.storage.local.set({ [CACHE_KEY]: cache });
  }

  // ---------- Banner ----------
  // Lives inside .table, so it scales with the game: Poker Now sizes everything in
  // rem from the window. It fills the gap between the community cards (same left
  // and width) and the title, which content.js prints about 65% down the table.
  // Seats (z-index 4) and the cards (z-index 2) stay on top of it.

  const style = document.createElement("style");
  style.id = "clean-poker-untappd";
  style.textContent = `
    #cp-banner { position: absolute; left: 28%; width: 44%; top: 57.5%; height: 7%; z-index: 1; overflow: hidden;
      display: flex; align-items: center; border-radius: 0.4rem; background: rgba(26,26,25,0.85);
      mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
      font: 400 0.6rem/1.25 system-ui, -apple-system, "Segoe UI", sans-serif; }
    .cp-banner-track { display: inline-flex; align-items: center; flex: none; margin: 0 auto; }
    .cp-banner-track.cp-scroll { margin: 0; animation: cp-banner-scroll var(--cp-scroll-s) linear infinite; }
    #cp-banner:hover .cp-banner-track { animation-play-state: paused; }
    @keyframes cp-banner-scroll { to { transform: translateX(-50%); } }
    .cp-banner-card { display: flex; align-items: center; gap: 0.4rem; padding: 0 0.8rem; white-space: nowrap;
      color: #c3c2b7 !important; text-decoration: none; }
    a.cp-banner-card:hover .cp-banner-beer { text-decoration: underline; }
    .cp-banner-card img { display: block; flex: none; height: 1.5rem; width: 1.5rem; object-fit: cover; }
    img.cp-banner-avatar { border-radius: 50%; }
    img.cp-banner-photo { border-radius: 0.2rem; }
    .cp-banner-name { color: #f0efec; font-weight: 600; }
    .cp-banner-beer { color: #ffc54d; font-weight: 600; }
    .cp-banner-rating { color: #f5b82e; }`;

  const banner = document.createElement("div");
  banner.id = "cp-banner";
  const track = document.createElement("div");
  track.className = "cp-banner-track";
  banner.append(track);

  const playerName = (seat) => seat.querySelector(".table-player-name a")?.textContent.trim() || "";

  function span(className, text) {
    const el = document.createElement("span");
    el.className = className;
    el.textContent = text;
    return el;
  }

  function img(className, src) {
    const el = document.createElement("img");
    el.className = className;
    el.alt = "";
    el.src = src;
    return el;
  }

  function card({ name, checkin }) {
    const el = document.createElement(checkin.url ? "a" : "div");
    el.className = "cp-banner-card";
    if (checkin.url) { el.href = checkin.url; el.target = "_blank"; el.rel = "noopener"; }
    const first = document.createElement("div");
    first.append(span("cp-banner-name", name), " · ", span("cp-banner-beer", checkin.beer));
    const second = document.createElement("div");
    const details = [["", checkin.brewery], ["cp-banner-rating", checkin.rating && `★ ${checkin.rating}`], ["", abvs[checkin.beerPath]]];
    details.filter(([, value]) => value).forEach(([className, value], i) => second.append(i ? " · " : "", span(className, value)));
    const text = document.createElement("div");
    text.append(first, second);
    if (checkin.avatar) el.append(img("cp-banner-avatar", checkin.avatar));
    el.append(text);
    if (checkin.image) el.append(img("cp-banner-photo", checkin.image));
    return el;
  }

  function showBanner(players) {
    const table = document.querySelector(".table");
    if (!players.length || !table) { banner.remove(); bannerKey = ""; return; }
    if (banner.parentElement !== table) table.appendChild(banner);
    const key = JSON.stringify([players, players.map((p) => abvs[p.checkin.beerPath])]);
    if (key === bannerKey) return;
    bannerKey = key;
    track.classList.remove("cp-scroll");
    track.replaceChildren(...players.map(card));
    // Too wide to fit: scroll two copies, so the second slides in behind the first.
    const width = track.offsetWidth;
    if (width > banner.clientWidth) {
      track.append(...[...track.children].map((el) => el.cloneNode(true)));
      track.style.setProperty("--cp-scroll-s", `${width / SCROLL_PX_PER_S}s`);
      track.classList.add("cp-scroll");
    }
  }

  function tick() {
    // The extension was reloaded or updated: this copy can't reach Chrome any more.
    // The new copy takes over once the tab is refreshed.
    if (!chrome.runtime?.id) { clearInterval(timer); return; }
    if (!style.isConnected) document.head.appendChild(style);
    let due = null;
    const players = [];
    for (const seat of document.querySelectorAll(".table-player:not(.table-player-seat)")) {
      const name = playerName(seat);
      const entry = USERNAME_RE.test(name) ? cache[name.toLowerCase()] : null;
      if (entry?.checkin) players.push({ name, checkin: entry.checkin });
      if (USERNAME_RE.test(name) && !(entry?.next > Date.now())) due ??= name;
    }
    showBanner(players);
    if (due && !busy) refresh(due);   // one profile at a time
  }

  // ---------- Lifecycle ----------

  async function setEnabled(on) {
    if (on === enabled) return;
    enabled = on;
    clearInterval(timer);
    if (on) {
      const stored = await chrome.storage.local.get([CACHE_KEY, ABV_KEY]);
      cache = stored[CACHE_KEY] || {};
      abvs = stored[ABV_KEY] || {};
      chrome.storage.local.remove(["untappd", "untappd2"]);   // older caches
      if (enabled) timer = setInterval(tick, TICK_MS);   // unless switched off meanwhile
    } else {
      style.remove();
      banner.remove();
      bannerKey = "";
    }
  }

  chrome.storage.sync.get({ untappd: true }, (s) => setEnabled(s.untappd));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.untappd) setEnabled(changes.untappd.newValue);
  });
})();
