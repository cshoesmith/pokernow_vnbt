# vNBT Poker

A Chrome extension that adds a few things to [Poker Now](https://www.pokernow.com) game pages:

- A beer-themed table with your own title (default "vNBT Poker Challenge")
- Table video: live TV on the felt, under the seats and cards, with the title kept on top. Under "Table video" in the popup, pick a list from [ChinaIPTV](https://github.com/hujingguang/ChinaIPTV) - China (national, provincial, Hunan TV), World news, or one of 30 countries from Australia to Vietnam - and a channel, with a search box and previous/next buttons; Chinese channel names are shown in English (hover for the original). (A "My own link" choice, for any HLS stream or video file, is built in but switched off: `OWN_LINK` in `extension/popup-stream.js`.) The popup says whether it's playing. Many listed channels are off air or only shown in their own country: one that never starts is marked dead and left out of the menu, and "Check channels" tests a whole list at once (in the background, so the popup can close) and hides every one that doesn't work. Tick "Show dead channels" to see them (marked ✕); a dead mark lasts 3 days, so a channel that comes back returns. Channels already found dead come listed with the extension (`extension/iptv-dead.js`, made from a Check channels run by `python tools/iptv_dead.py`), so they're hidden before anyone checks; finding one working overrules the list. Muted unless you tick "Sound" (then it starts once you click in the game). The small button at the top of the felt pops the video out into its own window, with volume and full-screen controls; the table goes back to its own felt meanwhile, and closing the window brings the video back. Played with [hls.js](https://github.com/video-dev/hls.js) (Apache 2.0, in `extension/lib`); plain `http://` channels are fetched by the background script, since Chrome won't load them into the https game page
- A chip stack chart for every player, with a gold coin where someone bought back in, a Winnings view (stack minus what they put in), a Table view of each player's ledger result, and an expanded view
- A live "win chance" badge next to your seat during a hand
- Automatic screenshots: when a pot goes to a royal flush, straight flush, four of a kind or ace-high straight, the table is saved to `Downloads\vNBT Poker` (on by default). Needs the game tab in front. Chrome's "all sites" permission is what allows this; only the game tab is ever captured
- Untappd check-ins: if a player's Poker Now name is their Untappd username, a scrolling banner on the felt, just above the table title, shows their avatar, latest beer, brewery, rating, ABV and photo. For anyone whose names differ, pair them up in the popup's name list (it only affects your own screen)
- Win streak flames: a player who wins hands in a row gets a burning border round their name - small flames after one win, bigger after two, biggest from three. A hand they're dealt into and don't win (folding included) puts them out. Five in a row sets off a nuclear blast over their name, and so does every win after that until the streak ends
- Chip leader crown: a gold crown sits on the name of whoever has the most chips. It moves as each pot is awarded, and nobody wears it while the lead is tied
- Card backs: five silhouette pin-up dancers (Scarlet, Velvet, Blinds, Jade, Gold), each swaying her hips and arms in a loop under a pulsing light, in place of Poker Now's card backs: dealt at random to every face-down card and reshuffled each hand (the default), or one for the whole table. Pick one, or Poker Now's own, in the popup. The dancers are drawn by `tools/card_backs.py` and rendered to high-definition animated WebP by `tools/card_backs_bitmap.py`
- Turn timer beeps: a beer can opening when your turn starts, then a double beep at 10 seconds left, then a beep every second from 5 (higher for the last 3), even with the game tab in the background. The popup has a volume slider and a Test button. Chrome only lets a page make sound once you've clicked in it
- Less clutter: hides the promo link, chat and video buttons (each can be turned back on)

> **Tip:** join the game with your Untappd username as your Poker Now name, so the banner shows everyone what you're drinking. Use the username from your profile link (`untappd.com/user/<username>`), not your display name. Your Untappd profile needs to be public, and a new check-in shows up within a few minutes.

## Install

Download the zip, unzip it somewhere you'll keep it, then load the folder in `chrome://extensions` with Developer mode on and **Load unpacked**. Step-by-step instructions are in [extension/INSTALL.txt](extension/INSTALL.txt).

## Build

`pwsh -File pack.ps1` builds the shareable zip at `dist/vNBT-Poker-<version>.zip` from the `extension` folder.

## License

[MIT](LICENSE). hls.js is Apache 2.0: see [extension/lib/hls.js-LICENSE.txt](extension/lib/hls.js-LICENSE.txt).
