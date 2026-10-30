# vNBT Poker

A Chrome extension that adds a few things to [Poker Now](https://www.pokernow.com) game pages:

- A beer-themed table with your own title (default "vNBT Poker Challenge")
- A chip stack chart for every player, with a gold coin where someone bought back in, a Winnings view (stack minus what they put in), a Table view of each player's ledger result, and an expanded view
- A live "win chance" badge next to your seat during a hand
- Untappd check-ins on seats: if a player's Poker Now name is their Untappd username, their seat shows their latest beer, brewery, rating, ABV and photo
- Less clutter: hides the promo link, chat and video buttons (each can be turned back on)

> **Tip:** join the game with your Untappd username as your Poker Now name, so everyone can see what you're drinking. Use the username from your profile link (`untappd.com/user/<username>`), not your display name. Your Untappd profile needs to be public, and a new check-in shows up within a few minutes.

## Install

Download the zip, unzip it somewhere you'll keep it, then load the folder in `chrome://extensions` with Developer mode on and **Load unpacked**. Step-by-step instructions are in [extension/INSTALL.txt](extension/INSTALL.txt).

## Build

`pwsh -File pack.ps1` builds the shareable zip at `dist/vNBT-Poker-<version>.zip` from the `extension` folder.

## License

[MIT](LICENSE)
