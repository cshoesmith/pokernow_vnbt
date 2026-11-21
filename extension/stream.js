// Table video: when a stream link is set in the popup (tableStream), plays it on
// the felt of the table. The video runs in a frame of the extension's own page
// (stream.html), shaped to the felt ellipse of the table image (1889x892, felt
// centred at 947,433.5 with radii 596x295.5), so the rail stays and the seats,
// cards and pot sit on top. Landscape only, like the beer table.
//
// A small button at the top of the felt pops the video out into its own window
// (opened by background.js, which keeps its id in session storage as
// streamPopout). While that window is open the table goes back to its own felt,
// so only one copy plays; closing it brings the video back.

(() => {
  const FRAME_URL = chrome.runtime.getURL("stream.html");
  let link = "", sound = false, popped = false, frame = null, button = null;

  const css = document.createElement("style");
  css.textContent = `.landscape .table > iframe.cp-stream {
  position: absolute; left: 18.58%; top: 15.47%; width: 63.1%; height: 66.26%;
  border: 0; border-radius: 50%; pointer-events: none; z-index: 0; background: transparent;
}
.landscape .table > button.cp-stream-popout {
  position: absolute; left: 50%; top: calc(15.47% + 0.35rem); transform: translateX(-50%); z-index: 3;
  width: 1.5rem; height: 1.5rem; padding: 0; border: 1px solid rgba(255,255,255,0.35); border-radius: 0.35rem;
  background: rgba(0,0,0,0.35); color: #fff; opacity: 0.5; cursor: pointer;
  display: none; align-items: center; justify-content: center; transition: opacity 0.15s;
}
.landscape .table > button.cp-stream-popout.on { display: flex; }
.landscape .table > button.cp-stream-popout:hover { opacity: 1; background: rgba(0,0,0,0.6); }
.landscape .table > button.cp-stream-popout svg { width: 0.95rem; height: 0.95rem; }
/* The table image has a faint pill behind the pot, which the video covers: drawn
   again on the pot itself while the video plays (as wide as the image's). */
.landscape .table.cp-stream-on .table-pot-size .main-value {
  width: 88%; box-sizing: border-box; border-radius: 0.6rem;
  background: rgba(0, 0, 0, 0.28); backdrop-filter: blur(3px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}`;
  (document.head || document.documentElement).appendChild(css);

  function remove() {
    frame?.parentNode?.classList.remove("cp-stream-on");
    frame?.remove();
    button?.remove();
    frame = button = null;
  }

  function makeButton() {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cp-stream-popout";
    b.title = "Watch in its own window";
    b.setAttribute("aria-label", b.title);
    // A window with an arrow out of its corner.
    b.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M13 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3.5"/><path d="M9.5 2H14v4.5"/><path d="M14 2 7.5 8.5"/></svg>`;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: "stream-popout" }).catch(() => {});
    });
    return b;
  }

  // Poker Now can redraw the table, so check now and then that the frame's still
  // on it. Moving a frame reloads it, so it's only put back when it's gone.
  function place() {
    if (!chrome.runtime?.id) { clearInterval(timer); remove(); return; }   // extension reloaded: F5 picks up the new one
    const table = link && !popped && cpGame.id ? document.querySelector(".landscape .table") : null;
    if (!table) { remove(); return; }
    if (frame?.parentNode === table && button?.parentNode === table) return;
    remove();
    frame = document.createElement("iframe");
    frame.className = "cp-stream";
    frame.src = FRAME_URL;
    frame.allow = "autoplay";
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    table.prepend(frame);   // first, so everything on the table draws over it
    button = makeButton();
    table.append(button);   // shown once the video is playing
  }
  const timer = setInterval(place, 1000);

  // The frame says when its video is playing (the button and pot pill only show then).
  addEventListener("message", (e) => {
    if (!frame || e.source !== frame.contentWindow || typeof e.data?.cpStream !== "string") return;
    const playing = e.data.cpStream === "playing";
    button?.classList.toggle("on", playing);
    frame.parentNode?.classList.toggle("cp-stream-on", playing);   // the pot's pill
  });

  // Chrome holds back a video's sound until someone clicks in the page; the frame
  // can't see clicks on the table, so tell it.
  const unmute = () => { if (sound && frame) frame.contentWindow?.postMessage("cp-stream-unmute", "*"); };
  addEventListener("pointerdown", unmute, true);
  addEventListener("keydown", unmute, true);

  function apply(s) {
    link = String(s.tableStream || "").trim();
    sound = !!s.tableStreamSound;
    place();
  }
  const read = () => chrome.storage.sync.get({ tableStream: "", tableStreamSound: false }, apply);
  read();
  // Whether the video is out in its own window. Session storage is only readable
  // here once background.js has allowed it, which it does before opening one.
  const readPopped = () => chrome.storage.session.get("streamPopout")
    .then((s) => { popped = !!s.streamPopout; place(); }, () => {});
  readPopped();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") read();
    else if (area === "session" && changes.streamPopout) readPopped();
  });
  cpGame.watch(() => place());
})();
