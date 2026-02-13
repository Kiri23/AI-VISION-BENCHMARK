const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { compare } = require("../compare");

// compare.js loads ground-truth.json at module level, so we test against real entries.
// "image.png" has 13 months in ground-truth.json.

describe("compare()", () => {
  it("returns 13/13 when API result matches ground truth exactly", () => {
    const perfect = {
      months: [
        { month: "ago-24", kwh: 808, costPerKwh: 0.24 },
        { month: "sep", kwh: 634, costPerKwh: 0.24 },
        { month: "oct", kwh: 919, costPerKwh: 0.24 },
        { month: "nov", kwh: 735, costPerKwh: 0.24 },
        { month: "dic", kwh: 308, costPerKwh: 0.24 },
        { month: "ene", kwh: 511, costPerKwh: 0.26 },
        { month: "feb", kwh: 377, costPerKwh: 0.26 },
        { month: "mar", kwh: 430, costPerKwh: 0.26 },
        { month: "abr", kwh: 461, costPerKwh: 0.26 },
        { month: "may", kwh: 465, costPerKwh: 0.26 },
        { month: "jun", kwh: 516, costPerKwh: 0.26 },
        { month: "jul", kwh: 556, costPerKwh: 0.25 },
        { month: "ago-25", kwh: 835, costPerKwh: 0.25 },
      ],
    };

    const result = compare("image.png", perfect);
    assert.equal(result.correctCount, 13);
    assert.equal(result.totalFields, 13);
    assert.equal(result.client, "Client imagen");
    assert.equal(result.results.every((r) => r.pass), true);
  });

  it("detects kWh mismatch", () => {
    const withBadKwh = {
      months: [
        { month: "ago-24", kwh: 999, costPerKwh: 0.24 },
        { month: "sep", kwh: 634, costPerKwh: 0.24 },
        { month: "oct", kwh: 919, costPerKwh: 0.24 },
        { month: "nov", kwh: 735, costPerKwh: 0.24 },
        { month: "dic", kwh: 308, costPerKwh: 0.24 },
        { month: "ene", kwh: 511, costPerKwh: 0.26 },
        { month: "feb", kwh: 377, costPerKwh: 0.26 },
        { month: "mar", kwh: 430, costPerKwh: 0.26 },
        { month: "abr", kwh: 461, costPerKwh: 0.26 },
        { month: "may", kwh: 465, costPerKwh: 0.26 },
        { month: "jun", kwh: 516, costPerKwh: 0.26 },
        { month: "jul", kwh: 556, costPerKwh: 0.25 },
        { month: "ago-25", kwh: 835, costPerKwh: 0.25 },
      ],
    };

    const result = compare("image.png", withBadKwh);
    assert.equal(result.correctCount, 12);
    assert.equal(result.results[0].kwh.match, false);
    assert.equal(result.results[0].pass, false);
  });

  it("costPerKwh within $0.01 tolerance passes", () => {
    const withinTolerance = {
      months: [
        { month: "ago-24", kwh: 808, costPerKwh: 0.249 }, // 0.009 diff, within $0.01
        { month: "sep", kwh: 634, costPerKwh: 0.24 },
        { month: "oct", kwh: 919, costPerKwh: 0.24 },
        { month: "nov", kwh: 735, costPerKwh: 0.24 },
        { month: "dic", kwh: 308, costPerKwh: 0.24 },
        { month: "ene", kwh: 511, costPerKwh: 0.26 },
        { month: "feb", kwh: 377, costPerKwh: 0.26 },
        { month: "mar", kwh: 430, costPerKwh: 0.26 },
        { month: "abr", kwh: 461, costPerKwh: 0.26 },
        { month: "may", kwh: 465, costPerKwh: 0.26 },
        { month: "jun", kwh: 516, costPerKwh: 0.26 },
        { month: "jul", kwh: 556, costPerKwh: 0.25 },
        { month: "ago-25", kwh: 835, costPerKwh: 0.25 },
      ],
    };

    const result = compare("image.png", withinTolerance);
    assert.equal(result.results[0].costPerKwh.match, true);
    assert.equal(result.results[0].pass, true);
  });

  it("costPerKwh outside $0.01 tolerance fails", () => {
    const outsideTolerance = {
      months: [
        { month: "ago-24", kwh: 808, costPerKwh: 0.26 }, // 0.24 + 0.02 = outside
        { month: "sep", kwh: 634, costPerKwh: 0.24 },
        { month: "oct", kwh: 919, costPerKwh: 0.24 },
        { month: "nov", kwh: 735, costPerKwh: 0.24 },
        { month: "dic", kwh: 308, costPerKwh: 0.24 },
        { month: "ene", kwh: 511, costPerKwh: 0.26 },
        { month: "feb", kwh: 377, costPerKwh: 0.26 },
        { month: "mar", kwh: 430, costPerKwh: 0.26 },
        { month: "abr", kwh: 461, costPerKwh: 0.26 },
        { month: "may", kwh: 465, costPerKwh: 0.26 },
        { month: "jun", kwh: 516, costPerKwh: 0.26 },
        { month: "jul", kwh: 556, costPerKwh: 0.25 },
        { month: "ago-25", kwh: 835, costPerKwh: 0.25 },
      ],
    };

    const result = compare("image.png", outsideTolerance);
    assert.equal(result.results[0].costPerKwh.match, false);
    assert.equal(result.results[0].pass, false);
    assert.equal(result.correctCount, 12);
  });

  it("month substring matching works (partial match)", () => {
    const partialMonth = {
      months: [
        { month: "ago", kwh: 808, costPerKwh: 0.24 }, // "ago" is substring of "ago-24"
        { month: "sep", kwh: 634, costPerKwh: 0.24 },
        { month: "oct", kwh: 919, costPerKwh: 0.24 },
        { month: "nov", kwh: 735, costPerKwh: 0.24 },
        { month: "dic", kwh: 308, costPerKwh: 0.24 },
        { month: "ene", kwh: 511, costPerKwh: 0.26 },
        { month: "feb", kwh: 377, costPerKwh: 0.26 },
        { month: "mar", kwh: 430, costPerKwh: 0.26 },
        { month: "abr", kwh: 461, costPerKwh: 0.26 },
        { month: "may", kwh: 465, costPerKwh: 0.26 },
        { month: "jun", kwh: 516, costPerKwh: 0.26 },
        { month: "jul", kwh: 556, costPerKwh: 0.25 },
        { month: "ago-25", kwh: 835, costPerKwh: 0.25 },
      ],
    };

    const result = compare("image.png", partialMonth);
    // "ago-24".includes("ago") → true
    assert.equal(result.results[0].month.match, true);
    assert.equal(result.results[0].pass, true);
  });

  it("wrong month count returns 0 correct with error", () => {
    const wrongCount = {
      months: [
        { month: "ago-24", kwh: 808, costPerKwh: 0.24 },
        { month: "sep", kwh: 634, costPerKwh: 0.24 },
      ],
    };

    const result = compare("image.png", wrongCount);
    assert.equal(result.correctCount, 0);
    assert.equal(result.totalFields, 13);
    assert.ok(result.error);
    assert.match(result.error, /Expected 13 months, got 2/);
  });

  it("chartComplete false returns warning with 0 correct", () => {
    const incomplete = {
      chartComplete: false,
      months: [
        { month: "oct-24", kwh: 919, costPerKwh: 0.24 },
        { month: "nov", kwh: 735, costPerKwh: 0.24 },
        { month: "dic", kwh: 308, costPerKwh: 0.24 },
        { month: "ene", kwh: 511, costPerKwh: 0.26 },
        { month: "feb", kwh: 377, costPerKwh: 0.26 },
        { month: "mar", kwh: 430, costPerKwh: 0.26 },
        { month: "abr", kwh: 461, costPerKwh: 0.26 },
        { month: "may", kwh: 465, costPerKwh: 0.26 },
        { month: "jun", kwh: 516, costPerKwh: 0.26 },
        { month: "jul", kwh: 556, costPerKwh: 0.25 },
        { month: "ago-25", kwh: 835, costPerKwh: 0.25 },
      ],
    };

    const result = compare("image.png", incomplete);
    assert.equal(result.correctCount, 0);
    assert.equal(result.totalFields, 13);
    assert.equal(result.chartComplete, false);
    assert.ok(result.warning);
    assert.match(result.warning, /Incomplete chart detected/);
    assert.match(result.warning, /11 months/);
    assert.deepEqual(result.results, []);
    assert.equal(result.error, undefined);
  });

  it("returns error for unknown filename", () => {
    const result = compare("nonexistent.png", { months: [] });
    assert.ok(result.error);
    assert.equal(result.totalFields, 0);
    assert.equal(result.correctCount, 0);
  });
});
