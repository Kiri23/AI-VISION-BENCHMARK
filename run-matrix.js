const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const providers = require("./providers");
const { compare } = require("./compare");
const { generateReport, archiveReport } = require("./report");
const { promptName } = require("./prompt");
const { generateExperimentId, saveExperiment } = require("./experiment-log");
const { calculateCost } = require("./pricing");
const groundTruth = require("./ground-truth.json");

// Parse CLI flags
const tagArg = process.argv.find((a) => a.startsWith("--tag="));
const preprocArg = process.argv.find((a) => a.startsWith("--preprocessing="));
const imageCount = Object.keys(groundTruth).filter((f) => !groundTruth[f].skip).length;
const experimentTag = tagArg ? tagArg.split("=")[1] : `${promptName}-${imageCount}img`;
const experimentPreprocessing = preprocArg ? preprocArg.split("=")[1] : "none";

const SAMPLE_DIR = path.join(__dirname, "sample");
const RESULTS_DIR = path.join(__dirname, "results");

const MIME_MAP = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
};

const API_KEY_MAP = {
  "Gemini 2.0 Flash": "GEMINI_API_KEY",
  "Gemini 2.5 Flash": "GEMINI_API_KEY",
  "Gemini 3 Flash (Preview)": "GEMINI_API_KEY",
  "OpenAI GPT-4o": "OPENAI_API_KEY",
  "OpenAI GPT-4.1 Mini": "OPENAI_API_KEY",
  "OpenAI GPT-4.1 Nano": "OPENAI_API_KEY",
  "OpenAI GPT-5.2": "OPENAI_API_KEY",
  "Claude Sonnet 4.5": "ANTHROPIC_API_KEY",
};

async function runOne(file, provider, filePath, mimeType) {
  console.log(`Running: ${file} × ${provider.name}...`);
  const start = Date.now();

  try {
    const result = await provider.extract(filePath, mimeType);
    const durationMs = Date.now() - start;
    const comparison = compare(file, result);
    const usage = result.usage || null;
    const estimatedCost = calculateCost(provider.name, usage);

    const costStr = estimatedCost != null ? ` $${estimatedCost.toFixed(6)}` : '';
    console.log(
      `  → ${file} × ${provider.name}: ${comparison.correctCount}/${comparison.totalFields} correct (${durationMs}ms)${costStr}`,
    );

    return {
      file,
      provider: provider.name,
      status: "OK",
      durationMs,
      comparison,
      usage,
      estimatedCost,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    console.log(`  → ${file} × ${provider.name}: ERROR: ${err.message} (${durationMs}ms)`);
    return {
      file,
      provider: provider.name,
      status: "ERROR",
      durationMs,
      error: err.message,
      comparison: { client: groundTruth[file]?.client || null },
    };
  }
}

async function run() {
  const files = Object.keys(groundTruth);
  const matrixResults = [];
  const tasks = [];

  for (const file of files) {
    const filePath = path.join(SAMPLE_DIR, file);
    const ext = path.extname(file).toLowerCase();
    const mimeType = MIME_MAP[ext];

    if (groundTruth[file].skip) {
      console.log(`SKIP: ${file} (marked skip in ground-truth.json)`);
      continue;
    }

    if (!fs.existsSync(filePath)) {
      console.log(`SKIP: ${file} not found in ${SAMPLE_DIR}`);
      continue;
    }

    if (!mimeType) {
      console.log(`SKIP: ${file} — unsupported extension "${ext}"`);
      continue;
    }

    for (const provider of providers) {
      const envVar = API_KEY_MAP[provider.name];
      if (envVar && !process.env[envVar]) {
        console.log(`SKIP: ${provider.name} — ${envVar} not set`);
        matrixResults.push({
          file,
          provider: provider.name,
          status: "SKIPPED",
          comparison: { client: groundTruth[file]?.client || null },
        });
        continue;
      }

      tasks.push(runOne(file, provider, filePath, mimeType));
    }
  }

  const results = await Promise.all(tasks);
  matrixResults.push(...results);

  const experimentId = generateExperimentId();
  const report = generateReport(matrixResults, promptName, experimentId);

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const reportPath = path.join(RESULTS_DIR, "report.md");
  const archiveDir = path.join(RESULTS_DIR, "archive");
  archiveReport(reportPath, archiveDir);

  fs.writeFileSync(reportPath, report);
  console.log(`\nReport written to: ${reportPath}\n`);
  console.log(report);

  // Save structured experiment log
  const { id, filePath: expPath } = saveExperiment({
    id: experimentId,
    matrixResults,
    promptName,
    tag: experimentTag,
    preprocessing: experimentPreprocessing,
    reportMarkdown: report,
  });
  console.log(`Experiment log saved: ${expPath} (${id})\n`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
