# Rank My Draft

Rank My Draft is a tiny static web app for MTG Arena Limited deck exports.

Paste an Arena export, click **Rank It**, and the app reports:

- the inferred deck color pair
- the set and set code
- the 17Lands Premier Draft win rate for that color pair over the past two weeks
- the mean GIH WR for the non-basic cards in the deck

Card GIH WR uses the identified color pair when available. If 17Lands does not
publish a color-pair GIH value for a card, the app falls back to the all-decks
GIH WR for that card.

Exports without set codes are supported. In that case, the app infers the set
from card names using 17Lands card-rating data.

The app first checks the past two weeks of Premier Draft data. If no Premier
Draft games are available for that set in the current window, it searches
backward in two-week chunks. Each fallback query includes one extra earlier
week, so fallback results use a three-week data window.

## Run Locally

Start the included local server:

```sh
npm start
```

Then visit `http://127.0.0.1:8081`.

The local server serves the app and proxies a small allowlist of 17Lands API
endpoints. The proxy is needed because 17Lands does not send browser CORS
headers consistently for every endpoint this tool uses.

## Data Source

The app queries public 17Lands endpoints directly:

- `/color_ratings/data`
- `/card_ratings/data`

Please keep the visible 17Lands attribution in place if you publish or modify
the tool.
