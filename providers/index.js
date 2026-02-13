const gemini = require('./gemini');
const gemini3Flash = require('./gemini-3-flash');
const openai = require('./openai');
const openai41Mini = require('./openai-4.1-mini');
const openai41Nano = require('./openai-4.1-nano');
const openai52 = require('./openai-5.2');
const claude = require('./claude');

const providers = [
  gemini,
  gemini3Flash,
  // openai,
  openai41Mini,
  // openai41Nano,
  openai52,
  claude,
];

module.exports = providers;
