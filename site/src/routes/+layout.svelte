<script>
	import favicon from '#lib/assets/favicon.svg';

	/** @type {{children: import('svelte').Snippet}} */
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- Shared look across Kiri sites: loaded live from kiri-design. -->
	<link rel="stylesheet" href="https://design.kiri231.com/tokens.css" />
</svelte:head>

{@render children()}
