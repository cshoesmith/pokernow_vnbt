// Stack chart: plots every player's chip stack at the start of each hand, read
// from the game log, in a panel in the bottom-left corner. History is cached
// per game, so only new log pages are fetched.

(() => {
  const match = location.pathname.match(/^\/games\/([\w-]+)/);
  if (!match) return;

  const GAME_ID = match[1];
  const CACHE_KEY = `stacks:${GAME_ID}`;
  const PAGE_DELAY_MS = 1200;   // the log endpoint rate-limits quick paging
  const RETRY_MS = 10000;
  const POLL_MS = 20000;

  // Validated dark categorical palette (fixed order; assigned by first appearance).
  const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
  const OVERFLOW = "#898781";   // 9th+ player: muted, still named in the legend
  const INK = { primary: "#f0efec", secondary: "#c3c2b7", muted: "#898781",
                grid: "#2c2c2a", axis: "#383835", surface: "#1a1a19",
                up: "#0ca30c", down: "#e66767" };
  const AXIS_W = 44;    // fixed y-axis column; the plot beside it scrolls
  const HAND_PX = 10;   // minimum horizontal space per hand

  // points: [{ c: created_at, t: ms, s: { playerId: stack } }], oldest first
  let data = { newest: null, points: [], names: {} };
  let enabled = false;
  let loaded = false;
  let syncing = false;
  let view = "chart";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const SVG_NS = "http://www.w3.org/2000/svg";

  // ---------- Data ----------

  const STACK_RE = /#\d+ "(.+?) @ ([\w-]+)" \((\d+(?:\.\d+)?)\)/g;

  function parseStacks(log) {
    const s = {};
    for (const m of log.msg.matchAll(STACK_RE)) {
      s[m[2]] = Number(m[3]);
      if (!(m[2] in data.names)) data.names[m[2]] = m[1];
    }
    return { c: Number(log.created_at), t: Date.parse(log.at), s };
  }

  async function fetchPage(before) {
    for (;;) {
      const res = await fetch(`/games/${GAME_ID}/log?before_at=${before ?? ""}&after_at=&mm=false&v=2`);
      const text = await res.text();
      if (text.startsWith("{")) return JSON.parse(text).logs || [];
      await sleep(RETRY_MS);   // "Too many requests" - back off and retry
    }
  }

  // Walk the log from newest backwards until we reach what we already have.
  async function sync() {
    if (syncing) return;
    syncing = true;
    try {
      const fresh = [];
      let before = null;
      let newest = null;
      for (;;) {
        const logs = await fetchPage(before);
        if (!logs.length) break;
        if (newest === null) newest = Number(logs[0].created_at);
        let reachedKnown = false;
        for (const log of logs) {
          if (data.newest !== null && Number(log.created_at) <= data.newest) { reachedKnown = true; break; }
          if (log.msg.startsWith("Player stacks:")) fresh.push(parseStacks(log));
        }
        const next = logs[logs.length - 1].created_at;
        if (reachedKnown || next === before) break;
        before = next;
        if (!loaded) setStatus(`Loading hand history… ${fresh.length} hands`);
        await sleep(PAGE_DELAY_MS);
      }
      if (newest !== null && (data.newest === null || newest > data.newest)) data.newest = newest;
      if (fresh.length) {
        data.points = data.points.concat(fresh.reverse());
        chrome.storage.local.set({ [CACHE_KEY]: data });
      }
      loaded = true;
      render();
    } finally {
      syncing = false;
    }
  }

  // Color follows the player: slot by first appearance, stable as hands are added.
  function seriesList() {
    const order = [];
    for (const p of data.points) for (const id of Object.keys(p.s)) if (!order.includes(id)) order.push(id);
    return order.map((id, i) => ({ id, name: data.names[id] || id, color: SERIES[i] || OVERFLOW }));
  }

  // ---------- Panel ----------

  const panel = document.createElement("div");
  panel.id = "clean-poker-chart";
  panel.innerHTML = `
    <style>
      #clean-poker-chart { position: fixed; z-index: 5; box-sizing: border-box; display: none;
        flex-direction: column; padding: 6px 8px 4px; background: ${INK.surface};
        border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; color: ${INK.secondary};
        font: 13px system-ui, -apple-system, "Segoe UI", sans-serif; }
      #clean-poker-chart [hidden] { display: none !important; }
      #clean-poker-chart .cp-head { display: flex; align-items: center; gap: 10px; min-height: 18px; }
      #clean-poker-chart .cp-title { color: ${INK.primary}; font-weight: 600; }
      #clean-poker-chart .cp-legend { display: flex; flex-wrap: wrap; gap: 2px 10px; flex: 1; }
      #clean-poker-chart .cp-key { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
      #clean-poker-chart .cp-key i { display: inline-block; width: 12px; height: 2px; border-radius: 1px; }
      #clean-poker-chart button { background: none; border: 1px solid rgba(255,255,255,0.15); color: ${INK.secondary};
        border-radius: 4px; font: inherit; padding: 1px 6px; cursor: pointer; }
      #clean-poker-chart button:hover { color: ${INK.primary}; border-color: rgba(255,255,255,0.3); }
      #clean-poker-chart .cp-body { position: relative; flex: 1; min-height: 0; }
      #clean-poker-chart .cp-yaxis { position: absolute; left: 0; top: 0; width: ${AXIS_W}px; }
      #clean-poker-chart .cp-scroll { position: absolute; left: ${AXIS_W}px; right: 0; top: 0; bottom: 0;
        overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; scrollbar-color: #383835 transparent; }
      #clean-poker-chart .cp-plot { display: block; }
      #clean-poker-chart .cp-status { position: absolute; inset: 0; display: flex; align-items: center;
        justify-content: center; color: ${INK.muted}; }
      #clean-poker-chart .cp-tip { position: absolute; bottom: 4px; pointer-events: none; display: none;
        background: #262625; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 5px 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4); white-space: nowrap; }
      #clean-poker-chart .cp-tip-time { color: ${INK.muted}; margin-bottom: 3px; }
      #clean-poker-chart .cp-row { display: flex; align-items: center; gap: 6px; line-height: 15px; }
      #clean-poker-chart .cp-row b { color: ${INK.primary}; font-variant-numeric: tabular-nums; min-width: 42px; text-align: right; }
      #clean-poker-chart table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
      #clean-poker-chart td { padding: 1px 6px 1px 0; }
      #clean-poker-chart td.num { text-align: right; color: ${INK.primary}; }
      #clean-poker-chart .cp-table { position: absolute; inset: 0; overflow: auto; }
    </style>
    <div class="cp-head">
      <span class="cp-title">Stacks</span>
      <span class="cp-legend"></span>
      <button type="button" class="cp-toggle">Table</button>
      <button type="button" class="cp-log">Log / Ledger</button>
    </div>
    <div class="cp-body">
      <svg class="cp-yaxis"></svg>
      <div class="cp-scroll"><svg class="cp-plot" aria-label="Chip stacks by hand"></svg></div>
      <div class="cp-table" hidden></div>
      <div class="cp-status"></div>
      <div class="cp-tip"></div>
    </div>`;

  const $ = (sel) => panel.querySelector(sel);
  const yAxis = $(".cp-yaxis");
  const scroller = $(".cp-scroll");
  const plot = $(".cp-plot");
  const tip = $(".cp-tip");

  $(".cp-toggle").addEventListener("click", () => {
    view = view === "chart" ? "table" : "chart";
    $(".cp-toggle").textContent = view === "chart" ? "Table" : "Chart";
    render();
  });

  // Poker Now's own Log/Ledger button is hidden while the chart is shown (content.js);
  // this one opens the same window.
  $(".cp-log").addEventListener("click", () => document.querySelector(".show-log-button")?.click());

  // Scroll the plot with the mouse wheel; redraw so the y-axis fits the hands in view.
  let drawQueued = false;
  scroller.addEventListener("scroll", () => {
    hideTip();
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; drawPlot(); });
  });
  scroller.addEventListener("wheel", (ev) => {
    if (Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return;
    scroller.scrollLeft += ev.deltaY;
    ev.preventDefault();
  }, { passive: false });

  function setStatus(text) {
    $(".cp-status").textContent = text;
    $(".cp-status").hidden = !text;
  }

  // Fill the bottom-left corner (Poker Now's Log/Ledger button is hidden; ours is in
  // the header) with the largest box that stays clear of the seat boxes: try a top edge just
  // below each seat, stretch right until a seat is in the way, keep the biggest.
  const MAX_WIDTH = 520, MAX_HEIGHT = 360, MIN_HEIGHT = 150, MARGIN = 12, GAP = 10;

  // A seat's full footprint: its box plus anything drawn outside it (cards, chips, emoji).
  function seatRect(seat) {
    const r = seat.getBoundingClientRect();
    if (!r.width) return null;
    let { left, top, right, bottom } = r;
    for (const el of seat.querySelectorAll("*")) {
      const c = el.getBoundingClientRect();
      if (!c.width || !c.height) continue;
      left = Math.min(left, c.left); top = Math.min(top, c.top);
      right = Math.max(right, c.right); bottom = Math.max(bottom, c.bottom);
    }
    return { left, top, right, bottom };
  }

  // The table oval on screen. The table image (1889x892, background-size: cover,
  // centred) has its rail at (947, 455) with radii 619 x 333, 3D edge included.
  function tableOval() {
    const t = document.querySelector(".table")?.getBoundingClientRect();
    if (!t?.width) return null;
    const s = Math.max(t.width / 1889, t.height / 892);
    const ox = t.left + (t.width - 1889 * s) / 2, oy = t.top + (t.height - 892 * s) / 2;
    return { cx: ox + 947 * s, cy: oy + 455 * s, rx: 619 * s + GAP, ry: 333 * s + GAP };
  }

  // Rightmost x a box spanning rows top..bottom can reach without touching the oval.
  function ovalLimit(o, top, bottom) {
    if (!o) return Infinity;
    const yc = Math.min(Math.max(o.cy, top), bottom);   // the row where the oval reaches furthest left
    const dy = (yc - o.cy) / o.ry;
    return Math.abs(dy) >= 1 ? Infinity : o.cx - o.rx * Math.sqrt(1 - dy * dy);
  }

  function cornerRect(h) {
    const seats = [...document.querySelectorAll(".table-player")].map(seatRect).filter(Boolean);
    const oval = tableOval();
    const left = h.left + MARGIN, bottom = h.bottom - MARGIN;
    const maxRight = left + Math.min(MAX_WIDTH, h.width * 0.32);
    const highest = Math.max(h.top + h.height / 2, bottom - MAX_HEIGHT);
    const tops = [highest, ...seats.map((r) => r.bottom + GAP)]
      .filter((t) => t >= highest && bottom - t >= MIN_HEIGHT);
    let best = null;
    for (const top of tops) {
      let right = Math.min(maxRight, ovalLimit(oval, top, bottom));
      for (const r of seats) if (r.top < bottom && r.bottom > top && r.right > left) right = Math.min(right, r.left - GAP);
      const area = (right - left) * (bottom - top);
      if (right > left && (!best || area > best.area)) best = { area, left, top, width: right - left, height: bottom - top };
    }
    return best || { left, top: bottom - MIN_HEIGHT, width: maxRight - left, height: MIN_HEIGHT };
  }

  function place() {
    if (!enabled) return;
    if (!panel.isConnected) document.body.appendChild(panel);
    const host = document.querySelector(".game-main-container");
    if (!host) { panel.style.display = "none"; return; }
    const { left, top, width, height } = cornerRect(host.getBoundingClientRect());
    const rect = { left, top, width, height };
    const changed = ["left", "top", "width", "height"].some((k) => panel.style[k] !== `${Math.round(rect[k])}px`);
    for (const k in rect) panel.style[k] = `${Math.round(rect[k])}px`;
    panel.style.display = "flex";
    if (changed) render();
  }

  // ---------- Rendering ----------

  const compact = (v) => v >= 1000 ? `${+(v / 1000).toFixed(2)}K` : `${v}`;
  const fmtTime = (t, withDate) => new Date(t).toLocaleString([], withDate
    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" });

  function niceStep(range, count) {
    const raw = range / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  }

  function el(name, attrs, parent) {
    const node = document.createElementNS(SVG_NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    parent.appendChild(node);
    return node;
  }

  function renderLegend(series) {
    const legend = $(".cp-legend");
    legend.replaceChildren();
    if (series.length < 2) return;   // one series: the title already names it
    for (const s of series) {
      const key = document.createElement("span");
      key.className = "cp-key";
      const line = document.createElement("i");
      line.style.background = s.color;
      key.append(line, document.createTextNode(s.name));
      legend.appendChild(key);
    }
  }

  function renderTable(series) {
    const box = $(".cp-table");
    const last = data.points[data.points.length - 1];
    const table = document.createElement("table");
    const rows = series
      .map((s) => ({ ...s, now: last.s[s.id], start: data.points.find((p) => s.id in p.s).s[s.id] }))
      .sort((a, b) => (b.now ?? -1) - (a.now ?? -1));
    for (const r of rows) {
      const tr = table.insertRow();
      const key = document.createElement("i");
      key.style.cssText = `display:inline-block;width:12px;height:2px;border-radius:1px;background:${r.color};vertical-align:middle;margin-right:6px`;
      tr.insertCell().append(key, document.createTextNode(r.name));
      const now = tr.insertCell(); now.className = "num"; now.textContent = r.now == null ? "—" : r.now.toLocaleString();
      const delta = tr.insertCell(); delta.className = "num";
      if (r.now != null) {
        const d = r.now - r.start;
        delta.textContent = `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toLocaleString()}`;
        delta.style.color = d > 0 ? INK.up : d < 0 ? INK.down : INK.muted;
      }
    }
    box.replaceChildren(table);
  }

  function render() {
    if (!enabled || panel.style.display === "none") return;
    const series = seriesList();
    renderLegend(series);
    plot.replaceChildren();
    yAxis.replaceChildren();
    hideTip();

    if (!loaded) return;
    if (!data.points.length) { setStatus("No hands played yet"); return; }
    setStatus("");

    const tableMode = view === "table";
    $(".cp-table").hidden = !tableMode;
    scroller.hidden = yAxis.hidden = tableMode;
    if (tableMode) { renderTable(series); return; }
    layoutChart(series);
  }

  // Hands are spaced evenly (a long break doesn't squash the session); the plot
  // scrolls sideways and the y-axis rescales to the hands in view.
  const PAD_L = 8, PAD_T = 8, PAD_B = 20, LABEL_GAP = 100, BREAK_MS = 30 * 60000;
  let geo = null;   // current plot geometry, shared with the scroll and hover handlers

  function layoutChart(series) {
    const vw = scroller.clientWidth;
    if (vw < 50 || scroller.clientHeight < 40) return;
    const n = data.points.length;
    const directLabels = series.length >= 2 && series.length <= 4;
    const padR = directLabels ? 80 : 12;
    const px = n > 1 ? Math.max(HAND_PX, (vw - PAD_L - padR) / (n - 1)) : 0;
    const width = Math.max(vw, Math.ceil(PAD_L + px * (n - 1) + padR));
    const atEnd = !geo || scroller.scrollLeft + vw >= scroller.scrollWidth - 4;   // follow new hands
    plot.setAttribute("height", 1);    // measure height after the scrollbar (if any) appears
    plot.setAttribute("width", width);
    const H = scroller.clientHeight;
    geo = { series, n, px, width, H, directLabels, x: (i) => PAD_L + i * px, y: null, cross: null };
    plot.setAttribute("height", H);
    yAxis.setAttribute("height", H);
    yAxis.style.height = `${H}px`;
    if (atEnd) scroller.scrollLeft = width;
    drawPlot();
  }

  // Indices of hands that get a time label: every session start, then regular
  // ones that don't crowd them.
  function labelIndices(pts, x) {
    const picked = [0];
    for (let i = 1; i < pts.length; i++) if (pts[i].t - pts[i - 1].t > BREAK_MS) picked.push(i);
    for (let i = 0; i < pts.length; i++) {
      if (picked.every((j) => Math.abs(x(i) - x(j)) >= LABEL_GAP)) picked.push(i);
    }
    return picked.sort((a, b) => a - b);
  }

  function drawPlot() {
    if (!geo || view !== "chart") return;
    const { series, n, px, width, H, directLabels, x } = geo;
    const pts = data.points;
    plot.replaceChildren();
    yAxis.replaceChildren();

    // Fit the y-axis to the hands in view (plus one either side, where lines leave the edge).
    const from = Math.max(0, Math.floor((scroller.scrollLeft - PAD_L) / (px || 1)) - 1);
    const to = Math.min(n - 1, Math.ceil((scroller.scrollLeft + scroller.clientWidth - PAD_L) / (px || 1)) + 1);
    let lo = Infinity, hi = -Infinity;
    for (let i = from; i <= to; i++) for (const v of Object.values(pts[i].s)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (lo === Infinity) { lo = 0; hi = 1; }
    const step = niceStep(Math.max(hi - lo, 1), Math.max(3, Math.floor((H - PAD_T - PAD_B) / 40)));
    const ymin = Math.floor(lo / step) * step;
    const ymax = Math.max(ymin + step, Math.ceil(hi / step) * step);
    const y = (v) => H - PAD_B - ((v - ymin) / (ymax - ymin)) * (H - PAD_T - PAD_B);
    geo.y = y;

    for (let v = ymin; v <= ymax + 1e-9; v += step) {
      el("line", { x1: 0, x2: width, y1: y(v), y2: y(v), stroke: v === ymin ? INK.axis : INK.grid, "stroke-width": 1 }, plot);
      el("text", { x: AXIS_W - 6, y: y(v) + 4, "text-anchor": "end", fill: INK.muted, "font-size": 12,
        style: "font-variant-numeric: tabular-nums" }, yAxis).textContent = compact(v);
    }

    // Session breaks get a divider; labels show the date when the day changes.
    for (let i = 1; i < n; i++) {
      if (pts[i].t - pts[i - 1].t <= BREAK_MS) continue;
      const bx = x(i) - px / 2;
      el("line", { x1: bx, x2: bx, y1: PAD_T, y2: H - PAD_B, stroke: INK.axis, "stroke-width": 1 }, plot);
    }
    let lastDay = "";
    for (const i of labelIndices(pts, x)) {
      const day = new Date(pts[i].t).toDateString();
      const anchor = i === 0 ? "start" : x(i) > width - 60 ? "end" : "middle";
      el("text", { x: x(i), y: H - 4, "text-anchor": anchor, fill: INK.muted, "font-size": 12 }, plot)
        .textContent = fmtTime(pts[i].t, day !== lastDay);
      lastDay = day;
    }

    // Lines (broken where a player wasn't seated), end dots, end labels
    const ends = [];
    for (const s of series) {
      let d = "", pen = false, last = -1;
      pts.forEach((p, i) => {
        if (s.id in p.s) { d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(p.s[s.id]).toFixed(1)}`; pen = true; last = i; }
        else pen = false;
      });
      el("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, plot);
      if (last >= 0) ends.push({ s, cx: x(last), cy: y(pts[last].s[s.id]) });
    }
    for (const e of ends) el("circle", { cx: e.cx, cy: e.cy, r: 4, fill: e.s.color, stroke: INK.surface, "stroke-width": 2 }, plot);
    if (directLabels) {
      let prevY = -Infinity;
      for (const e of [...ends].sort((a, b) => a.cy - b.cy)) {
        if (e.cy - prevY < 14) continue;   // would collide: legend + tooltip carry it
        el("text", { x: e.cx + 8, y: e.cy + 4, fill: INK.secondary, "font-size": 12 }, plot).textContent = e.s.name;
        prevY = e.cy;
      }
    }
    geo.cross = el("line", { y1: PAD_T, y2: H - PAD_B, stroke: INK.muted, "stroke-width": 1, visibility: "hidden" }, plot);
  }

  // Hover: crosshair snaps to the nearest hand; tooltip lists every player.
  plot.addEventListener("pointermove", (ev) => {
    if (!geo || !geo.y || !geo.n) return;
    const bx = ev.clientX - plot.getBoundingClientRect().left;
    const i = Math.max(0, Math.min(geo.n - 1, Math.round((bx - PAD_L) / (geo.px || 1))));
    const p = data.points[i];
    const cx = geo.x(i);
    geo.cross.setAttribute("x1", cx); geo.cross.setAttribute("x2", cx); geo.cross.setAttribute("visibility", "visible");

    const time = document.createElement("div");
    time.className = "cp-tip-time";
    time.textContent = fmtTime(p.t, true);
    const rows = geo.series.filter((s) => s.id in p.s).sort((a, b) => p.s[b.id] - p.s[a.id]).map((s) => {
      const row = document.createElement("div");
      row.className = "cp-row";
      const key = document.createElement("i");
      key.style.cssText = `display:inline-block;width:10px;height:2px;border-radius:1px;background:${s.color}`;
      const val = document.createElement("b");
      val.textContent = p.s[s.id].toLocaleString();
      row.append(key, val, document.createTextNode(s.name));
      return row;
    });
    tip.replaceChildren(time, ...rows);
    tip.style.display = "block";
    const at = AXIS_W + cx - scroller.scrollLeft, tw = tip.offsetWidth, bw = $(".cp-body").clientWidth;
    tip.style.left = `${at + 12 + tw > bw ? Math.max(0, at - 12 - tw) : at + 12}px`;
  });
  plot.addEventListener("pointerleave", hideTip);

  function hideTip() {
    tip.style.display = "none";
    geo?.cross?.setAttribute("visibility", "hidden");
  }

  // ---------- Lifecycle ----------

  let pollTimer = null;

  async function start() {
    const cached = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];
    if (cached && Array.isArray(cached.points)) { data = cached; loaded = cached.points.length > 0; }
    place();
    if (loaded) render(); else setStatus("Loading hand history…");
    await sync();
    pollTimer = setInterval(() => { if (!document.hidden) sync(); }, POLL_MS);
  }

  function setEnabled(on) {
    if (on === enabled) return;
    enabled = on;
    if (on) {
      if (document.body) start(); else document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      clearInterval(pollTimer);
      panel.remove();
    }
  }

  window.addEventListener("resize", place);
  setInterval(place, 1000);   // players sit down and the app re-renders its layout; keep clear of them

  chrome.storage.sync.get({ stackChart: true }, (s) => setEnabled(s.stackChart));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.stackChart) setEnabled(changes.stackChart.newValue);
  });
})();
