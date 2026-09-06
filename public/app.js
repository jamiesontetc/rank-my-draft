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

const CUBE_SOURCE_PLACEHOLDER = "Select a cube…";
const CUBE_HISTORY_START = "2020-01-01";

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
  formatWinRate: document.querySelector("#format-win-rate"),
  meanGih: document.querySelector("#mean-gih"),
  dateRange: document.querySelector("#date-range"),
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
  if (codedCopies === 0 || distinctSets < 3) return false;
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
  return available.includes(value) ? value : "";
}

function formatExpansionLabel(setCode) {
  if (isCubeLikeExpansion(setCode)) return setCode;
  const name = SET_NAMES[setCode];
  return name ? `${name} (${setCode})` : setCode;
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

function selectCardGih(card, colorByName, allByName, useColorPair = true) {
  const key = normalizeName(card.name);
  const colorRow = colorByName.get(key);
  const allRow = allByName.get(key);
  const selected =
    useColorPair && colorRow && colorRow.ever_drawn_win_rate !== null
      ? colorRow
      : allRow;
  const gihWr = selected?.ever_drawn_win_rate;
  return {
    quantity: card.quantity,
    name: card.name,
    source: selected === colorRow ? "Color pair" : "All decks",
    games: selected?.ever_drawn_game_count ?? null,
    gihWr: typeof gihWr === "number" ? gihWr : null,
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
    const row = selectCardGih(card, colorByName, allByName, true);
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
    fallbackCount: rows.filter((row) => row.source === "All decks").length,
  };
}

function compareGihRows(a, b) {
  return b.gihWr - a.gihWr || a.name.localeCompare(b.name);
}

function rankSideboardPicks(sideboardCards, colorCode, colorCardData, allCardData) {
  const colorByName = buildCardDataMap(colorCardData);
  const allByName = buildCardDataMap(allCardData);
  const uniqueCards = mergeCardsByName(
    sideboardCards.filter((card) => !isBasicLand(card))
  );
  const onColor = [];
  const offColor = [];

  for (const card of uniqueCards) {
    if (cardFitsColorCode(card, colorCode, allByName)) {
      const row = selectCardGih(card, colorByName, allByName, true);
      if (typeof row.gihWr === "number") onColor.push(row);
    } else {
      const row = selectCardGih(card, colorByName, allByName, false);
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
  if (!row || !(row.games > 0)) return "Unavailable";
  return `${formatPercent(row.wins / row.games)} (${formatInteger(row.games)} games)`;
}

function getSetStartDate(filters, setCode) {
  const rawStartDate = filters.start_dates?.[setCode];
  return rawStartDate ? new Date(rawStartDate) : new Date("2020-01-01T00:00:00Z");
}

async function findMostRecentAvailableRange(setCode, preferredRange, onProgress) {
  const filters = await fetchFilters();
  const setStartDate = getSetStartDate(filters, setCode);
  let searchRange = preferredRange;
  let checkedWindows = 0;
  let fallbackUsed = false;

  for (;;) {
    checkedWindows += 1;
    const colorRatings = await fetchColorRatings({
      setCode,
      startDate: searchRange.startDate,
      endDate: searchRange.endDate,
    });

    if (hasPremierDraftGames(colorRatings)) {
      if (!fallbackUsed) {
        return { range: searchRange, colorRatings, fallbackUsed };
      }

      const expandedRange = expandRangeEarlier(searchRange, 28);
      const expandedColorRatings = await fetchColorRatings({
        setCode,
        startDate: expandedRange.startDate,
        endDate: expandedRange.endDate,
      });

      return {
        range: expandedRange,
        colorRatings: expandedColorRatings,
        fallbackUsed,
      };
    }

    const previousChunk = getPreviousDateRange(searchRange);
    if (parseDate(previousChunk.endDate) <= setStartDate) {
      if (isCubeLikeExpansion(setCode)) {
        onProgress?.(`Searching older Premier Draft data for ${setCode}...`);
        const wideRange = {
          startDate: CUBE_HISTORY_START,
          endDate: preferredRange.endDate,
        };
        const wideColorRatings = await fetchColorRatings({
          setCode,
          startDate: wideRange.startDate,
          endDate: wideRange.endDate,
        });
        if (hasPremierDraftGames(wideColorRatings)) {
          return {
            range: wideRange,
            colorRatings: wideColorRatings,
            fallbackUsed: true,
          };
        }
      }
      return { range: preferredRange, colorRatings, fallbackUsed: false };
    }

    fallbackUsed = true;
    searchRange = previousChunk;

    if (checkedWindows % 3 === 0) {
      onProgress?.(`Searching older Premier Draft data near ${searchRange.endDate}...`);
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

async function discoverUsableCubeExpansions(preferredRange, onProgress) {
  const filters = await fetchFilters();
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
      const result = await findMostRecentAvailableRange(expansion, preferredRange);
      return hasPremierDraftGames(result.colorRatings) ? expansion : null;
    })
  );

  return found.filter(Boolean);
}

async function listUsableCubeExpansions(preferredRange, onProgress) {
  cubeSourcesPromise ??= discoverUsableCubeExpansions(preferredRange, onProgress).catch(
    (error) => {
      cubeSourcesPromise = null;
      throw error;
    }
  );
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
  for (const expansion of available) {
    const option = document.createElement("option");
    option.value = expansion;
    option.textContent = expansion;
    elements.cubeSource.append(option);
  }
  elements.cubeSource.value =
    selected && available.includes(selected) ? selected : "";
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
  elements.sampleButton.disabled = isLoading;
  elements.cubeSource.disabled = isLoading;
  elements.forceCube.disabled = isLoading;
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

function renderResults({
  setCode,
  colorCode,
  colorRow,
  allDecksRow,
  range,
  cardStats,
  fallbackUsed,
  sideboardCopies = 0,
  sideboardPicks = null,
}) {
  elements.colorPair.textContent = describeColorCode(colorCode);
  elements.setName.textContent = formatExpansionLabel(setCode);
  elements.pairWinRate.textContent = formatColorRatingWinRate(colorRow);
  elements.formatWinRate.textContent = formatColorRatingWinRate(allDecksRow);
  elements.meanGih.textContent = formatPercent(cardStats.mean);
  elements.dateRange.textContent = `${range.startDate} to ${range.endDate}${
    fallbackUsed ? " (most recent available)" : ""
  }`;
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
    const likelyCube =
      Boolean(elements.forceCube.checked) || isLikelyCubeExport(parsed.cards);
    let setCode = parsed.setCode;
    let usedCubeSource = false;

    showStatus("Fetching 17Lands data...");
    if (likelyCube) {
      const availableCubes = await listUsableCubeExpansions(
        preferredRange,
        showStatus
      );
      const selectedCube = selectedCubeExpansion(availableCubes);
      populateCubeDropdown(availableCubes, selectedCube);
      showCubeSourceRow(true);

      if (availableCubes.length === 0) {
        throw new Error(
          "Detected a cube export, but no 17Lands cube sources have Premier Draft data."
        );
      }
      if (!selectedCube) {
        showStatus("Select a cube from Cube / 17Lands source to rank this export.");
        return;
      }

      setCode = selectedCube;
      usedCubeSource = true;
    } else {
      showCubeSourceRow(false);
      if (!setCode) {
        showStatus("Inferring set from card names...");
        const inferredSet = await inferSetFromCards(parsed.cards, preferredRange);
        setCode = inferredSet.setCode;
      }
    }

    showStatus(
      usedCubeSource
        ? `Finding Premier Draft data for ${setCode}...`
        : "Finding the latest Premier Draft data..."
    );
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
    const allDecksRow = findAllDecksRow(colorRatings);
    const cardStats = calculateMeanGih(
      parsed.cards,
      colorCardData,
      allCardData
    );
    const sideboardPicks = rankSideboardPicks(
      parsed.sideboardCards,
      colorCode,
      colorCardData,
      allCardData
    );

    renderResults({
      setCode,
      colorCode,
      colorRow,
      allDecksRow,
      range,
      cardStats,
      fallbackUsed,
      sideboardCopies: parsed.sideboardCopies,
      sideboardPicks,
    });
    const sideboardNote = formatSideboardNote(parsed.sideboardCopies);
    const cubeNote = usedCubeSource
      ? ` Using 17Lands cube source: ${setCode}.`
      : "";
    if (usedCubeSource && colorRow && colorRow.games > 0 && cardStats.mean === null) {
      showStatus(
        `Done.${cubeNote} Color-pair data is available; card GIH WR is not published for this cube window.${sideboardNote}`
      );
    } else if (!colorRow || colorRow.games === 0 || cardStats.mean === null) {
      showStatus(
        `Done.${cubeNote} 17Lands has little or no recent Premier Draft data for this set.${sideboardNote}`
      );
    } else {
      showStatus(`Done.${cubeNote}${sideboardNote}`);
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
