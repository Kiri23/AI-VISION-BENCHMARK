const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const SAMPLE_DIR = path.join(__dirname, '..', '..', 'sample');

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
};

const PROVIDERS = {
  openai: () => require('../providers/openai'),
  gemini: () => require('../providers/gemini'),
  claude: () => require('../providers/claude'),
};

// Separate --flags from positional args
const positionalArgs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const [providerArg, fileArg] = positionalArgs;

if (!providerArg) {
  console.log('Usage: node run-single.js <provider> [file] [--prompt=vN]');
  console.log('');
  console.log('Providers:', Object.keys(PROVIDERS).join(', '));
  console.log('Files:     any file in backend/sample/ (default: lumaBill.pdf)');
  console.log('Options:   --prompt=vN  use a specific prompt version (default: latest)');
  console.log('');
  console.log('Examples:');
  console.log('  node run-single.js openai');
  console.log('  node run-single.js gemini image.png');
  console.log('  node run-single.js claude lumaBill.pdf --prompt=v1');
  process.exit(0);
}

const loaderFn = PROVIDERS[providerArg.toLowerCase()];
if (!loaderFn) {
  console.error(`Unknown provider "${providerArg}". Available: ${Object.keys(PROVIDERS).join(', ')}`);
  process.exit(1);
}

const file = fileArg || 'lumaBill.pdf';
const filePath = path.join(SAMPLE_DIR, file);
const ext = path.extname(file).toLowerCase();
const mimeType = MIME_MAP[ext];

if (!mimeType) {
  console.error(`Unsupported extension "${ext}"`);
  process.exit(1);
}

const { promptName } = require('../prompt');

(async () => {
  const provider = loaderFn();
  console.log(`Running: ${file} × ${provider.name} (prompt: ${promptName})...`);
  const start = Date.now();

  try {
    const result = await provider.extract(filePath, mimeType);
    const ms = Date.now() - start;
    console.log(`Done in ${ms}ms\n`);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`ERROR after ${ms}ms: ${err.message}`);
    process.exit(1);
  }
})();
