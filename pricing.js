// Cost per million tokens (USD) per provider model.
// Source: provider pricing pages as of 2025. Update as needed.
const PRICING = {
  "Gemini 2.0 Flash":        { inputPerMTok: 0.10, outputPerMTok: 0.40 },
  "Gemini 3 Flash (Preview)": { inputPerMTok: 0.50, outputPerMTok: 3.00 },
  "OpenAI GPT-4o":        { inputPerMTok: 2.50, outputPerMTok: 10.00 },
  "OpenAI GPT-4.1 Mini":  { inputPerMTok: 0.40, outputPerMTok: 1.60 },
  "OpenAI GPT-4.1 Nano":  { inputPerMTok: 0.10, outputPerMTok: 0.40 },
  "OpenAI GPT-5.2":       { inputPerMTok: 1.75, outputPerMTok: 14.00 },
  "Claude Sonnet 4.5":    { inputPerMTok: 3.00, outputPerMTok: 15.00 },
};

function calculateCost(providerName, usage) {
  if (!usage) return null;
  const pricing = PRICING[providerName];
  if (!pricing) return null;

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMTok;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMTok;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // avoid floating point noise
}

module.exports = { PRICING, calculateCost };
