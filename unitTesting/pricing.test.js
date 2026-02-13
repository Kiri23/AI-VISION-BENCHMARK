const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { calculateCost, PRICING } = require("../pricing");

describe("calculateCost()", () => {
  it("calculates cost for Gemini with known token counts", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
    const cost = calculateCost("Gemini 2.0 Flash", usage);
    // input: 1M * $0.10/M = $0.10, output: 1M * $0.40/M = $0.40 → $0.50
    assert.equal(cost, 0.5);
  });

  it("calculates cost for OpenAI with known token counts", () => {
    const usage = { inputTokens: 500_000, outputTokens: 100_000 };
    const cost = calculateCost("OpenAI GPT-4o", usage);
    // input: 0.5M * $2.50 = $1.25, output: 0.1M * $10.00 = $1.00 → $2.25
    assert.equal(cost, 2.25);
  });

  it("calculates cost for Claude with known token counts", () => {
    const usage = { inputTokens: 200_000, outputTokens: 50_000 };
    const cost = calculateCost("Claude Sonnet 4.5", usage);
    // input: 0.2M * $3.00 = $0.60, output: 0.05M * $15.00 = $0.75 → $1.35
    assert.equal(cost, 1.35);
  });

  it("returns null for unknown provider", () => {
    const cost = calculateCost("Unknown Provider", { inputTokens: 100, outputTokens: 100 });
    assert.equal(cost, null);
  });

  it("returns null when usage is null", () => {
    const cost = calculateCost("Gemini 2.0 Flash", null);
    assert.equal(cost, null);
  });

  it("returns null when usage is undefined", () => {
    const cost = calculateCost("Gemini 2.0 Flash", undefined);
    assert.equal(cost, null);
  });

  it("returns 0 for zero tokens", () => {
    const cost = calculateCost("Gemini 2.0 Flash", { inputTokens: 0, outputTokens: 0 });
    assert.equal(cost, 0);
  });

  it("handles small token counts without floating point issues", () => {
    // Gemini: 1000 input tokens → $0.10/M * 1000 = $0.0001
    //         500 output tokens → $0.40/M * 500 = $0.0002 → $0.0003
    const cost = calculateCost("Gemini 2.0 Flash", { inputTokens: 1000, outputTokens: 500 });
    assert.equal(cost, 0.0003);
  });

  it("PRICING has entries for all expected providers", () => {
    assert.ok(PRICING["Gemini 2.0 Flash"]);
    assert.ok(PRICING["OpenAI GPT-4o"]);
    assert.ok(PRICING["Claude Sonnet 4.5"]);
  });
});
