// The popup's Table video menu: pick a TV channel from one of the ChinaIPTV
// playlists (iptv.js), or paste your own link. Saves tableStream (the link the
// game tab plays) and tableStreamList (which list it's from) to sync storage.
// The game tab's player reports how it's going in local storage
// (tableStreamStatus), shown under the menu.
//
// Dead channels are left out of the menu: streamHealth (local storage, kept by
// background.js) marks each link that played or failed, from watching or from
// "Check channels", which tests the whole list. A dead mark lasts 3 days, so a
// channel that comes back on air returns. Channels found dead when the
// extension was made (iptv-dead.js) start out hidden too, until found working.

(() => {
  const CACHE_MS = 6 * 3600 * 1000;   // a list is fetched again after this long
  const DEAD_MS = 3 * 24 * 3600 * 1000;   // how long a dead mark hides a channel
  const $ = (id) => document.getElementById(id);
  const listSel = $("streamList"), picker = $("channelPicker"), filter = $("channelFilter");
  const channelSel = $("channel"), custom = $("tableStream"), status = $("streamStatus");
  const showDead = $("showDead"), deadCount = $("deadCount"), checkButton = $("checkChannels"), checkInfo = $("checkInfo");
  let channels = [], url = "", loading = null, saveTimer = null, health = {}, check = null, renderTimer = null;

  // Dead if this browser found it dead lately; failing that, if it's in the list
  // shipped with the extension (iptv-dead.js). Found working here overrules that.
  const knownDead = new Set(typeof IPTV_KNOWN_DEAD === "object" ? IPTV_KNOWN_DEAD.urls : []);
  const isDead = (link) => {
    const h = health[link];
    if (h && (h.ok || Date.now() - h.at < DEAD_MS)) return !h.ok;
    return knownDead.has(link);
  };

  // "My own link" (paste any .m3u8 or video link) is switched off for now: set
  // this to true to offer it again. Everything behind it is still here.
  const OWN_LINK = false;
  listSel.append(new Option("Nothing (the table)", ""));
  if (OWN_LINK) listSel.append(new Option("My own link", "custom"));
  for (const [heading, lists] of IPTV_MENU) {
    const group = document.createElement("optgroup");
    group.label = heading;
    for (const [id, label] of lists) group.append(new Option(label, id));
    listSel.append(group);
  }

  // A playlist's text, from the cache while it's fresh, else from GitHub (or the
  // stale copy if GitHub can't be reached).
  async function fetchList(file) {
    const key = "iptv:" + file;
    const cached = (await chrome.storage.local.get(key))[key];
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.text;
    try {
      const res = await fetch(IPTV_REPO + encodeURIComponent(file) + ".m3u8", { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      const text = await res.text();
      chrome.storage.local.set({ [key]: { at: Date.now(), text } }).catch(() => {});
      return text;
    } catch (err) {
      if (cached) return cached.text;
      throw err;
    }
  }

  // id is a playlist, or "playlist:country" for one country's channels in it.
  async function showList(id) {
    picker.hidden = !id || id === "custom";
    custom.hidden = id !== "custom";
    if (picker.hidden) return;
    channels = [];
    render("Loading channels…");
    const mine = loading = id;
    const [file, country] = id.split(":");
    try {
      const found = iptvParse(await fetchList(file)).filter((c) => !country || c.country === country);
      if (loading !== mine) return;   // another list was picked meanwhile
      channels = found.map((c) => {
        const label = iptvEnglish(c.name) || "Unnamed channel";
        const group = iptvEnglish(c.group, true);
        return { ...c, label, groupLabel: group, search: `${label} ${c.name} ${group} ${c.group}`.toLowerCase() };
      });
      render();
    } catch {
      if (loading === mine) render("Couldn't load this list. Try again later.");
    }
  }

  // The channel menu, grouped as the playlist groups them, narrowed by the search box.
  function render(placeholder) {
    const q = filter.value.trim().toLowerCase();
    const dead = channels.filter((c) => isDead(c.url)).length;
    deadCount.textContent = dead;
    showDead.parentElement.hidden = !dead;
    // The channel that's on stays in the menu even when it's marked dead.
    const shown = channels.filter((c) => (!q || c.search.includes(q)) && (showDead.checked || c.url === url || !isDead(c.url)));
    const head = new Option(placeholder || (shown.length ? `Pick a channel (${shown.length})`
      : !q && dead ? "None working: tick Show dead channels" : "No channels match"), "");
    head.disabled = true;
    channelSel.replaceChildren(head);
    const groups = new Map();
    const grouped = new Set(shown.map((c) => c.groupLabel)).size > 1;
    for (const c of shown) {
      let parent = channelSel;
      if (grouped) {
        parent = groups.get(c.groupLabel);
        if (!parent) {
          parent = document.createElement("optgroup");
          parent.label = c.groupLabel || "Other";
          groups.set(c.groupLabel, parent);
          channelSel.append(parent);
        }
      }
      const o = new Option((isDead(c.url) ? "✕ " : "") + c.label, c.url);
      if (c.label !== c.name) o.title = c.name;   // the original name on hover
      parent.append(o);
    }
    channelSel.value = url;
    if (channelSel.selectedIndex < 0) channelSel.selectedIndex = 0;
  }

  function save(link) {
    url = link;
    chrome.storage.sync.set({ tableStream: link, tableStreamList: listSel.value });
    showStatus();
  }

  listSel.addEventListener("change", () => {
    filter.value = "";
    showCheck();
    if (listSel.value === "") save("");
    else if (listSel.value === "custom") save(custom.value.trim());
    else chrome.storage.sync.set({ tableStreamList: listSel.value });   // keeps playing until a channel is picked
    showList(listSel.value);
  });

  filter.addEventListener("input", () => render());
  showDead.addEventListener("change", () => render());

  // Check channels: background.js tests every channel in this list, so it carries
  // on if the popup closes; progress comes back as streamCheck.
  checkButton.addEventListener("click", () => {
    if (!channels.length) return;
    chrome.runtime.sendMessage({ type: "stream-check", list: listSel.value, urls: channels.map((c) => c.url) });
  });
  setInterval(() => showCheck(), 5000);   // notices a check that stopped
  function showCheck() {
    // A check counts as running while its progress is recent (the background can be stopped).
    const running = check && check.list === listSel.value && check.done < check.total && Date.now() - check.at < 30000;
    const finished = check && check.list === listSel.value && check.done >= check.total;
    checkButton.disabled = !!running;
    checkInfo.textContent = running ? `Checking: ${check.done} of ${check.total}, ${check.dead} dead`
      : finished && Date.now() - check.at < 10 * 60000 ? `Checked ${check.total}: ${check.total - check.dead} working` : "";
  }

  // Health marks change as channels play, fail and are checked: redraw the menu
  // now and then, not on every one.
  function healthChanged(value) {
    health = value || {};
    if (!renderTimer) renderTimer = setTimeout(() => { renderTimer = null; if (channels.length) render(); }, 700);
  }
  channelSel.addEventListener("change", () => {
    const o = channelSel.selectedOptions[0];
    if (o?.value) save(o.value);
  });

  // Previous / next: step through the channels shown, wrapping round at the ends.
  function step(by) {
    const opts = [...channelSel.options].filter((o) => o.value && !o.disabled);
    if (!opts.length) return;
    const at = opts.indexOf(channelSel.selectedOptions[0]);
    const o = opts[at < 0 ? (by > 0 ? 0 : opts.length - 1) : (at + by + opts.length) % opts.length];
    o.selected = true;
    save(o.value);
  }
  $("prevChannel").addEventListener("click", () => step(-1));
  $("nextChannel").addEventListener("click", () => step(1));

  // Your own link: saved a moment after typing stops (synced settings are rate limited).
  custom.addEventListener("input", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(custom.value.trim()), 500);
  });
  custom.addEventListener("change", () => { clearTimeout(saveTimer); save(custom.value.trim()); });

  // How the game tab's player is getting on with the current link.
  async function showStatus() {
    const { tableStreamStatus: s } = await chrome.storage.local.get("tableStreamStatus");
    status.className = "";
    if (!url) { status.textContent = ""; return; }
    if (s?.url !== url) { status.textContent = "Plays on the table in the game tab."; return; }
    if (s.state === "playing") status.textContent = "Playing.";
    else if (s.state === "loading") status.textContent = "Connecting…";
    else {
      status.className = "bad";
      status.textContent = "Not playing: this channel looks dead (off air, or only shown in its own country), so it's hidden from the menu now. Still trying - or pick another with ▶.";
    }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.tableStreamStatus) showStatus();
    if (changes.streamHealth) healthChanged(changes.streamHealth.newValue);
    if (changes.streamCheck) { check = changes.streamCheck.newValue; showCheck(); }
  });
  chrome.storage.local.get({ streamHealth: {}, streamCheck: null }).then((s) => {
    health = s.streamHealth;
    check = s.streamCheck;
    showCheck();
    if (channels.length) render();
  });

  chrome.storage.sync.get({ tableStream: "", tableStreamList: null }, (s) => {
    url = s.tableStream.trim();
    // A link saved before there was a menu is your own, and so is one from a list
    // that's no longer in the menu.
    const list = IPTV_RENAMED[s.tableStreamList] ?? s.tableStreamList ?? (url ? "custom" : "");
    listSel.value = list;
    if (listSel.selectedIndex < 0) listSel.value = url && OWN_LINK ? "custom" : "";
    if (listSel.value === "custom") custom.value = url;
    // A link of your own while that's switched off: stop it, rather than play
    // something the menu can't show or change.
    if (url && !listSel.value) save("");
    showList(listSel.value);
    showStatus();
  });
})();
