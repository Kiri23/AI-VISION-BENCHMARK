# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Prototype spike (Ticket #736) for Windmar to extract monthly kWh energy consumption data from LUMA/AEE electricity bill images using AI vision APIs. This is **not** a production app — it's a benchmarking harness to compare providers (Gemini, OpenAI, Claude) on accuracy and cost before choosing one for production integration into the Windmar ecosystem.

## The Problem

Windmar needs to extract 13 months of kWh consumption + cost-per-kWh from LUMA bill chart images. Inputs come from two sources: phone photos of physical bills (variable quality) and PDF exports from the LUMA app (clean). The spike validates whether AI vision APIs can hit the accuracy threshold (~65%) needed for production.

## Current State

- Gemini 2.0 Flash and OpenAI GPT-4o are active providers. Claude is implemented but commented out in `providers/index.js`.
- Latest results: Gemini hits 13/13 on both test images, OpenAI hits 13/13 on one and 10/13 on the other (costPerKwh alignment errors).
- Prompt v2 is the current version — it explicitly describes the two-chart layout (consumption bars + cost line chart) and instructs the model to read printed values, not estimate from bar heights.
- PDFs are converted to images via `pdf-to-img` before sending to providers (the `lumaBill.pdf` entry is skipped in ground-truth, `lumaBill-page4.png` is its extracted chart page).

## Architecture

```
run-matrix.js          ← Main entry: loops files × providers, generates markdown report
├── ground-truth.json  ← Expected values per sample file (month, kwh, costPerKwh)
├── prompt.js          ← Loads versioned prompt from prompts/ (latest by default, or --prompt=vN)
├── compare.js         ← Compares API output against ground truth, scores per-field
├── report.js          ← Generates markdown summary + detail tables
├── providers/
│   ├── index.js       ← Registry of active providers (array export)
│   ├── gemini.js      ← Google GenAI SDK, uses structured JSON output schema
│   ├── openai.js      ← OpenAI SDK, uses json_schema response format
│   └── claude.js      ← Anthropic SDK, manual JSON parsing (no structured output)
├── prompts/
│   ├── v1.js          ← Initial prompt
│   └── v2.js          ← Current prompt (two-chart layout description)
├── script/
│   └── run-single.js  ← Quick test: one provider × one file
└── sample/            ← Test images (phone photos at various angles/lighting + PDF-extracted PNGs)
```

## Key Design Decisions

- **All providers share the same prompt** from `prompt.js` — this ensures fair comparison. Each provider module only handles SDK-specific wiring.
- **Structured JSON output**: Gemini and OpenAI use their native JSON schema enforcement. Claude doesn't support it natively, so the prompt is appended with schema instructions and the response is manually parsed.
- **Comparison is per-field**: each month entry must match on month label, kWh (exact), and costPerKwh (within $0.01 tolerance). A month only counts as "correct" if all three match.
- **Reports auto-archive**: running the matrix moves the previous `results/report.md` to `results/archive/` with a timestamp + prompt version + provider names in the filename.

## Adding a New Provider

1. Create `providers/<name>.js` exporting `{ name: string, extract(filePath, mimeType): Promise<{ months: [...] }> }`
2. Add it to the array in `providers/index.js`
3. Add its API key env var to the `API_KEY_MAP` in `run-matrix.js`

## Adding a New Sample Image

1. Place the image in `sample/`
2. Add an entry to `ground-truth.json` with the filename as key, including `client` label and `months` array with the correct values
3. Set `"skip": true` if you want to exclude it from the matrix run
