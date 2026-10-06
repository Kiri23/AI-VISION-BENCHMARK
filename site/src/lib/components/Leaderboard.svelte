<script>
	import { percent, dollars, shortName } from '#lib/format.js';

	/** @type {{ providers: any[] }} */
	let { providers } = $props();
</script>

<table class="kiri-tabla kiri-tabla--compacta">
	<thead>
		<tr>
			<th>Model</th>
			<th class="num">Accuracy</th>
			<th class="num">Per image</th>
			<th class="num">Per month</th>
		</tr>
	</thead>
	<tbody>
		{#each providers as p (p.name)}
			<tr>
				<td class="model">{shortName(p.name)}</td>
				<td class="num kiri-mono"><strong>{percent(p.accuracy)}</strong></td>
				<td class="num kiri-mono">{dollars(p.costPerImage)}</td>
				<td class="num kiri-mono">{dollars(p.costPerMonth)}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.num {
		text-align: right;
	}
	.model {
		white-space: nowrap;
	}
	/* Four columns have to fit a 360px phone: tighter sides, headers in the UI font. */
	th,
	td {
		padding-inline: var(--kiri-e-2);
	}
	th.num {
		font-family: var(--kiri-ui);
	}
</style>
