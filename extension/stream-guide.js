// The TV window's channel guide (kept in step with vNBT TV's tv-guide.js, which
// differs only in its setting names): the channels of the chosen list (sync setting tableStreamList),
// group by group, dead ones left out (iptv.js). Moving the mouse shows a
// "Channels" tab on the right edge; clicking it pulls the guide out, and it
// slides away soon after the mouse leaves it. Click a channel, or step with the
// arrow buttons or Up/Down keys, which run on from the end of one group into the
// next. The list's name at the top opens a chooser of every list. Search narrows
// the channels; "Check channels" tests the whole list (in background.js) and
// hides the ones that don't work. The first time, it starts on World news.

(() => {
  const FIRST_LIST = "Global";
  const TAB_MS = 2000;     // the tab fades this long after the mouse stops
  const LEAVE_MS = 500;    // the guide slides away this long after the mouse leaves it
  const UNUSED_MS = 2500;  // ...or this long after opening, if the mouse never goes onto it
  const $ = (id) => document.getElementById(id);
  const guide = $("guide"), scroller = $("guideScroll"), tab = $("guideTab"), listName = $("guideList"), zap = $("zap");
  const search = $("guideSearch"), osd = $("osd"), showDead = $("showDead"), deadCount = $("deadCount");
  const checkButton = $("checkChannels"), checkInfo = $("checkInfo");
  let choosing = false;   // showing the lists instead of the channels
  let listId = "", channels = [], shown = [], health = {}, check = null;
  let hideTimer = null, tabTimer = null, osdTimer = null, loading = null, redraw = null;

  const labelOf = (id) => IPTV_MENU.flatMap(([, lists]) => lists).find(([i]) => i === id)?.[1] ?? "";
  const typing = (e) => e.target instanceof HTMLInputElement;

  // --- Showing and hiding ----------------------------------------------------

  const body = document.body.classList;

  function showTab(ms = TAB_MS) {
    body.add("tab-on");
    clearTimeout(tabTimer);
    tabTimer = setTimeout(() => { if (!tab.matches(":hover") && !zap.matches(":hover")) body.remove("tab-on"); }, ms);
  }
  addEventListener("mousemove", () => { if (!touch) showTab(); });
  tab.addEventListener("mouseleave", () => showTab());
  zap.addEventListener("mouseleave", () => { if (!touch) showTab(); });

  // Open the guide, closing it after ms unless the mouse is on it, or the search
  // box is being typed in, by then.
  function showGuide(ms = UNUSED_MS) {
    body.add("guide-on");
    mark(true);
    hideGuide(ms);
  }
  function hideGuide(ms) {
    clearTimeout(hideTimer);
    if (touch) return;   // on a touch screen it stays until a tap outside it
    hideTimer = setTimeout(() => {
      if (guide.matches(":hover") || document.activeElement === search) return;
      closeGuide();
    }, ms);
  }
  function closeGuide() {
    body.remove("guide-on");
    if (choosing) setTimeout(closeChooser, 250);   // reopens on the channels, once it's slid away
  }

  // Phones and tablets (Kiwi Browser on Android, say): there's no mouse to show
  // the tab or to leave the guide, so a tap shows the tab, and the guide stays
  // open (for scrolling through it) until a tap on the picture outside it.
  let touch = false;
  addEventListener("pointerdown", (e) => {
    touch = e.pointerType !== "mouse";
    if (!touch) { showTab(); return; }   // a click shows the tab and buttons too, as moving the mouse does
    if (body.contains("guide-on") && !guide.contains(e.target)) closeGuide();
    else if (!guide.contains(e.target)) showTab(4000);
  }, true);
  tab.addEventListener("click", () => showGuide());
  guide.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  guide.addEventListener("mouseleave", () => hideGuide(LEAVE_MS));
  search.addEventListener("blur", () => hideGuide(LEAVE_MS));

  function showOsd(c, note = "") {
    if (!c) return;
    osd.replaceChildren(c.label);
    const small = document.createElement("small");
    small.textContent = [c.groupLabel, note].filter(Boolean).join(" · ");
    if (small.textContent) osd.append(small);
    osd.classList.add("on");
    clearTimeout(osdTimer);
    if (!note) osdTimer = setTimeout(() => osd.classList.remove("on"), 3000);
  }

  // --- The list ------------------------------------------------------------

  function render(center = false) {
    if (choosing) return;
    const q = search.value.trim().toLowerCase();
    const dead = channels.filter((c) => iptvIsDead(c.url, health)).length;
    deadCount.textContent = dead;
    showDead.parentElement.hidden = !dead;
    shown = iptvVisible(channels.filter((c) => !q || c.search.includes(q)), health, url, showDead.checked);
    const rows = [];
    let group = null;
    for (const c of shown) {
      if (c.groupLabel !== group) {
        group = c.groupLabel;
        const head = document.createElement("div");
        head.className = "head";
        head.textContent = group || "Other";
        rows.push(head);
      }
      const row = document.createElement("div");
      row.className = "ch" + (iptvIsDead(c.url, health) ? " dead" : "");
      row.textContent = (iptvIsDead(c.url, health) ? "✕ " : "") + c.label;
      if (c.label !== c.name) row.title = c.name;   // the original name on hover
      row.dataset.url = c.url;
      row.addEventListener("click", () => pick(c));
      rows.push(row);
    }
    if (!shown.length) {
      const none = document.createElement("div");
      none.className = "empty";
      none.textContent = q ? "No channels match." : dead ? "None working: tick Show dead channels." : "No channels in this list.";
      rows.push(none);
    }
    // Redrawn as channels are marked working or dead: keep the list where it was
    // (it's only moved to the channel that's on when that changes, or it opens).
    const top = scroller.scrollTop;
    scroller.replaceChildren(...rows);
    scroller.scrollTop = top;
    mark(center);
  }

  // Highlight the channel that's on; with center, also scroll the list to it.
  // (Done by hand: scrollIntoView can shift the whole page, video and all.)
  function mark(center = false) {
    let on = null;
    for (const row of choosing ? [] : scroller.querySelectorAll(".ch")) {
      const is = row.dataset.url === url;
      row.classList.toggle("on", is);
      if (is) on = row;
    }
    if (center && on) scroller.scrollTop = on.offsetTop - (scroller.clientHeight - on.offsetHeight) / 2;
    const c = channels.find((x) => x.url === url);
    document.title = c ? `vNBT Poker TV - ${c.label}` : "vNBT Poker TV";
  }

  function setHeading(text) {
    listName.textContent = text;
  }

  async function load(id) {
    listId = id;
    channels = [];
    choosing = false;
    search.value = "";
    showCheck();
    const wait = document.createElement("div");
    wait.className = "empty";
    wait.textContent = "Loading channels…";
    scroller.replaceChildren(wait);
    setHeading(labelOf(id) + " ▾");
    const mine = loading = id;
    try {
      const found = await iptvChannels(id);
      if (loading !== mine) return [];
      channels = found;
      render(true);
      return channels;
    } catch {
      if (loading === mine) wait.textContent = "Couldn't load the channels. Try another list.";
      return [];
    }
  }

  // The list chooser: every list in the menu (iptv.js), in its groups, leaving
  // out those with nothing working. Picking one shows its channels; what's on
  // keeps playing until a channel is picked from them.
  function closeChooser() {
    if (!choosing) return;
    choosing = false;
    setHeading(labelOf(listId) + " ▾");
    render(true);
  }

  function chooseList() {
    if (choosing) { closeChooser(); return; }
    choosing = true;
    setHeading("Choose a list ▴");
    const rows = [];
    let on = null;
    for (const [heading, lists] of IPTV_MENU) {
      const items = lists.filter(([id]) => !iptvListIsDead(id));
      if (!items.length) continue;
      const head = document.createElement("div");
      head.className = "head";
      head.textContent = heading;
      rows.push(head);
      for (const [id, label] of items) {
        const row = document.createElement("div");
        row.className = "ch" + (id === listId ? " on" : "");
        row.textContent = label;
        row.addEventListener("click", () => {
          if (id !== listId) chrome.storage.sync.set({ tableStreamList: id });
          load(id);
        });
        if (id === listId) on = row;
        rows.push(row);
      }
    }
    scroller.replaceChildren(...rows);
    scroller.scrollTop = on ? on.offsetTop - (scroller.clientHeight - on.offsetHeight) / 2 : 0;
  }
  listName.addEventListener("click", chooseList);
  listName.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chooseList(); } });

  search.addEventListener("input", () => render());
  showDead.addEventListener("change", () => render());

  // --- Changing channel ----------------------------------------------------

  function pick(c) {
    if (c.url === url) return;
    start(c.url);   // play it now (stream-player.js)...
    chrome.storage.sync.set({ tableStream: c.url });   // ...and remember it
  }

  // glimpse: slide the guide out briefly to show where you are. Not from the
  // buttons over the picture: the channel's name shows anyway, and it's less to look at.
  function step(by, glimpse = true) {
    closeChooser();
    if (!shown.length) return;
    const at = shown.findIndex((c) => c.url === url);
    pick(shown[at < 0 ? (by > 0 ? 0 : shown.length - 1) : (at + by + shown.length) % shown.length]);
    if (glimpse && !guide.matches(":hover")) showGuide(1500);
  }
  $("chUp").addEventListener("click", () => step(-1));
  $("chDown").addEventListener("click", () => step(1));
  $("zapNext").addEventListener("click", () => step(1, false));   // + and -, as on a remote
  $("zapPrev").addEventListener("click", () => step(-1, false));
  // Up/Down change channel (rather than the video's volume, as they otherwise might).
  addEventListener("keydown", (e) => {
    const by = { ArrowUp: -1, PageUp: -1, ArrowDown: 1, PageDown: 1 }[e.key];
    if (!by || !channels.length || (typing(e) && e.key.startsWith("Page"))) return;
    e.preventDefault();
    e.stopPropagation();
    step(by);
  }, true);

  // From the player: a new channel started, and when it's actually playing.
  window.cpChannelChanged = () => {
    mark(true);
    showOsd(channels.find((c) => c.url === url), "connecting…");
  };
  window.cpChannelPlaying = () => showOsd(channels.find((c) => c.url === url));
  window.cpChannelFailed = () => showOsd(channels.find((c) => c.url === url), "not working: try ▲ ▼");

  // --- Checking a whole list -----------------------------------------------
  // background.js tests every channel in the list, so it carries on if the tab
  // closes; progress comes back as streamCheck in local storage.

  checkButton.addEventListener("click", () => {
    if (!channels.length) return;
    chrome.runtime.sendMessage({ type: "stream-check", list: listId, urls: channels.map((c) => c.url) });
  });
  setInterval(() => showCheck(), 5000);   // notices a check that stopped
  function showCheck() {
    // A check counts as running while its progress is recent (the background can be stopped).
    const mine = check && check.list === listId;
    const running = mine && check.done < check.total && Date.now() - check.at < 30000;
    checkButton.disabled = !!running;
    checkInfo.textContent = running ? `${check.done} of ${check.total}, ${check.dead} dead`
      : mine && check.done >= check.total && Date.now() - check.at < 10 * 60000 ? `${check.total - check.dead} of ${check.total} working` : "";
  }

  // --- Full screen ---------------------------------------------------------
  // The whole page goes full screen, so the tab, guide and channel name come too
  // (the video's own button would take just the video). Also by double-clicking
  // the picture, or F.
  const fullBtn = $("fullBtn");
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  fullBtn.addEventListener("click", toggleFull);
  video.addEventListener("dblclick", (e) => { e.preventDefault(); toggleFull(); });
  addEventListener("keydown", (e) => {
    if (typing(e)) return;
    if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); toggleFull(); }
  });
  document.addEventListener("fullscreenchange", () => {
    fullBtn.title = document.fullscreenElement ? "Exit full screen (F or Esc)" : "Full screen (F)";
    fullBtn.setAttribute("aria-label", fullBtn.title);
  });

  // --- Starting up -----------------------------------------------------------

  Promise.all([
    chrome.storage.sync.get({ tableStreamList: "", tableStream: "", tableStreamSound: false }),
    chrome.storage.local.get({ streamHealth: {}, streamCheck: null })
  ]).then(async ([s, l]) => {
    health = l.streamHealth;
    check = l.streamCheck;
    wantSound = !!s.tableStreamSound;   // stream-player.js
    const saved = iptvListId(s.tableStreamList);
    const id = labelOf(saved) && !iptvListIsDead(saved) ? saved : FIRST_LIST;
    const found = await load(id);
    // The channel last watched, or else the list's first working one.
    const first = s.tableStream || iptvVisible(found, health, "")[0]?.url;
    if (first) {
      start(first);
      if (!s.tableStream) chrome.storage.sync.set({ tableStreamList: id, tableStream: first });
    }
    showTab(4000);   // so the Channels tab is noticed
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    // Another TV tab choosing a list. (A change made here has been loaded already.)
    if (area === "sync" && changes.tableStreamList && (changes.tableStreamList.newValue || "") !== listId) load(iptvListId(changes.tableStreamList.newValue) || FIRST_LIST);
    if (area === "local" && changes.streamCheck) { check = changes.streamCheck.newValue; showCheck(); }
    if (area === "local" && changes.streamHealth) {
      // Marks arrive as channels play or fail: redraw now and then, not every time.
      health = changes.streamHealth.newValue || {};
      if (!redraw) redraw = setTimeout(() => { redraw = null; if (channels.length) render(); }, 1000);
    }
  });
})();
