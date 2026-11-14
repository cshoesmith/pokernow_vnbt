const DEFAULTS = {
  promoLink: true,
  chat: true,
  videoControls: true,
  beerTheme: true,
  tableTitle: "vNBT Poker Challenge",
  holidayWorkaround: false,
  stackChart: true,
  winOdds: true,
  winCapture: true,
  untappd: true,
  winStreak: true,
  turnBeeps: true,
  beepVolume: 80
};

chrome.storage.sync.get(DEFAULTS, (settings) => {
  for (const key of Object.keys(DEFAULTS)) {
    const input = document.getElementById(key);
    if (input.type === "checkbox") {
      input.checked = settings[key];
      input.addEventListener("change", () => chrome.storage.sync.set({ [key]: input.checked }));
    } else {
      input.value = settings[key];
      input.addEventListener("input", () => chrome.storage.sync.set({ [key]: input.type === "range" ? Number(input.value) : input.value }));
    }
  }
});

// Test: play the beeps in the game tab at the slider's volume, and say why if it can't.
document.getElementById("testBeeps").addEventListener("click", async () => {
  const status = document.getElementById("beepStatus");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!/^https:\/\/(www\.)?pokernow\.com\/games\//.test(tab?.url || "")) {
    status.textContent = "Open the game tab first, then try again.";
    return;
  }
  let r;
  try {
    r = await chrome.tabs.sendMessage(tab.id, { type: "beeps-test" });
  } catch {
    status.textContent = "Refresh the game tab so it picks up this version, then try again.";
    return;
  }
  const turns = r.turns ? ` Turns timed since the tab loaded: ${r.turns}; beeps lined up on the last: ${r.planned}.` : "";
  status.textContent =
    r.audio === "off" ? "Turn timer beeps are switched off." :
    r.audio === "running" ? `Played a test beep in the game tab.${turns}` :
    r.audio === "suspended" ? "Chrome is holding the sound back until you click in the game. Click anywhere on the table, then try again." :
    "This tab can't play sound.";
});
