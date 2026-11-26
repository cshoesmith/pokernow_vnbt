// The TV button: while TV is switched on in the popup (sync setting tv, on unless unticked), a small
// TV at the top of the felt opens the TV window (stream.html, opened by
// background.js, which brings it to the front if it's open already). Switching
// TV off removes the button and closes the window. Landscape only, like the beer table.

(() => {
  let on = false, button = null;

  const css = document.createElement("style");
  css.textContent = `.landscape .table > button.cp-tv {
  position: absolute; left: 50%; top: calc(15.47% + 0.35rem); transform: translateX(-50%); z-index: 3;
  width: 1.7rem; height: 1.7rem; padding: 0; border: 1px solid rgba(255,255,255,0.35); border-radius: 0.4rem;
  background: rgba(0,0,0,0.35); color: #fff; opacity: 0.55; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: opacity 0.15s;
}
.landscape .table > button.cp-tv:hover { opacity: 1; background: rgba(0,0,0,0.6); }
.landscape .table > button.cp-tv svg { width: 1.05rem; height: 1.05rem; }`;
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

  // Poker Now can redraw the table, so check now and then that the button's still on it.
  function place() {
    if (!chrome.runtime?.id) { clearInterval(timer); button?.remove(); return; }   // extension reloaded: F5 picks up the new one
    const table = on && cpGame.id ? document.querySelector(".landscape .table") : null;
    if (!table) { button?.remove(); button = null; return; }
    if (button?.parentNode === table) return;
    button?.remove();
    button = makeButton();
    table.append(button);
  }
  const timer = setInterval(place, 1000);

  const read = () => chrome.storage.sync.get({ tv: true }, (s) => { on = !!s.tv; place(); });
  read();
  chrome.storage.onChanged.addListener((changes, area) => { if (area === "sync" && changes.tv) read(); });
  cpGame.watch(() => place());
})();
