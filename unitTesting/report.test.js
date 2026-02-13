const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { generateReport, archiveReport } = require("../report");

// A minimal report that matches what generateReport produces,
// with the header patterns that archiveReport parses.
function makeFakeReport({ promptName, providerNames }) {
  const lines = [];
  lines.push("# LUMA kWh Extraction — Test Matrix Report");
  lines.push("");
  lines.push("Generated: 2026-02-13 17:00:00");
  lines.push(`Prompt: **${promptName}**`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  const headerCols = ["File", "Client", ...providerNames];
  lines.push("| " + headerCols.join(" | ") + " |");
  lines.push("| " + headerCols.map(() => "---").join(" | ") + " |");
  lines.push("| test.png | TestClient | 13/13 (1000ms) |");
  return lines.join("\n");
}

describe("archiveReport()", () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("returns null when report.md does not exist", () => {
    tmpDir = path.join(os.tmpdir(), `report-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const result = archiveReport(
      path.join(tmpDir, "report.md"),
      path.join(tmpDir, "archive"),
    );
    assert.equal(result, null);
  });

  it("creates the archive directory if it doesn't exist", () => {
    tmpDir = path.join(os.tmpdir(), `report-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const reportPath = path.join(tmpDir, "report.md");
    const archiveDir = path.join(tmpDir, "archive");
    fs.writeFileSync(reportPath, makeFakeReport({ promptName: "v2", providerNames: ["Gemini 2.0 Flash"] }));

    assert.equal(fs.existsSync(archiveDir), false);
    archiveReport(reportPath, archiveDir);
    assert.equal(fs.existsSync(archiveDir), true);
  });

  it("moves report.md into archive (original gone, archive file exists)", () => {
    tmpDir = path.join(os.tmpdir(), `report-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const reportPath = path.join(tmpDir, "report.md");
    const archiveDir = path.join(tmpDir, "archive");
    fs.writeFileSync(reportPath, makeFakeReport({ promptName: "v2", providerNames: ["Gemini 2.0 Flash"] }));

    const archivePath = archiveReport(reportPath, archiveDir);

    assert.equal(fs.existsSync(reportPath), false, "original report.md should be gone");
    assert.ok(archivePath);
    assert.equal(fs.existsSync(archivePath), true, "archived file should exist");
  });

  it("archive filename contains the prompt version from the report", () => {
    tmpDir = path.join(os.tmpdir(), `report-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const reportPath = path.join(tmpDir, "report.md");
    const archiveDir = path.join(tmpDir, "archive");
    fs.writeFileSync(reportPath, makeFakeReport({ promptName: "v3", providerNames: ["Gemini 2.0 Flash"] }));

    const archivePath = archiveReport(reportPath, archiveDir);
    const filename = path.basename(archivePath);

    assert.ok(filename.includes("v3"), `expected "v3" in filename, got: ${filename}`);
  });

  it("archive filename contains the provider model name", () => {
    tmpDir = path.join(os.tmpdir(), `report-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const reportPath = path.join(tmpDir, "report.md");
    const archiveDir = path.join(tmpDir, "archive");
    fs.writeFileSync(reportPath, makeFakeReport({ promptName: "v2", providerNames: ["Gemini 2.0 Flash"] }));

    const archivePath = archiveReport(reportPath, archiveDir);
    const filename = path.basename(archivePath);

    // The logic takes the first word of each provider, lowercased → "gemini"
    assert.ok(filename.includes("gemini"), `expected "gemini" in filename, got: ${filename}`);
  });

  it("archive filename contains multiple providers joined with dash", () => {
    tmpDir = path.join(os.tmpdir(), `report-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const reportPath = path.join(tmpDir, "report.md");
    const archiveDir = path.join(tmpDir, "archive");
    fs.writeFileSync(
      reportPath,
      makeFakeReport({ promptName: "v2", providerNames: ["Gemini 2.0 Flash", "OpenAI GPT-4o"] }),
    );

    const archivePath = archiveReport(reportPath, archiveDir);
    const filename = path.basename(archivePath);

    assert.ok(filename.includes("gemini-openai"), `expected "gemini-openai" in filename, got: ${filename}`);
  });

  it("archive filename ends with -report.md", () => {
    tmpDir = path.join(os.tmpdir(), `report-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const reportPath = path.join(tmpDir, "report.md");
    const archiveDir = path.join(tmpDir, "archive");
    fs.writeFileSync(reportPath, makeFakeReport({ promptName: "v2", providerNames: ["Gemini 2.0 Flash"] }));

    const archivePath = archiveReport(reportPath, archiveDir);
    assert.ok(archivePath.endsWith("-report.md"));
  });

  it("archive filename contains a date portion (YYYY-MM-DD)", () => {
    tmpDir = path.join(os.tmpdir(), `report-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const reportPath = path.join(tmpDir, "report.md");
    const archiveDir = path.join(tmpDir, "archive");
    fs.writeFileSync(reportPath, makeFakeReport({ promptName: "v2", providerNames: ["Gemini 2.0 Flash"] }));

    const archivePath = archiveReport(reportPath, archiveDir);
    const filename = path.basename(archivePath);

    assert.match(filename, /^\d{4}-\d{2}-\d{2}-\d{4}/);
  });

  it("falls back to 'unknown' when report has no parseable header", () => {
    tmpDir = path.join(os.tmpdir(), `report-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const reportPath = path.join(tmpDir, "report.md");
    const archiveDir = path.join(tmpDir, "archive");
    fs.writeFileSync(reportPath, "# Just some markdown\n\nNo tables here.");

    const archivePath = archiveReport(reportPath, archiveDir);
    const filename = path.basename(archivePath);

    assert.ok(filename.includes("unknown"), `expected "unknown" in filename for unparseable report, got: ${filename}`);
  });

  it("archived file content matches the original report content", () => {
    tmpDir = path.join(os.tmpdir(), `report-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const reportPath = path.join(tmpDir, "report.md");
    const archiveDir = path.join(tmpDir, "archive");
    const content = makeFakeReport({ promptName: "v2", providerNames: ["Gemini 2.0 Flash"] });
    fs.writeFileSync(reportPath, content);

    const archivePath = archiveReport(reportPath, archiveDir);
    const archivedContent = fs.readFileSync(archivePath, "utf-8");

    assert.equal(archivedContent, content);
  });
});

describe("generateReport()", () => {
  it("produces markdown with prompt name in header", () => {
    const results = [
      {
        file: "test.png",
        provider: "TestProvider",
        status: "OK",
        durationMs: 100,
        comparison: {
          client: "Client1",
          correctCount: 13,
          totalFields: 13,
          results: [],
        },
      },
    ];

    const report = generateReport(results, "v2");
    assert.ok(report.includes("Prompt: **v2**"));
  });

  it("includes provider names in summary table header", () => {
    const results = [
      {
        file: "test.png",
        provider: "Gemini 2.0 Flash",
        status: "OK",
        durationMs: 100,
        comparison: { client: "C", correctCount: 13, totalFields: 13, results: [] },
      },
      {
        file: "test.png",
        provider: "OpenAI GPT-4o",
        status: "OK",
        durationMs: 200,
        comparison: { client: "C", correctCount: 10, totalFields: 13, results: [] },
      },
    ];

    const report = generateReport(results, "v2");
    assert.ok(report.includes("| File | Client | Gemini 2.0 Flash | OpenAI GPT-4o |"));
  });

  it("includes experiment ID in markdown when provided", () => {
    const results = [
      {
        file: "test.png",
        provider: "TestProvider",
        status: "OK",
        durationMs: 100,
        comparison: { client: "C", correctCount: 13, totalFields: 13, results: [] },
      },
    ];

    const report = generateReport(results, "v2", "exp-2026-02-13-1700");
    assert.ok(report.includes("Experiment: **exp-2026-02-13-1700**"));
  });

  it("omits experiment line when no ID provided", () => {
    const results = [
      {
        file: "test.png",
        provider: "TestProvider",
        status: "OK",
        durationMs: 100,
        comparison: { client: "C", correctCount: 13, totalFields: 13, results: [] },
      },
    ];

    const report = generateReport(results, "v2");
    assert.equal(report.includes("Experiment:"), false);
  });
});

describe("bidirectional pairing — report <-> experiment", () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("experiment JSON contains the report markdown with its own ID embedded", () => {
    const { generateExperimentId, saveExperiment } = require("../experiment-log");
    tmpDir = path.join(os.tmpdir(), `pair-test-${Date.now()}`);

    const fakeResults = [
      {
        file: "test.png",
        provider: "Gemini",
        status: "OK",
        durationMs: 100,
        comparison: { client: "C", correctCount: 13, totalFields: 13, results: [] },
      },
    ];

    // Same flow as run-matrix.js: generate ID, pass to both
    const expId = generateExperimentId();
    const report = generateReport(fakeResults, "v2", expId);
    const { filePath } = saveExperiment({
      id: expId,
      matrixResults: fakeResults,
      promptName: "v2",
      reportMarkdown: report,
      outputDir: tmpDir,
    });

    const exp = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // report markdown contains the experiment ID
    assert.ok(exp.reportMarkdown.includes(`Experiment: **${expId}**`));
    // experiment ID matches
    assert.equal(exp.id, expId);
  });
});
