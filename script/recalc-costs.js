const fs = require("fs");
const path = require("path");
const { calculateCost } = require("../pricing.js");

const expDir = path.join(__dirname, "..", "results", "experiments");
const files = fs.readdirSync(expDir).filter(f => f.startsWith("exp-")).sort();

let totalPatched = 0;

for (const f of files) {
  const filePath = path.join(expDir, f);
  const exp = JSON.parse(fs.readFileSync(filePath));

  // Track per-provider cost sums for summary
  const providerCosts = {};

  for (const r of exp.results) {
    if (!r.usage) continue;
    const newCost = calculateCost(r.provider, r.usage);
    if (newCost === null) continue;

    r.estimatedCost = newCost;

    if (!providerCosts[r.provider]) providerCosts[r.provider] = 0;
    providerCosts[r.provider] += newCost;
  }

  // Update summary totalEstimatedCost per provider
  let totalCost = 0;
  for (const [provider, stats] of Object.entries(exp.summary)) {
    if (provider === "_totalCost") continue;
    if (providerCosts[provider] !== undefined) {
      const rounded = Math.round(providerCosts[provider] * 1_000_000) / 1_000_000;
      stats.totalEstimatedCost = rounded;
      totalCost += rounded;
    }
  }
  exp.summary._totalCost = Math.round(totalCost * 1_000_000) / 1_000_000;

  fs.writeFileSync(filePath, JSON.stringify(exp, null, 2) + "\n");
  totalPatched++;
  console.log(`${f} — patched (${Object.keys(providerCosts).join(", ")})`);
}

console.log(`\nDone. Patched ${totalPatched} experiment files with current pricing.`);
