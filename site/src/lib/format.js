/** @param {number} x */
export const percent = (x) => `${x.toFixed(1)}%`;

/** Small amounts keep four decimals so $0.0009 doesn't round to $0.00. @param {number} x */
export const dollars = (x) => (x < 1 ? `$${x.toFixed(4)}` : `$${Math.round(x).toLocaleString('en-US')}`);

/** "OpenAI GPT-5.2" → "GPT-5.2". @param {string} name */
export const shortName = (name) => name.replace(/^(OpenAI|Claude) /, (m) => (m === 'Claude ' ? m : ''));
