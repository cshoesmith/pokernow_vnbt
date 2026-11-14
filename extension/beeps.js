// Turn timer beeps: Poker Now's warning is easy to miss, so on your turn this
// double-beeps at 10 seconds left, then beeps every second from 5, higher and
// louder for the last 3. Only on your own turn, and it still works with the game
// tab in the background.
//
// Your seat (.you-player) has .decision-current while it's your turn, and its sign
// holds the timer, .time-to-talk: two bars, .normal-time then .time-bank, whose
// widths are % of the whole turn (normal time plus extra time). The normal bar runs
// down first, then the extra time; when both are empty Poker Now acts for you. The
// time left is their total width over the rate they're falling, measured as the turn
// runs. The beeps are scheduled on the audio clock, which keeps time in a background
// tab where page timers are slowed, and are called off the moment the turn ends.

(() => {
  if (!/^\/games\//.test(location.pathname)) return;

  const WARN_AT = [10, 5, 4, 3, 2, 1];   // seconds left
  const MIN_GAP_MS = 100;                 // sample the bars at most this often
  const FALLBACK_MS = 500;                // and at least this often while the tab is in front
  const FIT_MS = 4000;                    // fit the rate over the last few seconds of samples
  const MIN_SPAN_MS = 800;                // before that, use the last turn's rate
  const MOVE_MS = 250;                    // re-plan the beeps if the deadline moves more than this

  let enabled = false, timer = null, observer = null, ctx = null;
  let turn = null;       // { samples: [{ t, r }], deadline, beeps: Map(secondsLeft -> { when, nodes }) }
  let lastRate = null;   // %/ms the bars fell at last turn
  let lastSample = 0;

  // ---------- Sound ----------

  // Chrome only lets a page make sound after it's been clicked or typed in; players
  // click their way through a game, so the audio is woken on the first of those.
  function audio() {
    try {
      ctx ??= new AudioContext();
      if (ctx.state === "suspended") ctx.resume();
    } catch { /* no audio available */ }
    return ctx;
  }
  for (const type of ["pointerdown", "keydown"]) {
    addEventListener(type, () => { if (enabled) audio(); }, { capture: true, passive: true });
  }

  // One short tone: 10 seconds left is a soft double beep, 5 and 4 a beep, the last 3 higher and louder.
  function tone(when, left) {
    const pitch = left > 5 ? 660 : left > 3 ? 880 : 1175;
    const volume = left > 5 ? 0.18 : left > 3 ? 0.25 : 0.35;
    const nodes = [];
    for (const start of left > 5 ? [when, when + 0.16] : [when]) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = pitch;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.14);
      nodes.push(osc);
    }
    return nodes;
  }

  function silence(nodes) {
    for (const osc of nodes) try { osc.stop(); osc.disconnect(); } catch { /* already done */ }
  }

  // (Re)plan the beeps for a turn ending at `deadline` (performance.now() ms).
  // Beeps already heard stay heard; the rest move to the new deadline.
  function plan(deadline) {
    if (!audio() || ctx.state !== "running") return;
    if (turn.deadline != null && Math.abs(deadline - turn.deadline) < MOVE_MS) return;
    turn.deadline = deadline;
    const end = ctx.currentTime + (deadline - performance.now()) / 1000;
    for (const left of WARN_AT) {
      const done = turn.beeps.get(left);
      if (done && done.when <= ctx.currentTime) continue;   // already sounded
      if (done) silence(done.nodes);
      turn.beeps.delete(left);
      const when = end - left;
      if (when > ctx.currentTime + 0.02) turn.beeps.set(left, { when, nodes: tone(when, left) });
    }
  }

  function endTurn() {
    if (!turn) return;
    for (const { nodes } of turn.beeps.values()) silence(nodes);
    turn = null;
  }

  // ---------- Reading the timer ----------

  // Least-squares slope of the bar total over time (%/ms, negative while it runs),
  // and when that line reaches zero.
  function fit(samples) {
    const n = samples.length;
    const mt = samples.reduce((s, p) => s + p.t, 0) / n, mr = samples.reduce((s, p) => s + p.r, 0) / n;
    let num = 0, den = 0;
    for (const p of samples) { num += (p.t - mt) * (p.r - mr); den += (p.t - mt) ** 2; }
    return den ? num / den : 0;
  }

  function sample() {
    const now = performance.now();
    lastSample = now;
    const bars = document.querySelector(".table-player.you-player.decision-current .time-to-talk");
    if (!enabled || !bars) { endTurn(); return; }
    const width = (sel) => parseFloat(bars.querySelector(sel)?.style.width) || 0;
    const r = width(".normal-time") + width(".time-bank");
    // The bars filled back up: a new turn straight after the last, or more time.
    if (turn && r > turn.samples[turn.samples.length - 1].r + 1) endTurn();
    turn ??= { samples: [], deadline: null, beeps: new Map() };
    const s = turn.samples;
    if (!s.length || s[s.length - 1].r !== r) s.push({ t: now, r });
    while (s.length > 2 && now - s[0].t > FIT_MS) s.shift();

    let rate = null;
    if (s.length >= 3 && s[s.length - 1].t - s[0].t >= MIN_SPAN_MS) {
      const slope = fit(s);
      if (slope < 0) rate = lastRate = -slope;
    }
    rate ??= lastRate;
    if (!rate) return;
    const last = s[s.length - 1];
    plan(last.t + last.r / rate);
  }

  // ---------- Lifecycle ----------

  // Poker Now redraws the bars several times a second, and keeps doing so (from its
  // server's updates) when the tab is in the background, so watch for that rather
  // than relying on a timer alone.
  function onMutation() {
    if (performance.now() - lastSample >= MIN_GAP_MS) sample();
  }

  function setEnabled(on) {
    if (on === enabled) return;
    enabled = on;
    clearInterval(timer);
    observer?.disconnect();
    if (on) {
      observer = new MutationObserver(onMutation);
      const watch = () => observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class"] });
      if (document.body) watch(); else document.addEventListener("DOMContentLoaded", watch, { once: true });
      timer = setInterval(() => {
        // The extension was reloaded or updated: the new copy takes over once the tab is refreshed.
        if (!chrome.runtime?.id) { setEnabled(false); return; }
        sample();
      }, FALLBACK_MS);
    } else {
      endTurn();
    }
  }

  chrome.storage.sync.get({ turnBeeps: true }, (s) => setEnabled(s.turnBeeps));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.turnBeeps) setEnabled(changes.turnBeeps.newValue);
  });
})();
