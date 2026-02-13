const EXTRACTION_PROMPT =
  'This is a LUMA/AEE electricity bill PDF. Focus ONLY on the "HISTORIAL DE CONSUMO (KWH)" page ' +
  'which shows 13 months of data in two charts: a kWh bar chart and a "Costo por kWh" line chart. ' +
  'Ignore all other pages. For each of the 13 months, read the exact number printed above each bar ' +
  'in the kWh chart (do NOT estimate from bar height) and the exact dollar amount printed above ' +
  'the cost line chart. Return the month label exactly as shown (e.g. "ene-25", "feb", "mar"). ' +
  'Return all 13 months in left-to-right chronological order.';

module.exports = { name: 'v1', EXTRACTION_PROMPT };
