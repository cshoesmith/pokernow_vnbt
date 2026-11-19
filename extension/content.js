// Restyles the Poker Now UI via an injected stylesheet. CSS rules apply to
// elements as soon as the app renders them, so no DOM watching is needed.

// Which game this tab is showing, for the other scripts. Poker Now can go from
// its home page to a game, or from one game to the next, without loading a new
// page, so they can't just read the address once when the page loads: that left
// them off until F5. cpGame.id is the game's id, or null off a game page;
// cpGame.watch(fn) calls fn(id) now and whenever it changes.
const cpGame = (() => {
  const read = () => location.pathname.match(/^\/games\/([\w-]+)/)?.[1] ?? null;
  let id = read();
  const listeners = [];
  function check() {
    // The extension was reloaded or updated: the new copy takes over once the tab is refreshed.
    if (!chrome.runtime?.id) { clearInterval(timer); return; }
    const now = read();
    if (now === id) return;
    id = now;
    for (const fn of listeners) fn(id);
  }
  const timer = setInterval(check, 500);
  addEventListener("popstate", check);
  return { get id() { return id; }, watch(fn) { listeners.push(fn); fn(id); } };
})();

const RULES = {
  promoLink: ".help-link-game",                 // "Polymarket & Poker Now / Join our Squad"
  chat: ".game-main-container > .chat",         // chat messages + new message button
  videoControls: ".conf-controls"               // JOIN / camera / mic box
};

// Poker Now's landscape table image is 1889x892, set from its stylesheet, or for
// seasonal themes (e.g. design-themes-elements/felt/hw26-felt-l.png) as an inline
// background on .table. Our table is drawn with the same geometry and overrides
// either one; portrait uses a vertical table image, so it is left alone.
const BEER_TABLE = chrome.runtime.getURL("beer-table.svg");

// How the beer table was matched during Halloween 2026, kept behind the
// "Holidays workaround" switch in case a seasonal theme's table isn't caught above.
const HOLIDAY_TABLE = '.table[style*="-felt-l.png"]';

const DEFAULTS = {
  promoLink: true,
  chat: true,
  videoControls: true,
  beerTheme: true,
  tableTitle: "vNBT Poker Challenge",
  holidayWorkaround: false,
  stackChart: true,
  cardBacks: "standard"   // "standard", "mixed", or "1" to "5"
};

const style = document.createElement("style");
style.id = "clean-poker-style";
(document.head || document.documentElement).appendChild(style);

function escapeXml(s) {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// A transparent layer the same size as the table image, holding just the title
// printed near the bottom of the felt (where Poker Now's logo was), so it scales
// exactly like the table under background-size: cover.
function titleLayer(text) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1889" height="892" viewBox="0 0 1889 892">` +
    `<text x="947" y="619" text-anchor="middle" font-family="'Segoe UI', 'Helvetica Neue', Arial, sans-serif" ` +
    `font-size="48" font-weight="600" letter-spacing="4" fill="#fff" fill-opacity="0.75">` +
    `${escapeXml(text)}</text></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

function beerCss(title, holidays) {
  const layers = [`url("${BEER_TABLE}")`];
  if (title.trim()) layers.unshift(titleLayer(title.trim()));
  const selector = holidays ? `.landscape .table, ${HOLIDAY_TABLE}` : ".landscape .table";
  return `${selector} {
  background-image: ${layers.join(", ")} !important;
  background-size: cover !important;
  background-position: 50% 50% !important;
  background-repeat: no-repeat !important;
}`;
}

// Card backs: five silhouette pin-up designs (card-backs/back-1..5.svg, drawn by
// tools/card_backs.py) in place of Poker Now's own. Every face-down card is a
// .card-container whose .front shows the back image; "sneak" shows it faintly over
// your own cards. "mixed" gives each seat (.table-player-1 to -10) its own design.
const CARD_BACK_COUNT = 5;
const cardBackUrl = (n) => chrome.runtime.getURL(`card-backs/back-${n}.svg`);

function cardBackCss(choice) {
  const n = Number(choice);
  const base = choice === "mixed" ? 1 : n >= 1 && n <= CARD_BACK_COUNT ? n : 0;
  if (!base) return "";   // Poker Now's standard back
  const rule = (sel, url) => `${sel} { background-image: url("${url}") !important; background-size: cover !important; }`;
  const css = [
    rule(".card-container .front", cardBackUrl(base)),
    rule(".card-container.sneak .card:before", cardBackUrl(base))
  ];
  if (choice === "mixed") {
    for (let seat = 1; seat <= 10; seat++) {
      css.push(rule(`.table-player-${seat} .card-container .front`, cardBackUrl(((seat - 1) % CARD_BACK_COUNT) + 1)));
    }
  }
  return css.join("\n");
}

// The stack chart (chart.js) takes the bottom-left corner and has its own
// Log/Ledger button, so Poker Now's is hidden while the chart is on.
const LOG_BUTTON = ".aux-chat-bottom-buttons-ctn";

function apply(settings) {
  const selectors = Object.keys(RULES).filter((k) => settings[k]).map((k) => RULES[k]);
  if (settings.stackChart) selectors.push(LOG_BUTTON);
  const css = [];
  if (selectors.length) css.push(`${selectors.join(",\n")} { display: none !important; }`);
  if (settings.beerTheme) css.push(beerCss(settings.tableTitle, settings.holidayWorkaround));
  css.push(cardBackCss(settings.cardBacks));
  style.textContent = css.join("\n\n");
}

chrome.storage.sync.get(DEFAULTS, apply);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  chrome.storage.sync.get(DEFAULTS, apply);
});
