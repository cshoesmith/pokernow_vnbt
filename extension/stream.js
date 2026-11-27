// TV on the table page, in two parts, both landscape only like the beer table:
//
// The TV button: while TV is switched on in the popup (sync setting tv, on
// unless unticked), a small TV at the top of the felt opens the TV window
// (stream.html, opened by background.js, which brings it to the front if it's
// open already). Switching TV off removes the button and closes the window.
//
// TV on the felt: when "TV on the table" is ticked in the popup (tvTable, off
// unless ticked), the channel (tableStream) plays on the felt. The video runs in
// a frame of the extension's own page (table-tv.html), shaped to the felt
// ellipse of the table image (1889x892, felt centred at 947,433.5 with radii
// 596x295.5), so the rail stays and the seats, cards and pot sit on top. While
// the TV window is open (its id is kept in session storage as streamPopout) the
// felt goes back to the table's own, so only one copy plays.

(() => {
  const FRAME_URL = chrome.runtime.getURL("table-tv.html");
  let tv = true, onTable = false, link = "", sound = false, popped = false;
  let button = null, frame = null;

  const css = document.createElement("style");
  css.textContent = `.landscape .table > button.cp-tv {
  position: absolute; left: 50%; top: calc(15.47% + 0.35rem); transform: translateX(-50%); z-index: 3;
  width: 1.7rem; height: 1.7rem; padding: 0; border: 1px solid rgba(255,255,255,0.35); border-radius: 0.4rem;
  background: rgba(0,0,0,0.35); color: #fff; opacity: 0.55; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: opacity 0.15s;
}
.landscape .table > button.cp-tv:hover { opacity: 1; background: rgba(0,0,0,0.6); }
.landscape .table > button.cp-tv svg { width: 1.05rem; height: 1.05rem; }
.landscape .table > iframe.cp-stream {
  position: absolute; left: 18.58%; top: 15.47%; width: 63.1%; height: 66.26%;
  border: 0; border-radius: 50%; pointer-events: none; z-index: 0; background: transparent;
}
/* The table image has a faint pill behind the pot, which the video covers: drawn
   again on the pot itself while the video plays (as wide as the image's). */
.landscape .table.cp-stream-on .table-pot-size .main-value {
  width: 88%; box-sizing: border-box; border-radius: 0.6rem;
  background: rgba(0, 0, 0, 0.28); backdrop-filter: blur(3px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}`;
  (document.head || document.documentElement).appendChild(css);

  function makeButton() {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cp-tv";
    b.title = "Watch TV";
    b.setAttribute("aria-label", b.title);
    // A TV set with rabbit-ear aerials.
    b.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
      `<rect x="1.75" y="5" width="12.5" height="8.5" rx="1.5"/><path d="M5.5 1.75 8 5l2.5-3.25"/></svg>`;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: "tv-open" }).catch(() => {});
    });
    return b;
  }

  function removeButton() { button?.remove(); button = null; }
  function removeFrame() {
    frame?.parentNode?.classList.remove("cp-stream-on");
    frame?.remove();
    frame = null;
  }

  // Poker Now can redraw the table, so check now and then that the button and
  // frame are still on it. Moving a frame reloads it, so it's only put back when it's gone.
  function place() {
    if (!chrome.runtime?.id) { clearInterval(timer); removeButton(); removeFrame(); return; }   // extension reloaded: F5 picks up the new one
    const table = cpGame.id ? document.querySelector(".landscape .table") : null;
    if (table && tv) {
      if (button?.parentNode !== table) { removeButton(); button = makeButton(); table.append(button); }
    } else removeButton();
    if (table && onTable && link && !popped) {
      if (frame?.parentNode !== table) {
        removeFrame();
        frame = document.createElement("iframe");
        frame.className = "cp-stream";
        frame.src = FRAME_URL;
        frame.allow = "autoplay";
        frame.tabIndex = -1;
        frame.setAttribute("aria-hidden", "true");
        table.prepend(frame);   // first, so everything on the table draws over it
      }
    } else removeFrame();
  }
  const timer = setInterval(place, 1000);

  // The frame says when its video is playing (the pot's pill only shows then).
  addEventListener("message", (e) => {
    if (!frame || e.source !== frame.contentWindow || typeof e.data?.cpStream !== "string") return;
    frame.parentNode?.classList.toggle("cp-stream-on", e.data.cpStream === "playing");
  });

  // Chrome holds back a video's sound until someone clicks in the page; the frame
  // can't see clicks on the table, so tell it.
  const unmute = () => { if (sound && frame) frame.contentWindow?.postMessage("cp-stream-unmute", "*"); };
  addEventListener("pointerdown", unmute, true);
  addEventListener("keydown", unmute, true);

  const read = () => chrome.storage.sync.get({ tv: true, tvTable: false, tableStream: "", tableStreamSound: false }, (s) => {
    tv = !!s.tv;
    onTable = !!s.tvTable;
    link = String(s.tableStream || "").trim();
    sound = !!s.tableStreamSound;
    place();
  });
  read();
  // Whether the TV window is open. Session storage is only readable here once
  // background.js has allowed it.
  const readPopped = () => chrome.storage.session.get("streamPopout")
    .then((s) => { popped = !!s.streamPopout; place(); }, () => {});
  readPopped();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes.tv || changes.tvTable || changes.tableStream || changes.tableStreamSound)) read();
    else if (area === "session" && changes.streamPopout) readPopped();
  });
  cpGame.watch(() => place());
})();
