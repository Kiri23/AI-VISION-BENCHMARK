const EXTRACTION_PROMPT =
  'Extract data from a LUMA/AEE electricity bill. Focus ONLY on the "HISTORIAL DE CONSUMO (KWH)" page ' +
  'which has two charts stacked vertically, sharing the same 13 month labels on the X axis.\n\n' +
  'CHART 1 (top) — "Consumo kWh": A bar chart. Each bar has an exact integer printed above it.\n' +
  'CHART 2 (bottom) — "Costo por kWh": A line chart. Each data point has an exact dollar value (format "$X.XX") printed above it.\n\n' +
  'Instructions:\n' +
  '1. Identify all 13 month labels on the X axis, left to right (e.g. "ene-25", "feb", "mar", ...).\n' +
  '2. For each month, read the integer printed above the bar in Chart 1 — this is the kWh value. Do NOT estimate from bar height.\n' +
  '3. For each month, read the dollar value printed above the corresponding point in Chart 2 — this is the costPerKwh. Do NOT estimate from the line\'s vertical position. Values are typically between $0.20 and $0.30.\n' +
  '4. CRITICAL: Match each cost to its correct month by vertical alignment with the bars above. Adjacent months may have very similar costs (e.g. $0.25 vs $0.26) — read each label individually.\n' +
  '5. Before extracting, verify the chart is complete: all 13 month bars and their labels must be fully visible. Set "chartComplete" to false if any bars or labels are cut off, cropped, or missing.\n\n' +
  'Return all 13 months in chronological order (left to right). Use month labels exactly as shown.';

module.exports = { name: 'v2', EXTRACTION_PROMPT };
