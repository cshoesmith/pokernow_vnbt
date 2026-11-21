// Plays the table video set in the popup (tableStream) inside stream.html: an
// HLS stream (.m3u8) through hls.js (lib/hls.light.min.js), or a plain video
// file (.mp4, .webm...) straight in the <video>. A live stream that drops is
// retried every few seconds; until it plays, the frame shows nothing. How it's
// going is put in local storage (tableStreamStatus) for the popup to show, and
// told to the game page (stream.js), which shows its pop-out button while playing.
//
// Opened as stream.html?popout it's the video's own window instead (from that
// button, via background.js): the whole picture, with volume and full-screen
// controls. It closes itself if the table video is switched off.

const DEFAULTS = { tableStream: "", tableStreamSound: false, beerTheme: true, tableTitle: "vNBT Poker Challenge" };
const FILE_RE = /\.(mp4|m4v|webm|mov|ogv)(\?|#|$)/i;   // anything else is treated as HLS
const POKER_NOW = ["https://www.pokernow.com", "https://pokernow.com"];

const POPOUT = new URLSearchParams(location.search).has("popout");

const video = document.getElementById("video");
const title = document.getElementById("title");
let hls = null, url = "", wantSound = false, retry = null, typing = null;
let played = false, markedDead = false;   // for the current link

// Half volume to start with, so unmuting isn't a blast; the window's volume
// control can turn it up.
video.volume = 0.5;

if (POPOUT) {
  document.body.classList.add("popout");
  video.controls = true;
}

// The game page only needs to know whether it's playing; the popup wants more.
function tell(state) {
  if (!POPOUT && parent !== window) parent.postMessage({ cpStream: state }, "*");
}
function report(state) {
  if (url) chrome.storage.local.set({ tableStreamStatus: { url, state } }).catch(() => {});
  tell(state);
}

// Whether a channel works, for the popup's channel menu (kept by background.js):
// it works once it plays; it's dead if it fails before it ever has.
function health(ok) {
  chrome.runtime.sendMessage({ type: "stream-health", url, ok }).catch(() => {});
}

video.addEventListener("playing", () => {
  document.body.classList.add("playing");
  report("playing");
  window.cpChannelPlaying?.();
  if (!played) { played = true; health(true); }
});
video.addEventListener("error", () => { if (!hls && video.getAttribute("src")) again(); });

function stop() {
  clearTimeout(retry);
  hls?.destroy();
  hls = null;
  video.removeAttribute("src");
  video.load();
  document.body.classList.remove("playing");
  tell("stopped");
}

function start(u, retrying = false) {
  stop();
  url = u;
  if (!retrying) {
    played = markedDead = false;
    window.cpChannelChanged?.(u);   // the video window's guide (stream-guide.js)
  }
  if (!/^https?:\/\/\S+$/i.test(u)) return;
  if (!retrying) report("loading");
  if (!FILE_RE.test(u) && window.Hls?.isSupported()) {
    // Extension pages can't start workers from blob: URLs, hence no worker.
    hls = new Hls({ enableWorker: false, loader: ProxyLoader });
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      else again();
    });
    hls.loadSource(u);
    hls.attachMedia(video);
  } else {
    video.src = u;   // a video file, or HLS that Chrome plays itself
  }
  play();
}

// The stream dropped or isn't up yet: try again shortly, for as long as it's set.
function again() {
  const u = url;
  report("retrying");
  if (!played && !markedDead) { markedDead = true; health(false); window.cpChannelFailed?.(); }
  stop();
  retry = setTimeout(() => start(u, true), 5000);
}

// Many TV channels are plain http://, which Chrome won't load into a frame on
// an https page like Poker Now's. The background script isn't in a page, so
// those files are fetched by it (background.js) and handed back; https ones load
// here as normal.
class ProxyLoader {
  constructor(config) {
    this.base = new Hls.DefaultConfig.loader(config);
    this.stats = this.base.stats;
    this.context = null;
    this.done = false;
  }

  load(context, config, callbacks) {
    if (!/^http:/i.test(context.url)) {
      this.base.load(context, config, callbacks);
      this.context = this.base.context;
      return;
    }
    this.context = context;
    const stats = this.stats;
    stats.loading.start = performance.now();
    const ms = config.loadPolicy?.maxLoadTimeMs || config.timeout || 20000;
    const timer = setTimeout(() => {
      if (this.done) return;
      this.done = true;
      callbacks.onTimeout(stats, context, null);
    }, ms);
    const { rangeStart: from, rangeEnd: to } = context;
    const range = to ? `bytes=${from || 0}-${to - 1}` : from ? `bytes=${from}-` : "";
    chrome.runtime.sendMessage({ type: "stream-fetch", url: context.url, range }).then(async (r) => {
      if (this.done) return;
      if (!r || r.status < 200 || r.status >= 300) throw new Error(r?.error || `HTTP ${r?.status}`);
      const bytes = await (await fetch("data:application/octet-stream;base64," + r.data)).arrayBuffer();
      if (this.done) return;
      this.done = true;
      clearTimeout(timer);
      stats.loaded = stats.total = bytes.byteLength;
      stats.loading.first = stats.loading.end = performance.now();
      const data = context.responseType === "arraybuffer" ? bytes : new TextDecoder().decode(bytes);
      callbacks.onSuccess({ url: r.url || context.url, data, code: r.status }, stats, context, null);
    }).catch((err) => {
      if (this.done) return;
      this.done = true;
      clearTimeout(timer);
      callbacks.onError({ code: 0, text: String(err.message || err) }, context, null, stats);
    });
  }

  abort() {
    this.done = true;
    this.stats.aborted = true;
    this.base.abort();
  }

  destroy() {
    this.done = true;
    this.base.destroy();
  }
}

// Chrome only lets a video start with sound once someone has clicked in the
// game; until then it plays muted, and stream.js passes on the first click.
let blockedMute = false;   // muted only because Chrome held the sound back
function play() {
  video.muted = !wantSound;
  video.play().catch((err) => {
    // Only Chrome refusing sound (NotAllowedError) means playing muted; a start
    // cut short by the next channel or a retry (AbortError) doesn't.
    if (video.muted || err?.name !== "NotAllowedError") return;
    blockedMute = true;
    video.muted = true;
    video.play().catch(() => {});
  });
}

// Muting or unmuting in the video window's own controls is the person's choice,
// and new channels keep it: it becomes the Sound setting (so the popup's tick box
// agrees, and the table plays the same way once the window closes). The player
// only ever mutes to match that setting, or when Chrome holds the sound back,
// which isn't a choice and is left out.
video.addEventListener("volumechange", () => {
  if (!video.muted) blockedMute = false;
  if (!POPOUT || blockedMute || wantSound === !video.muted) return;   // nothing chosen
  wantSound = !video.muted;
  chrome.storage.sync.set({ tableStreamSound: wantSound });
});

addEventListener("message", (e) => {
  if (e.data !== "cp-stream-unmute" || !POKER_NOW.includes(e.origin)) return;
  if (wantSound && video.muted && url) play();
});

function apply(s) {
  title.textContent = s.beerTheme ? s.tableTitle.trim() : "";
  const sound = !!s.tableStreamSound;
  if (sound !== wantSound) {
    wantSound = sound;
    if (url) play();
  }
  const u = String(s.tableStream || "").trim();
  if (POPOUT && !u) { window.close(); return; }   // switched off in the popup
  if (u === url) return;
  // The link is saved as it's typed in the popup: wait until it's whole.
  clearTimeout(typing);
  typing = setTimeout(() => start(u), url || u ? 800 : 0);
}

chrome.storage.sync.get(DEFAULTS, (s) => {
  url = String(s.tableStream || "").trim();
  wantSound = !!s.tableStreamSound;
  title.textContent = s.beerTheme ? s.tableTitle.trim() : "";
  if (url) start(url);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") chrome.storage.sync.get(DEFAULTS, apply);
});
