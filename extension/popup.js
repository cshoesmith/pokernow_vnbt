const DEFAULTS = {
  promoLink: true,
  chat: true,
  videoControls: true,
  beerTheme: true,
  tableTitle: "vNBT Poker Challenge",
  stackChart: true,
  winOdds: true
};

chrome.storage.sync.get(DEFAULTS, (settings) => {
  for (const key of Object.keys(DEFAULTS)) {
    const input = document.getElementById(key);
    if (input.type === "checkbox") {
      input.checked = settings[key];
      input.addEventListener("change", () => chrome.storage.sync.set({ [key]: input.checked }));
    } else {
      input.value = settings[key];
      input.addEventListener("input", () => chrome.storage.sync.set({ [key]: input.value }));
    }
  }
});
