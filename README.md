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

## Run Locally

Open `index.html` in a browser, or serve the folder with any static web server.

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Data Source

The app queries public 17Lands endpoints directly:

- `/color_ratings/data`
- `/card_ratings/data`

Please keep the visible 17Lands attribution in place if you publish or modify
the tool.
