// Card reading and hand scoring, shared by winodds.js and capture.js.

const cpHands = (() => {
  const RANKS = "23456789TJQKA", SUITS = "cdhs";

  // ---------- Reading cards from the page ----------
  // A face-up card looks like: <div class="card-container card-h card-s-T ..."> (10 of hearts).

  function readCard(el) {
    const suit = el.className.match(/(?:^|\s)card-([cdhs])(?=\s|$)/);
    const rank = el.className.match(/(?:^|\s)card-s-([2-9TJQKA])(?=\s|$)/);
    return suit && rank ? RANKS.indexOf(rank[1]) * 4 + SUITS.indexOf(suit[1]) : null;
  }

  const readCards = (els) => [...els].map(readCard).filter((c) => c !== null);

  // ---------- Hand evaluation ----------
  // Cards are 0..51: rank = c >> 2 (0 = deuce .. 12 = ace), suit = c & 3.
  // Scores compare as numbers: category * 1e6 + kickers in base 13.

  function topRanks(mask, n) {
    let v = 0;
    for (let r = 12; r >= 0 && n > 0; r--) if (mask & (1 << r)) { v = v * 13 + r; n--; }
    return v;
  }

  function straightHigh(mask) {
    const m = (mask << 1) | ((mask >> 12) & 1);   // ace also plays low
    for (let hi = 13; hi >= 4; hi--) if (((m >> (hi - 4)) & 31) === 31) return hi - 1;
    return -1;
  }

  function score(cards) {
    const counts = new Array(13).fill(0), suitMask = [0, 0, 0, 0], suitCount = [0, 0, 0, 0];
    let mask = 0;
    for (const c of cards) {
      const r = c >> 2, s = c & 3;
      counts[r]++; suitMask[s] |= 1 << r; suitCount[s]++; mask |= 1 << r;
    }
    let flush = -1;
    for (let s = 0; s < 4; s++) {
      if (suitCount[s] < 5) continue;
      const sf = straightHigh(suitMask[s]);
      if (sf >= 0) return 8e6 + sf;
      flush = 5e6 + topRanks(suitMask[s], 5);
    }
    let quad = -1; const trips = [], pairs = [];
    for (let r = 12; r >= 0; r--) {
      if (counts[r] === 4) quad = r;
      else if (counts[r] === 3) trips.push(r);
      else if (counts[r] === 2) pairs.push(r);
    }
    if (quad >= 0) return 7e6 + quad * 13 + topRanks(mask & ~(1 << quad), 1);
    if (trips.length && (trips.length > 1 || pairs.length)) return 6e6 + trips[0] * 13 + (trips[1] ?? pairs[0]);
    if (flush >= 0) return flush;
    const straight = straightHigh(mask);
    if (straight >= 0) return 4e6 + straight;
    if (trips.length) return 3e6 + trips[0] * 169 + topRanks(mask & ~(1 << trips[0]), 2);
    if (pairs.length >= 2) return 2e6 + pairs[0] * 169 + pairs[1] * 13 + topRanks(mask & ~(1 << pairs[0]) & ~(1 << pairs[1]), 1);
    if (pairs.length) return 1e6 + pairs[0] * 2197 + topRanks(mask & ~(1 << pairs[0]), 3);
    return topRanks(mask, 5);
  }

  // The hands worth a screenshot, or null for anything else.
  function bigHand(cards) {
    const s = score(cards);
    if (s === 8e6 + 12) return "Royal Flush";
    if (s >= 8e6) return "Straight Flush";
    if (s >= 7e6) return "Four of a Kind";
    if (s === 4e6 + 12) return "Ace-High Straight";
    return null;
  }

  return { readCards, score, bigHand };
})();
