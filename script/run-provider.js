// run the images folder with a single provider
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { compare } = require('../compare');
const { calculateCost } = require('../pricing');
const { promptName } = require('../prompt');
const groundTruth = require('../ground-truth.json');

const SAMPLE_DIR = path.join(__dirname, '..', 'sample');

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
};

const PROVIDERS = {
  gemini: () => require('../providers/gemini'),
  'gemini-2.5': () => require('../providers/gemini-2.5-flash'),
  'gemini-3': () => require('../providers/gemini-3-flash'),
  openai: () => require('../providers/openai'),
  'openai-4.1-mini': () => require('../providers/openai-4.1-mini'),
  'openai-4.1-nano': () => require('../providers/openai-4.1-nano'),
  'openai-5.2': () => require('../providers/openai-5.2'),
  claude: () => require('../providers/claude'),
};

const positionalArgs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const [providerArg] = positionalArgs;

if (!providerArg) {
  console.log('Usage: node run-provider.js <provider> [--prompt=vN]');
  console.log('');
  console.log('Runs all sample images against a single provider.');
  console.log('');
  console.log('Providers:', Object.keys(PROVIDERS).join(', '));
  console.log('Options:   --prompt=vN  use a specific prompt version (default: latest)');
  console.log('');
  console.log('Examples:');
  console.log('  node run-provider.js gemini-2.5');
  console.log('  node run-provider.js claude --prompt=v1');
  process.exit(0);
}

const loaderFn = PROVIDERS[providerArg.toLowerCase()];
if (!loaderFn) {
  console.error(`Unknown provider "${providerArg}". Available: ${Object.keys(PROVIDERS).join(', ')}`);
  process.exit(1);
}

(async () => {
  const provider = loaderFn();
  const files = Object.keys(groundTruth);
  let totalCorrect = 0;
  let totalFields = 0;
  let totalCost = 0;
  let processed = 0;
  let errors = 0;

  console.log(`Provider: ${provider.name} | Prompt: ${promptName}\n`);

  for (const file of files) {
    if (groundTruth[file].skip) {
      console.log(`SKIP: ${file} (marked skip)`);
      continue;
    }

    const filePath = path.join(SAMPLE_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP: ${file} (not found)`);
      continue;
    }

    const ext = path.extname(file).toLowerCase();
    const mimeType = MIME_MAP[ext];
    if (!mimeType) {
      console.log(`SKIP: ${file} (unsupported extension "${ext}")`);
      continue;
    }

    process.stdout.write(`${file} ... `);
    const start = Date.now();

    try {
      const result = await provider.extract(filePath, mimeType);
      const ms = Date.now() - start;
      const comparison = compare(file, result);
      const usage = result.usage || null;
      const cost = calculateCost(provider.name, usage);

      if (cost != null) totalCost += cost;
      const costStr = cost != null ? ` · $${cost.toFixed(6)}` : '';

      if (comparison.chartComplete === false) {
        console.log(`INCOMPLETE (${ms}ms${costStr})`);
      } else {
        console.log(`${comparison.correctCount}/${comparison.totalFields} (${ms}ms${costStr})`);
        totalCorrect += comparison.correctCount;
        totalFields += comparison.totalFields;
      }
      processed++;
    } catch (err) {
      const ms = Date.now() - start;
      console.log(`ERROR: ${err.message} (${ms}ms)`);
      errors++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Processed: ${processed} | Errors: ${errors}`);
  if (totalFields > 0) {
    const pct = ((totalCorrect / totalFields) * 100).toFixed(1);
    console.log(`Accuracy: ${totalCorrect}/${totalFields} (${pct}%)`);
  }
  console.log(`Total cost: $${totalCost.toFixed(6)}`);
})();
