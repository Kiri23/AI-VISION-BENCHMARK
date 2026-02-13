const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { computeSummary, saveExperiment, loadAllExperiments } = require("../experiment-log");

describe("computeSummary()", () => {
  it("computes avgAccuracy per provider correctly", () => {
    const matrixResults = [
      {
        file: "a.png",
        provider: "ProviderA",
        status: "OK",
        durationMs: 1000,
        comparison: { correctCount: 10, totalFields: 13 },
      },
      {
        file: "b.png",
        provider: "ProviderA",
        status: "OK",
        durationMs: 2000,
        comparison: { correctCount: 13, totalFields: 13 },
      },
    ];

    const summary = computeSummary(matrixResults);
    assert.equal(summary["ProviderA"].totalCorrect, 23);
    assert.equal(summary["ProviderA"].totalFields, 26);
    assert.ok(
      Math.abs(summary["ProviderA"].avgAccuracy - 23 / 26) < 0.0001,
    );
    assert.equal(summary["ProviderA"].avgDurationMs, 1500);
    assert.equal(summary["ProviderA"].imagesProcessed, 2);
  });

  it("counts images processed per provider", () => {
    const matrixResults = [
      {
        file: "a.png",
        provider: "P1",
        status: "OK",
        durationMs: 500,
        comparison: { correctCount: 5, totalFields: 13 },
      },
      {
        file: "b.png",
        provider: "P1",
        status: "OK",
        durationMs: 700,
        comparison: { correctCount: 8, totalFields: 13 },
      },
      {
        file: "a.png",
        provider: "P2",
        status: "OK",
        durationMs: 1000,
        comparison: { correctCount: 13, totalFields: 13 },
      },
    ];

    const summary = computeSummary(matrixResults);
    assert.equal(summary["P1"].imagesProcessed, 2);
    assert.equal(summary["P2"].imagesProcessed, 1);
  });

  it("handles errors and skipped results gracefully", () => {
    const matrixResults = [
      {
        file: "a.png",
        provider: "P1",
        status: "OK",
        durationMs: 1000,
        comparison: { correctCount: 10, totalFields: 13 },
      },
      {
        file: "b.png",
        provider: "P1",
        status: "ERROR",
        durationMs: 500,
        error: "API timeout",
        comparison: { client: "TestClient" },
      },
      {
        file: "c.png",
        provider: "P1",
        status: "SKIPPED",
        comparison: { client: "TestClient" },
      },
    ];

    const summary = computeSummary(matrixResults);
    // Only the OK result should count
    assert.equal(summary["P1"].imagesProcessed, 1);
    assert.equal(summary["P1"].totalCorrect, 10);
    assert.equal(summary["P1"].totalFields, 13);
  });

  it("handles empty results array", () => {
    const summary = computeSummary([]);
    assert.deepEqual(summary, {});
  });

  it("returns 0 avgAccuracy when all results are errors", () => {
    const matrixResults = [
      {
        file: "a.png",
        provider: "P1",
        status: "ERROR",
        durationMs: 100,
        error: "fail",
        comparison: { client: "X" },
      },
    ];

    const summary = computeSummary(matrixResults);
    assert.equal(summary["P1"].avgAccuracy, 0);
    assert.equal(summary["P1"].imagesProcessed, 0);
  });

  it("handles multiple providers in same results", () => {
    const matrixResults = [
      {
        file: "a.png",
        provider: "Gemini",
        status: "OK",
        durationMs: 1000,
        comparison: { correctCount: 13, totalFields: 13 },
      },
      {
        file: "a.png",
        provider: "OpenAI",
        status: "OK",
        durationMs: 2000,
        comparison: { correctCount: 10, totalFields: 13 },
      },
    ];

    const summary = computeSummary(matrixResults);
    assert.ok(Math.abs(summary["Gemini"].avgAccuracy - 1.0) < 0.0001);
    assert.ok(
      Math.abs(summary["OpenAI"].avgAccuracy - 10 / 13) < 0.0001,
    );
  });

  it("aggregates totalEstimatedCost per provider", () => {
    const matrixResults = [
      {
        file: "a.png",
        provider: "P1",
        status: "OK",
        durationMs: 1000,
        comparison: { correctCount: 13, totalFields: 13 },
        estimatedCost: 0.005,
      },
      {
        file: "b.png",
        provider: "P1",
        status: "OK",
        durationMs: 2000,
        comparison: { correctCount: 10, totalFields: 13 },
        estimatedCost: 0.003,
      },
      {
        file: "a.png",
        provider: "P2",
        status: "OK",
        durationMs: 1500,
        comparison: { correctCount: 12, totalFields: 13 },
        estimatedCost: 0.05,
      },
    ];

    const summary = computeSummary(matrixResults);
    assert.equal(summary["P1"].totalEstimatedCost, 0.008);
    assert.equal(summary["P2"].totalEstimatedCost, 0.05);
    assert.equal(summary._totalCost, 0.058);
  });

  it("totalEstimatedCost is 0 when no cost data present", () => {
    const matrixResults = [
      {
        file: "a.png",
        provider: "P1",
        status: "OK",
        durationMs: 1000,
        comparison: { correctCount: 13, totalFields: 13 },
      },
    ];

    const summary = computeSummary(matrixResults);
    assert.equal(summary["P1"].totalEstimatedCost, 0);
    assert.equal(summary._totalCost, 0);
  });

  it("_totalCost sums across all providers", () => {
    const matrixResults = [
      {
        file: "a.png",
        provider: "P1",
        status: "OK",
        durationMs: 1000,
        comparison: { correctCount: 13, totalFields: 13 },
        estimatedCost: 0.01,
      },
      {
        file: "a.png",
        provider: "P2",
        status: "OK",
        durationMs: 1000,
        comparison: { correctCount: 13, totalFields: 13 },
        estimatedCost: 0.02,
      },
    ];

    const summary = computeSummary(matrixResults);
    assert.equal(summary._totalCost, 0.03);
  });
});

// --- File I/O tests ---

const FAKE_RESULTS = [
  {
    file: "test-image.png",
    provider: "Gemini 2.0 Flash",
    status: "OK",
    durationMs: 3000,
    comparison: { correctCount: 13, totalFields: 13, client: "TestClient" },
  },
  {
    file: "test-image.png",
    provider: "OpenAI GPT-4o",
    status: "OK",
    durationMs: 5000,
    comparison: { correctCount: 10, totalFields: 13, client: "TestClient" },
  },
  {
    file: "test-image2.png",
    provider: "Gemini 2.0 Flash",
    status: "OK",
    durationMs: 2500,
    comparison: { correctCount: 12, totalFields: 13, client: "TestClient2" },
  },
  {
    file: "test-image2.png",
    provider: "OpenAI GPT-4o",
    status: "ERROR",
    durationMs: 1000,
    error: "timeout",
    comparison: { client: "TestClient2" },
  },
];

describe("saveExperiment() — file I/O", () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("creates the experiments directory if it doesn't exist", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);
    assert.equal(fs.existsSync(tmpDir), false);

    saveExperiment({
      matrixResults: FAKE_RESULTS,
      promptName: "v2",
      tag: "test-run",
      outputDir: tmpDir,
    });

    assert.equal(fs.existsSync(tmpDir), true);
  });

  it("creates a .json file on disk", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);

    const { filePath } = saveExperiment({
      matrixResults: FAKE_RESULTS,
      promptName: "v2",
      tag: "fs-test",
      outputDir: tmpDir,
    });

    assert.equal(fs.existsSync(filePath), true);
    assert.ok(filePath.endsWith(".json"));
  });

  it("writes valid parseable JSON", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);

    const { filePath } = saveExperiment({
      matrixResults: FAKE_RESULTS,
      promptName: "v2",
      outputDir: tmpDir,
    });

    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw); // would throw if invalid
    assert.equal(typeof parsed, "object");
    assert.ok(parsed.id);
  });

  it("saved JSON contains all required top-level fields", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);

    const { filePath } = saveExperiment({
      matrixResults: FAKE_RESULTS,
      promptName: "v2",
      tag: "fields-check",
      preprocessing: "sharpen",
      outputDir: tmpDir,
    });

    const exp = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    assert.ok(exp.id, "missing id");
    assert.ok(exp.timestamp, "missing timestamp");
    assert.equal(exp.tag, "fields-check");
    assert.equal(exp.promptVersion, "v2");
    assert.equal(exp.preprocessing, "sharpen");
    assert.equal(exp.imageCount, 2);
    assert.deepEqual(exp.images, ["test-image.png", "test-image2.png"]);
    assert.deepEqual(exp.providers, ["Gemini 2.0 Flash", "OpenAI GPT-4o"]);
    assert.ok(Array.isArray(exp.results), "results should be array");
    assert.equal(exp.results.length, 4);
    assert.ok(typeof exp.summary === "object", "summary should be object");
  });

  it("saved JSON summary has correct computed values", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);

    const { filePath } = saveExperiment({
      matrixResults: FAKE_RESULTS,
      promptName: "v2",
      outputDir: tmpDir,
    });

    const exp = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // Gemini: 13+12=25 correct out of 13+13=26 total, 2 images
    assert.equal(exp.summary["Gemini 2.0 Flash"].totalCorrect, 25);
    assert.equal(exp.summary["Gemini 2.0 Flash"].totalFields, 26);
    assert.equal(exp.summary["Gemini 2.0 Flash"].imagesProcessed, 2);
    assert.equal(exp.summary["Gemini 2.0 Flash"].avgDurationMs, 2750);

    // OpenAI: only 1 OK (10/13), the other was ERROR
    assert.equal(exp.summary["OpenAI GPT-4o"].totalCorrect, 10);
    assert.equal(exp.summary["OpenAI GPT-4o"].totalFields, 13);
    assert.equal(exp.summary["OpenAI GPT-4o"].imagesProcessed, 1);
  });

  it("defaults tag to null and preprocessing to 'none' when omitted", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);

    const { filePath } = saveExperiment({
      matrixResults: FAKE_RESULTS,
      promptName: "v2",
      outputDir: tmpDir,
    });

    const exp = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    assert.equal(exp.tag, null);
    assert.equal(exp.preprocessing, "none");
  });

  it("id follows exp-YYYY-MM-DD-HHMM format", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);

    const { id } = saveExperiment({
      matrixResults: FAKE_RESULTS,
      promptName: "v2",
      outputDir: tmpDir,
    });

    assert.match(id, /^exp-\d{4}-\d{2}-\d{2}-\d{4}$/);
  });

  it("filename matches the returned id", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);

    const { id, filePath } = saveExperiment({
      matrixResults: FAKE_RESULTS,
      promptName: "v2",
      outputDir: tmpDir,
    });

    assert.equal(path.basename(filePath), `${id}.json`);
  });

  it("stores reportMarkdown in the JSON when provided", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);
    const fakeReport = "# Report\n\n| File | Client | Gemini |\n| --- | --- | --- |\n| test.png | C | 13/13 |";

    const { filePath } = saveExperiment({
      matrixResults: FAKE_RESULTS,
      promptName: "v2",
      reportMarkdown: fakeReport,
      outputDir: tmpDir,
    });

    const exp = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    assert.equal(exp.reportMarkdown, fakeReport);
  });

  it("reportMarkdown is null when not provided", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);

    const { filePath } = saveExperiment({
      matrixResults: FAKE_RESULTS,
      promptName: "v2",
      outputDir: tmpDir,
    });

    const exp = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    assert.equal(exp.reportMarkdown, null);
  });
});

describe("loadAllExperiments() — file I/O", () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("returns empty array when directory doesn't exist", () => {
    const result = loadAllExperiments("/tmp/nonexistent-dir-" + Date.now());
    assert.deepEqual(result, []);
  });

  it("loads back the experiment that was saved", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);

    saveExperiment({
      matrixResults: FAKE_RESULTS,
      promptName: "v2",
      tag: "roundtrip",
      outputDir: tmpDir,
    });

    const experiments = loadAllExperiments(tmpDir);
    assert.equal(experiments.length, 1);
    assert.equal(experiments[0].tag, "roundtrip");
    assert.equal(experiments[0].promptVersion, "v2");
    assert.equal(experiments[0].imageCount, 2);
  });

  it("loads multiple experiments sorted by timestamp", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // Write two fake experiment files with different timestamps
    const exp1 = { id: "exp-a", timestamp: "2026-02-13T10:00:00Z", tag: "first" };
    const exp2 = { id: "exp-b", timestamp: "2026-02-13T12:00:00Z", tag: "second" };
    fs.writeFileSync(path.join(tmpDir, "exp-b.json"), JSON.stringify(exp2));
    fs.writeFileSync(path.join(tmpDir, "exp-a.json"), JSON.stringify(exp1));

    const experiments = loadAllExperiments(tmpDir);
    assert.equal(experiments.length, 2);
    assert.equal(experiments[0].tag, "first");
    assert.equal(experiments[1].tag, "second");
  });

  it("ignores non-json files in the directory", () => {
    tmpDir = path.join(os.tmpdir(), `exp-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    fs.writeFileSync(path.join(tmpDir, "notes.txt"), "not an experiment");
    fs.writeFileSync(
      path.join(tmpDir, "exp-001.json"),
      JSON.stringify({ id: "exp-001", timestamp: "2026-01-01T00:00:00Z" }),
    );

    const experiments = loadAllExperiments(tmpDir);
    assert.equal(experiments.length, 1);
    assert.equal(experiments[0].id, "exp-001");
  });
});
