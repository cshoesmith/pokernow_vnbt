# vNBT Poker

A Chrome extension that adds a few things to [Poker Now](https://www.pokernow.com) game pages:

- A beer-themed table with your own title (default "vNBT Poker Challenge")
- A chip stack chart for every player, with a gold coin where someone bought back in, a Winnings view (stack minus what they put in), a Table view of each player's ledger result, and an expanded view
- A live "win chance" badge next to your seat during a hand
- Automatic screenshots: when a pot goes to a royal flush, straight flush, four of a kind or ace-high straight, the table is saved to `Downloads\vNBT Poker` (on by default). Needs the game tab in front. Chrome's "all sites" permission is what allows this; only the game tab is ever captured
- Untappd check-ins: if a player's Poker Now name is their Untappd username, a scrolling banner on the felt, just above the table title, shows their avatar, latest beer, brewery, rating, ABV and photo
- Less clutter: hides the promo link, chat and video buttons (each can be turned back on)

> **Tip:** join the game with your Untappd username as your Poker Now name, so the banner shows everyone what you're drinking. Use the username from your profile link (`untappd.com/user/<username>`), not your display name. Your Untappd profile needs to be public, and a new check-in shows up within a few minutes.

## Install

Download the zip, unzip it somewhere you'll keep it, then load the folder in `chrome://extensions` with Developer mode on and **Load unpacked**. Step-by-step instructions are in [extension/INSTALL.txt](extension/INSTALL.txt).

## Build

`pwsh -File pack.ps1` builds the shareable zip at `dist/vNBT-Poker-<version>.zip` from the `extension` folder.

## License

[MIT](LICENSE)
