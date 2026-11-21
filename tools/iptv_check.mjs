// Tests every table video channel the popup can offer, from this computer, and
// writes what it finds for the extension:
//   extension/iptv-dead.js       the channels that don't work (hidden in the menus),
//                                and the China/News lists with nothing working
//   extension/iptv-countries.js  the countries with at least one working channel
//                                (the Countries part of the menu)
// It loads the extension's own code to do it: the lists and their sources from
// iptv.js, and the stream test "Check channels" uses from background.js. Results
// depend on where it's run: channels shown only in their own country fail elsewhere.
//
// From the repo root (Node 18 or later; takes 15-30 minutes):
//   node tools/iptv_check.mjs
// tools/iptv_dead.py can then add channels found dead in the popup's own checks.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXT = path.join(ROOT, "extension");
const AT_ONCE = 64;   // streams tested at a time
// Names for the countries' codes where iptv-org's list (below) is long-winded.
const SHORT_NAMES = { us: "USA", uk: "UK", kr: "South Korea", kp: "North Korea", ae: "UAE", cd: "DR Congo",
  do: "Dominican Republic", ru: "Russia", tw: "Taiwan", ir: "Iran", la: "Laos", sy: "Syria", vn: "Vietnam" };

// --- The extension's code, run here -------------------------------------------

const memory = new Map();   // stands in for the extension's storage
const sandbox = {
  console, URL, AbortController,
  setTimeout, clearTimeout, Promise,
  fetch: (url, opts = {}) => { const { cache, ...rest } = opts; return fetch(url, rest); },   // Node has no HTTP cache to skip
  chrome: { storage: { local: {
    get: async (key) => ({ [key]: memory.get(key) }),
    set: async (obj) => { for (const [k, v] of Object.entries(obj)) memory.set(k, v); }
  } } }
};
vm.createContext(sandbox);
const run = (file, code = fs.readFileSync(path.join(EXT, file), "utf8")) => vm.runInContext(code, sandbox, { filename: file });

// The menu's countries come from what this finds, so offer every country there is.
const countryList = await (await fetch("https://iptv-org.github.io/api/countries.json")).json();
const names = Object.fromEntries(countryList.map((c) => [c.code.toLowerCase(), c.name]));
names.uk ??= "UK";
run("iptv-countries.js", `var IPTV_COUNTRIES = ${JSON.stringify(Object.fromEntries(Object.keys(names).map((c) => [c, c])))};`);
run("iptv.js");
const background = fs.readFileSync(path.join(EXT, "background.js"), "utf8");
run("background.js", background.slice(background.indexOf("async function probeStream"), background.indexOf("// Checks every channel")));
const blockedHosts = JSON.parse(fs.readFileSync(path.join(EXT, "iptv-dead.js"), "utf8").match(/blockedHosts: (\[.*?\])/)[1]);
const blocked = (url) => {
  const host = new URL(url).hostname;
  return blockedHosts.some((b) => host === b || host.endsWith("." + b));
};

// --- Every list's channels ----------------------------------------------------

const lists = vm.runInContext("IPTV_MENU", sandbox).flatMap(([, items]) => items.map(([id]) => id));
const channelsOf = new Map();
let n = 0;
for (const id of lists) {
  try {
    channelsOf.set(id, (await vm.runInContext(`iptvChannels(${JSON.stringify(id)})`, sandbox)).map((c) => c.url));
  } catch {
    channelsOf.set(id, []);   // no source has this country
  }
  if (++n % 50 === 0) console.log(`Loaded ${n} of ${lists.length} lists`);
}
const urls = [...new Set([...channelsOf.values()].flat())];
console.log(`${lists.length} lists, ${urls.length} different channels`);

// --- Testing them -------------------------------------------------------------

const dead = new Set(urls.filter(blocked));
const queue = urls.filter((u) => !blocked(u));
const toTest = queue.length;
let done = 0;
const started = Date.now();
await Promise.all(Array.from({ length: AT_ONCE }, async () => {
  while (queue.length) {
    const url = queue.shift();
    if (!(await vm.runInContext(`probeStream(${JSON.stringify(url)})`, sandbox))) dead.add(url);
    if (++done % 250 === 0) {
      console.log(`Tested ${done} of ${toTest}, ${dead.size} dead so far, ${Math.round((Date.now() - started) / 1000)}s`);
    }
  }
}));

// --- Writing it down ----------------------------------------------------------

const working = (id) => channelsOf.get(id).filter((u) => !dead.has(u)).length;
const countries = Object.fromEntries(lists.filter((id) => id.startsWith("country:") && working(id) > 0)
  .map((id) => id.slice(8)).map((c) => [c, SHORT_NAMES[c] ?? names[c] ?? c.toUpperCase()])
  .sort((a, b) => a[1].localeCompare(b[1])));
const deadLists = lists.filter((id) => !id.startsWith("country:") && working(id) === 0);
const today = new Date().toISOString().slice(0, 10);

fs.writeFileSync(path.join(EXT, "iptv-countries.js"),
  "// The countries in the table video menu: those with channels that worked when\n" +
  `// tools/iptv_check.mjs last tested them (${today}). Code: name.\n` +
  "const IPTV_COUNTRIES = {\n" +
  Object.entries(countries).map(([c, name]) => `  ${JSON.stringify(c)}: ${JSON.stringify(name)}`).join(",\n") + "\n};\n");

fs.writeFileSync(path.join(EXT, "iptv-dead.js"),
  "// Table video channels found dead (off air, or not shown here), so the popup\n" +
  "// hides them before you've checked them yourself, and the menu lists with no\n" +
  "// working channels at all, which it leaves out. Made by tools/iptv_check.mjs (and\n" +
  "// tools/iptv_dead.py, from Check channels runs); your own checks, and channels\n" +
  "// you watch, overrule it, except on blockedHosts: services that have shut all\n" +
  "// their channels off.\n" +
  "const IPTV_KNOWN_DEAD = {\n" +
  `  checked: ${JSON.stringify(today)},\n` +
  `  lists: ${JSON.stringify(deadLists)},\n` +
  `  blockedHosts: ${JSON.stringify(blockedHosts)},\n` +
  "  urls: [\n    " + [...dead].filter((u) => !blocked(u)).sort().map((u) => JSON.stringify(u)).join(",\n    ") + "\n  ]\n};\n");

const total = urls.length, ok = total - dead.size;
console.log(`\n${ok} of ${total} channels work; ${Object.keys(countries).length} countries have some.`);
console.log("China and News lists with nothing working:", deadLists.join(", ") || "none");
console.log("Most working channels:", Object.keys(countries).map((c) => [countries[c], working("country:" + c)])
  .sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, k]) => `${name} ${k}`).join(", "));
