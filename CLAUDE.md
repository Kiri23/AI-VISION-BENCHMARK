# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A benchmarking harness that compares AI vision APIs (Gemini, OpenAI, Claude) on one task: reading 13 months of kWh consumption and cost-per-kWh from the usage chart on LUMA (Puerto Rico) electricity bills. It is **not** a production app. It exists to pick a provider on accuracy and cost before building the real integration.

## The Problem

A solar company in Puerto Rico needs a customer's last 13 months of kWh to size a system. Customers send either phone photos of the paper bill (variable angle, light, blur, background objects) or PDF exports from the LUMA app (clean). Typing the values by hand is slow and error-prone, so the question is whether a vision API can read the chart reliably and cheaply.

## Current State

- The study is finished. Final run (prompt v3, resize preprocessing, 124 images): GPT-5.2 95.2%, Gemini 2.5 Flash 90.1% at about 1/8 of the cost.
- Recommendation: Gemini 2.5 Flash with resize to 1600px, with GPT-5.2 as a fallback for low-confidence reads.
- Known failures: cropped charts and strongly tilted photos.
- `providers/index.js` currently has only Gemini 2.5 Flash active; uncomment others to compare.
- Prompt v3 (`prompts/v3.js`) is the latest.
- Preprocessing (`preprocessing/pipeline.py`) is EXIF orientation fix + resize to 1600px. Perspective warp and CLAHE were tried and made accuracy worse.
- `sample/`, `sample_preprocessed/` and `results/` are gitignored: the real bills contain personal data and never go in the repo. `ground-truth.json` is committed and holds only months, kWh and cost values.

## Architecture

```
run-matrix.js            ← Main entry: loops files × providers, generates report + experiment log
├── ground-truth.json    ← Expected values per sample file (month, kwh, costPerKwh)
├── prompt.js            ← Loads versioned prompt from prompts/ (latest by default, or --prompt=vN)
├── compare.js           ← Compares API output against ground truth, scores per-field
├── report.js            ← Generates markdown summary + detail tables, archives previous reports
├── experiment-log.js    ← Saves/loads structured JSON experiment logs
├── experiment-compare.js ← Reads all experiment logs, prints comparison table
├── providers/
│   ├── index.js         ← Registry of active providers (array export)
│   ├── gemini*.js       ← Google GenAI SDK (2.0 Flash, 2.5 Flash, 3 Flash), structured JSON output schema
│   ├── openai*.js       ← OpenAI SDK (GPT-4o, 4.1 mini/nano, 5.2), json_schema response format
│   └── claude.js        ← Anthropic SDK, manual JSON parsing (no structured output)
├── prompts/
│   ├── v1.js, v2.js     ← Earlier prompts
│   └── v3.js            ← Current prompt
├── pricing.js           ← Per-model token prices used for cost estimates
├── preprocessing/       ← Python + Pillow: preprocess.py (batch), pipeline.py (EXIF + resize), augment.py (dataset augmentation)
├── script/
│   ├── run-single.js    ← Quick test: one provider × one file
│   └── run-provider.js  ← One provider over a folder
├── unitTesting/         ← Unit tests (node:test)
│   ├── compare.test.js  ← Tests for scoring logic
│   ├── experiment-log.test.js ← Tests for experiment log (computation + file I/O)
│   └── report.test.js   ← Tests for report generation + archiving + bidirectional pairing
├── results/
│   ├── report.md        ← Latest report (overwritten each run)
│   ├── archive/         ← Previous reports (auto-archived with timestamp+prompt+models)
│   └── experiments/     ← JSON experiment logs (one per run, never overwritten)
└── sample/              ← Test images (phone photos at various angles/lighting + PDF-extracted PNGs)
```

## Results Page

`site/` is a SvelteKit app (adapter-static, prerendered) published at https://vision-bench.kiri231.com.
- Data: `site/src/lib/data/results.json`, written by `npm run export-site` from `results/experiments/` (which only exists locally). Commit the JSON; the site builds from it alone.
- Showcase bills: images in `site/static/bills/`, cropped to the chart. Never add a crop that shows a name, address, account number or amount. A bill whose image is missing stays off the page.
- Styling comes live from `https://design.kiri231.com/tokens.css` (kiri-design); use its `--kiri-*` variables, no raw hex.
- Deploy: `Dockerfile` (node build → Caddy), `compose.prod.yaml` on vps2 behind kiri-edge, `.github/workflows/container.yml`.

## Key Design Decisions

- **All providers share the same prompt** from `prompt.js` — this ensures fair comparison. Each provider module only handles SDK-specific wiring.
- **Structured JSON output**: Gemini and OpenAI use their native JSON schema enforcement. Claude doesn't support it natively, so the prompt is appended with schema instructions and the response is manually parsed.
- **Comparison is per-field**: each month entry must match on month label, kWh (exact), and costPerKwh (within $0.01 tolerance). A month only counts as "correct" if all three match.
- **Reports auto-archive**: running the matrix moves the previous `results/report.md` to `results/archive/` with a timestamp + prompt version + provider names in the filename.
- **Experiment tracking**: each run saves a JSON log to `results/experiments/` with structured data (summary stats, raw results). Report markdown is NOT stored in experiment JSON (removed for performance/memory reasons). The report file references the experiment ID, but the link is one-directional.

## CLI Flags

- `--prompt=vN` — use a specific prompt version (default: latest)
- `--tag=my-label` — human-readable experiment label (default: auto-generated as `{promptVersion}-{imageCount}img`, e.g. `v2-18img`)
- `--preprocessing=resize` — label for what preprocessing was applied (default: `none`)

## npm Scripts

- `npm start` — run the full matrix (all images × all providers)
- `npm test` — run unit tests
- `npm run compare-experiments` — print comparison table across all experiment logs
- `npm run start:preprocessed` — preprocess `sample/` into `sample_preprocessed/`, then run the matrix
- `npm --prefix site run check` — typecheck the results page
- `npm --prefix site run check:overflow -- <url>` — fail if the page is wider than a 375px or 1280px screen (needs Google Chrome)

CI runs `npm test`, the site typecheck and the layout check on every push and PR.

## Adding a New Provider

1. Create `providers/<name>.js` exporting `{ name: string, extract(filePath, mimeType): Promise<{ months: [...] }> }`
2. Add it to the array in `providers/index.js`
3. Add its API key env var to the `API_KEY_MAP` in `run-matrix.js`

## Adding a New Sample Image

1. Place the image in `sample/`
2. Add an entry to `ground-truth.json` with the filename as key, including `client` label and `months` array with the correct values
3. Set `"skip": true` if you want to exclude it from the matrix run
