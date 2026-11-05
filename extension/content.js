// Restyles the Poker Now UI via an injected stylesheet. CSS rules apply to
// elements as soon as the app renders them, so no DOM watching is needed.

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
  stackChart: true
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

// The stack chart (chart.js) takes the bottom-left corner and has its own
// Log/Ledger button, so Poker Now's is hidden while the chart is on.
const LOG_BUTTON = ".aux-chat-bottom-buttons-ctn";

function apply(settings) {
  const selectors = Object.keys(RULES).filter((k) => settings[k]).map((k) => RULES[k]);
  if (settings.stackChart) selectors.push(LOG_BUTTON);
  const css = [];
  if (selectors.length) css.push(`${selectors.join(",\n")} { display: none !important; }`);
  if (settings.beerTheme) css.push(beerCss(settings.tableTitle, settings.holidayWorkaround));
  style.textContent = css.join("\n\n");
}

chrome.storage.sync.get(DEFAULTS, apply);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  chrome.storage.sync.get(DEFAULTS, apply);
});
