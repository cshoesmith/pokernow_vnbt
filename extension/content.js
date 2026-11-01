// Restyles the Poker Now UI via an injected stylesheet. CSS rules apply to
// elements as soon as the app renders them, so no DOM watching is needed.

const RULES = {
  promoLink: ".help-link-game",                 // "Polymarket & Poker Now / Join our Squad"
  chat: ".game-main-container > .chat",         // chat messages + new message button
  videoControls: ".conf-controls"               // JOIN / camera / mic box
};

// Poker Now sets the table image (e.g. design-themes-elements/felt/hw26-felt-l.png)
// as an inline background on .table, so we can match on it and swap in our own
// table drawn with the same geometry.
const BEER_TABLE = chrome.runtime.getURL("beer-table.svg");

const DEFAULTS = {
  promoLink: true,
  chat: true,
  videoControls: true,
  beerTheme: true,
  tableTitle: "vNBT Poker Challenge",
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

function beerCss(title) {
  const layers = [`url("${BEER_TABLE}")`];
  if (title.trim()) layers.unshift(titleLayer(title.trim()));
  return `.table[style*="-felt-l.png"] {
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
  if (settings.beerTheme) css.push(beerCss(settings.tableTitle));
  style.textContent = css.join("\n\n");
}

chrome.storage.sync.get(DEFAULTS, apply);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  chrome.storage.sync.get(DEFAULTS, apply);
});
