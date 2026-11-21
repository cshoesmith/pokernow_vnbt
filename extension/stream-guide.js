// The video window's channel guide (stream.html?popout only): the channels of the
// list picked in the popup (tableStreamList), group by group, dead ones left out
// as in the popup's menu (iptv.js). Moving the mouse shows a "Channels" tab on
// the right edge; clicking it pulls the guide out, and it slides away soon after
// the mouse leaves it. Click a channel, or step with the arrow buttons or Up/Down keys, which
// run on from the end of one group into the next. A new channel is played here
// at once (start() in stream-player.js) and saved as tableStream, so the popup
// follows and the table plays it once the window closes. The list's name at the
// top opens a chooser of every list (as in the popup), to switch to another.

(() => {
  if (!POPOUT) return;
  const TAB_MS = 2000;     // the tab fades this long after the mouse stops
  const LEAVE_MS = 500;    // the guide slides away this long after the mouse leaves it
  const UNUSED_MS = 2500;  // ...or this long after opening, if the mouse never goes onto it
  const guide = document.getElementById("guide"), scroller = document.getElementById("guideScroll");
  const tab = document.getElementById("guideTab");
  const listName = document.getElementById("guideList"), osd = document.getElementById("osd");
  let choosing = false;   // showing the lists instead of the channels
  let listId = "", channels = [], shown = [], health = {}, hideTimer = null, tabTimer = null, osdTimer = null, loading = null, redraw = null;

  const labelOf = (id) => IPTV_MENU.flatMap(([, lists]) => lists).find(([i]) => i === id)?.[1] ?? "";

  // --- Showing and hiding ----------------------------------------------------

  const body = document.body.classList;

  function showTab() {
    body.add("tab-on");   // the full-screen button comes with it; the tab itself needs channels
    clearTimeout(tabTimer);
    tabTimer = setTimeout(() => { if (!tab.matches(":hover")) body.remove("tab-on"); }, TAB_MS);
  }
  addEventListener("mousemove", showTab);
  tab.addEventListener("mouseleave", showTab);

  // Open the guide, closing it after ms unless the mouse is on it by then.
  function showGuide(ms = UNUSED_MS) {
    if (!channels.length) return;
    body.add("guide-on");
    mark(true);
    hideGuide(ms);
  }
  function hideGuide(ms) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (guide.matches(":hover")) return;
      body.remove("guide-on");
      if (choosing) setTimeout(closeChooser, 250);   // reopens on the channels, once it's slid away
    }, ms);
  }
  tab.addEventListener("click", () => showGuide());
  guide.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  guide.addEventListener("mouseleave", () => hideGuide(LEAVE_MS));

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
    shown = iptvVisible(channels, health, url);
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
      row.className = "ch";
      row.textContent = c.label;
      if (c.label !== c.name) row.title = c.name;   // the original name on hover
      row.dataset.url = c.url;
      row.addEventListener("click", () => pick(c));
      rows.push(row);
    }
    if (!shown.length) {
      const none = document.createElement("div");
      none.className = "empty";
      none.textContent = "No working channels in this list.";
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
    const wait = document.createElement("div");
    wait.className = "empty";
    wait.textContent = "Loading channels…";
    scroller.replaceChildren(wait);
    setHeading(labelOf(id) + " ▾");
    body.remove("has-channels");
    if (!id || id === "custom") { body.remove("guide-on", "tab-on"); return; }
    const mine = loading = id;
    try {
      const found = await iptvChannels(id);
      if (loading !== mine) return;
      channels = found;
      body.toggle("has-channels", channels.length > 0);
      render(true);
    } catch {
      if (loading === mine) wait.textContent = "Couldn't load the channels. Try another list.";
    }
  }

  // The list chooser: every list in the popup's menu (iptv.js), in its groups,
  // leaving out those with nothing working. Picking one shows its channels;
  // what's on keeps playing until a channel is picked from them.
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
          if (id !== listId) chrome.storage.sync.set({ tableStreamList: id });   // the popup follows
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

  // --- Changing channel ----------------------------------------------------

  function pick(c) {
    if (c.url === url) return;
    start(c.url);   // play it now (stream-player.js)...
    chrome.storage.sync.set({ tableStream: c.url });   // ...and remember it, for the popup and the table
  }

  function step(by) {
    closeChooser();
    if (!shown.length) return;
    const at = shown.findIndex((c) => c.url === url);
    pick(shown[at < 0 ? (by > 0 ? 0 : shown.length - 1) : (at + by + shown.length) % shown.length]);
    if (!guide.matches(":hover")) showGuide(1500);   // a glimpse of where you are
  }
  document.getElementById("chUp").addEventListener("click", () => step(-1));
  document.getElementById("chDown").addEventListener("click", () => step(1));
  // Up/Down change channel (rather than the video's volume, as they otherwise might).
  addEventListener("keydown", (e) => {
    const by = { ArrowUp: -1, PageUp: -1, ArrowDown: 1, PageDown: 1 }[e.key];
    if (!by || !channels.length) return;
    e.preventDefault();
    e.stopPropagation();
    step(by);
  }, true);

  // From the player: a new channel started (from here, the popup or a retry of
  // the list), and when it's actually playing.
  window.cpChannelChanged = () => {
    mark(true);
    showOsd(channels.find((c) => c.url === url), "connecting…");
  };
  window.cpChannelPlaying = () => showOsd(channels.find((c) => c.url === url));
  window.cpChannelFailed = () => showOsd(channels.find((c) => c.url === url), "not working: try ▲ ▼");

  // --- Full screen ---------------------------------------------------------
  // The whole window goes full screen, so the tab, guide and channel name come
  // too (the video's own button would take just the video). Also by
  // double-clicking the picture, or F.
  const fullBtn = document.getElementById("fullBtn");
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  fullBtn.addEventListener("click", toggleFull);
  video.addEventListener("dblclick", (e) => { e.preventDefault(); toggleFull(); });
  addEventListener("keydown", (e) => {
    if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); toggleFull(); }
  });
  document.addEventListener("fullscreenchange", () => {
    fullBtn.title = document.fullscreenElement ? "Exit full screen (F or Esc)" : "Full screen (F)";
    fullBtn.setAttribute("aria-label", fullBtn.title);
  });

  // --- Settings ------------------------------------------------------------

  chrome.storage.sync.get({ tableStreamList: "" }, (s) => load(iptvListId(s.tableStreamList) || ""));
  chrome.storage.local.get({ streamHealth: {} }).then((s) => { health = s.streamHealth; if (channels.length) render(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    // (A change made here has been loaded already.)
    if (area === "sync" && changes.tableStreamList) {
      const id = iptvListId(changes.tableStreamList.newValue) || "";
      if (id !== listId) load(id);
    }
    if (area === "local" && changes.streamHealth) {
      // Marks arrive as channels play or fail: redraw now and then, not every time.
      health = changes.streamHealth.newValue || {};
      if (!redraw) redraw = setTimeout(() => { redraw = null; if (channels.length) render(); }, 1000);
    }
  });
})();
