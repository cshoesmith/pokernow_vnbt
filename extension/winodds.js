// Win chance: reads your hole cards, the board and how many opponents are still
// in the hand, then estimates your equity by dealing out the unknown cards at
// random (Monte Carlo). Shown as a small badge beside your seat.

(() => {
  if (!/^\/games\//.test(location.pathname)) return;

  const { readCards, score } = cpHands;
  const ITERATIONS = 4000;
  const TICK_MS = 500;

  // ---------- Reading the table ----------

  const folded = (seat) => !!seat.querySelector(".table-player-infos-ctn.fold, .table-player-status-icon.fold");

  function readState() {
    const hero = document.querySelector(".you-player")?.closest(".table-player");
    if (!hero || folded(hero)) return null;
    const hole = readCards(hero.querySelectorAll(".table-player-cards .card-container"));
    if (hole.length !== 2) return null;   // Hold'em only
    const board = readCards(document.querySelectorAll(".table-cards .card-container"));
    const seats = [...document.querySelectorAll(".table-player:not(.table-player-seat)")];
    // Each opponent still in the hand: their two cards once shown (showdown), else null.
    const opponents = seats
      .filter((s) => s !== hero && !folded(s) && s.querySelector(".table-player-cards .card-container"))
      .map((s) => { const c = readCards(s.querySelectorAll(".table-player-cards .card-container")); return c.length === 2 ? c : null; });
    // Once the pot is awarded Poker Now marks the winning seat(s).
    const winners = seats.filter((s) => s.classList.contains("winner"));
    const result = !winners.length ? null : !winners.includes(hero) ? "lost" : winners.length > 1 ? "split" : "won";
    return { hole, board, opponents, hero, result };
  }

  // ---------- Simulation ----------

  // `opponents` holds each opponent's two cards if shown, or null to deal them at random.
  function equity(hole, board, opponents) {
    const known = new Set([...hole, ...board, ...opponents.flatMap((h) => h || [])]);
    const deck = [];
    for (let c = 0; c < 52; c++) if (!known.has(c)) deck.push(c);
    const unknown = opponents.filter((h) => !h).length;
    const need = 5 - board.length + 2 * unknown;
    let wins = 0, ties = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      for (let j = 0; j < need; j++) {   // partial Fisher-Yates: first `need` cards are the deal
        const k = j + Math.floor(Math.random() * (deck.length - j));
        [deck[j], deck[k]] = [deck[k], deck[j]];
      }
      const runout = board.concat(deck.slice(0, 5 - board.length));
      const mine = score(hole.concat(runout));
      let best = -1, at = 5 - board.length;
      for (const hand of opponents) {
        const cards = hand || [deck[at++], deck[at++]];
        best = Math.max(best, score([...cards, ...runout]));
      }
      if (mine > best) wins++;
      else if (mine === best) ties++;
    }
    return { win: wins / ITERATIONS, tie: ties / ITERATIONS };
  }

  // ---------- Badge ----------

  const badge = document.createElement("div");
  badge.id = "clean-poker-odds";
  badge.innerHTML = `
    <style>
      #clean-poker-odds { position: fixed; z-index: 6; display: none; pointer-events: none;
        padding: 6px 10px; border-radius: 8px; background: rgba(26,26,25,0.92);
        border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        font: 13px system-ui, -apple-system, "Segoe UI", sans-serif; color: #c3c2b7; white-space: nowrap; }
      #clean-poker-odds .cp-odds-label { color: #898781; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
      #clean-poker-odds .cp-odds-value { color: #f0efec; font-size: 22px; font-weight: 600; line-height: 1.1; }
      #clean-poker-odds .cp-odds-meter { height: 4px; border-radius: 2px; background: #184f95; margin: 4px 0 3px; }
      #clean-poker-odds .cp-odds-meter i { display: block; height: 100%; border-radius: 2px; background: #3987e5; }
    </style>
    <div class="cp-odds-label">Win chance</div>
    <div class="cp-odds-value"></div>
    <div class="cp-odds-meter"><i></i></div>
    <div class="cp-odds-sub"></div>`;

  let enabled = false, lastKey = "", timer = null;

  function tick() {
    const state = readState();
    if (!state) { badge.style.display = "none"; lastKey = ""; return; }
    if (!badge.isConnected) document.body.appendChild(badge);

    const { opponents, result } = state;
    const key = `${state.hole}|${state.board}|${JSON.stringify(opponents)}|${result}`;
    if (key !== lastKey) {
      lastKey = key;
      let win, sub;
      if (result) {
        win = result === "won" ? 1 : 0;
        sub = { won: "Won the pot", split: "Split pot", lost: "Lost this hand" }[result];
      } else if (!opponents.length) {
        win = 1;
        sub = "Everyone else folded";
      } else {
        const odds = equity(state.hole, state.board, opponents);
        win = odds.win;
        const vs = `vs ${opponents.length} player${opponents.length === 1 ? "" : "s"}`;
        sub = odds.tie >= 0.005 ? `Tie ${Math.round(odds.tie * 100)}% · ${vs}` : vs;
      }
      badge.querySelector(".cp-odds-value").textContent = result === "split" ? "Split" : `${Math.round(win * 100)}%`;
      badge.querySelector(".cp-odds-meter i").style.width = `${(result === "split" ? 0.5 : win) * 100}%`;
      badge.querySelector(".cp-odds-sub").textContent = sub;
    }

    // Beside your seat box (clear of the emoji on its right edge), vertically centred on it.
    const box = (state.hero.querySelector(".table-player-infos-ctn") || state.hero).getBoundingClientRect();
    badge.style.display = "block";
    badge.style.left = `${Math.round(box.right + 28)}px`;
    badge.style.top = `${Math.round(box.top + box.height / 2 - badge.offsetHeight / 2)}px`;
  }

  function setEnabled(on) {
    if (on === enabled) return;
    enabled = on;
    clearInterval(timer);
    if (on) timer = setInterval(tick, TICK_MS);
    else { badge.remove(); lastKey = ""; }
  }

  chrome.storage.sync.get({ winOdds: true }, (s) => setEnabled(s.winOdds));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.winOdds) setEnabled(changes.winOdds.newValue);
  });
})();
