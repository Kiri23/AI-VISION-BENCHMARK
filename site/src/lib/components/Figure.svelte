<script>
	/** @type {{ n: number, caption: string, children: import('svelte').Snippet }} */
	let { n, caption, children } = $props();
</script>

<figure>
	<div class="body">{@render children()}</div>
	<figcaption><strong>Figure {n}.</strong> {caption}</figcaption>
</figure>

<style>
	figure {
		margin: var(--kiri-e-5) 0 var(--kiri-e-6);
	}
	/* min-width: 0 lets a wide table scroll inside the column instead of widening the page. */
	.body {
		min-width: 0;
		overflow-x: auto;
		font: var(--kiri-t-base) / var(--kiri-i-normal) var(--kiri-ui);
	}
	figcaption {
		margin-top: var(--kiri-e-3);
		font: var(--kiri-t-sm) / var(--kiri-i-normal) var(--kiri-ui);
		color: var(--kiri-tinta-suave);
	}
	figcaption strong {
		color: var(--kiri-tinta);
		font-weight: 500;
	}
</style>
