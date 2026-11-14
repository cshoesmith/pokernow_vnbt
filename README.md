# vNBT Poker

A Chrome extension that adds a few things to [Poker Now](https://www.pokernow.com) game pages:

- A beer-themed table with your own title (default "vNBT Poker Challenge")
- A chip stack chart for every player, with a gold coin where someone bought back in, a Winnings view (stack minus what they put in), a Table view of each player's ledger result, and an expanded view
- A live "win chance" badge next to your seat during a hand
- Automatic screenshots: when a pot goes to a royal flush, straight flush, four of a kind or ace-high straight, the table is saved to `Downloads\vNBT Poker` (on by default). Needs the game tab in front. Chrome's "all sites" permission is what allows this; only the game tab is ever captured
- Untappd check-ins: if a player's Poker Now name is their Untappd username, a scrolling banner on the felt, just above the table title, shows their avatar, latest beer, brewery, rating, ABV and photo
- Win streak flames: a player who wins hands in a row gets a burning border round their name - small flames after one win, bigger after two, biggest from three. A hand they're dealt into and don't win (folding included) puts them out. Five in a row sets off a nuclear blast over their name, and so does every win after that until the streak ends
- Turn timer beeps: on your turn, a double beep at 10 seconds left, then a beep every second from 5 (higher for the last 3), even with the game tab in the background. The popup has a volume slider and a Test button. Chrome only lets a page make sound once you've clicked in it
- Less clutter: hides the promo link, chat and video buttons (each can be turned back on)

> **Tip:** join the game with your Untappd username as your Poker Now name, so the banner shows everyone what you're drinking. Use the username from your profile link (`untappd.com/user/<username>`), not your display name. Your Untappd profile needs to be public, and a new check-in shows up within a few minutes.

## Install

Download the zip, unzip it somewhere you'll keep it, then load the folder in `chrome://extensions` with Developer mode on and **Load unpacked**. Step-by-step instructions are in [extension/INSTALL.txt](extension/INSTALL.txt).

## Build

`pwsh -File pack.ps1` builds the shareable zip at `dist/vNBT-Poker-<version>.zip` from the `extension` folder.

## License

[MIT](LICENSE)
