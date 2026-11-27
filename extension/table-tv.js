// TV on the table (table-tv.html, in a frame over the felt): what the felt needs
// on top of the TV window's player (stream-player.js, whose start(), play(),
// url and wantSound this uses). It starts the channel (tableStream), draws the
// table title over the video, tells the game page (stream.js) whether it's
// playing so the pot gets its pill, and tells the popup how it's going
// (tableStreamStatus in local storage). The player follows channel and sound
// changes itself.

(() => {
  const POKER_NOW = ["https://www.pokernow.com", "https://pokernow.com"];
  const title = document.getElementById("title");

  // How it's going, for the popup; and whether it's playing, for the game page.
  function report(state) {
    if (url) chrome.storage.local.set({ tableStreamStatus: { url, state } }).catch(() => {});
  }
  window.cpChannelChanged = () => report("loading");
  window.cpChannelPlaying = () => report("playing");
  window.cpChannelFailed = () => report("retrying");
  new MutationObserver(() => {
    parent.postMessage({ cpStream: document.body.classList.contains("playing") ? "playing" : "stopped" }, "*");
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // Chrome holds back a video's sound until someone clicks in the page; this frame
  // can't see clicks on the table, so the game page passes them on.
  addEventListener("message", (e) => {
    if (e.data !== "cp-stream-unmute" || !POKER_NOW.includes(e.origin)) return;
    if (wantSound && video.muted && url) play();
  });

  const showTitle = (s) => { title.textContent = s.beerTheme ? s.tableTitle.trim() : ""; };
  const TITLE = { beerTheme: true, tableTitle: "vNBT Poker Challenge" };
  chrome.storage.sync.get({ ...TITLE, tableStream: "", tableStreamSound: false }, (s) => {
    showTitle(s);
    wantSound = !!s.tableStreamSound;
    const u = String(s.tableStream || "").trim();
    if (u) start(u);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes.beerTheme || changes.tableTitle)) chrome.storage.sync.get(TITLE, showTitle);
  });
})();
