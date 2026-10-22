// Hides parts of the Poker Now UI via an injected stylesheet. CSS rules apply
// to elements as soon as the app renders them, so no DOM watching is needed.

const RULES = {
  promoLink: ".help-link-game",                 // "Polymarket & Poker Now / Join our Squad"
  chat: ".game-main-container > .chat",         // chat messages + new message button
  videoControls: ".conf-controls"               // JOIN / camera / mic box
};

const DEFAULTS = { promoLink: true, chat: true, videoControls: true };

const style = document.createElement("style");
style.id = "clean-poker-style";
(document.head || document.documentElement).appendChild(style);

function apply(settings) {
  const selectors = Object.keys(RULES).filter((k) => settings[k]).map((k) => RULES[k]);
  style.textContent = selectors.length
    ? `${selectors.join(",\n")} { display: none !important; }`
    : "";
}

chrome.storage.sync.get(DEFAULTS, apply);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  chrome.storage.sync.get(DEFAULTS, apply);
});
