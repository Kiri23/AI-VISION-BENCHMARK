const gemini = require('./gemini');
const openai = require('./openai');
const claude = require('./claude');

const providers = [
  gemini,
  // openai,
  // claude,
];

module.exports = providers;
