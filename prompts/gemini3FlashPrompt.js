const EXTRACTION_PROMPT =
  'Extract 13 months of kWh consumption and cost-per-kWh data from this LUMA/AEE electricity bill image.\n\n' +
  'The page has two charts stacked vertically sharing 13 month labels on the X axis:\n' +
  '- Top: "Consumo kWh" bar chart — integer value printed above each bar\n' +
  '- Bottom: "Costo por kWh" line chart — dollar value (format "$X.XX") printed above each point\n\n' +
  'If any values are hard to read (small text, shadows, angles), use code execution to zoom into that region and inspect it.\n\n' +
  'Read the printed values exactly — do not estimate from bar heights or line positions.\n' +
  'Match each cost to its correct month by vertical alignment with the bar above.\n' +
  'Set "chartComplete" to false if any bars or labels are cut off or missing.\n\n' +
  'Return all 13 months left to right, using month labels exactly as shown.';

module.exports = { name: 'gemini3-flash', EXTRACTION_PROMPT };
