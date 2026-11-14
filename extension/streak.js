// Win streak flames: a player who wins hands in a row gets a burning border round
// their name sign - small flames after one win, bigger after two, biggest from
// three on. A hand they're dealt into and don't win (folding included) puts it out.
// Streaks come from the game log: "Player stacks:" lists exactly who was dealt
// in, and "collected ... from pot" who won (both players, on a split pot).

(() => {
  const TICK_MS = 1000;
  const AFTER_WIN_MS = 2000;   // the pot is logged as it's awarded; give the log a moment
  const POLL_MS = 60000;       // in case a hand ended while the tab was in the background
  const RETRY_MS = 10000;      // rate limited, or the hand isn't in the log yet
  const PAGE_DELAY_MS = 1200;  // the log endpoint rate-limits quick paging
  const FETCH_MS = 30000;
  const MAX_PAGES = 8;         // 50 lines a page; a hand is 20-40
  const SEED_HANDS = 10;       // first read: enough hands for everyone's current streak
  const BLAST_FROM = 5;        // wins in a row from which each win sets off the nuclear blast
  const BLAST_FRESH_MS = 60000;   // only for a hand that's just ended, not one caught up on later
  const BLAST_MS = 4200;

  // Sizes in rem, so the flames scale with the table (Poker Now sizes it in rem):
  // the tongues along the top (height, width), those up the sides, and the glow.
  const STAGES = {
    1: { h: 0.75, w: 0.55, side: 0, glow: 0.2 },
    2: { h: 1.35, w: 0.75, side: 0.8, glow: 0.35 },
    3: { h: 2.1, w: 0.95, side: 1.2, glow: 0.55 }
  };
  // Flame colours, core to edge: orange, then yellow, then white-hot.
  const COLORS = {
    1: ["#fbbf24", "#f97316", "#c2410c"],
    2: ["#fde047", "#fb923c", "#dc2626"],
    3: ["#fffbe6", "#fcd34d", "#f97316"]
  };

  let streaks = {};     // playerId -> hands won in a row
  let names = {};       // playerId -> current name
  let lastEnd = null;   // created_at of the latest hand counted
  let gameId = null;    // the game on screen (cpGame, content.js); the streaks are its
  let enabled = false, busy = false, again = false, wonBefore = false;
  let tickTimer = null, pollTimer = null, updateTimer = null;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Reading the log ----------

  const STACK_RE = /#\d+ "(.+?) @ ([\w-]+)" \(/g;
  const COLLECTED_RE = /^"(.+?) @ ([\w-]+)" collected /;

  async function fetchPage(game, before) {
    for (;;) {
      const res = await fetch(`/games/${game}/log?before_at=${before}&after_at=&mm=false&v=2`, { signal: AbortSignal.timeout(FETCH_MS) });
      const text = await res.text();
      if (text.startsWith("{")) return JSON.parse(text).logs || [];
      if (game !== gameId) return [];   // moved to another game: give up on this one
      await sleep(RETRY_MS);   // "Too many requests" - back off and retry
    }
  }

  // Count the hands that ended after the last one counted, oldest first.
  // Returns whether there were any. Anyone it takes to BLAST_FROM or more wins
  // in a row goes in `blasts`, with their streak and when that hand ended.
  function count(logs, blasts = []) {
    let hand = null, counted = false;
    for (const log of logs) {
      const msg = log.msg;
      if (msg.startsWith("-- starting hand")) hand = { players: [], winners: new Set() };
      else if (!hand) continue;   // the tail of a hand that started before these lines
      else if (msg.startsWith("Player stacks:")) {
        for (const m of msg.matchAll(STACK_RE)) { hand.players.push(m[2]); names[m[2]] = m[1]; }
      }
      else if (msg.startsWith("-- ending hand")) {
        const c = Number(log.created_at);
        if (lastEnd === null || c > lastEnd) {
          for (const id of hand.players) {
            streaks[id] = hand.winners.has(id) ? (streaks[id] || 0) + 1 : 0;
            if (streaks[id] >= BLAST_FROM) blasts.push({ id, wins: streaks[id], at: Date.parse(log.at) });
          }
          lastEnd = c;
          counted = true;
        }
        hand = null;
      }
      else {
        const m = msg.match(COLLECTED_RE);
        if (m) hand.winners.add(m[2]);
      }
    }
    return counted;
  }

  // Read back from the newest line to the last hand counted (the first time,
  // far enough for a few hands), then count what's new. Just after a win
  // (expectNew), try again shortly if the hand hasn't reached the log yet.
  async function update(expectNew = false) {
    const game = gameId;
    if (!enabled || !game) return;
    if (busy) { again = true; return; }
    busy = true;
    let retry = false;
    try {
      const logs = [];
      let before = "", reached = false;
      for (let page = 0; page < MAX_PAGES; page++) {
        const batch = await fetchPage(game, before);
        if (game !== gameId) return;   // moved to another game meanwhile: drop what this read
        if (!batch.length) { reached = true; break; }   // the start of the game
        logs.push(...batch);
        const oldest = batch[batch.length - 1].created_at;
        const enough = lastEnd !== null
          ? Number(oldest) <= lastEnd
          : logs.filter((l) => l.msg.startsWith("-- ending hand")).length > SEED_HANDS;
        if (enough || oldest === before) { reached = true; break; }
        before = oldest;
        await sleep(PAGE_DELAY_MS);
      }
      // Too many hands since the last read to bridge: start over from what's here.
      if (!reached) { streaks = {}; lastEnd = null; }
      const seeding = lastEnd === null, blasts = [];
      retry = !count(logs.reverse(), blasts) && expectNew;
      render();
      // A first read is history: no blast for a streak that's already happened.
      if (!seeding) for (const { id, wins, at } of blasts) if (Date.now() - at < BLAST_FRESH_MS) blast(id, wins);
    } catch (err) {
      console.warn("vNBT Poker: win streak update failed, trying again shortly", err);   // offline, say
      retry = true;
    } finally {
      busy = false;
    }
    if (again) { again = false; schedule(0, true); }
    else if (retry) schedule(RETRY_MS);
  }

  function schedule(ms, expectNew = false) {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => update(expectNew), ms);
  }

  // ---------- Flames ----------
  // The layer is the seat's bottom layer (z-index -1 in the seat's stacking
  // context), so the cards, chips, sign, name and stack all draw over it. It's
  // the sign's box plus room for the flames, with the sign's box cut out of its
  // mask, so nothing is drawn inside the sign even where the sign is see-through.
  // Tongues rise from behind the top edge and lick up the sides; the glow (a
  // box-shadow, so it only falls outside the box) runs right round.

  const flameImage = ([core, mid, edge]) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 100" preserveAspectRatio="none">` +
      `<defs><radialGradient id="f" cx="50%" cy="80%" r="100%" fx="50%" fy="92%">` +
      `<stop offset="0" stop-color="${core}"/><stop offset=".35" stop-color="${mid}"/>` +
      `<stop offset=".8" stop-color="${edge}" stop-opacity=".95"/><stop offset="1" stop-color="${edge}" stop-opacity="0"/>` +
      `</radialGradient></defs><path d="M20 0C23 20 37 36 37 62C37 86 29 100 20 100S3 86 3 62C3 36 17 20 20 0Z" fill="url(#f)"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  };

  const style = document.createElement("style");
  style.id = "clean-poker-streak";
  style.textContent = `
    .cp-flames { position: absolute; z-index: -1; pointer-events: none; box-sizing: border-box;
      padding: var(--t) var(--x) var(--b);
      mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }
    .cp-flames-host { isolation: isolate; }
    .cp-flames i { position: absolute; display: block; }
    .cp-flame { transform-origin: 50% 100%; background: var(--flame) center / 100% 100% no-repeat;
      animation: cp-flicker var(--d) ease-in-out var(--delay) infinite alternate; }
    .cp-glow { inset: var(--t) var(--x) var(--b); border-radius: var(--r);
      box-shadow: 0 0 var(--glow) calc(var(--glow) / 3) var(--glow-color), 0 0 calc(var(--glow) * 2.5) 0 var(--glow-outer);
      animation: cp-glow 1.3s ease-in-out infinite alternate; }
    .cp-ember { width: 3px; height: 3px; border-radius: 50%; background: #ffe7a3; box-shadow: 0 0 4px 1px #ff9a3c;
      animation: cp-rise var(--d) linear var(--delay) infinite; }
    ${[1, 2, 3].map((s) => `.cp-flames-${s} { --flame: ${flameImage(COLORS[s])}; }`).join("\n    ")}
    .cp-flames-1 { --glow-color: rgba(249,115,22,0.75); --glow-outer: rgba(194,65,12,0.35); }
    .cp-flames-2 { --glow-color: rgba(251,146,60,0.85); --glow-outer: rgba(220,38,38,0.45); }
    .cp-flames-3 { --glow-color: rgba(253,224,71,0.9); --glow-outer: rgba(249,115,22,0.6); }
    @keyframes cp-flicker {
      0% { transform: scale(1, 1) skewX(0deg); opacity: 0.9; }
      35% { transform: scale(0.9, 1.15) skewX(-5deg); opacity: 1; }
      70% { transform: scale(1.06, 0.88) skewX(4deg); opacity: 0.85; }
      100% { transform: scale(0.95, 1.06) skewX(-2deg); opacity: 1; }
    }
    @keyframes cp-glow { from { opacity: 0.65; } to { opacity: 1; } }
    @keyframes cp-rise {
      from { transform: translate(0, 0); opacity: 0; }
      15% { opacity: 1; }
      to { transform: translate(var(--dx), calc(-1 * var(--rise))); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .cp-flames i { animation: none !important; }
      .cp-ember { display: none; }
    }

    /* The blast: centred on the sign, over everything for a few seconds, then gone.
       --s is its scale, from the sign's width; parts are placed round the centre. */
    .cp-nuke { position: fixed; z-index: 900; width: 0; height: 0; pointer-events: none; }
    .cp-nuke i, .cp-nuke b { position: absolute; display: block; }
    .cp-nuke-flash { left: calc(var(--s) * -0.9); top: calc(var(--s) * -0.9); width: calc(var(--s) * 1.8); height: calc(var(--s) * 1.8);
      border-radius: 50%; background: radial-gradient(circle, #fff 0, #fff6c8 22%, rgba(255,190,90,0.75) 42%, rgba(255,120,40,0) 70%);
      animation: cp-nuke-flash 0.8s ease-out both; }
    .cp-nuke-ring { left: calc(var(--s) * -0.6); top: calc(var(--s) * -0.18); width: calc(var(--s) * 1.2); height: calc(var(--s) * 0.36);
      border-radius: 50%; border: calc(var(--s) * 0.012) solid rgba(255,236,200,0.9);
      box-shadow: 0 0 12px rgba(255,200,120,0.8), inset 0 0 12px rgba(255,200,120,0.6);
      animation: cp-nuke-ring 1.3s ease-out 0.1s both; }
    .cp-nuke-cloud { left: 0; top: 0; animation: cp-nuke-cool 3.9s ease-in both; }
    .cp-nuke-dust { left: calc(var(--s) * -0.5); top: calc(var(--s) * -0.12); width: calc(var(--s) * 1); height: calc(var(--s) * 0.24);
      border-radius: 50%; background: radial-gradient(closest-side, rgba(150,80,40,0.85), rgba(110,60,35,0.5) 60%, rgba(80,50,30,0));
      animation: cp-nuke-dust 2.2s cubic-bezier(0.2, 0.7, 0.3, 1) 0.1s both; }
    .cp-nuke-stem { left: calc(var(--s) * -0.12); top: calc(var(--s) * -0.85); width: calc(var(--s) * 0.24); height: calc(var(--s) * 0.85);
      clip-path: polygon(33% 0, 67% 0, 92% 100%, 8% 100%); filter: blur(calc(var(--s) * 0.006)); transform-origin: 50% 100%;
      background: linear-gradient(to top, rgba(120,40,10,0) 0, #a83a12 14%, #ff7a1a 55%, #ffd27a 100%);
      animation: cp-nuke-stem 1.4s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
    .cp-nuke-cap { left: 0; top: 0; width: 0; height: 0;
      animation: cp-nuke-cap 1.5s cubic-bezier(0.15, 0.75, 0.3, 1) both, cp-nuke-drift 2.4s linear 1.5s forwards; }
    .cp-nuke-cap b { border-radius: 50%; filter: blur(calc(var(--s) * 0.012));
      background: radial-gradient(circle at 45% 40%, #fff4c4 0, #ffc457 22%, #ff7b22 45%, #b9381a 70%, rgba(90,30,15,0) 100%); }
    .cp-nuke-cap b.cp-nuke-under { transform: scaleY(0.45);
      background: radial-gradient(closest-side, #ff8a2a 0, #b33a16 50%, rgba(80,25,12,0) 100%); }
    .cp-nuke-debris { left: -2px; top: -2px; width: 4px; height: 4px; border-radius: 50%; background: #ffd27a;
      box-shadow: 0 0 6px 2px rgba(255,150,60,0.9); animation: cp-nuke-debris var(--d) cubic-bezier(0.1, 0.8, 0.3, 1) 0.05s both; }
    .cp-nuke-text { left: 0; top: 0; translate: -50% -50%; white-space: nowrap;
      font: 900 calc(var(--s) * 0.11)/1 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: 0.06em;
      color: #fff3c4; text-shadow: 0 0 calc(var(--s) * 0.03) #ff7a1a, 0 0 calc(var(--s) * 0.06) #ff4d00, 0 2px 2px #000;
      animation: cp-nuke-text 3.4s ease-out 0.25s both; }
    .cp-nuke-shake { animation: cp-nuke-shake 0.7s linear 0.05s; }
    @keyframes cp-nuke-flash { 0% { transform: scale(0.1); opacity: 1; } 30% { opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
    @keyframes cp-nuke-ring { from { transform: scale(0.1); opacity: 1; } to { transform: scale(3.2); opacity: 0; } }
    @keyframes cp-nuke-dust { from { transform: scale(0.2); opacity: 0; } 20% { opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
    @keyframes cp-nuke-stem { from { transform: scale(0.6, 0); } to { transform: scale(1, 1); } }
    @keyframes cp-nuke-cap {
      from { transform: translate(0, calc(var(--s) * -0.15)) scale(0.15); }
      to { transform: translate(0, calc(var(--s) * -1)) scale(1); }
    }
    @keyframes cp-nuke-drift {
      from { transform: translate(0, calc(var(--s) * -1)) scale(1); }
      to { transform: translate(0, calc(var(--s) * -1.15)) scale(1.12); }
    }
    @keyframes cp-nuke-cool {   /* fireball to grey smoke, then gone */
      0% { opacity: 0; filter: brightness(1.7) saturate(1.2) grayscale(0); }
      5% { opacity: 1; }
      40% { filter: brightness(1.1) saturate(1) grayscale(0); }
      70% { opacity: 1; filter: brightness(0.9) saturate(0.8) grayscale(0.45); }
      100% { opacity: 0; filter: brightness(0.75) saturate(0.6) grayscale(0.9); }
    }
    @keyframes cp-nuke-debris {
      from { transform: translate(0, 0); opacity: 1; }
      to { transform: translate(var(--dx), var(--dy)); opacity: 0; }
    }
    @keyframes cp-nuke-text {
      0% { transform: scale(0.3); opacity: 0; }
      12% { transform: scale(1.15); opacity: 1; }
      20% { transform: scale(1); }
      80% { opacity: 1; }
      100% { transform: scale(1); opacity: 0; }
    }
    @keyframes cp-nuke-shake {   /* the translate property, so the table's own transform is left alone */
      0%, 100% { translate: 0 0; } 10% { translate: -6px 3px; } 20% { translate: 5px -4px; } 30% { translate: -5px 2px; }
      40% { translate: 4px 3px; } 55% { translate: -3px -2px; } 70% { translate: 2px 2px; } 85% { translate: -1px -1px; }
    }
    @keyframes cp-nuke-fade { 0%, 80% { opacity: 1; } 100% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .cp-nuke > :not(.cp-nuke-text) { display: none; }
      .cp-nuke-text { animation: cp-nuke-fade 3s ease-out both; }
      .cp-nuke-shake { animation: none; }
    }`;

  const playerName = (seat) => seat.querySelector(".table-player-name a")?.textContent.trim() || "";

  function piece(className, box, vars = {}) {
    const el = document.createElement("i");
    el.className = className;
    for (const k of ["left", "top", "width", "height"]) if (k in box) el.style[k] = `${box[k].toFixed(1)}px`;
    for (const k in vars) el.style.setProperty(k, vars[k]);
    return el;
  }

  const flicker = (stage) => {
    const d = (0.45 + Math.random() * 0.35) * (stage === 3 ? 0.8 : 1);
    return { "--d": `${d.toFixed(2)}s`, "--delay": `${(-Math.random() * d).toFixed(2)}s` };
  };

  // Lay out the flames for a sign W x H px. Returns the room they take round it.
  function build(layer, stage, W, H) {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const { h, w, side, glow } = STAGES[stage];
    const th = h * rem, tw = w * rem, sh = side * rem, sw = sh * 0.7, g = glow * rem;
    // Room for the tallest tongue at full stretch, the side tongues and the glow's blur.
    const pad = { t: Math.ceil(Math.max(th * 1.5, g * 3)), x: Math.ceil(Math.max(g * 3, sw)), b: Math.ceil(g * 3) };
    const { t, x } = pad;
    const kids = [piece("cp-glow", {}, { "--glow": `${g.toFixed(1)}px` })];

    // Along the top, tallest in the middle; the bottom fifth of each is behind the sign.
    const n = Math.max(2, Math.round(W / (tw * 0.55)));
    for (let i = 0; i <= n; i++) {
      const at = i / n;
      const fh = th * (0.6 + 0.4 * Math.sin(Math.PI * at) + Math.random() * 0.3);
      kids.push(piece("cp-flame", { left: x + at * W - tw / 2, top: t - fh * 0.8, width: tw, height: fh }, flicker(stage)));
    }
    // Up both sides, half behind the sign's edge.
    if (sh) {
      const m = Math.max(1, Math.round(H / (sh * 0.5)));
      for (let j = 0; j < m; j++) {
        const bottom = t + H - (j / m) * H * 0.8;
        const fh = sh * (0.8 + Math.random() * 0.3);
        for (const edge of [x, x + W]) {
          kids.push(piece("cp-flame", { left: edge - sw / 2, top: bottom - fh, width: sw, height: fh }, flicker(stage)));
        }
      }
    }
    // Sparks drifting up off the top.
    if (stage === 3) {
      for (let k = 0; k < 7; k++) {
        const d = 1.2 + Math.random();
        kids.push(piece("cp-ember", { left: x + Math.random() * W, top: t - th * 0.3 }, {
          "--d": `${d.toFixed(2)}s`, "--delay": `${(-Math.random() * d).toFixed(2)}s`,
          "--rise": `${(t - th * 0.3 - 4).toFixed(1)}px`, "--dx": `${((Math.random() - 0.5) * rem).toFixed(1)}px`
        }));
      }
    }
    layer.className = `cp-flames cp-flames-${stage}`;
    layer.replaceChildren(...kids);
    return pad;
  }

  // Where the sign sits inside the layer's containing block, in layout px
  // (offsets, not screen rects, so a scaled table doesn't throw it off).
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

  const pads = new WeakMap();   // layer -> room round the sign, for its current layout

  function burn(seat, sign, stage) {
    let layer = seat.querySelector(":scope > .cp-flames");
    if (!layer) {
      layer = document.createElement("div");
      seat.appendChild(layer);
    }
    // z-index -1 needs the seat to be a stacking context, or the flames could
    // drop behind the felt. Poker Now's seats are (z-index 4); make sure.
    if (getComputedStyle(seat).zIndex === "auto") seat.classList.add("cp-flames-host");
    const W = sign.offsetWidth, H = sign.offsetHeight;
    const at = layer.offsetParent && offsetWithin(sign, layer.offsetParent);
    if (!W || !H || !at) { douse(layer); return false; }
    const key = `${stage}|${W}|${H}`;
    if (layer.dataset.key !== key) {
      pads.set(layer, build(layer, stage, W, H));
      layer.dataset.key = key;
    }
    const { t, x, b } = pads.get(layer);
    const box = { left: at.x - x, top: at.y - t, width: W + 2 * x, height: H + t + b };
    for (const k in box) layer.style[k] = `${box[k]}px`;
    layer.style.setProperty("--t", `${t}px`);
    layer.style.setProperty("--x", `${x}px`);
    layer.style.setProperty("--b", `${b}px`);
    layer.style.setProperty("--r", getComputedStyle(sign).borderRadius);
    return true;
  }

  // The nuclear blast for each win from BLAST_FROM in a row on, centred on that
  // player's sign: a flash, a shockwave ring, debris, and a mushroom cloud that
  // rises, cools to smoke and fades, with "6 IN A ROW" (their streak) over the
  // sign and a shake of the table. It's laid over the page for a few seconds;
  // clicks go straight through it.
  function blast(id, wins) {
    const name = names[id]?.toLowerCase();
    const seat = name && [...document.querySelectorAll(".table-player:not(.table-player-seat)")]
      .find((s) => playerName(s).toLowerCase() === name);
    if (!seat) return;
    const r = (seat.querySelector(".table-player-infos-ctn") || seat).getBoundingClientRect();
    if (!r.width) return;
    const boom = document.createElement("div");
    boom.className = "cp-nuke";
    boom.style.left = `${r.left + r.width / 2}px`;
    boom.style.top = `${r.top + r.height / 2}px`;
    boom.style.setProperty("--s", `${Math.round(Math.max(r.width * 1.4, 200))}px`);
    const part = (className, css = "") => `<i class="${className}" style="${css}"></i>`;
    const at = (x, y, w, h) => `left: calc(var(--s) * ${x}); top: calc(var(--s) * ${y}); width: calc(var(--s) * ${w}); height: calc(var(--s) * ${h})`;
    // The cap's puffs as [x, y, diameter] in --s, round its centre.
    const puffs = [[0, 0, 0.6], [-0.3, 0.08, 0.42], [0.3, 0.08, 0.42], [-0.17, -0.17, 0.44], [0.17, -0.17, 0.44],
      [-0.43, 0.14, 0.3], [0.43, 0.14, 0.3], [0, -0.27, 0.36]]
      .map(([x, y, d]) => `<b style="${at(x - d / 2, y - d / 2, d, d)}"></b>`).join("");
    const under = `<b class="cp-nuke-under" style="${at(-0.32, 0.04, 0.64, 0.5)}"></b>`;
    const debris = Array.from({ length: 14 }, () => {
      const angle = Math.random() * Math.PI * 2, reach = 0.5 + Math.random() * 0.6;
      return part("cp-nuke-debris", `--dx: calc(var(--s) * ${(Math.cos(angle) * reach).toFixed(2)}); ` +
        `--dy: calc(var(--s) * ${(Math.sin(angle) * reach * 0.6).toFixed(2)}); --d: ${(0.9 + Math.random() * 0.6).toFixed(2)}s`);
    }).join("");
    boom.innerHTML = part("cp-nuke-flash") + part("cp-nuke-ring") +
      `<i class="cp-nuke-cloud">${part("cp-nuke-dust")}${part("cp-nuke-stem")}<i class="cp-nuke-cap">${under}${puffs}</i></i>` +
      debris + `<b class="cp-nuke-text">${wins} IN A ROW</b>`;
    document.body.appendChild(boom);
    const table = document.querySelector(".table");
    table?.classList.add("cp-nuke-shake");
    setTimeout(() => table?.classList.remove("cp-nuke-shake"), 900);
    setTimeout(() => boom.remove(), BLAST_MS);
  }

  function douse(layer) {
    layer.parentElement?.classList.remove("cp-flames-host");
    layer.remove();
  }

  function render() {
    if (!enabled) return;
    const byName = new Map(Object.entries(names).map(([id, name]) => [name.toLowerCase(), id]));
    const lit = new Set();
    for (const seat of document.querySelectorAll(".table-player:not(.table-player-seat)")) {
      const stage = Math.min(3, streaks[byName.get(playerName(seat).toLowerCase())] || 0);
      const sign = seat.querySelector(".table-player-infos-ctn");
      if (stage && sign && burn(seat, sign, stage)) lit.add(seat);
    }
    for (const layer of document.querySelectorAll(".cp-flames")) if (!lit.has(layer.parentElement)) douse(layer);
  }

  // ---------- Lifecycle ----------

  function tick() {
    // The extension was reloaded or updated: this copy can't reach Chrome any more.
    // The new copy takes over once the tab is refreshed.
    if (!chrome.runtime?.id) { setEnabled(false); return; }
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
    // Poker Now marks the winning seats as the pot is awarded: the hand is over.
    const won = !!document.querySelector(".table-player.winner");
    if (won && !wonBefore) schedule(AFTER_WIN_MS, true);
    wonBefore = won;
    render();
  }

  function setEnabled(on) {
    if (on === enabled) return;
    enabled = on;
    clearInterval(tickTimer); clearInterval(pollTimer); clearTimeout(updateTimer);
    if (on) {
      tickTimer = setInterval(tick, TICK_MS);
      pollTimer = setInterval(() => { if (!document.hidden) update(); }, POLL_MS);
      update();
    } else {
      for (const layer of document.querySelectorAll(".cp-flames")) douse(layer);
      style.remove();
    }
  }

  // A new game on screen (or none): its streaks start from its own log.
  cpGame.watch((id) => {
    gameId = id;
    streaks = {}; names = {}; lastEnd = null; wonBefore = false;
    clearTimeout(updateTimer);
    render();   // puts out the last game's flames
    if (enabled && id) update();
  });

  window.addEventListener("resize", render);
  document.addEventListener("visibilitychange", () => { if (enabled && !document.hidden) update(); });

  chrome.storage.sync.get({ winStreak: true }, (s) => setEnabled(s.winStreak));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.winStreak) setEnabled(changes.winStreak.newValue);
  });
})();
