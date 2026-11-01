// Big hand capture: once a pot is awarded to a royal flush, straight flush, four
// of a kind or ace-high straight, background.js saves a screenshot of the table.
// Cards the winner didn't show can't be read, so they're judged on the board alone
// (your own cards are always readable, shown or not).

(() => {
  if (!/^\/games\//.test(location.pathname)) return;

  const { readCards, score, bigHand } = cpHands;
  const TICK_MS = 500;
  const SETTLE_MS = 1000;   // let the last cards and chips land

  let timer = null, captured = "";

  function winningHand(board) {
    const hands = [...document.querySelectorAll(".table-player.winner:not(.table-player-seat)")].map((seat) => {
      const hole = readCards(seat.querySelectorAll(".table-player-cards .card-container"));
      return hole.length === 2 ? [...hole, ...board] : board;
    });
    return bigHand(hands.reduce((best, h) => (score(h) > score(best) ? h : best), board));
  }

  function tick() {
    // The extension was reloaded or updated: this copy can't reach Chrome any more.
    if (!chrome.runtime?.id) { clearInterval(timer); return; }
    if (!document.querySelector(".table-player.winner")) { captured = ""; return; }
    const board = readCards(document.querySelectorAll(".table-cards .card-container"));
    const key = board.join();
    if (key === captured || document.hidden) return;   // once a hand; a tab behind others has nothing to show
    const hand = winningHand(board);
    if (!hand) return;
    captured = key;
    setTimeout(() => chrome.runtime.sendMessage({ type: "capture", hand }), SETTLE_MS);
  }

  function setEnabled(on) {
    clearInterval(timer);
    timer = on ? setInterval(tick, TICK_MS) : null;
  }

  chrome.storage.sync.get({ winCapture: true }, (s) => setEnabled(s.winCapture));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.winCapture) setEnabled(changes.winCapture.newValue);
  });
})();
