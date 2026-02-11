function generateReport(matrixResults) {
  const lines = [];
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

  lines.push('# LUMA kWh Extraction — Test Matrix Report');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');

  // --- Summary Table ---
  lines.push('## Summary');
  lines.push('');

  const providerNames = [...new Set(matrixResults.map((r) => r.provider))];
  const files = [...new Set(matrixResults.map((r) => r.file))];

  const headerCols = ['File', 'Client', ...providerNames];
  lines.push('| ' + headerCols.join(' | ') + ' |');
  lines.push('| ' + headerCols.map(() => '---').join(' | ') + ' |');

  for (const file of files) {
    const fileResults = matrixResults.filter((r) => r.file === file);
    const client = fileResults[0]?.comparison?.client || '—';
    const cells = [file, client];

    for (const provName of providerNames) {
      const result = fileResults.find((r) => r.provider === provName);
      if (!result) {
        cells.push('—');
      } else if (result.status === 'SKIPPED') {
        cells.push('SKIPPED');
      } else if (result.status === 'ERROR') {
        cells.push('ERROR');
      } else {
        const c = result.comparison;
        cells.push(`${c.correctCount}/${c.totalFields} (${result.durationMs}ms)`);
      }
    }

    lines.push('| ' + cells.join(' | ') + ' |');
  }

  lines.push('');

  // --- Detail Sections ---
  lines.push('## Details');
  lines.push('');

  for (const result of matrixResults) {
    lines.push(`### ${result.file} — ${result.provider}`);
    lines.push('');

    if (result.status === 'SKIPPED') {
      lines.push('> SKIPPED: API key not configured');
      lines.push('');
      continue;
    }

    if (result.status === 'ERROR') {
      lines.push(`> ERROR: ${result.error}`);
      lines.push('');
      continue;
    }

    const c = result.comparison;

    if (c.error) {
      lines.push(`> ${c.error}`);
      lines.push('');
      continue;
    }

    lines.push(`Client: **${c.client}** | Score: **${c.correctCount}/${c.totalFields}** | Duration: ${result.durationMs}ms`);
    lines.push('');
    lines.push('| # | Month (exp) | Month (act) | M | kWh (exp) | kWh (act) | K | Cost (exp) | Cost (act) | C | Result |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');

    for (const r of c.results) {
      const mIcon = r.month.match ? 'OK' : 'FAIL';
      const kIcon = r.kwh.match ? 'OK' : 'FAIL';
      const cIcon = r.costPerKwh.match ? 'OK' : 'FAIL';
      const rowResult = r.pass ? 'PASS' : 'FAIL';

      lines.push(
        `| ${r.index} | ${r.month.expected} | ${r.month.actual} | ${mIcon} | ${r.kwh.expected} | ${r.kwh.actual} | ${kIcon} | ${r.costPerKwh.expected} | ${r.costPerKwh.actual} | ${cIcon} | **${rowResult}** |`
      );
    }

    lines.push('');
  }

  return lines.join('\n');
}

module.exports = { generateReport };
