const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, 'prompts');

function loadPrompt(version) {
  if (version) {
    return require(path.join(PROMPTS_DIR, `${version}.js`));
  }
  // Default: find latest version file (highest number)
  const files = fs.readdirSync(PROMPTS_DIR)
    .filter(f => /^v\d+\.js$/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numB - numA;
    });
  return require(path.join(PROMPTS_DIR, files[0]));
}

// Parse --prompt=vN from process.argv
const promptArg = process.argv.find(a => a.startsWith('--prompt='));
const version = promptArg ? promptArg.split('=')[1] : null;
const prompt = loadPrompt(version);

module.exports = { EXTRACTION_PROMPT: prompt.EXTRACTION_PROMPT, promptName: prompt.name };
