const groundTruth = require('./ground-truth.json');

const COST_TOLERANCE = 0.01;

function compare(filename, apiResult) {
  const truth = groundTruth[filename];
  if (!truth) {
    return { error: `No ground truth for "${filename}"`, client: null, totalFields: 0, correctCount: 0, results: [] };
  }

  const expected = truth.months;
  const actual = apiResult.months || [];

  if (actual.length !== expected.length) {
    return {
      error: `Expected ${expected.length} months, got ${actual.length}`,
      client: truth.client,
      totalFields: expected.length,
      correctCount: 0,
      results: [],
    };
  }

  let correctCount = 0;
  const results = expected.map((exp, i) => {
    const act = actual[i];

    const expMonth = exp.month.trim().toLowerCase();
    const actMonth = (act.month || '').trim().toLowerCase();
    const monthMatch = expMonth.includes(actMonth) || actMonth.includes(expMonth);
    const kwhMatch = exp.kwh === act.kwh;
    const costMatch = Math.abs(exp.costPerKwh - (act.costPerKwh ?? 0)) <= COST_TOLERANCE;

    const allMatch = monthMatch && kwhMatch && costMatch;
    if (allMatch) correctCount++;

    return {
      index: i,
      month: { expected: exp.month, actual: act.month, match: monthMatch },
      kwh: { expected: exp.kwh, actual: act.kwh, match: kwhMatch },
      costPerKwh: { expected: exp.costPerKwh, actual: act.costPerKwh, match: costMatch },
      pass: allMatch,
    };
  });

  return {
    client: truth.client,
    totalFields: expected.length,
    correctCount,
    results,
  };
}

module.exports = { compare };
