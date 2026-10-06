<script>
	import { percent, shortName } from '#lib/format.js';

	/**
	 * Horizontal bars, one group per row, one bar per series. Accuracy goes from `min` to 100.
	 * @type {{ rows: { label: string, note?: string, values: Record<string, number> }[], series: string[], min?: number, legend?: boolean }}
	 */
	let { rows, series, min = 40, legend = true } = $props();

	const width = (/** @type {number} */ v) => `${Math.max(0, ((v - min) / (100 - min)) * 100)}%`;

	// One color per model on every chart, so a model is recognizable across sections.
	const COLORS = {
		'OpenAI GPT-5.2': 'var(--kiri-marca)',
		'Gemini 2.5 Flash': 'var(--kiri-bien)',
		'Gemini 2.0 Flash': 'var(--kiri-ojo)',
		'OpenAI GPT-4.1 Mini': 'var(--kiri-tinta-suave)',
		'Claude Sonnet 4.5': 'var(--kiri-mal)'
	};
	const color = (/** @type {string} */ s) => COLORS[/** @type {keyof typeof COLORS} */ (s)] ?? 'var(--kiri-apagado)';
</script>

{#if legend}
<div class="legend">
	{#each series as s (s)}
		<span><i class="swatch" style:background={color(s)}></i>{shortName(s)}</span>
	{/each}
	<span class="axis">axis starts at {min}%</span>
</div>
{/if}

<div class="chart">
	{#each rows as row (row.label)}
		<div class="label">
			{row.label}
			{#if row.note}<small>{row.note}</small>{/if}
		</div>
		<div class="bars">
			{#each series as s (s)}
				{#if row.values[s] != null}
					<div class="bar">
						<div class="fill" style:width={width(row.values[s])} style:background={color(s)}></div>
						<span class="kiri-mono">{percent(row.values[s])}</span>
					</div>
				{/if}
			{/each}
		</div>
	{/each}
</div>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--kiri-e-3);
		font-size: var(--kiri-t-sm);
		color: var(--kiri-tinta-suave);
		margin-bottom: var(--kiri-e-3);
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: var(--kiri-e-1);
	}
	.axis {
		margin-left: auto;
	}
	.swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}
	.chart {
		display: grid;
		grid-template-columns: minmax(7rem, 11rem) 1fr;
		gap: var(--kiri-e-3) var(--kiri-e-4);
		align-items: center;
	}
	.label {
		font-size: var(--kiri-t-sm);
	}
	.label small {
		display: block;
		color: var(--kiri-tinta-suave);
		font-size: var(--kiri-t-xs);
	}
	.bars {
		display: grid;
		gap: 3px;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: var(--kiri-e-2);
		font-size: var(--kiri-t-xs);
	}
	.fill {
		height: 12px;
		border-radius: 0 3px 3px 0;
	}
</style>
