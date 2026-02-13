const fs = require("fs");
const path = require("path");

const EXPERIMENTS_DIR = path.join(__dirname, "results", "experiments");

function computeSummary(matrixResults) {
  const byProvider = {};

  for (const r of matrixResults) {
    if (!byProvider[r.provider]) {
      byProvider[r.provider] = {
        totalCorrect: 0,
        totalFields: 0,
        totalDurationMs: 0,
        imagesProcessed: 0,
      };
    }

    const entry = byProvider[r.provider];

    if (r.status === "OK" && r.comparison) {
      entry.totalCorrect += r.comparison.correctCount;
      entry.totalFields += r.comparison.totalFields;
      entry.totalDurationMs += r.durationMs || 0;
      entry.imagesProcessed++;
    }
  }

  const summary = {};
  for (const [provider, data] of Object.entries(byProvider)) {
    summary[provider] = {
      avgAccuracy: data.totalFields > 0 ? data.totalCorrect / data.totalFields : 0,
      totalCorrect: data.totalCorrect,
      totalFields: data.totalFields,
      avgDurationMs:
        data.imagesProcessed > 0
          ? Math.round(data.totalDurationMs / data.imagesProcessed)
          : 0,
      imagesProcessed: data.imagesProcessed,
    };
  }

  return summary;
}

function generateExperimentId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 16).replace(":", "");
  return `exp-${date}-${time}`;
}

function saveExperiment({ matrixResults, promptName, tag, preprocessing, reportMarkdown, outputDir }) {
  const now = new Date();
  const id = generateExperimentId();
  const dir = outputDir || EXPERIMENTS_DIR;

  const images = [...new Set(matrixResults.map((r) => r.file))];
  const providers = [...new Set(matrixResults.map((r) => r.provider))];
  const summary = computeSummary(matrixResults);

  const experiment = {
    id,
    timestamp: now.toISOString(),
    tag: tag || null,
    promptVersion: promptName,
    preprocessing: preprocessing || "none",
    reportMarkdown: reportMarkdown || null,
    imageCount: images.length,
    images,
    providers,
    results: matrixResults,
    summary,
  };

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(experiment, null, 2));

  return { id, filePath };
}

function loadAllExperiments(dir) {
  const targetDir = dir || EXPERIMENTS_DIR;
  if (!fs.existsSync(targetDir)) return [];

  return fs
    .readdirSync(targetDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const content = fs.readFileSync(path.join(targetDir, f), "utf-8");
      return JSON.parse(content);
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

module.exports = { computeSummary, saveExperiment, loadAllExperiments, EXPERIMENTS_DIR };
