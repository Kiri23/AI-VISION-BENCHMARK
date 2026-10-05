<script>
	import { percent, dollars } from '#lib/format.js';

	/** @type {{ providers: any[], perMonth: number }} */
	let { providers, perMonth } = $props();
</script>

<table class="kiri-tabla">
	<thead>
		<tr>
			<th>Model</th>
			<th class="num">Accuracy</th>
			<th class="num">Per image</th>
			<th class="num">At {perMonth.toLocaleString('en-US')}/month</th>
		</tr>
	</thead>
	<tbody>
		{#each providers as p (p.name)}
			<tr>
				<td>{p.name}</td>
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
</style>
