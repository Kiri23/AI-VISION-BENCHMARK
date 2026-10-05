<script>
	import { asset } from '$app/paths';
	import data from '#lib/data/results.json';
	import Leaderboard from '#lib/components/Leaderboard.svelte';
	import BarChart from '#lib/components/BarChart.svelte';
	import BillCard from '#lib/components/BillCard.svelte';
	import { percent, dollars } from '#lib/format.js';

	const REPO = 'https://github.com/Kiri23/AI-VISION-BENCHMARK';

	const [best, cheap] = data.final.providers;
	const costRatio = Math.round(best.costPerImage / cheap.costPerImage);
	const gemini = data.final.providers.find((p) => p.name === 'Gemini 2.5 Flash') ?? cheap;
	const geminiRaw = data.noPreprocessing.providers[0];

	// Empty until the cropped bill images are added, so give it its real shape.
	/** @type {{ image: string, label: string, months: any[] }[]} */
	const bills = data.showcase;

	const finalSeries = data.final.providers.map((p) => p.name);
	const categoryRows = data.final.byCategory.map((c) => ({
		label: c.category,
		note: `${c.images} images`,
		values: c.providers
	}));

	const allSeries = data.allProviders.providers.map((p) => p.name);
	const allRows = data.allProviders.providers.map((p) => ({
		label: p.name,
		note: `${dollars(p.costPerImage)} per image`,
		values: { [p.name]: p.accuracy }
	}));

	const preSeries = allSeries.filter((s) => s !== 'Claude Sonnet 4.5');
	const preRows = data.preprocessing.map((run) => ({
		label: run.method,
		values: Object.fromEntries(run.providers.map((p) => [p.name, p.accuracy]))
	}));
</script>

<svelte:head>
	<title>AI Vision Benchmark: reading kWh from Puerto Rico power bills</title>
	<meta
		name="description"
		content="Gemini, OpenAI and Claude compared on reading 13 months of kWh from LUMA bill charts. {best.name} {percent(best.accuracy)}, {cheap.name} {percent(cheap.accuracy)} at 1/{costRatio} of the cost."
	/>
</svelte:head>

<main>
	<header>
		<p class="eyebrow">AI Vision Benchmark</p>
		<h1>
			{best.name} reads the bill right {percent(best.accuracy)} of the time.
			{cheap.name} gets {percent(cheap.accuracy)} for 1/{costRatio} of the price.
		</h1>
		<p class="lede">
			Five vision models, one job: read 13 months of kWh and cost per kWh from the usage chart on a
			Puerto Rico electricity bill, from phone photos and PDFs. {data.final.imageCount} images,
			{data.final.providers[0].fields.toLocaleString('en-US')} months checked against the printed values.
		</p>
		<p class="links">
			<a class="kiri-btn kiri-btn--primario" href={REPO}>Code on GitHub</a>
			<a class="kiri-btn" href={asset(/** @type {any} */ (data.rawFile))} download>Raw results (JSON)</a>
		</p>
	</header>

	<section>
		<h2>Leaderboard</h2>
		<p class="sub">
			Final run, {data.final.date}: prompt {data.final.prompt}, images resized to 1600px. A month
			counts only if the label, the kWh and the cost per kWh all match.
		</p>
		<Leaderboard providers={data.final.providers} perMonth={data.perMonth} />
	</section>

	<section>
		<h2>Where each model breaks</h2>
		<p class="sub">
			The same {data.final.imageCount} images split by how they were made: the real photos, and
			copies of them rotated, darkened, blurred, compressed or with added noise.
		</p>
		<BarChart rows={categoryRows} series={finalSeries} />
	</section>

	{#if bills.length}
	<section>
		<h2>What the models read</h2>
		<p class="sub">
			{bills.length === 1 ? 'One' : 'Two'} of the bills, cropped to the chart. Red marks a value that doesn't match the bill.
			Phone photos aren't shown: they include the customer's name and address.
		</p>
		<div class="bills">
			{#each bills as bill (bill.image)}
				<BillCard {bill} />
			{/each}
		</div>
	</section>
	{/if}

	<article class="kiri-lectura">
		<h2>The problem</h2>
		<p>
			A solar company in Puerto Rico sizes every installation from the customer's last 13 months of
			consumption. That history is a bar chart on the LUMA bill, and customers send it however they
			can: a photo of the paper bill on the kitchen table, tilted, in bad light, or a PDF from the
			LUMA app. Someone was typing 13 kWh values and 13 prices by hand for every lead.
		</p>
		<p>
			The question was whether a vision API could do that typing reliably, and which one is worth
			paying for at about {data.perMonth.toLocaleString('en-US')} bills a month.
		</p>

		<h2>How it was measured</h2>
		<p>
			Every model gets the same prompt and must answer in the same JSON shape: 13 months, each with
			its label, kWh and cost per kWh. A harness runs every image against every model and scores
			each month against a hand-checked ground truth. kWh must match exactly; cost per kWh within
			one cent.
		</p>
		<p>
			The dataset started with real bills: phone photos at different angles and light, plus PDF
			exports. To test robustness without collecting hundreds of bills, each photo was copied with
			controlled damage: rotation, brightness, blur, JPEG compression and noise.
		</p>
	</article>

	<section>
		<h2>All five models</h2>
		<p class="sub">
			An earlier run on {data.allProviders.imageCount} original images, before the dataset grew.
			Only the two leaders went on to the full run.
		</p>
		<BarChart rows={allRows} series={allSeries} min={0} />
	</section>

	<section>
		<h2>Preprocessing: simpler won</h2>
		<p class="sub">
			Same {data.preprocessing[0].imageCount} images, four ways of cleaning them first. Fixing the
			photo's orientation and resizing it to 1600px helped. Straightening the perspective and boosting
			contrast made things worse.
		</p>
		<BarChart rows={preRows} series={preSeries} />
		<p class="sub">
			On the full {data.final.imageCount}-image set, resizing alone took Gemini 2.5 Flash from
			{percent(geminiRaw.accuracy)} to {percent(gemini.accuracy)}.
		</p>
	</section>

	<article class="kiri-lectura">
		<h2>What I'd ship</h2>
		<p>
			Gemini 2.5 Flash with the resize step, about {dollars(gemini.costPerMonth)} a month at
			{data.perMonth.toLocaleString('en-US')} bills, and GPT-5.2 as a second opinion for bills
			Gemini gets wrong. GPT-5.2 alone would cost about {dollars(best.costPerMonth)} a month for
			{(best.accuracy - gemini.accuracy).toFixed(1)} more points.
		</p>

		<h2>Limits</h2>
		<p>
			Real tilted photos fail for every model, between 0% and 58%: they can't read distorted text,
			and prompting didn't fix it. Charts cut off at the edge of the photo lose the missing months.
			Synthetic rotation turned out much easier than a real phone held at an angle, so the rotation
			numbers above are optimistic. And the models give no confidence score, so in production
			nothing flags a wrong read on its own.
		</p>

		<h2>Run it on your own bills</h2>
		<p>
			The harness is in the <a href={REPO}>repo</a>. Clone it, add API keys to <code>.env</code>, put
			your bill images in <code>sample/</code> with their values in <code>ground-truth.json</code>,
			and run <code>npm start</code>. Each run writes a report and a JSON log like the one you can
			<a href={asset(/** @type {any} */ (data.rawFile))} download>download here</a>.
		</p>
	</article>

	<footer>
		<a href={REPO}>Kiri23/AI-VISION-BENCHMARK</a> · Christian Nogueras ·
		<a href="https://kiri231.com">kiri231.com</a>
	</footer>
</main>

<style>
	main {
		max-width: 52rem;
		margin-inline: auto;
		padding: var(--kiri-e-6) var(--kiri-e-4);
	}
	.eyebrow {
		font-family: var(--kiri-mono);
		font-size: var(--kiri-t-sm);
		color: var(--kiri-marca-texto);
		margin: 0 0 var(--kiri-e-2);
	}
	h1 {
		font-size: clamp(var(--kiri-t-xl), 4vw, 2.3rem);
		line-height: var(--kiri-i-apretado);
		margin: 0 0 var(--kiri-e-4);
	}
	.lede {
		font-size: var(--kiri-t-md);
		color: var(--kiri-tinta-suave);
		max-width: 40rem;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--kiri-separacion);
	}
	.links a {
		text-decoration: none;
	}
	section {
		margin-top: var(--kiri-e-6);
	}
	h2 {
		font-size: var(--kiri-t-lg);
		margin: 0 0 var(--kiri-e-2);
	}
	.sub {
		color: var(--kiri-tinta-suave);
		font-size: var(--kiri-t-sm);
		max-width: 40rem;
	}
	.bills {
		display: grid;
		gap: var(--kiri-e-5);
	}
	article {
		margin-top: var(--kiri-e-6);
	}
	footer {
		margin-top: var(--kiri-e-6);
		padding-top: var(--kiri-e-4);
		border-top: var(--kiri-b-hilo) solid var(--kiri-linea);
		font-size: var(--kiri-t-sm);
		color: var(--kiri-tinta-suave);
	}
	footer a {
		color: inherit;
	}
</style>
