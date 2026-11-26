const DEFAULTS = {
  promoLink: true,
  chat: true,
  videoControls: true,
  beerTheme: true,
  tableTitle: "vNBT Poker Challenge",
  tv: true,   // the TV button on the table (stream.js); channels are picked in the TV window
  holidayWorkaround: false,
  stackChart: true,
  winOdds: true,
  winCapture: true,
  untappd: true,
  winStreak: true,
  crown: true,
  cardBacks: "mixed",
  turnBeeps: true,
  beepVolume: 80
};

// The version from manifest.json, so you can tell which build is loaded.
document.getElementById("version").textContent = "v" + chrome.runtime.getManifest().version;

chrome.storage.sync.get(DEFAULTS, (settings) => {
  if (settings.cardBacks === "dancers") settings.cardBacks = "mixed";   // a set that's gone (see content.js)
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

// Untappd name list: pairs of [Poker Now name, Untappd username], saved as
// untappdNames for untappd.js. Saved a moment after typing stops, so a whole
// name is one write (Chrome limits how often synced settings can change).
const nameRows = document.getElementById("nameRows");
let saveTimer = null;

function saveNames(now = false) {
  clearTimeout(saveTimer);
  const save = () => {
    const pairs = [...nameRows.children]
      .map((row) => [...row.querySelectorAll("input")].map((i) => i.value.trim()))
      .filter(([pn, ut]) => pn && ut);
    chrome.storage.sync.set({ untappdNames: pairs });
  };
  if (now === true) save(); else saveTimer = setTimeout(save, 400);
}

function addRow(pn = "", ut = "") {
  const row = document.createElement("div");
  row.className = "name-row";
  const input = (value, placeholder, title) => {
    const el = document.createElement("input");
    el.type = "text";
    el.value = value;
    el.placeholder = placeholder;
    el.title = title;
    el.spellcheck = false;
    el.addEventListener("input", () => saveNames());
    el.addEventListener("change", () => saveNames(true));   // left the box: the popup may be about to close
    return el;
  };
  const arrow = document.createElement("span");
  arrow.textContent = "→";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "×";
  remove.title = "Remove";
  remove.addEventListener("click", () => { row.remove(); saveNames(true); });
  row.append(input(pn, "Poker Now name", "Their name at the table"), arrow,
    input(ut, "Untappd user", "Their Untappd username"), remove);
  nameRows.append(row);
  return row;
}

chrome.storage.sync.get({ untappdNames: [] }, ({ untappdNames }) => {
  for (const [pn, ut] of Array.isArray(untappdNames) ? untappdNames : []) addRow(pn, ut);
});
document.getElementById("addName").addEventListener("click", () => addRow().querySelector("input").focus());
