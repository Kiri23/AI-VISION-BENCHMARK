const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const providers = require("./providers");
const { compare } = require("./compare");
const { generateReport } = require("./report");
const { promptName } = require("./prompt");
const groundTruth = require("./ground-truth.json");

const SAMPLE_DIR = path.join(__dirname, "..", "sample");
const RESULTS_DIR = path.join(__dirname, "results");

const MIME_MAP = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
};

const API_KEY_MAP = {
  "Gemini 2.0 Flash": "GEMINI_API_KEY",
  "OpenAI GPT-4o": "OPENAI_API_KEY",
  "Claude Sonnet 4.5": "ANTHROPIC_API_KEY",
};

async function run() {
  const files = Object.keys(groundTruth);
  const matrixResults = [];

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

      console.log(`Running: ${file} × ${provider.name}...`);
      const start = Date.now();

      try {
        const result = await provider.extract(filePath, mimeType);
        const durationMs = Date.now() - start;
        const comparison = compare(file, result);

        matrixResults.push({
          file,
          provider: provider.name,
          status: "OK",
          durationMs,
          comparison,
        });

        console.log(
          `  → ${comparison.correctCount}/${comparison.totalFields} correct (${durationMs}ms)`,
        );
      } catch (err) {
        const durationMs = Date.now() - start;
        matrixResults.push({
          file,
          provider: provider.name,
          status: "ERROR",
          durationMs,
          error: err.message,
          comparison: { client: groundTruth[file]?.client || null },
        });
        console.log(`  → ERROR: ${err.message} (${durationMs}ms)`);
      }
    }
  }

  const report = generateReport(matrixResults, promptName);

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const reportPath = path.join(RESULTS_DIR, "report.md");

  // Archive previous report if it exists
  if (fs.existsSync(reportPath)) {
    const archiveDir = path.join(RESULTS_DIR, "archive");
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    const stat = fs.statSync(reportPath);
    const d = stat.mtime;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
    // Extract providers from the previous report's summary table header
    const prevContent = fs.readFileSync(reportPath, "utf-8");
    const headerMatch = prevContent.match(/\| File \| Client \|(.+)\|/);
    let modelStr = "unknown";
    if (headerMatch) {
      modelStr = headerMatch[1]
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => name.split(" ")[0].toLowerCase())
        .join("-");
    }
    // Extract prompt version from the previous report
    const promptMatch = prevContent.match(/Prompt: \*\*(.+?)\*\*/);
    const prevPrompt = promptMatch ? promptMatch[1] : 'unknown';
    fs.renameSync(reportPath, path.join(archiveDir, `${dateStr}-${timeStr}-${prevPrompt}-${modelStr}-report.md`));
  }

  fs.writeFileSync(reportPath, report);
  console.log(`\nReport written to: ${reportPath}\n`);
  console.log(report);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
