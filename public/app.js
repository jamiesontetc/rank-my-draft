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
let cubeSourcesPromise;
let lastRankSession = null;
let rankInProgress = false;

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

const KNOWN_CUBE_EXPANSIONS = [
  "Cube - Planar",
  "Cube - Powered",
  "Cube",
  "Chaos",
  "Remix - Artifacts",
];

const CUBE_SOURCE_PLACEHOLDER = "Select a source…";
const NOT_A_CUBE_VALUE = "not-a-cube";
const NOT_A_CUBE_LABEL = "Not a Cube";
const CUBE_HISTORY_START = "2020-01-01";

const SET_NAMES = {
  HOB: "The Hobbit",
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
  formatWinRate: document.querySelector("#format-win-rate"),
  meanGih: document.querySelector("#mean-gih"),
  dateRange: document.querySelector("#date-range"),
  dataWindow: document.querySelector("#data-window"),
  cardWindow: document.querySelector("#card-window"),
  cardsCounted: document.querySelector("#cards-counted"),
  fallbackCount: document.querySelector("#fallback-count"),
  sideboardRow: document.querySelector("#sideboard-row"),
  sideboardIgnored: document.querySelector("#sideboard-ignored"),
  sideboardPicks: document.querySelector("#sideboard-picks"),
  onColorPicks: document.querySelector("#on-color-picks"),
  offColorPicks: document.querySelector("#off-color-picks"),
  cardTable: document.querySelector("#card-table"),
  emptyRowTemplate: document.querySelector("#empty-row-template"),
  forceCube: document.querySelector("#force-cube"),
  cubeSourceRow: document.querySelector("#cube-source-row"),
  cubeSource: document.querySelector("#cube-source"),
  windowStartSlider: document.querySelector("#window-start-slider"),
  windowRangeLabel: document.querySelector("#window-range-label"),
  windowFloorLabel: document.querySelector("#window-floor-label"),
  windowControlsNote: document.querySelector("#window-controls-note"),
  rerankButton: document.querySelector("#rerank-button"),
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

function todayDateString() {
  return formatDate(new Date());
}

function utcDayCount(startDate, endDate) {
  return Math.round((parseDate(endDate) - parseDate(startDate)) / 86400000);
}

function parseDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function clampRangeStart(range, floorDate) {
  const floor = typeof floorDate === "string" ? parseDate(floorDate) : floorDate;
  if (parseDate(range.startDate) >= floor) return range;
  return {
    startDate: formatDate(floor),
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
  const sideboardCards = [];
  const setCounts = new Map();
  const linePattern = /^\s*(\d+)\s+(.+?)(?:\s+\(([A-Z0-9]{2,8})\)\s+\d+)?\s*$/i;
  let section = "deck";

  for (const line of text.split(/\r?\n/)) {
    if (/^\s*deck:?\s*$/i.test(line)) {
      section = "deck";
      continue;
    }
    if (/^\s*sideboard:?\s*$/i.test(line)) {
      section = "sideboard";
      continue;
    }

    const match = line.match(linePattern);
    if (!match) continue;

    const quantity = Number(match[1]);
    const name = match[2].trim();
    const setCode = match[3]?.toUpperCase();
    const card = { quantity, name, setCode };

    if (section === "sideboard") {
      sideboardCards.push(card);
      continue;
    }

    cards.push(card);
    if (setCode) {
      setCounts.set(setCode, (setCounts.get(setCode) ?? 0) + quantity);
    }
  }

  if (cards.length === 0) {
    throw new Error("Paste a valid Arena export with card lines like: 1 Card Name or 1 Card Name (SOS) 123.");
  }

  const setCode = [...setCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const sideboardCopies = sideboardCards.reduce((sum, card) => sum + card.quantity, 0);
  return { cards, setCode, sideboardCards, sideboardCopies };
}

function isBasicLand(card) {
  return BASIC_LANDS.has(normalizeName(card.name));
}

function collectCodedSetCounts(cards) {
  const setCounts = new Map();
  let codedCopies = 0;

  for (const card of cards) {
    if (!card.setCode || isBasicLand(card)) continue;
    setCounts.set(card.setCode, (setCounts.get(card.setCode) ?? 0) + card.quantity);
    codedCopies += card.quantity;
  }

  return { setCounts, codedCopies };
}

function isLikelyCubeExport(cards) {
  const { setCounts, codedCopies } = collectCodedSetCounts(cards);
  const distinctSets = setCounts.size;
  if (codedCopies === 0 || distinctSets < 2) return false;
  if (distinctSets >= 4) return true;

  const topShare = Math.max(...setCounts.values()) / codedCopies;
  return topShare < 0.7;
}

function isCubeLikeExpansion(name) {
  if (typeof name !== "string" || name.length === 0) return false;
  return /^Cube/i.test(name) || KNOWN_CUBE_EXPANSIONS.includes(name);
}

function expansionSupportsFormat(filters, expansion, format) {
  const formats = filters.formats_by_expansion?.[expansion];
  if (!Array.isArray(formats) || formats.length === 0) return true;
  return formats.includes(format);
}

function sortCubeExpansions(expansions) {
  return [...expansions].sort((a, b) => {
    const aKnown = KNOWN_CUBE_EXPANSIONS.indexOf(a);
    const bKnown = KNOWN_CUBE_EXPANSIONS.indexOf(b);
    const aOrder = aKnown === -1 ? KNOWN_CUBE_EXPANSIONS.length : aKnown;
    const bOrder = bKnown === -1 ? KNOWN_CUBE_EXPANSIONS.length : bKnown;
    return aOrder - bOrder || a.localeCompare(b);
  });
}

function selectedCubeExpansion(available) {
  const value = elements.cubeSource.value;
  if (value === NOT_A_CUBE_VALUE) return value;
  return available.includes(value) ? value : "";
}

function collectDistinctSetCodes(cardLists) {
  const codes = new Set();
  for (const cards of cardLists) {
    for (const card of cards) {
      if (!card.setCode || isBasicLand(card)) continue;
      codes.add(card.setCode);
    }
  }
  return [...codes].sort();
}

function getPerSetFloorDate(filters, setCodes) {
  let earliest = null;
  for (const setCode of setCodes) {
    const floor = getSearchFloorDate(filters, setCode);
    if (!earliest || floor < earliest) earliest = floor;
  }
  return earliest ?? parseDate(CUBE_HISTORY_START);
}

function formatPerSetSource(source, setCode) {
  return setCode ? `${source} · ${setCode}` : source;
}

function expansionDisplayParts(setCode) {
  if (typeof setCode !== "string" || setCode.length === 0) {
    return { name: "-", code: "" };
  }

  const labeled = setCode.match(/^(.*?)\s+\(([^()]+)\)\s*$/);
  if (labeled) {
    return { name: labeled[1], code: labeled[2] };
  }

  if (isCubeLikeExpansion(setCode)) {
    return { name: setCode, code: "" };
  }

  const name = SET_NAMES[setCode];
  return name ? { name, code: setCode } : { name: setCode, code: "" };
}

function setPrimaryWithNote(element, primary, note) {
  element.replaceChildren();
  element.append(primary);
  if (!note) return;
  const suffix = document.createElement("span");
  suffix.className = "value-note";
  suffix.textContent = note.startsWith(" ") ? note : ` ${note}`;
  element.append(suffix);
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

function getCardColors(card, cardDataByName) {
  const basicColor = BASIC_LAND_COLORS[normalizeName(card.name)];
  if (basicColor) return basicColor;
  return cardDataByName.get(normalizeName(card.name))?.color ?? "";
}

function cardFitsColorCode(card, colorCode, cardDataByName) {
  const colors = getCardColors(card, cardDataByName);
  for (const color of colors) {
    if (color in COLOR_NAMES && !colorCode.includes(color)) {
      return false;
    }
  }
  return true;
}

function mergeCardsByName(cards) {
  const byName = new Map();
  for (const card of cards) {
    const key = normalizeName(card.name);
    const existing = byName.get(key);
    if (existing) {
      existing.quantity += card.quantity;
    } else {
      byName.set(key, { ...card });
    }
  }
  return [...byName.values()];
}

function selectCardGih(card, colorByName, allByName, useColorPair = true, options = {}) {
  const key = normalizeName(card.name);
  const colorRow = colorByName.get(key);
  const allRow = allByName.get(key);
  const selected =
    useColorPair && colorRow && colorRow.ever_drawn_win_rate !== null
      ? colorRow
      : allRow;
  const gihWr = selected?.ever_drawn_win_rate;
  const source = selected === colorRow ? "Color pair" : "All decks";
  return {
    quantity: card.quantity,
    name: options.includeSet && card.setCode ? `${card.name} (${card.setCode})` : card.name,
    source: options.includeSet ? formatPerSetSource(source, card.setCode) : source,
    games: selected?.ever_drawn_game_count ?? null,
    gihWr: typeof gihWr === "number" ? gihWr : null,
  };
}

function cardMapsForSet(card, colorBySet, allBySet) {
  const empty = new Map();
  if (!card.setCode) return { colorByName: empty, allByName: empty };
  return {
    colorByName: colorBySet.get(card.setCode) ?? empty,
    allByName: allBySet.get(card.setCode) ?? empty,
  };
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

function unwrapCardData(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

async function fetchCardData({ setCode, timePeriod, colors }) {
  return unwrapCardData(
    await fetchJson(
      buildUrl("/api/card_data", {
        expansion: setCode,
        event_type: FORMAT,
        time_period: timePeriod,
        colors,
      })
    )
  );
}

async function fetchCardDataSafe(params) {
  try {
    return await fetchCardData(params);
  } catch {
    return [];
  }
}

async function fetchCardDataMapsBySet({ setCodes, timePeriod, colors }) {
  const bySet = new Map();
  await Promise.all(
    setCodes.map(async (setCode) => {
      const cardData = await fetchCardDataSafe({ setCode, timePeriod, colors });
      bySet.set(setCode, buildCardDataMap(cardData));
    })
  );
  return bySet;
}

function mergeCardDataMapsForCards(cards, dataBySet) {
  const merged = new Map();
  for (const card of cards) {
    if (!card.setCode) continue;
    const apiCard = dataBySet.get(card.setCode)?.get(normalizeName(card.name));
    if (apiCard) merged.set(normalizeName(card.name), apiCard);
  }
  return merged;
}

// 17Lands card_data only accepts discrete time_period enums. Custom
// start_date/end_date are ignored (they fall back to All Time). The live
// card_data UI uses the same presets, not a calendar range.
const CARD_DATA_PERIODS = [
  {
    id: "ALL_TIME",
    label: "All Time",
    impliedStart({ floorDate }) {
      return floorDate;
    },
  },
  {
    id: "ALL_EXCEPT_FIRST_WEEK",
    label: "All Except First Week",
    impliedStart({ floorDate }) {
      return formatDate(addDays(parseDate(floorDate), 7));
    },
  },
  {
    id: "LAST_TWO_WEEKS",
    label: "Last Two Weeks",
    impliedStart({ endDate }) {
      return formatDate(addDays(parseDate(endDate), -14));
    },
  },
  {
    id: "LAST_WEEK",
    label: "Last Week",
    impliedStart({ endDate }) {
      return formatDate(addDays(parseDate(endDate), -7));
    },
  },
  {
    id: "LAST_DAY",
    label: "Last Day",
    impliedStart({ endDate }) {
      return formatDate(addDays(parseDate(endDate), -1));
    },
  },
];

function selectCardDataPeriod(range, floorDate) {
  if (range.startDate === floorDate) {
    return { id: "ALL_TIME", label: "All Time", exact: true };
  }

  const floor = parseDate(floorDate);
  const end = parseDate(range.endDate);
  let best = null;

  for (const period of CARD_DATA_PERIODS) {
    const impliedStart = parseDate(
      period.impliedStart({ floorDate, endDate: range.endDate })
    );
    if (period.id !== "ALL_TIME" && impliedStart < floor) continue;
    if (impliedStart > end) continue;
    const distance = Math.abs(
      utcDayCount(formatDate(impliedStart), range.startDate)
    );
    if (!best || distance < best.distance) {
      best = { id: period.id, label: period.label, distance };
    }
  }

  return best
    ? { id: best.id, label: best.label, exact: best.distance === 0 }
    : { id: "ALL_TIME", label: "All Time", exact: false };
}

function describeCardGihWindow(cardPeriod) {
  if (cardPeriod.exact) return cardPeriod.label;
  return `${cardPeriod.label} (closest 17Lands window)`;
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

function isAllDecksSource(source) {
  return source === "All decks" || source.startsWith("All decks · ");
}

function calculateMeanGih(cards, colorCardData, allCardData, options = {}) {
  const colorByName = buildCardDataMap(colorCardData);
  const allByName = buildCardDataMap(allCardData);
  const rows = [];
  let weightedTotal = 0;
  let countedCopies = 0;

  for (const card of cards.filter((item) => !isBasicLand(item))) {
    const row = selectCardGih(card, colorByName, allByName, true, options);
    if (typeof row.gihWr === "number") {
      weightedTotal += row.gihWr * card.quantity;
      countedCopies += card.quantity;
    }
    rows.push(row);
  }

  return {
    rows,
    mean: countedCopies > 0 ? weightedTotal / countedCopies : null,
    countedCopies,
    fallbackCount: rows.filter((row) => isAllDecksSource(row.source)).length,
  };
}

function calculateMeanGihFromSetMaps(cards, colorBySet, allBySet) {
  const rows = [];
  let weightedTotal = 0;
  let countedCopies = 0;

  for (const card of cards.filter((item) => !isBasicLand(item))) {
    const { colorByName, allByName } = cardMapsForSet(card, colorBySet, allBySet);
    const row = selectCardGih(card, colorByName, allByName, true, { includeSet: true });
    if (typeof row.gihWr === "number") {
      weightedTotal += row.gihWr * card.quantity;
      countedCopies += card.quantity;
    }
    rows.push(row);
  }

  return {
    rows,
    mean: countedCopies > 0 ? weightedTotal / countedCopies : null,
    countedCopies,
    fallbackCount: rows.filter((row) => isAllDecksSource(row.source)).length,
  };
}

function compareGihRows(a, b) {
  return b.gihWr - a.gihWr || a.name.localeCompare(b.name);
}

function rankSideboardPicks(sideboardCards, colorCode, colorCardData, allCardData, options = {}) {
  const colorByName = buildCardDataMap(colorCardData);
  const allByName = buildCardDataMap(allCardData);
  return rankSideboardPicksFromMaps(
    sideboardCards,
    colorCode,
    colorByName,
    allByName,
    options
  );
}

function rankSideboardPicksFromMaps(
  sideboardCards,
  colorCode,
  colorByName,
  allByName,
  options = {}
) {
  const uniqueCards = mergeCardsByName(
    sideboardCards.filter((card) => !isBasicLand(card))
  );
  const onColor = [];
  const offColor = [];

  for (const card of uniqueCards) {
    if (cardFitsColorCode(card, colorCode, allByName)) {
      const row = selectCardGih(card, colorByName, allByName, true, options);
      if (typeof row.gihWr === "number") onColor.push(row);
    } else {
      const row = selectCardGih(card, colorByName, allByName, false, options);
      if (typeof row.gihWr === "number") offColor.push(row);
    }
  }

  onColor.sort(compareGihRows);
  offColor.sort(compareGihRows);

  return {
    onColor: onColor.slice(0, 2),
    offColor: offColor.slice(0, 2),
    rankableCount: onColor.length + offColor.length,
  };
}

function rankSideboardPicksFromSetMaps(sideboardCards, colorCode, colorBySet, allBySet) {
  const uniqueCards = mergeCardsByName(
    sideboardCards.filter((card) => !isBasicLand(card))
  );
  const onColor = [];
  const offColor = [];
  const mergedAllByName = mergeCardDataMapsForCards(uniqueCards, allBySet);

  for (const card of uniqueCards) {
    const { colorByName, allByName } = cardMapsForSet(card, colorBySet, allBySet);
    if (cardFitsColorCode(card, colorCode, mergedAllByName)) {
      const row = selectCardGih(card, colorByName, allByName, true, { includeSet: true });
      if (typeof row.gihWr === "number") onColor.push(row);
    } else {
      const row = selectCardGih(card, colorByName, allByName, false, { includeSet: true });
      if (typeof row.gihWr === "number") offColor.push(row);
    }
  }

  onColor.sort(compareGihRows);
  offColor.sort(compareGihRows);

  return {
    onColor: onColor.slice(0, 2),
    offColor: offColor.slice(0, 2),
    rankableCount: onColor.length + offColor.length,
  };
}

function findColorRow(colorRatings, colorCode) {
  return colorRatings.find((row) => row.short_name === colorCode);
}

function findAllDecksRow(colorRatings) {
  return colorRatings.find((row) => row.short_name === "All");
}

function hasPremierDraftGames(colorRatings) {
  const allDecksRow = findAllDecksRow(colorRatings);
  return (allDecksRow?.games ?? 0) > 0;
}

function formatColorRatingWinRate(row) {
  if (!row || !(row.games > 0)) {
    return {
      primary: "Unavailable",
      note: "",
    };
  }
  return {
    primary: formatPercent(row.wins / row.games),
    note: `(${formatInteger(row.games)} games)`,
  };
}

function getSetStartDate(filters, setCode) {
  const rawStartDate = filters.start_dates?.[setCode];
  return rawStartDate ? new Date(rawStartDate) : parseDate(CUBE_HISTORY_START);
}

function getSearchFloorDate(filters, setCode) {
  if (isCubeLikeExpansion(setCode)) {
    // 17Lands cube start_dates are recent placeholders, not real event starts.
    return parseDate(CUBE_HISTORY_START);
  }
  return getSetStartDate(filters, setCode);
}

function getDefaultRankRangeFromFloor(floorDate, endDate = todayDateString()) {
  const floor = typeof floorDate === "string" ? floorDate : formatDate(floorDate);
  const startDate = parseDate(floor) > parseDate(endDate) ? endDate : floor;
  return { startDate, endDate };
}

function getDefaultRankRange(filters, setCode, endDate = todayDateString()) {
  return getDefaultRankRangeFromFloor(getSearchFloorDate(filters, setCode), endDate);
}

function describeDataWindow(range, floorDate, setCode, { perSet = false } = {}) {
  if (range.startDate === floorDate) {
    if (perSet) return "Since earliest set release";
    return isCubeLikeExpansion(setCode)
      ? "Since cube history start"
      : "Since set release";
  }
  const inclusiveDays = utcDayCount(range.startDate, range.endDate) + 1;
  if (inclusiveDays <= 1) return "Today";
  return `Last ${inclusiveDays} days`;
}

function emptyWindowError(setCode, range) {
  return new Error(
    `No Premier Draft games for ${setCode} from ${range.startDate} to ${range.endDate}. Try a wider date range.`
  );
}

async function fetchColorRatingsForRange(setCode, range) {
  return fetchColorRatings({
    setCode,
    startDate: range.startDate,
    endDate: range.endDate,
  });
}

async function fetchPremierDraftWindow(setCode, range) {
  const colorRatings = await fetchColorRatingsForRange(setCode, range);
  if (!hasPremierDraftGames(colorRatings)) {
    throw emptyWindowError(setCode, range);
  }
  return colorRatings;
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

async function inferSetFromCards(cards) {
  const filters = await fetchFilters();
  const expansions = filters.expansions ?? [];
  const uniqueNonBasics = new Set(
    cards.filter((card) => !isBasicLand(card)).map((card) => normalizeName(card.name))
  );
  const requiredMatches = Math.max(3, Math.ceil(uniqueNonBasics.size * 0.6));
  let bestMatch = null;

  for (const expansion of expansions) {
    const cardData = await fetchCardData({
      setCode: expansion,
      timePeriod: "ALL_TIME",
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

async function discoverUsableCubeExpansions(onProgress) {
  const filters = await fetchFilters();
  const endDate = todayDateString();
  const candidates = sortCubeExpansions(
    (filters.expansions ?? []).filter(
      (expansion) =>
        isCubeLikeExpansion(expansion) &&
        expansionSupportsFormat(filters, expansion, FORMAT)
    )
  );

  if (candidates.length === 0) return [];

  onProgress?.("Checking 17Lands cube sources...");
  const found = await Promise.all(
    candidates.map(async (expansion) => {
      const range = getDefaultRankRange(filters, expansion, endDate);
      const colorRatings = await fetchColorRatingsForRange(expansion, range);
      return hasPremierDraftGames(colorRatings) ? expansion : null;
    })
  );

  return found.filter(Boolean);
}

async function listUsableCubeExpansions(onProgress) {
  cubeSourcesPromise ??= discoverUsableCubeExpansions(onProgress).catch((error) => {
    cubeSourcesPromise = null;
    throw error;
  });
  return cubeSourcesPromise;
}

function showCubeSourceRow(visible) {
  elements.cubeSourceRow.classList.toggle("hidden", !visible);
}

function resetCubeSourceSelection() {
  elements.cubeSource.replaceChildren();
  elements.cubeSource.value = "";
}

function populateCubeDropdown(available, selected) {
  elements.cubeSource.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = CUBE_SOURCE_PLACEHOLDER;
  elements.cubeSource.append(placeholder);

  const notACubeGroup = document.createElement("optgroup");
  notACubeGroup.label = "Multi-set Premier Draft";
  const notACube = document.createElement("option");
  notACube.value = NOT_A_CUBE_VALUE;
  notACube.textContent = `${NOT_A_CUBE_LABEL} — GIH by card set`;
  notACubeGroup.append(notACube);
  elements.cubeSource.append(notACubeGroup);

  if (available.length > 0) {
    const cubeGroup = document.createElement("optgroup");
    cubeGroup.label = "17Lands cube sources";
    for (const expansion of available) {
      const option = document.createElement("option");
      option.value = expansion;
      option.textContent = expansion;
      cubeGroup.append(option);
    }
    elements.cubeSource.append(cubeGroup);
  }

  const allowed = [NOT_A_CUBE_VALUE, ...available];
  elements.cubeSource.value = selected && allowed.includes(selected) ? selected : "";
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
  rankInProgress = isLoading;
  elements.rankButton.disabled = isLoading;
  elements.rankButton.textContent = isLoading ? "Ranking..." : "Rank It";
  elements.sampleButton.disabled = isLoading;
  elements.cubeSource.disabled = isLoading;
  elements.forceCube.disabled = isLoading;
  if (elements.windowStartSlider) {
    const spanDays = Number(elements.windowStartSlider.max) || 0;
    elements.windowStartSlider.disabled = isLoading || spanDays === 0;
  }
  if (elements.rerankButton) {
    elements.rerankButton.disabled = isLoading || !lastRankSession;
    elements.rerankButton.textContent = isLoading ? "Re-ranking..." : "Re-rank";
  }
}

function showStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function formatSideboardNote(sideboardCopies) {
  if (!sideboardCopies) return "";
  const noun = sideboardCopies === 1 ? "card" : "cards";
  return ` ${sideboardCopies} sideboard ${noun} ignored for the deck mean.`;
}

function renderPickList(listEl, rows) {
  listEl.replaceChildren();
  if (rows.length === 0) {
    const li = document.createElement("li");
    li.className = "sideboard-pick-empty";
    li.textContent = "None";
    listEl.append(li);
    return;
  }

  for (const row of rows) {
    const li = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = row.quantity > 1 ? `${row.quantity} ${row.name}` : row.name;
    const meta = document.createElement("span");
    meta.textContent = `${formatPercent(row.gihWr)} · ${row.source}`;
    li.append(name, meta);
    listEl.append(li);
  }
}

function renderSideboardPicks(picks) {
  const hasPicks = Boolean(picks?.rankableCount);
  if (!hasPicks) {
    elements.onColorPicks.replaceChildren();
    elements.offColorPicks.replaceChildren();
    elements.sideboardPicks.classList.add("hidden");
    return;
  }

  renderPickList(elements.onColorPicks, picks.onColor);
  renderPickList(elements.offColorPicks, picks.offColor);
  elements.sideboardPicks.classList.remove("hidden");
}

function selectedWindowRange() {
  if (!lastRankSession) return null;
  const offset = Number(elements.windowStartSlider.value) || 0;
  const startDate = formatDate(addDays(parseDate(lastRankSession.floorDate), offset));
  return clampRangeStart(
    { startDate, endDate: lastRankSession.endDate },
    lastRankSession.floorDate
  );
}

function updateWindowRangeLabel() {
  const range = selectedWindowRange();
  if (!range || !elements.windowRangeLabel) return;
  elements.windowRangeLabel.textContent = `${range.startDate} to ${range.endDate}`;
  elements.windowStartSlider.setAttribute(
    "aria-valuetext",
    `Start ${range.startDate}, end ${range.endDate}`
  );
}

function defaultWindowControlsNote() {
  return (
    "Move the slider to start later. The end date stays at today. " +
    "Pair and All Decks win rates use these dates. Card games in " +
    "hand uses the closest 17Lands published window."
  );
}

function perSetWindowControlsNote() {
  return (
    "Move the slider to start later. The end date stays at today. " +
    "Pair and All Decks win rates stay N/A — there is no single expansion. " +
    "Card games in hand uses the closest 17Lands published window, " +
    "fetched from each card’s own set."
  );
}

function syncWindowControls({ floorDate, endDate, startDate, setCode, usedPerSetGih = false }) {
  const maxDays = Math.max(0, utcDayCount(floorDate, endDate));
  const value = Math.min(maxDays, Math.max(0, utcDayCount(floorDate, startDate)));
  elements.windowStartSlider.min = "0";
  elements.windowStartSlider.max = String(maxDays);
  elements.windowStartSlider.value = String(value);
  elements.windowStartSlider.disabled = rankInProgress || maxDays === 0;
  elements.windowFloorLabel.textContent = usedPerSetGih
    ? "Earliest set"
    : isCubeLikeExpansion(setCode)
      ? "Cube history"
      : "Set release";
  if (elements.windowControlsNote) {
    elements.windowControlsNote.textContent = usedPerSetGih
      ? perSetWindowControlsNote()
      : defaultWindowControlsNote();
  }
  updateWindowRangeLabel();
}

function renderResults({
  setCode,
  colorCode,
  colorRow,
  allDecksRow,
  range,
  cardStats,
  floorDate,
  cardPeriod,
  sideboardCopies = 0,
  sideboardPicks = null,
  usedPerSetGih = false,
  setCodes = [],
}) {
  elements.colorPair.textContent = describeColorCode(colorCode);
  if (usedPerSetGih) {
    const codes = setCodes.join(", ");
    setPrimaryWithNote(
      elements.setName,
      "Multi-set",
      codes ? `(${codes})` : ""
    );
    setPrimaryWithNote(elements.pairWinRate, "N/A", "no single expansion");
    setPrimaryWithNote(elements.formatWinRate, "N/A", "no single expansion");
  } else {
    const expansion = expansionDisplayParts(setCode);
    setPrimaryWithNote(
      elements.setName,
      expansion.name,
      expansion.code ? `(${expansion.code})` : ""
    );
    const pairWinRate = formatColorRatingWinRate(colorRow);
    setPrimaryWithNote(elements.pairWinRate, pairWinRate.primary, pairWinRate.note);
    const formatWinRate = formatColorRatingWinRate(allDecksRow);
    setPrimaryWithNote(elements.formatWinRate, formatWinRate.primary, formatWinRate.note);
  }
  elements.meanGih.textContent = formatPercent(cardStats.mean);
  elements.dateRange.textContent = `${range.startDate} to ${range.endDate}`;
  if (elements.dataWindow) {
    elements.dataWindow.textContent = describeDataWindow(range, floorDate, setCode, {
      perSet: usedPerSetGih,
    });
  }
  if (elements.cardWindow) {
    elements.cardWindow.textContent = describeCardGihWindow(cardPeriod);
  }
  elements.cardsCounted.textContent = formatInteger(cardStats.countedCopies);
  elements.fallbackCount.textContent = `${formatInteger(cardStats.fallbackCount)} cards`;
  if (sideboardCopies > 0) {
    elements.sideboardIgnored.textContent = `${formatInteger(sideboardCopies)} ignored for deck mean`;
    elements.sideboardRow.classList.remove("hidden");
  } else {
    elements.sideboardIgnored.textContent = "-";
    elements.sideboardRow.classList.add("hidden");
  }
  renderSideboardPicks(sideboardPicks);
  renderTable(cardStats.rows);
  elements.results.classList.remove("hidden");
}

function showRankCompleteStatus({
  colorRow,
  cardStats,
  usedCubeSource,
  usedPerSetGih,
  setCode,
  sideboardCopies,
  cardPeriod,
}) {
  const sideboardNote = formatSideboardNote(sideboardCopies);
  const sourceNote = usedPerSetGih
    ? " Using Premier Draft GIH from each card’s own set, not a cube source and not a single format win rate."
    : usedCubeSource
      ? ` Using 17Lands cube source: ${setCode}.`
      : "";
  const gihNote =
    cardPeriod && !cardPeriod.exact
      ? ` Card GIH uses 17Lands ${cardPeriod.label}, the closest published window to the selected dates.`
      : "";
  if (usedPerSetGih) {
    if (cardStats.mean === null) {
      showStatus(
        `Done.${sourceNote} Card games in hand win rate is not published for this window.${gihNote}${sideboardNote}`
      );
      return;
    }
    showStatus(`Done.${sourceNote}${gihNote}${sideboardNote}`);
    return;
  }
  if (colorRow && colorRow.games > 0 && cardStats.mean === null) {
    const gihScope = usedCubeSource ? "cube window" : "window";
    showStatus(
      `Done.${sourceNote} Color-pair data is available; card games in hand win rate is not published for this ${gihScope}.${gihNote}${sideboardNote}`
    );
    return;
  }
  if (!colorRow || colorRow.games === 0 || cardStats.mean === null) {
    showStatus(
      `Done.${sourceNote} 17Lands has little or no Premier Draft data for this date range.${gihNote}${sideboardNote}`
    );
    return;
  }
  showStatus(`Done.${sourceNote}${gihNote}${sideboardNote}`);
}

async function applyPerSetRanking({ parsed, range, colorCode: existingColorCode }) {
  const filters = await fetchFilters();
  const setCodes = collectDistinctSetCodes([parsed.cards, parsed.sideboardCards]);
  if (setCodes.length === 0) {
    throw new Error(
      "Not a Cube needs Arena set codes on each card, like 1 Card Name (SOS) 123."
    );
  }

  const floorDate = formatDate(getPerSetFloorDate(filters, setCodes));
  const clampedRange = clampRangeStart(range, floorDate);
  const cardPeriod = selectCardDataPeriod(clampedRange, floorDate);
  const setLabel = setCodes.join(", ");

  showStatus(`Fetching Premier Draft GIH by card set (${setLabel})...`);
  const colorFromLands = existingColorCode ?? inferColorCodeFromLands(parsed.cards);

  let allBySet;
  let colorBySet;
  let colorCode = colorFromLands;

  if (colorCode) {
    [allBySet, colorBySet] = await Promise.all([
      fetchCardDataMapsBySet({ setCodes, timePeriod: cardPeriod.id }),
      fetchCardDataMapsBySet({
        setCodes,
        timePeriod: cardPeriod.id,
        colors: colorCode,
      }),
    ]);
  } else {
    allBySet = await fetchCardDataMapsBySet({
      setCodes,
      timePeriod: cardPeriod.id,
    });
    const mergedAllByName = mergeCardDataMapsForCards(
      [...parsed.cards, ...parsed.sideboardCards],
      allBySet
    );
    colorCode = inferColorCodeFromCards(parsed.cards, mergedAllByName);
    if (!colorCode) {
      throw new Error("Could not infer a deck color pair from the export.");
    }
    colorBySet = await fetchCardDataMapsBySet({
      setCodes,
      timePeriod: cardPeriod.id,
      colors: colorCode,
    });
  }

  const cardStats = calculateMeanGihFromSetMaps(parsed.cards, colorBySet, allBySet);
  const sideboardPicks = rankSideboardPicksFromSetMaps(
    parsed.sideboardCards,
    colorCode,
    colorBySet,
    allBySet
  );

  lastRankSession = {
    parsed,
    setCode: "Multi-set",
    colorCode,
    usedCubeSource: false,
    usedPerSetGih: true,
    floorDate,
    endDate: clampedRange.endDate,
  };

  syncWindowControls({
    floorDate,
    endDate: clampedRange.endDate,
    startDate: clampedRange.startDate,
    setCode: "Multi-set",
    usedPerSetGih: true,
  });

  renderResults({
    setCode: "Multi-set",
    colorCode,
    colorRow: null,
    allDecksRow: null,
    range: clampedRange,
    cardStats,
    floorDate,
    cardPeriod,
    sideboardCopies: parsed.sideboardCopies,
    sideboardPicks,
    usedPerSetGih: true,
    setCodes,
  });

  showRankCompleteStatus({
    colorRow: null,
    cardStats,
    usedCubeSource: false,
    usedPerSetGih: true,
    setCode: "Multi-set",
    sideboardCopies: parsed.sideboardCopies,
    cardPeriod,
  });
}

async function applyRanking({
  parsed,
  setCode,
  range,
  usedCubeSource,
  usedPerSetGih = false,
  colorCode: existingColorCode,
}) {
  if (usedPerSetGih) {
    await applyPerSetRanking({ parsed, range, colorCode: existingColorCode });
    return;
  }

  const filters = await fetchFilters();
  const floorDate = formatDate(getSearchFloorDate(filters, setCode));
  const clampedRange = clampRangeStart(range, floorDate);

  showStatus(
    usedCubeSource
      ? `Fetching Premier Draft data for ${setCode}...`
      : "Fetching Premier Draft data..."
  );
  const colorRatings = await fetchPremierDraftWindow(setCode, clampedRange);
  const cardPeriod = selectCardDataPeriod(clampedRange, floorDate);

  const allCardData = await fetchCardData({
    setCode,
    timePeriod: cardPeriod.id,
  });

  const allCardDataByName = buildCardDataMap(allCardData);
  const colorCode =
    existingColorCode ??
    inferColorCodeFromLands(parsed.cards) ??
    inferColorCodeFromCards(parsed.cards, allCardDataByName);

  if (!colorCode) {
    throw new Error("Could not infer a deck color pair from the export.");
  }

  const colorCardData = await fetchCardData({
    setCode,
    timePeriod: cardPeriod.id,
    colors: colorCode,
  });

  const colorRow = findColorRow(colorRatings, colorCode);
  const allDecksRow = findAllDecksRow(colorRatings);
  const cardStats = calculateMeanGih(parsed.cards, colorCardData, allCardData);
  const sideboardPicks = rankSideboardPicks(
    parsed.sideboardCards,
    colorCode,
    colorCardData,
    allCardData
  );

  lastRankSession = {
    parsed,
    setCode,
    colorCode,
    usedCubeSource,
    usedPerSetGih: false,
    floorDate,
    endDate: clampedRange.endDate,
  };

  syncWindowControls({
    floorDate,
    endDate: clampedRange.endDate,
    startDate: clampedRange.startDate,
    setCode,
  });

  renderResults({
    setCode,
    colorCode,
    colorRow,
    allDecksRow,
    range: clampedRange,
    cardStats,
    floorDate,
    cardPeriod,
    sideboardCopies: parsed.sideboardCopies,
    sideboardPicks,
  });

  showRankCompleteStatus({
    colorRow,
    cardStats,
    usedCubeSource,
    usedPerSetGih: false,
    setCode,
    sideboardCopies: parsed.sideboardCopies,
    cardPeriod,
  });
}

async function rankExport() {
  const exportText = elements.textarea.value.trim();
  if (!exportText) {
    showStatus("Paste an Arena export first.", true);
    return;
  }

  lastRankSession = null;
  setLoading(true);
  elements.results.classList.add("hidden");
  showStatus("Parsing deck...");

  try {
    const parsed = parseArenaExport(exportText);
    const filters = await fetchFilters();
    const likelyCube =
      Boolean(elements.forceCube.checked) || isLikelyCubeExport(parsed.cards);
    let setCode = parsed.setCode;
    let usedCubeSource = false;
    let usedPerSetGih = false;

    showStatus("Fetching 17Lands data...");
    if (likelyCube) {
      let availableCubes = [];
      try {
        availableCubes = await listUsableCubeExpansions(showStatus);
      } catch {
        availableCubes = [];
      }
      const selectedCube = selectedCubeExpansion(availableCubes);
      populateCubeDropdown(availableCubes, selectedCube);
      showCubeSourceRow(true);

      if (!selectedCube) {
        showStatus(
          "Select Not a Cube to rank each card by its own set’s Premier Draft GIH, or choose a 17Lands cube source."
        );
        return;
      }

      if (selectedCube === NOT_A_CUBE_VALUE) {
        usedPerSetGih = true;
        setCode = "Multi-set";
      } else {
        setCode = selectedCube;
        usedCubeSource = true;
      }
    } else {
      showCubeSourceRow(false);
      if (!setCode) {
        showStatus("Inferring set from card names...");
        const inferredSet = await inferSetFromCards(parsed.cards);
        setCode = inferredSet.setCode;
      }
    }

    const range = usedPerSetGih
      ? getDefaultRankRangeFromFloor(
          getPerSetFloorDate(
            filters,
            collectDistinctSetCodes([parsed.cards, parsed.sideboardCards])
          )
        )
      : getDefaultRankRange(filters, setCode);
    await applyRanking({ parsed, setCode, range, usedCubeSource, usedPerSetGih });
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

async function rerankExport() {
  if (!lastRankSession || rankInProgress) return;

  const range = selectedWindowRange();
  if (!range) return;

  setLoading(true);
  showStatus("Re-ranking with the selected date range...");

  try {
    await applyRanking({
      parsed: lastRankSession.parsed,
      setCode: lastRankSession.setCode,
      range,
      usedCubeSource: lastRankSession.usedCubeSource,
      usedPerSetGih: lastRankSession.usedPerSetGih,
      colorCode: lastRankSession.colorCode,
    });
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

elements.rankButton.addEventListener("click", rankExport);
elements.rerankButton.addEventListener("click", rerankExport);
elements.windowStartSlider.addEventListener("input", updateWindowRangeLabel);
elements.sampleButton.addEventListener("click", () => {
  elements.textarea.value = SAMPLE_EXPORT;
  elements.forceCube.checked = false;
  resetCubeSourceSelection();
  showCubeSourceRow(false);
  elements.textarea.focus();
  showStatus("Sample loaded.");
});
elements.cubeSource.addEventListener("change", () => {
  if (elements.textarea.value.trim() && !elements.rankButton.disabled) {
    rankExport();
  }
});
