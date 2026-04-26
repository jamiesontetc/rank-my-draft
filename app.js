const API_BASE = window.location.origin;
const API_PROXY_PREFIX = "/api/17lands";
const FORMAT = "PremierDraft";
const BASIC_LANDS = new Set([
  "plains",
  "island",
  "swamp",
  "mountain",
  "forest",
  "wastes",
]);

const BASIC_LAND_COLORS = {
  plains: "W",
  island: "U",
  swamp: "B",
  mountain: "R",
  forest: "G",
};

let filtersPromise;

const COLOR_NAMES = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

const PAIR_NAMES = {
  WU: "Azorius (WU)",
  UB: "Dimir (UB)",
  BR: "Rakdos (BR)",
  RG: "Gruul (RG)",
  WG: "Selesnya (GW)",
  WB: "Orzhov (WB)",
  UR: "Izzet (UR)",
  BG: "Golgari (BG)",
  WR: "Boros (RW)",
  UG: "Simic (GU)",
};

const PAIR_CODES = {
  UW: "WU",
  WU: "WU",
  BU: "UB",
  UB: "UB",
  BR: "BR",
  RB: "BR",
  GR: "RG",
  RG: "RG",
  GW: "WG",
  WG: "WG",
  BW: "WB",
  WB: "WB",
  RU: "UR",
  UR: "UR",
  BG: "BG",
  GB: "BG",
  RW: "WR",
  WR: "WR",
  GU: "UG",
  UG: "UG",
};

const SET_NAMES = {
  SOS: "Secrets of Strixhaven",
  TMT: "Ninja Turtles",
  ECL: "Lorwyn Eclipsed",
  TLA: "Avatar",
  EOE: "Edge of Eternities",
  FIN: "Final Fantasy",
  TDM: "Dragonstorm",
  DFT: "Aetherdrift",
  PIO: "Pioneer Masters",
  FDN: "Foundations",
  DSK: "Duskmourn",
  BLB: "Bloomburrow",
  MH3: "Modern Horizons 3",
  OTJ: "Thunder Junction",
  MKM: "Karlov Manor",
  LCI: "Caverns of Ixalan",
  WOE: "Wilds of Eldraine",
  LTR: "Lord of the Rings",
  MOM: "March of the Machine",
  ONE: "All Will Be One",
  BRO: "Brothers' War",
  DMU: "Dominaria United",
  SNC: "New Capenna",
  NEO: "Neon Dynasty",
  VOW: "Crimson Vow",
  MID: "Midnight Hunt",
  AFR: "Forgotten Realms",
  STX: "Strixhaven",
  KHM: "Kaldheim",
  ZNR: "Zendikar Rising",
};

const SAMPLE_EXPORT = `Deck
1 Studious First-Year (SOS) 162
1 Environmental Scientist (SOS) 147
1 Noxious Newt (SOS) 155
1 Vastlands Scavenger (SOS) 166
1 Emil, Vastlands Roamer (SOS) 146
1 Pestbrood Sloth (SOS) 157
1 Hungry Graffalon (SOS) 151
1 Wild Hypothesis (SOS) 167
1 Burrog Barrage (SOS) 141
1 Chelonian Tackle (SOS) 142
1 Zimone's Experiment (SOS) 169
1 Elite Interceptor (SOS) 12
1 Ennis, Debate Moderator (SOS) 14
1 Stone Docent (SOS) 36
1 Spiritcall Enthusiast (SOS) 33
1 Antiquities on the Loose (SOS) 7
1 Eager Glyphmage (SOS) 11
1 Ascendant Dustspeaker (SOS) 8
1 Soaring Stoneglider (SOS) 32
1 Dig Site Inventory (SOS) 10
1 Rapier Wit (SOS) 28
1 Daydream (SOS) 9
1 Ajani's Response (SOS) 6
1 Terramorphic Expanse (SOS) 265
8 Plains (SOS) 272
8 Forest (SOS) 280`;

const elements = {
  textarea: document.querySelector("#arena-export"),
  rankButton: document.querySelector("#rank-button"),
  sampleButton: document.querySelector("#sample-button"),
  status: document.querySelector("#status"),
  results: document.querySelector("#results"),
  colorPair: document.querySelector("#color-pair"),
  setName: document.querySelector("#set-name"),
  pairWinRate: document.querySelector("#pair-win-rate"),
  meanGih: document.querySelector("#mean-gih"),
  dateRange: document.querySelector("#date-range"),
  cardsCounted: document.querySelector("#cards-counted"),
  fallbackCount: document.querySelector("#fallback-count"),
  cardTable: document.querySelector("#card-table"),
  emptyRowTemplate: document.querySelector("#empty-row-template"),
};

function normalizeName(value) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 14);
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

function parseDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getPreviousDateRange(range) {
  const end = parseDate(range.startDate);
  const start = addDays(end, -14);
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

function expandRangeEarlier(range, days) {
  return {
    startDate: formatDate(addDays(parseDate(range.startDate), -days)),
    endDate: range.endDate,
  };
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatInteger(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toLocaleString();
}

function parseArenaExport(text) {
  const cards = [];
  const setCounts = new Map();
  const linePattern = /^\s*(\d+)\s+(.+?)(?:\s+\(([A-Z0-9]{2,8})\)\s+\d+)?\s*$/i;

  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(deck|sideboard)\s*$/i.test(line)) continue;

    const match = line.match(linePattern);
    if (!match) continue;

    const quantity = Number(match[1]);
    const name = match[2].trim();
    const setCode = match[3]?.toUpperCase();

    cards.push({ quantity, name, setCode });
    if (setCode) {
      setCounts.set(setCode, (setCounts.get(setCode) ?? 0) + quantity);
    }
  }

  if (cards.length === 0) {
    throw new Error("Paste a valid Arena export with card lines like: 1 Card Name or 1 Card Name (SOS) 123.");
  }

  const setCode = [...setCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { cards, setCode };
}

function isBasicLand(card) {
  return BASIC_LANDS.has(normalizeName(card.name));
}

function getBasicLandColorCounts(cards) {
  const counts = new Map();
  for (const card of cards) {
    const color = BASIC_LAND_COLORS[normalizeName(card.name)];
    if (color) counts.set(color, (counts.get(color) ?? 0) + card.quantity);
  }
  return counts;
}

function canonicalColorCode(colors) {
  if (colors.length === 0) return null;
  if (colors.length === 1) return colors[0];
  return PAIR_CODES[colors.slice(0, 2).join("")] ?? colors.slice(0, 2).join("");
}

function describeColorCode(code) {
  if (!code) return "Unknown";
  if (code.length === 1) return `Mono ${COLOR_NAMES[code] ?? code} (${code})`;
  return PAIR_NAMES[code] ?? code;
}

function inferColorCodeFromLands(cards) {
  const colorCounts = getBasicLandColorCounts(cards);
  const colors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color);
  return canonicalColorCode(colors);
}

function inferColorCodeFromCards(cards, cardDataByName) {
  const colorCounts = new Map();
  for (const card of cards) {
    if (isBasicLand(card)) continue;
    const apiCard = cardDataByName.get(normalizeName(card.name));
    if (!apiCard?.color) continue;
    for (const color of apiCard.color) {
      if (color in COLOR_NAMES) {
        colorCounts.set(color, (colorCounts.get(color) ?? 0) + card.quantity);
      }
    }
  }
  const colors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color);
  return canonicalColorCode(colors);
}

function buildCardDataMap(cardData) {
  return new Map(cardData.map((card) => [normalizeName(card.name), card]));
}

function buildUrl(path, params) {
  const url = new URL(`${API_PROXY_PREFIX}${path}`, API_BASE);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error("Could not fetch 17Lands data. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(`17Lands request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchFilters() {
  filtersPromise ??= fetchJson(buildUrl("/data/filters", {}));
  return filtersPromise;
}

async function fetchCardRatings({ setCode, startDate, endDate, colors }) {
  return fetchJson(
    buildUrl("/card_ratings/data", {
      expansion: setCode,
      format: FORMAT,
      start_date: startDate,
      end_date: endDate,
      colors,
    })
  );
}

async function fetchColorRatings({ setCode, startDate, endDate }) {
  return fetchJson(
    buildUrl("/color_ratings/data", {
      expansion: setCode,
      event_type: FORMAT,
      start_date: startDate,
      end_date: endDate,
      combine_splash: "true",
    })
  );
}

function calculateMeanGih(cards, colorCardData, allCardData) {
  const colorByName = buildCardDataMap(colorCardData);
  const allByName = buildCardDataMap(allCardData);
  const rows = [];
  let weightedTotal = 0;
  let countedCopies = 0;

  for (const card of cards.filter((item) => !isBasicLand(item))) {
    const key = normalizeName(card.name);
    const colorRow = colorByName.get(key);
    const allRow = allByName.get(key);
    const selected =
      colorRow && colorRow.ever_drawn_win_rate !== null ? colorRow : allRow;
    const source = selected === colorRow ? "Color pair" : "All decks";
    const gihWr = selected?.ever_drawn_win_rate;

    if (typeof gihWr === "number") {
      weightedTotal += gihWr * card.quantity;
      countedCopies += card.quantity;
    }

    rows.push({
      quantity: card.quantity,
      name: card.name,
      source,
      games: selected?.ever_drawn_game_count ?? null,
      gihWr: typeof gihWr === "number" ? gihWr : null,
    });
  }

  return {
    rows,
    mean: countedCopies > 0 ? weightedTotal / countedCopies : null,
    countedCopies,
    fallbackCount: rows.filter((row) => row.source === "All decks").length,
  };
}

function findColorRow(colorRatings, colorCode) {
  return colorRatings.find((row) => row.short_name === colorCode);
}

function hasPremierDraftGames(colorRatings) {
  const allDecksRow = colorRatings.find((row) => row.short_name === "All");
  return (allDecksRow?.games ?? 0) > 0;
}

function getSetStartDate(filters, setCode) {
  const rawStartDate = filters.start_dates?.[setCode];
  return rawStartDate ? new Date(rawStartDate) : new Date("2020-01-01T00:00:00Z");
}

async function findMostRecentAvailableRange(setCode, preferredRange, onProgress) {
  const filters = await fetchFilters();
  const setStartDate = getSetStartDate(filters, setCode);
  let chunkRange = preferredRange;
  let queryRange = preferredRange;
  let checkedWindows = 0;
  let fallbackUsed = false;

  for (;;) {
    checkedWindows += 1;
    const colorRatings = await fetchColorRatings({
      setCode,
      startDate: queryRange.startDate,
      endDate: queryRange.endDate,
    });

    if (hasPremierDraftGames(colorRatings)) {
      return { range: queryRange, colorRatings, fallbackUsed };
    }

    const previousChunk = getPreviousDateRange(chunkRange);
    if (parseDate(previousChunk.endDate) <= setStartDate) {
      return { range: preferredRange, colorRatings, fallbackUsed: false };
    }

    fallbackUsed = true;
    chunkRange = previousChunk;
    queryRange = expandRangeEarlier(previousChunk, 14);

    if (checkedWindows % 3 === 0) {
      onProgress?.(`Searching older Premier Draft data near ${queryRange.endDate}...`);
    }
  }
}

function countMatchedCards(cards, cardData) {
  const cardDataByName = buildCardDataMap(cardData);
  const uniqueNames = new Set(
    cards.filter((card) => !isBasicLand(card)).map((card) => normalizeName(card.name))
  );
  let matches = 0;

  for (const name of uniqueNames) {
    if (cardDataByName.has(name)) matches += 1;
  }

  return matches;
}

async function inferSetFromCards(cards, range) {
  const filters = await fetchFilters();
  const expansions = filters.expansions ?? [];
  const uniqueNonBasics = new Set(
    cards.filter((card) => !isBasicLand(card)).map((card) => normalizeName(card.name))
  );
  const requiredMatches = Math.max(3, Math.ceil(uniqueNonBasics.size * 0.6));
  let bestMatch = null;

  for (const expansion of expansions) {
    const cardData = await fetchCardRatings({
      setCode: expansion,
      startDate: range.startDate,
      endDate: range.endDate,
    });
    const matches = countMatchedCards(cards, cardData);

    if (!bestMatch || matches > bestMatch.matches) {
      bestMatch = { setCode: expansion, cardData, matches };
    }
    if (matches >= requiredMatches) {
      return bestMatch;
    }
  }

  if (bestMatch?.matches > 0) {
    return bestMatch;
  }
  throw new Error("Could not infer the set. Try pasting an Arena export that includes set codes.");
}

function clearTable() {
  elements.cardTable.replaceChildren();
}

function renderTable(rows) {
  clearTable();
  if (rows.length === 0) {
    elements.cardTable.append(elements.emptyRowTemplate.content.cloneNode(true));
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    const cells = [
      row.quantity,
      row.name,
      row.source,
      formatInteger(row.games),
      formatPercent(row.gihWr),
    ];

    for (const value of cells) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    elements.cardTable.append(tr);
  }
}

function setLoading(isLoading) {
  elements.rankButton.disabled = isLoading;
  elements.rankButton.textContent = isLoading ? "Ranking..." : "Rank It";
}

function showStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function renderResults({
  setCode,
  colorCode,
  colorRow,
  range,
  cardStats,
  fallbackUsed,
}) {
  const pairWinRate =
    colorRow && colorRow.games > 0 ? colorRow.wins / colorRow.games : null;

  elements.colorPair.textContent = describeColorCode(colorCode);
  elements.setName.textContent = `${SET_NAMES[setCode] ?? setCode} (${setCode})`;
  elements.pairWinRate.textContent =
    pairWinRate === null
      ? "Unavailable"
      : `${formatPercent(pairWinRate)} (${formatInteger(colorRow.games)} games)`;
  elements.meanGih.textContent = formatPercent(cardStats.mean);
  elements.dateRange.textContent = `${range.startDate} to ${range.endDate}${
    fallbackUsed ? " (most recent available)" : ""
  }`;
  elements.cardsCounted.textContent = formatInteger(cardStats.countedCopies);
  elements.fallbackCount.textContent = `${formatInteger(cardStats.fallbackCount)} cards`;
  renderTable(cardStats.rows);
  elements.results.classList.remove("hidden");
}

async function rankExport() {
  const exportText = elements.textarea.value.trim();
  if (!exportText) {
    showStatus("Paste an Arena export first.", true);
    return;
  }

  setLoading(true);
  elements.results.classList.add("hidden");
  showStatus("Parsing deck...");

  try {
    const parsed = parseArenaExport(exportText);
    const preferredRange = getDateRange();
    let setCode = parsed.setCode;

    showStatus("Fetching 17Lands data...");
    if (!setCode) {
      showStatus("Inferring set from card names...");
      const inferredSet = await inferSetFromCards(parsed.cards, preferredRange);
      setCode = inferredSet.setCode;
    }

    showStatus("Finding the latest Premier Draft data...");
    const { range, colorRatings, fallbackUsed } =
      await findMostRecentAvailableRange(setCode, preferredRange, showStatus);

    const allCardData = await fetchCardRatings({
      setCode,
      startDate: range.startDate,
      endDate: range.endDate,
    });

    const allCardDataByName = buildCardDataMap(allCardData);
    const colorCode =
      inferColorCodeFromLands(parsed.cards) ??
      inferColorCodeFromCards(parsed.cards, allCardDataByName);

    if (!colorCode) {
      throw new Error("Could not infer a deck color pair from the export.");
    }

    const colorCardData = await fetchCardRatings({
      setCode,
      startDate: range.startDate,
      endDate: range.endDate,
      colors: colorCode,
    });

    const colorRow = findColorRow(colorRatings, colorCode);
    const cardStats = calculateMeanGih(
      parsed.cards,
      colorCardData,
      allCardData
    );

    renderResults({
      setCode,
      colorCode,
      colorRow,
      range,
      cardStats,
      fallbackUsed,
    });
    if (!colorRow || colorRow.games === 0 || cardStats.mean === null) {
      showStatus("Done. 17Lands has little or no recent Premier Draft data for this set.");
    } else {
      showStatus("Done.");
    }
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

elements.rankButton.addEventListener("click", rankExport);
elements.sampleButton.addEventListener("click", () => {
  elements.textarea.value = SAMPLE_EXPORT;
  elements.textarea.focus();
  showStatus("Sample loaded.");
});
