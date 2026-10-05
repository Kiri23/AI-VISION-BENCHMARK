/**
 * Builds site/src/lib/data/results.json from the experiment logs in results/experiments/.
 *
 * results/ is gitignored, so this only runs on a machine that has the logs. The JSON it
 * writes is committed, and the site builds from it alone.
 *
 * Usage: node script/export-site-data.js
 */
const fs = require("fs");
const path = require("path");

const EXPERIMENTS = path.join(__dirname, "..", "results", "experiments");
const OUT_DATA = path.join(__dirname, "..", "site", "src", "lib", "data", "results.json");
const OUT_RAW = path.join(__dirname, "..", "site", "static", "data");

const FINAL = "exp-2026-02-17-1657-100img.json";
const NO_PREPROCESSING = "exp-2026-02-18-1523.json";
const ALL_PROVIDERS = "exp-2026-02-17-1543.json";
const PREPROCESSING = [
  ["None", "exp-2026-02-13-2323.json"],
  ["Perspective warp", "exp-2026-02-14-0059.json"],
  ["CLAHE contrast", "exp-2026-02-14-0106.json"],
  ["Resize to 1600px", "exp-2026-02-14-0105.json"],
];

// Images shown on the page, cropped to the chart (no names, addresses or account numbers).
const SHOWCASE = [
  { file: "image.png", image: "bills/screenshot.png", label: "Screenshot of the bill chart" },
  { file: "lumaBill-page4.png", image: "bills/pdf-export.png", label: "PDF export from the LUMA app" },
];

const PER_MONTH = 15000;

function load(file) {
  return JSON.parse(fs.readFileSync(path.join(EXPERIMENTS, file), "utf8"));
}

const pct = (x) => Math.round(x * 1000) / 10;

function providers(exp) {
  return Object.entries(exp.summary)
    .filter(([name]) => !name.startsWith("_"))
    .map(([name, s]) => {
      const costPerImage = s.totalEstimatedCost / s.imagesProcessed;
      return {
        name,
        accuracy: pct(s.avgAccuracy),
        correct: s.totalCorrect,
        fields: s.totalFields,
        images: s.imagesProcessed,
        avgSeconds: Math.round(s.avgDurationMs / 100) / 10,
        costPerImage,
        costPerMonth: Math.round(costPerImage * PER_MONTH * 100) / 100,
      };
    })
    .sort((a, b) => b.accuracy - a.accuracy);
}

function meta(exp) {
  return {
    id: exp.id,
    date: exp.timestamp.slice(0, 10),
    prompt: exp.promptVersion,
    preprocessing: exp.preprocessing,
    imageCount: exp.imageCount,
  };
}

// Augmented files are named <original>__aug-<kind><level>[_<kind><level>].<ext>.
// Combined augmentations count under their first kind.
const CATEGORY_NAMES = {
  original: "Original photo",
  rot: "Rotation",
  bright: "Brightness",
  blur: "Blur",
  jpeg: "JPEG compression",
  noise: "Noise",
};

function category(file) {
  const m = file.match(/__aug-([a-z]+)/);
  if (!m) return "original";
  return m[1] === "rotn" ? "rot" : m[1];
}

function byCategory(exp) {
  const acc = {};
  for (const r of exp.results) {
    if (r.status !== "OK" || !r.comparison) continue;
    const cat = category(r.file);
    acc[cat] ??= {};
    acc[cat][r.provider] ??= { correct: 0, fields: 0, images: 0 };
    const a = acc[cat][r.provider];
    a.correct += r.comparison.correctCount;
    a.fields += r.comparison.totalFields;
    a.images += 1;
  }
  return Object.keys(CATEGORY_NAMES)
    .filter((cat) => acc[cat])
    .map((cat) => ({
      category: CATEGORY_NAMES[cat],
      images: Math.max(...Object.values(acc[cat]).map((a) => a.images)),
      providers: Object.fromEntries(
        Object.entries(acc[cat]).map(([name, a]) => [name, pct(a.correct / a.fields)])
      ),
    }));
}

function showcase(exp) {
  // The cropped images are added by hand; a bill without its image stays off the page.
  const present = SHOWCASE.filter(({ image }) =>
    fs.existsSync(path.join(__dirname, "..", "site", "static", image))
  );
  return present.map(({ file, image, label }) => {
    const rows = exp.results.filter((r) => r.file === file && r.comparison);
    const months = rows[0].comparison.results.map((m, i) => ({
      month: m.month.expected,
      kwh: m.kwh.expected,
      costPerKwh: m.costPerKwh.expected,
      models: Object.fromEntries(
        rows.map((r) => {
          const got = r.comparison.results[i];
          return [r.provider, { kwh: got.kwh.actual, costPerKwh: got.costPerKwh.actual, pass: got.pass }];
        })
      ),
    }));
    return { image, label, months };
  });
}

const final = load(FINAL);
const noPre = load(NO_PREPROCESSING);
const all = load(ALL_PROVIDERS);

const data = {
  perMonth: PER_MONTH,
  final: { ...meta(final), providers: providers(final), byCategory: byCategory(final) },
  noPreprocessing: { ...meta(noPre), providers: providers(noPre) },
  allProviders: { ...meta(all), providers: providers(all) },
  preprocessing: PREPROCESSING.map(([method, file]) => {
    const exp = load(file);
    return { method, ...meta(exp), providers: providers(exp) };
  }),
  showcase: showcase(final),
  rawFile: `data/${final.id}.json`,
};

fs.mkdirSync(path.dirname(OUT_DATA), { recursive: true });
fs.writeFileSync(OUT_DATA, JSON.stringify(data, null, 2) + "\n");

// The full per-image log of the final run, for anyone who wants to recompute the numbers.
const { reportMarkdown, ...raw } = final;
fs.mkdirSync(OUT_RAW, { recursive: true });
fs.writeFileSync(path.join(OUT_RAW, `${final.id}.json`), JSON.stringify(raw, null, 2) + "\n");

console.log(`Wrote ${path.relative(process.cwd(), OUT_DATA)} and ${data.rawFile}`);
