// The TV window's player (stream.html, opened from the TV button on the table:
// stream.js, background.js): plays the channel (sync setting tableStream), an
// HLS stream (.m3u8) through hls.js (lib/hls.min.js) or a plain video file
// straight in the <video>. A live stream that drops is retried every few
// seconds. The guide (stream-guide.js) changes channel with start() and hears
// back through the cpChannel* hooks. The window closes itself when TV is
// switched off in the popup (sync setting tv).
//
// Kept in step with vNBT TV's tv-player.js (../vnbt-tv), which differs only in
// its setting names and not closing.

const FILE_RE = /\.(mp4|m4v|webm|mov|ogv)(\?|#|$)/i;   // anything else is treated as HLS

const video = document.getElementById("video");
let hls = null, url = "", wantSound = false, retry = null;
let played = false, markedDead = false;   // for the current channel

// Half volume to start with, so unmuting isn't a blast.
video.volume = 0.5;

// Whether a channel works, for the guide (kept by background.js): it works once
// it plays; it's dead if it fails before it ever has.
function health(ok) {
  chrome.runtime.sendMessage({ type: "stream-health", url, ok }).catch(() => {});
}

video.addEventListener("playing", () => {
  document.body.classList.add("playing");
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
}

function start(u, retrying = false) {
  stop();
  url = u;
  if (!retrying) {
    played = markedDead = false;
    window.cpChannelChanged?.(u);
  }
  if (!/^https?:\/\/\S+$/i.test(u)) return;
  if (!FILE_RE.test(u) && window.Hls?.isSupported()) {
    // Extension pages can't start workers from blob: URLs, hence no worker.
    hls = new Hls({ enableWorker: false, loader: ProxyLoader,
      subtitleDisplay: false });   // a channel's subtitles are there to turn on (the player's CC button), not shown
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

// The stream dropped or isn't up yet: try again shortly, for as long as it's on.
function again() {
  const u = url;
  if (!played && !markedDead) { markedDead = true; health(false); window.cpChannelFailed?.(); }
  stop();
  retry = setTimeout(() => start(u, true), 5000);
}

// Many TV channels are plain http://, which Chrome won't load into a secure page
// like this one. The background script isn't a page, so those files are
// fetched by it (background.js) and handed back; https ones load here as normal.
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
// page; until then it plays muted.
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

// Muting or unmuting in the video's controls is the person's choice, and new
// channels keep it: it's saved as tableStreamSound. The player only ever mutes
// to match that, or when Chrome holds the sound back, which isn't a choice.
video.addEventListener("volumechange", () => {
  if (!video.muted) blockedMute = false;
  if (blockedMute || wantSound === !video.muted) return;   // nothing chosen
  wantSound = !video.muted;
  chrome.storage.sync.set({ tableStreamSound: wantSound });
});

// TV switched off in the popup: close. Another window changing channel or sound: follow it.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.tv && !changes.tv.newValue) { window.close(); return; }
  if (changes.tableStreamSound && !!changes.tableStreamSound.newValue !== wantSound) {
    wantSound = !!changes.tableStreamSound.newValue;
    if (url) play();
  }
  const u = changes.tableStream?.newValue;
  if (typeof u === "string" && u && u !== url) start(u);
});
