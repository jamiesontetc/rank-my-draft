const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
const start = source.indexOf("function normalizeArenaLine");
const end = source.indexOf("function isBasicLand");
assert.ok(start >= 0 && end > start, "expected Arena parse helpers in public/app.js");

// Run in this realm so assert.deepEqual can compare the returned arrays.
vm.runInThisContext(source.slice(start, end));

const MULTI_SET_EXPORT = `Deck
1 Studious First-Year (SOS) 162
1 Environmental Scientist (SOS) 147
1 Noxious Newt (SOS) 155
1 Vastlands Scavenger (SOS) 166
1 Elite Interceptor (SOS) 12
1 Ennis, Debate Moderator (SOS) 14
1 Aang, Swift Savior (TLA) 207
1 Sokka, Bold Boomeranger (TLA) 239
1 Katara, Bending Prodigy (TLA) 58
1 Toph, the First Metalbender (TLA) 247
8 Plains (SOS) 272
8 Forest (TLA) 280

SIDEBOARD :
1 Pestbrood Sloth (SOS) 157
1 Hungry Graffalon (SOS) 151
1 Firebending Lesson (TLA) 132
`;

function names(cards) {
  return cards.map((card) => card.name).sort();
}

function testStandardAndColonWhitespace() {
  const parsed = parseArenaExport(MULTI_SET_EXPORT);
  assert.deepEqual(names(parsed.cards), [
    "Aang, Swift Savior",
    "Elite Interceptor",
    "Ennis, Debate Moderator",
    "Environmental Scientist",
    "Forest",
    "Katara, Bending Prodigy",
    "Noxious Newt",
    "Plains",
    "Sokka, Bold Boomeranger",
    "Studious First-Year",
    "Toph, the First Metalbender",
    "Vastlands Scavenger",
  ]);
  assert.deepEqual(names(parsed.sideboardCards), [
    "Firebending Lesson",
    "Hungry Graffalon",
    "Pestbrood Sloth",
  ]);
  assert.equal(parsed.sideboardCopies, 3);
  assert.ok(!names(parsed.cards).includes("Pestbrood Sloth"));
  assert.ok(!names(parsed.cards).includes("Firebending Lesson"));
}

function testHeaderVariants() {
  const variants = [
    "Sideboard",
    "SIDEBOARD",
    "Sideboard:",
    "SIDEBOARD :",
    "  sideboard  :  ",
    "Sideboard (3)",
    "Sideboard (3 cards)",
    "// Sideboard",
  ];
  for (const header of variants) {
    const parsed = parseArenaExport(`Deck\n1 Studious First-Year (SOS) 162\n\n${header}\n1 Pestbrood Sloth (SOS) 157\n`);
    assert.equal(parsed.cards.length, 1, `deck split failed for ${JSON.stringify(header)}`);
    assert.equal(parsed.sideboardCards[0]?.name, "Pestbrood Sloth", `sideboard missed for ${JSON.stringify(header)}`);
    assert.equal(parsed.sideboardCopies, 1);
  }
}

function testPostSideboardDeckHeaderStaysSideboard() {
  const parsed = parseArenaExport(`Deck
1 Studious First-Year (SOS) 162
SIDEBOARD
1 Pestbrood Sloth (SOS) 157
Deck
1 Hungry Graffalon (SOS) 151
`);
  assert.deepEqual(names(parsed.cards), ["Studious First-Year"]);
  assert.deepEqual(names(parsed.sideboardCards), ["Hungry Graffalon", "Pestbrood Sloth"]);
  assert.equal(parsed.sideboardCopies, 2);
}

testStandardAndColonWhitespace();
testHeaderVariants();
testPostSideboardDeckHeaderStaysSideboard();
console.log("parse-arena-export tests passed");
