function generateReport(matrixResults, promptName, experimentId) {
  const lines = [];
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

  lines.push('# LUMA kWh Extraction — Test Matrix Report');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push(`Prompt: **${promptName}**`);
  if (experimentId) {
    lines.push(`Experiment: **${experimentId}**`);
  }
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
        const costStr = result.estimatedCost != null ? ` · $${result.estimatedCost.toFixed(4)}` : '';
        cells.push(`${c.correctCount}/${c.totalFields} (${result.durationMs}ms${costStr})`);
      }
    }

    lines.push('| ' + cells.join(' | ') + ' |');
  }

  // Cost totals per provider
  const costTotals = {};
  for (const r of matrixResults) {
    if (r.estimatedCost != null) {
      costTotals[r.provider] = (costTotals[r.provider] || 0) + r.estimatedCost;
    }
  }

  if (Object.keys(costTotals).length > 0) {
    lines.push('');
    lines.push('**Estimated cost:**');
    let grandTotal = 0;
    for (const provName of providerNames) {
      if (costTotals[provName] != null) {
        lines.push(`- ${provName}: $${costTotals[provName].toFixed(4)}`);
        grandTotal += costTotals[provName];
      }
    }
    lines.push(`- **Total: $${grandTotal.toFixed(4)}**`);
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

    if (c.warning) {
      lines.push(`> WARNING: ${c.warning}`);
      lines.push('');
      continue;
    }

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

function archiveReport(reportPath, archiveDir) {
  const fs = require('fs');
  const path = require('path');

  if (!fs.existsSync(reportPath)) return null;

  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const stat = fs.statSync(reportPath);
  const d = stat.mtime;
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;

  const prevContent = fs.readFileSync(reportPath, 'utf-8');
  const headerMatch = prevContent.match(/\| File \| Client \|(.+)\|/);
  let modelStr = 'unknown';
  if (headerMatch) {
    modelStr = headerMatch[1]
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => name.split(' ')[0].toLowerCase())
      .join('-');
  }

  const promptMatch = prevContent.match(/Prompt: \*\*(.+?)\*\*/);
  const prevPrompt = promptMatch ? promptMatch[1] : 'unknown';

  const archiveName = `${dateStr}-${timeStr}-${prevPrompt}-${modelStr}-report.md`;
  const archivePath = path.join(archiveDir, archiveName);
  fs.renameSync(reportPath, archivePath);

  return archivePath;
}

module.exports = { generateReport, archiveReport };
