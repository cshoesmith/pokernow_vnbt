// Chip leader crown: a gold crown perched on the name sign of whoever has the
// most chips. Nobody wears it while the lead is tied (at the start, everyone
// has the same stack).
//
// Stacks are read off the table. Each seat's .table-player-stack holds the stack
// in .chips-value .normal-value, as a plain or comma-grouped number ("4,880",
// "12.50" in cents mode) even when the table shows big blinds; while a pot is
// being awarded it shows the old stack plus the "+gain", and adding up every
// .normal-value in it gives the new stack. Chips bet this street sit in front of
// the seat, .table-player-bet-value, and count too. The crown only moves as a pot
// is awarded (Poker Now marks the winning seats .winner), so it doesn't hop about
// while players bet; it's first placed as soon as stacks are on screen.

(() => {
  const TICK_MS = 1000;

  let enabled = false, timer = null;
  let leader = null;   // lowercased name of the chip leader, or null for nobody
  let checked = false; // the lead has been read at least once in this game

  const style = document.createElement("style");
  style.id = "clean-poker-crown";
  style.textContent = `
    .cp-crown { position: absolute; z-index: 5; pointer-events: none; width: 2.2rem; height: 1.65rem;
      translate: -50% 0; rotate: -8deg; filter: drop-shadow(0 0.1rem 0.12rem rgba(0,0,0,0.6));
      animation: cp-crown-bob 2.6s ease-in-out infinite; }
    .cp-crown svg { display: block; width: 100%; height: 100%; overflow: visible; }
    .cp-crown-host { isolation: isolate; }
    @keyframes cp-crown-bob { 0%, 100% { translate: -50% 0; } 50% { translate: -50% -0.12rem; } }`;

  // A crown in gold, with three jewels; viewBox units.
  const CROWN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48">
    <defs>
      <linearGradient id="cp-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#f6c343"/><stop offset="1" stop-color="#b7791f"/>
      </linearGradient>
    </defs>
    <path d="M4 16 L18 28 L32 6 L46 28 L60 16 L54 40 H10 Z" fill="url(#cp-gold)" stroke="#7a4a0e" stroke-width="2" stroke-linejoin="round"/>
    <rect x="9" y="38" width="46" height="8" rx="2" fill="url(#cp-gold)" stroke="#7a4a0e" stroke-width="2"/>
    <circle cx="4" cy="15" r="3.5" fill="#fff3b0" stroke="#7a4a0e" stroke-width="1.5"/>
    <circle cx="32" cy="5" r="3.5" fill="#fff3b0" stroke="#7a4a0e" stroke-width="1.5"/>
    <circle cx="60" cy="15" r="3.5" fill="#fff3b0" stroke="#7a4a0e" stroke-width="1.5"/>
    <circle cx="20" cy="42" r="2.6" fill="#2563eb"/><circle cx="32" cy="42" r="2.8" fill="#dc2626"/><circle cx="44" cy="42" r="2.6" fill="#16a34a"/>
    <path d="M14 34 L50 34" stroke="#fff6cf" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>
  </svg>`;

  // Same as streak.js: the name moved to .table-player-name-text in Poker Now's
  // 16 Nov 2026 update; before that it was a link.
  const playerName = (seat) =>
    seat.querySelector(".table-player-name-text, .table-player-name a")?.textContent.trim() || "";

  const chips = (el) => {
    let total = 0;
    for (const v of el?.querySelectorAll(".normal-value") || []) total += parseFloat(v.textContent.replace(/,/g, "")) || 0;
    return total;
  };

  const seats = () => [...document.querySelectorAll(".table-player:not(.table-player-seat)")];

  // Who has the most chips now, or null if nobody has stacks showing or the lead is tied.
  function chipLeader() {
    let best = null, bestChips = -1, tied = false;
    for (const seat of seats()) {
      const name = playerName(seat), stack = seat.querySelector(".table-player-stack");
      if (!name || !stack) continue;
      const total = chips(stack) + chips(seat.querySelector(".table-player-bet-value"));
      if (total > bestChips) { best = name.toLowerCase(); bestChips = total; tied = false; }
      else if (total === bestChips) tied = true;
    }
    return bestChips > 0 && !tied ? best : null;
  }

  // Where el sits inside container, in layout px (offsets, not screen rects, so a
  // scaled table doesn't throw it off). As in streak.js.
  function offsetWithin(el, container) {
    let x = 0, y = 0;
    for (let n = el; n !== container; ) {
      if (!n.offsetParent) return null;
      x += n.offsetLeft; y += n.offsetTop;
      n = n.offsetParent;
      if (n !== container) { x += n.clientLeft; y += n.clientTop; }
    }
    return { x, y };
  }

  function removeCrowns(except) {
    for (const el of document.querySelectorAll(".cp-crown")) {
      if (el === except) continue;
      el.parentElement?.classList.remove("cp-crown-host");
      el.remove();
    }
  }

  // Sit the crown on the sign's top edge, centred over the name.
  function render() {
    const seat = leader && seats().find((s) => playerName(s).toLowerCase() === leader);
    const sign = seat?.querySelector(".table-player-infos-ctn");
    const nameEl = seat?.querySelector(".table-player-name-text, .table-player-name a, .table-player-name");
    if (!sign || !nameEl) { removeCrowns(); return; }
    let crown = seat.querySelector(":scope > .cp-crown");
    if (!crown) {
      crown = document.createElement("div");
      crown.className = "cp-crown";
      crown.innerHTML = CROWN_SVG;
      seat.appendChild(crown);
    }
    removeCrowns(crown);
    if (getComputedStyle(seat).zIndex === "auto") seat.classList.add("cp-crown-host");
    const box = crown.offsetParent;
    const signAt = box && offsetWithin(sign, box), nameAt = box && offsetWithin(nameEl, box);
    if (!signAt || !nameAt) { crown.style.display = "none"; return; }
    crown.style.display = "";
    crown.style.left = `${nameAt.x + nameEl.offsetWidth / 2}px`;
    crown.style.top = `${signAt.y - crown.offsetHeight * 0.75}px`;   // the band overlaps the sign's edge
  }

  function tick() {
    // The extension was reloaded or updated: the new copy takes over once the tab is refreshed.
    if (!chrome.runtime?.id) { setEnabled(false); return; }
    if (!cpGame.id) { leader = null; checked = false; removeCrowns(); return; }   // off a game page (cpGame, content.js)
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
    // Re-read the lead while a pot is being awarded, the first time round, or if
    // the leader has left the table.
    // (Mid-hand, chips already in the pot aren't on the table, so a read then
    // could crown someone who's simply put less in.)
    const awarding = !!document.querySelector(".table-player.winner");
    const left = leader && !seats().some((s) => playerName(s).toLowerCase() === leader);
    if (awarding || !checked || left) {
      leader = chipLeader();
      checked = !!document.querySelector(".table-player-stack .normal-value");   // not until stacks are drawn
    }
    render();
  }

  function setEnabled(on) {
    if (on === enabled) return;
    enabled = on;
    clearInterval(timer);
    if (on) timer = setInterval(tick, TICK_MS);
    else { leader = null; checked = false; removeCrowns(); style.remove(); }
  }

  cpGame.watch(() => { leader = null; checked = false; if (enabled) tick(); });
  window.addEventListener("resize", () => { if (enabled) render(); });

  chrome.storage.sync.get({ crown: true }, (s) => setEnabled(s.crown));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.crown) setEnabled(changes.crown.newValue);
  });
})();
