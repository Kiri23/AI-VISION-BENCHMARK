# AI Vision API Benchmarking Harness

Benchmarking harness to compare AI vision APIs on extracting structured data from utility bill chart images. Tests multiple providers (Google Gemini, OpenAI, Anthropic Claude) on accuracy and cost, with support for image preprocessing and data augmentation.

## Problem

Extract 13 months of energy consumption data (kWh per month + cost per kWh) from bar chart images on electricity bills. Images come from two sources:

- **Phone photos** of physical bills (variable quality — angles, shadows, blur, lighting)
- **PDF exports** from utility apps (clean, consistent)

The harness measures which AI vision APIs can reliably read these charts, how they handle degraded image quality, and what it costs at scale.

## Key Findings

### Provider Accuracy (124 images, with resize preprocessing)

| Provider | Accuracy | Cost (124 imgs) | Est. $/image |
|---|---|---|---|
| OpenAI GPT-5.2 | **95.2%** | $0.92 | ~$0.0074 |
| Gemini 2.5 Flash | **90.1%** | $0.12 | ~$0.0009 |

Gemini 2.5 Flash is ~8x cheaper with 5% less accuracy.

### Provider Accuracy (18 original images, no preprocessing)

| Provider | Accuracy | Cost |
|---|---|---|
| Gemini 2.0 Flash | 87% | $0.01 |
| GPT-5.2 | 86% | $0.13 |
| GPT-4.1 Mini | 80% | $0.03 |
| Gemini 2.5 Flash | 69% | $0.02 |
| Claude Sonnet 4.5 | 50% | $0.20 |

### Preprocessing Impact

Simple resize to 1600px width (with EXIF orientation fix) improves accuracy across all providers:

| Provider | No preprocessing | Resize only | Delta |
|---|---|---|---|
| Gemini 2.5 Flash | 69% | 87% | **+18%** |
| Gemini 2.0 Flash | 87% | 93% | **+6%** |
| GPT-5.2 | 86% | 91% | **+5%** |

More aggressive preprocessing (perspective warp, CLAHE contrast) **hurt** accuracy — simpler is better.

### Failure Modes

- **Angled photos** are the only universal failure (0-58% across all providers). This is a perceptual limitation — the models can't read distorted text, and prompt engineering doesn't help.
- **Cropped/incomplete charts** score ~50% across all providers — missing data can't be recovered.
- Clean photos, shadows, background objects, zoom, and blur are all handled well (85-100%) by the best models.

### Data Augmentation Findings

Tested 124 images (25 originals + 99 synthetic augmentations: rotation, brightness, blur, JPEG compression, noise):

- **Rotation** — GPT-5.2 dominates (89-100% vs Gemini's 66-75%)
- **Brightness/blur** — Gemini slightly better on dim/blurry images
- **JPEG compression/noise** — tied (~98%)
- Synthetic rotation (Pillow `rotate()`) is much easier for models than real-world angles — don't assume augmented rotation scores predict real-world performance.

## Architecture

```
run-matrix.js            <- Main entry: loops files x providers, generates report + experiment log
├── ground-truth.json    <- Expected values per sample file (month, kwh, costPerKwh)
├── prompt.js            <- Loads versioned prompt from prompts/ (latest by default, or --prompt=vN)
├── compare.js           <- Compares API output against ground truth, scores per-field
├── report.js            <- Generates markdown summary + detail tables, archives previous reports
├── experiment-log.js    <- Saves/loads structured JSON experiment logs
├── experiment-compare.js <- Reads all experiment logs, prints comparison table
├── pricing.js           <- Per-provider token pricing for cost estimation
├── providers/
│   ├── index.js         <- Registry of active providers (array export)
│   ├── gemini.js        <- Google GenAI SDK, structured JSON output schema
│   ├── openai.js        <- OpenAI SDK, json_schema response format
│   └── claude.js        <- Anthropic SDK, manual JSON parsing
├── prompts/
│   ├── v1.js            <- Initial prompt
│   ├── v2.js            <- Two-chart layout description
│   └── v3.js            <- Added angle/distortion hints (didn't help)
├── preprocessing/
│   ├── preprocess.py    <- EXIF fix + resize pipeline
│   ├── augment.py       <- Data augmentation (rotation, brightness, blur, noise, JPEG)
│   └── pipeline.py      <- Combined preprocessing pipeline
├── script/
│   ├── run-single.js    <- Quick test: one provider x one file
│   ├── run-provider.js  <- Run one provider against all files
│   ├── recalc-costs.js  <- Recalculate costs from experiment logs
│   └── sum-costs.js     <- Sum costs across experiments
├── unitTesting/         <- Unit tests (node:test)
├── results/             <- (gitignored) Reports and experiment JSON logs
└── sample/              <- (gitignored) Test images
```

## Design Decisions

- **All providers share the same prompt** — ensures fair comparison. Each provider module only handles SDK-specific wiring.
- **Structured JSON output** — Gemini and OpenAI use native JSON schema enforcement. Claude falls back to prompt-based JSON instructions with manual parsing.
- **Per-field comparison** — each month must match on label, kWh (exact), and costPerKwh (within $0.01 tolerance). A month only counts as correct if all three match.
- **Experiment tracking** — each run saves a JSON log to `results/experiments/` with summary stats and raw results. Reports auto-archive with timestamps.

## Usage

```bash
npm install
```

Set API keys in `.env`:
```
GEMINI_API_KEY=your-key
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key   # optional
```

Place test images in `sample/` and add entries to `ground-truth.json`.

```bash
# Run full matrix (all images x all active providers)
npm start

# Run with specific prompt version
npm start -- --prompt=v2

# Run with a tag for the experiment log
npm start -- --tag=my-experiment

# Run a single provider against one file
node script/run-single.js gemini sample/myimage.jpg

# Compare all experiment logs
npm run compare-experiments

# Run unit tests
npm test
```

### CLI Flags

| Flag | Description | Default |
|---|---|---|
| `--prompt=vN` | Use a specific prompt version | latest |
| `--tag=label` | Human-readable experiment label | auto-generated |
| `--preprocessing=name` | Label for preprocessing applied | `none` |

## Adding a New Provider

1. Create `providers/<name>.js` exporting `{ name, extract(filePath, mimeType) }`
2. Add it to the array in `providers/index.js`
3. Add its API key to `API_KEY_MAP` in `run-matrix.js`
4. Add pricing to `pricing.js`

## Adding a New Sample Image

1. Place the image in `sample/`
2. Add an entry to `ground-truth.json` with the filename as key
3. Set `"skip": true` to exclude from matrix runs

## Preprocessing

The `preprocessing/` directory contains Python scripts for image manipulation:

```bash
pip install -r preprocessing/requirements.txt

# Resize images to 1600px width with EXIF fix
python preprocessing/preprocess.py sample/ sample_preprocessed/

# Generate augmented dataset (rotation, brightness, blur, noise, JPEG compression)
python preprocessing/augment.py
```
