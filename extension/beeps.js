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
  const WARN_AT = [10, 5, 4, 3, 2, 1];   // seconds left
  const MIN_GAP_MS = 100;                 // sample the bars at most this often
  const FALLBACK_MS = 500;                // and at least this often while the tab is in front
  const FIT_MS = 4000;                    // fit the rate over the last few seconds of samples
  const MIN_SPAN_MS = 800;                // before that, use the last turn's rate
  const MOVE_MS = 250;                    // re-plan the beeps if the deadline moves more than this

  let enabled = false, timer = null, observer = null, ctx = null;
  let volume = 0.8;      // the popup's slider, 0.1 to 1
  let turn = null;       // { samples: [{ t, r }], deadline, beeps: Map(secondsLeft -> { when, nodes }) }
  let lastRate = null;   // %/ms the bars fell at last turn
  let lastSample = 0;
  // For the popup's Test button: how many of your turns were timed since the tab
  // loaded, and how the last one went.
  const stats = { turns: 0, planned: 0, firstLeft: null, blocked: 0 };

  // ---------- Sound ----------

  // Chrome only lets a page make sound after it's been clicked or typed in, and
  // logs a warning if audio is started any sooner. Players click their way through
  // a game, so the audio is started on the first of those, and not before.
  function audio() {
    if (!navigator.userActivation?.hasBeenActive) return null;
    try {
      ctx ??= new AudioContext();
      if (ctx.state === "suspended") ctx.resume();
    } catch { /* no audio available */ }
    return ctx;
  }
  for (const type of ["pointerdown", "pointerup", "click", "keydown"]) {   // a tap counts on release
    addEventListener(type, () => { if (enabled) audio(); }, { capture: true, passive: true });
  }

  // One beep: 10 seconds left is a double beep, 5 and 4 a beep, the last 3 higher
  // and at full volume. A square wave with its harshest overtones filtered off: it
  // carries over laptop speakers and chatter far better than a pure tone.
  function tone(when, left) {
    const pitch = left > 5 ? 660 : left > 3 ? 880 : 1175;
    const level = (left > 5 ? 0.6 : left > 3 ? 0.8 : 1) * volume;
    const nodes = [];
    for (const start of left > 5 ? [when, when + 0.2] : [when]) {
      const osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = pitch;
      filter.type = "lowpass";
      filter.frequency.value = 3200;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(level, start + 0.01);
      gain.gain.setValueAtTime(level, start + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
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
    if (!audio() || ctx.state !== "running") { turn.blocked ||= (stats.blocked++, true); return; }
    if (turn.deadline != null && Math.abs(deadline - turn.deadline) < MOVE_MS) return;
    if (turn.deadline == null) stats.firstLeft = Math.round((deadline - performance.now()) / 100) / 10;
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
    stats.planned = turn.beeps.size;
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
    if (!enabled || !bars || !cpGame.id) { endTurn(); return; }   // cpGame: content.js
    const width = (sel) => parseFloat(bars.querySelector(sel)?.style.width) || 0;
    const r = width(".normal-time") + width(".time-bank");
    // The bars filled back up: a new turn straight after the last, or more time.
    if (turn && r > turn.samples[turn.samples.length - 1].r + 1) endTurn();
    if (!turn) {
      turn = { samples: [], deadline: null, beeps: new Map(), blocked: false };
      stats.turns++;
      stats.planned = 0;
      stats.firstLeft = null;
    }
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

  // The popup's Test button: play the 10-second and last-3 sounds here, and report
  // whether Chrome is letting this tab make sound and what the last turns did.
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (msg?.type !== "beeps-test") return;
    const c = enabled ? audio() : null;
    if (c?.state === "running") {
      tone(c.currentTime + 0.05, 10);
      tone(c.currentTime + 0.7, 3);
    }
    const state = c ? c.state : !enabled ? "off" : navigator.userActivation?.hasBeenActive ? "unavailable" : "suspended";
    reply({ enabled, audio: state, ...stats });
  });

  const setVolume = (v) => { volume = Math.min(1, Math.max(0.1, Number(v) / 100 || 0.8)); };

  chrome.storage.sync.get({ turnBeeps: true, beepVolume: 80 }, (s) => { setVolume(s.beepVolume); setEnabled(s.turnBeeps); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.beepVolume) setVolume(changes.beepVolume.newValue);   // beeps already planned keep their level
    if (changes.turnBeeps) setEnabled(changes.turnBeeps.newValue);
  });
})();
