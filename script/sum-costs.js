const fs = require("fs");
const path = require("path");
const { PRICING, calculateCost } = require("../pricing.js");

const expDir = path.join(__dirname, "..", "results", "experiments");
const files = fs.readdirSync(expDir).filter(f => f.startsWith("exp-")).sort();

// Accumulators: { provider: { stored, recalculated, inputTokens, outputTokens, count } }
const totals = {};

for (const f of files) {
  const exp = JSON.parse(fs.readFileSync(path.join(expDir, f)));

  // Sum stored costs from summary
  for (const [provider, stats] of Object.entries(exp.summary)) {
    if (provider === "_totalCost") continue;
    if (!totals[provider]) {
      totals[provider] = { stored: 0, recalculated: 0, inputTokens: 0, outputTokens: 0, count: 0 };
    }
    totals[provider].stored += stats.totalEstimatedCost || 0;
  }

  // Sum recalculated costs from individual results
  for (const r of exp.results) {
    if (!totals[r.provider]) {
      totals[r.provider] = { stored: 0, recalculated: 0, inputTokens: 0, outputTokens: 0, count: 0 };
    }
    if (r.usage) {
      const cost = calculateCost(r.provider, r.usage);
      totals[r.provider].recalculated += cost || 0;
      totals[r.provider].inputTokens += r.usage.inputTokens || 0;
      totals[r.provider].outputTokens += r.usage.outputTokens || 0;
    }
    totals[r.provider].count++;
  }
}

// Print table
const isGemini = (name) => name.toLowerCase().includes("gemini");

console.log("");
console.log("Provider                    | Stored     | Recalculated | Input Tok  | Output Tok | # Calls");
console.log("----------------------------|------------|--------------|------------|------------|--------");

let geminiStored = 0, geminiRecalc = 0;
let allStored = 0, allRecalc = 0;

const sorted = Object.entries(totals).sort((a, b) => a[0].localeCompare(b[0]));

for (const [provider, t] of sorted) {
  const recalcStr = t.recalculated > 0 ? `$${t.recalculated.toFixed(4)}` : "(no usage)";
  console.log(
    `${provider.padEnd(28)}| $${t.stored.toFixed(4).padEnd(9)}| ${recalcStr.padEnd(13)}| ${String(t.inputTokens).padEnd(11)}| ${String(t.outputTokens).padEnd(11)}| ${t.count}`
  );
  allStored += t.stored;
  allRecalc += t.recalculated;
  if (isGemini(provider)) {
    geminiStored += t.stored;
    geminiRecalc += t.recalculated;
  }
}

console.log("----------------------------|------------|--------------|------------|------------|--------");
console.log(
  `${"Total (all)".padEnd(28)}| $${allStored.toFixed(4).padEnd(9)}| $${allRecalc.toFixed(4).padEnd(12)}|            |            |`
);
console.log(
  `${"Total (Gemini only)".padEnd(28)}| $${geminiStored.toFixed(4).padEnd(9)}| $${geminiRecalc > 0 ? geminiRecalc.toFixed(4) : "(no usage)".padEnd(12)}|            |            |`
);

const GOOGLE_BILL = 0.67;
console.log("");
console.log(`Google API Bill:  $${GOOGLE_BILL.toFixed(2)}`);
console.log(`Gemini Stored:    $${geminiStored.toFixed(4)}`);
if (geminiRecalc > 0) {
  console.log(`Gemini Recalc:    $${geminiRecalc.toFixed(4)}`);
  console.log(`Gap (recalc):     $${(GOOGLE_BILL - geminiRecalc).toFixed(4)}`);
} else {
  console.log(`Gap (stored):     $${(GOOGLE_BILL - geminiStored).toFixed(4)}`);
  console.log("(No usage data in older experiments — recalculation only covers experiments with token counts)");
}
