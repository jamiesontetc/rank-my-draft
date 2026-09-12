# Rank My Draft

Rank My Draft is a tiny static web app for MTG Arena Limited deck exports.

Paste an Arena export, click **Rank It**, and the app reports:

- the inferred deck color pair
- the set and set code
- the 17Lands Premier Draft win rate for that color pair since set release
  (or since the cube history floor)
- the mean GIH WR for the non-basic cards in the main deck

Sideboard cards in an Arena export are ignored for the main-deck mean GIH WR,
color-pair inference, and set detection. A paste with no Sideboard section
behaves as before.

When a Sideboard section has rankable non-basic cards, the results also show
Sideboard Considerations with up to two on-color and two off-color picks:

- On-color picks use the deck’s color-pair GIH WR, falling back to all-decks
  GIH only when the pair value is missing (same rule as the main table).
- Off-color picks use all-decks GIH WR.
- Basic lands are skipped. Cards are classified from 17Lands `color` (a card
  is on-color when its colors are a subset of the inferred pair, including
  colorless cards).

Card GIH WR uses the identified color pair when available. If 17Lands does not
publish a color-pair GIH value for a card, the app falls back to the all-decks
GIH WR for that card.

Exports without set codes are supported. In that case, the app infers the set
from card names using 17Lands card data.

Multi-set Arena cube exports (many different `(SET)` codes in the main deck)
are detected as cubes. Ranking then uses 17Lands cube expansions such as
`Cube - Planar`, `Cube - Powered`, `Cube`, `Chaos`, and `Remix - Artifacts`
instead of a single premier-draft set code. A **Cube / 17Lands source**
dropdown lists cube expansions that have Premier Draft data for the current
format. Choose a source from the list to rank; nothing is selected
automatically. Check **This is a cube** to force cube mode when the paste
is mixed but does not trip the heuristic. Single-set Premier Draft pastes
are unchanged.

The first **Rank It** query uses Premier Draft data from the expansion’s
`start_date` in 17Lands `/data/filters` through today. Cube expansions ignore
placeholder start dates and use `2020-01-01` through today instead. Card GIH
for that first rank uses 17Lands `time_period=ALL_TIME` (full published
history), not last-day data.

After results appear, a date-range slider moves the window start from that
floor toward today (end date stays today). **Re-rank** fetches the same
export, set or cube source, and colors again for the selected range. Pair and
All Decks win rates follow the exact slider dates via `/color_ratings/data`.
Card GIH (mean, table, and Sideboard Considerations) comes from
`/api/card_data`, which only accepts discrete `time_period` presets (`ALL_TIME`,
`ALL_EXCEPT_FIRST_WEEK`, `LAST_TWO_WEEKS`, `LAST_WEEK`, `LAST_DAY`). The app
picks the closest preset to the selected start→today window and labels that
**Card GIH Window** in Query. If the chosen color-ratings window has no
Premier Draft games, the app shows a status error instead of blank win-rate
tiles.

## Project Layout

- `public/` contains the static frontend Vercel serves at the site root.
- `api/17lands/[...path].js` is the Vercel serverless proxy for 17Lands data.
- `server.js` is only for local development.

## Run Locally

Start the included local server:

```sh
node server.js
```

Then visit `http://127.0.0.1:8081`.

The local server serves the app and proxies a small allowlist of 17Lands API
endpoints. The proxy is needed because 17Lands does not send browser CORS
headers consistently for every endpoint this tool uses.

## Deploy to Vercel

Import this repository in Vercel and deploy it as a plain static project. No
build command or output directory is required. Vercel will serve `public/` and
deploy the `/api/17lands/*` serverless function automatically.

The frontend calls the proxy through relative URLs like `/api/17lands/...`, so
the same code works locally and on Vercel.

## Data Source

The app queries public 17Lands endpoints directly:

- `/color_ratings/data` (pair / all-decks win rates; custom `start_date` / `end_date`)
- `/api/card_data` (card GIH; `event_type` + `time_period`, optional `colors`)
- `/data/filters`

Please keep the visible 17Lands attribution in place if you publish or modify
the tool.
