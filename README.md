# AI Vision Benchmark

A benchmark that compares AI vision APIs (Google Gemini, OpenAI, Anthropic Claude) on one real task: reading 13 months of kWh and cost-per-kWh from the usage chart on Puerto Rico electricity bills. The result: GPT-5.2 is the most accurate (95.2%), and Gemini 2.5 Flash gets 90.1% for about 1/8 of the cost.

**Live:** https://vision-bench.kiri231.com

## The problem

A solar company in Puerto Rico sizes each installation from the customer's last 13 months of consumption. That history lives in a bar chart on the LUMA bill, and customers send it as a phone photo of the paper bill (tilted, shadowed, blurry, with a hand or a table in frame) or as a PDF from the LUMA app. Someone had to type 13 months of kWh and cost per kWh by hand for every lead.

The question this repo answers: can a vision API read that chart reliably enough to replace the typing, and which one is worth paying for at about 15,000 bills a month?

## Results

Final run: prompt v3, resize preprocessing, 124 images (25 real bills plus 99 augmentations: rotation, brightness, blur, JPEG compression, noise).

| Provider | Accuracy | Cost per image | Cost at 15k images/month |
|---|---|---|---|
| OpenAI GPT-5.2 | **95.2%** | ~$0.0074 | ~$110 |
| Gemini 2.5 Flash | **90.1%** | ~$0.0009 | ~$13 |

A month counts as correct only if the label, the kWh (exact) and the cost per kWh (within $0.01) all match.

Earlier runs on the 18 original photos, without preprocessing:

| Provider | Accuracy | Cost |
|---|---|---|
| Gemini 2.0 Flash | 87% | $0.01 |
| GPT-5.2 | 86% | $0.13 |
| GPT-4.1 Mini | 80% | $0.03 |
| Gemini 2.5 Flash | 69% | $0.02 |
| Claude Sonnet 4.5 | 50% | $0.20 |

Resizing to 1600px wide (after fixing EXIF orientation) helped every provider: Gemini 2.5 Flash went from 69% to 87%, Gemini 2.0 Flash from 87% to 93%, GPT-5.2 from 86% to 91%. Perspective warp and CLAHE contrast both made accuracy worse.

Recommendation: Gemini 2.5 Flash with resize, and GPT-5.2 as a fallback for the reads Gemini gets wrong.

## How it's built

| Part | Technology |
|---|---|
| Harness | Node.js (CommonJS), `node:test` for unit tests |
| Providers | `@google/genai`, `openai`, `@anthropic-ai/sdk`; `pdf-to-img` for PDF bills |
| Preprocessing | Python with Pillow: EXIF fix, resize, dataset augmentation |
| Results page | SvelteKit with `adapter-static`, prerendered from a JSON snapshot of the runs |
| Hosting | Caddy container on a VPS behind a shared edge Caddy ([Kiri23/kiriInfra](https://github.com/Kiri23/kiriInfra)) |

Every provider gets the same prompt, so each provider module only does SDK wiring. Gemini and OpenAI enforce the JSON schema natively; Claude gets schema instructions in the prompt and its answer is parsed by hand.

## Run it locally

The real bills contain personal data, so `sample/` is not in the repo. Bring your own LUMA bill photos or PDFs.

```bash
npm install
cp .env.example .env   # then fill in the keys
```

```
GEMINI_API_KEY=your-key
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key   # optional
```

Put your images in `sample/`, add one entry per file to `ground-truth.json` (the 13 months with kWh and cost per kWh), turn providers on or off in `providers/index.js`, and run:

```bash
npm start
```

Each run writes a Markdown report to `results/report.md` and a JSON log to `results/experiments/`.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Runs every image against every active provider |
| `npm start -- --prompt=v2` | Uses a specific prompt version (default: latest) |
| `npm start -- --tag=label` | Labels the experiment log |
| `npm run start:preprocessed` | Preprocesses `sample/` into `sample_preprocessed/`, then runs the matrix |
| `node script/run-single.js <provider> <file>` | One provider against one file |
| `npm run compare-experiments` | Compares every experiment log in a table |
| `npm test` | Unit tests |
| `python preprocessing/augment.py` | Generates the augmented dataset |

## Limitations

- **Tilted photos** fail for every provider (0-58%). The models can't read distorted text, and prompting didn't fix it.
- **Cropped charts** score around 50%: missing months can't be recovered.
- **Synthetic rotation is easier than a real angle.** Pillow's `rotate()` doesn't predict how a model handles a phone held at an angle.
- No confidence score: nothing tells you which reads to trust without a ground truth to compare against.
- 25 real bills is a small sample. The augmentations widen it, but they come from the same photos.

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


