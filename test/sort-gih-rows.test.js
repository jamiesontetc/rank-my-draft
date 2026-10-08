const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
const start = source.indexOf("function hasPublishedGih");
const end = source.indexOf("function rankSideboardPicks(");
assert.ok(start >= 0 && end > start, "expected GIH sort helpers in public/app.js");

vm.runInThisContext(source.slice(start, end));

function names(rows) {
  return rows.map((row) => row.name);
}

function testDescendingPublishedGih() {
  const sorted = sortGihRows([
    { name: "Low", gihWr: 0.5 },
    { name: "High", gihWr: 0.62 },
    { name: "Mid", gihWr: 0.55 },
  ]);
  assert.deepEqual(names(sorted), ["High", "Mid", "Low"]);
}

function testUnpublishedGoLast() {
  const sorted = sortGihRows([
    { name: "Zebra", gihWr: null },
    { name: "Alpha", gihWr: Number.NaN },
    { name: "Mid", gihWr: 0.55 },
    { name: "Missing" },
    { name: "High", gihWr: 0.62 },
  ]);
  assert.deepEqual(names(sorted), ["High", "Mid", "Alpha", "Missing", "Zebra"]);
}

function testTiesBreakByNameAndStayStable() {
  const tied = [
    { name: "Beta", gihWr: 0.6 },
    { name: "Alpha", gihWr: 0.6 },
    { name: "Alpha", gihWr: 0.6, copy: 2 },
  ];
  const sorted = sortGihRows(tied);
  assert.deepEqual(names(sorted), ["Alpha", "Alpha", "Beta"]);
  assert.equal(sorted[0].copy, undefined);
  assert.equal(sorted[1].copy, 2);
}

function testDoesNotMutateInput() {
  const rows = [
    { name: "Low", gihWr: 0.4 },
    { name: "High", gihWr: 0.7 },
  ];
  const sorted = sortGihRows(rows);
  assert.deepEqual(names(rows), ["Low", "High"]);
  assert.deepEqual(names(sorted), ["High", "Low"]);
}

testDescendingPublishedGih();
testUnpublishedGoLast();
testTiesBreakByNameAndStayStable();
testDoesNotMutateInput();
console.log("sort-gih-rows tests passed");
