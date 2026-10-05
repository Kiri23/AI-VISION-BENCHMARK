<script>
	import { asset } from '$app/paths';
	import { shortName } from '#lib/format.js';

	/** @type {{ bill: { image: string, label: string, months: any[] } }} */
	let { bill } = $props();

	const models = $derived(Object.keys(bill.months[0].models));
	const score = (/** @type {string} */ m) => bill.months.filter((row) => row.models[m].pass).length;
</script>

<div class="kiri-panel card">
	<figure>
	<img src={asset(/** @type {any} */ (bill.image))} alt="{bill.label}: 13-month kWh bar chart and cost-per-kWh line" loading="lazy" />
	<figcaption>
		{bill.label}
		{#each models as m (m)}
			<span class="kiri-chip" class:kiri-chip--bien={score(m) === bill.months.length}>
				{shortName(m)} {score(m)}/{bill.months.length}
			</span>
		{/each}
	</figcaption>
	</figure>

	<div class="scroll">
		<table class="kiri-tabla kiri-tabla--compacta">
			<thead>
				<tr>
					<th>Month</th>
					<th class="num">Bill kWh</th>
					{#each models as m (m)}<th class="num">{shortName(m)}</th>{/each}
					<th class="num">Bill $/kWh</th>
					{#each models as m (m)}<th class="num">{shortName(m)}</th>{/each}
				</tr>
			</thead>
			<tbody>
				{#each bill.months as row (row.month)}
					<tr>
						<td>{row.month}</td>
						<td class="num kiri-mono">{row.kwh}</td>
						{#each models as m (m)}
							<td class="num kiri-mono" class:miss={row.models[m].kwh !== row.kwh}>{row.models[m].kwh ?? '—'}</td>
						{/each}
						<td class="num kiri-mono">{row.costPerKwh.toFixed(2)}</td>
						{#each models as m (m)}
							<td class="num kiri-mono" class:miss={!row.models[m].pass}>{row.models[m].costPerKwh?.toFixed(2) ?? '—'}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.card {
		padding: var(--kiri-e-4);
	}
	figure {
		margin: 0;
	}
	img {
		width: 100%;
		height: auto;
		border-radius: var(--kiri-r-sm);
		border: var(--kiri-b-hilo) solid var(--kiri-linea);
		background: #fff;
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--kiri-e-2);
		margin: var(--kiri-e-3) 0;
		font-weight: 500;
	}
	.scroll {
		overflow-x: auto;
	}
	.num {
		text-align: right;
	}
	.miss {
		color: var(--kiri-mal);
		font-weight: 700;
	}
</style>
