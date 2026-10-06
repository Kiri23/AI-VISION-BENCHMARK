<script>
	import { asset } from '$app/paths';
	import data from '#lib/data/results.json';
	import Figure from '#lib/components/Figure.svelte';
	import Leaderboard from '#lib/components/Leaderboard.svelte';
	import BarChart from '#lib/components/BarChart.svelte';
	import { percent, dollars } from '#lib/format.js';

	const REPO = 'https://github.com/Kiri23/AI-VISION-BENCHMARK';
	const raw = asset(/** @type {any} */ (data.rawFile));
	/** @type {string | null} */
	const inputExample = data.inputExample;

	const [best, cheap] = data.final.providers;
	const costRatio = Math.round(best.costPerImage / cheap.costPerImage);
	const gemini = data.final.providers.find((p) => p.name === 'Gemini 2.5 Flash') ?? cheap;
	const geminiRaw = data.noPreprocessing.providers[0];
	const perMonth = data.perMonth.toLocaleString('en-US');

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
	<title>Can a vision model read a Puerto Rico power bill?</title>
	<meta
		name="description"
		content="Five vision models compared on reading 13 months of kWh from LUMA bill charts. {best.name} {percent(best.accuracy)}, {cheap.name} {percent(cheap.accuracy)} at 1/{costRatio} of the cost."
	/>
</svelte:head>

<main>
	<header>
		<p class="kicker">Research note · AI Vision Benchmark</p>
		<h1>Can a vision model read a Puerto Rico power bill?</h1>
		<p class="byline">Christian Nogueras · February 2026</p>
	</header>

	<p class="abstract">
		I compared five vision models on one narrow task: reading 13 months of kWh and cost per kWh from
		the usage chart on a LUMA electricity bill. On {data.final.imageCount} images, {best.name} read
		{percent(best.accuracy)} of the months right and {cheap.name} {percent(cheap.accuracy)}, at about
		1/{costRatio} of the price. Resizing the photo before sending it mattered more than any clever
		preprocessing, and real tilted photos still break every model.
	</p>

	<h2>The problem</h2>
	<p>
		A solar company in Puerto Rico sizes every installation from the customer's last 13 months of
		consumption. Its sales reps work each lead through to an appointment and a quote, and the
		consumption history comes from a bar chart on the LUMA bill. Customers send it however they
		can: a photo of the paper bill on the kitchen table, tilted, in bad light, or a PDF from the
		LUMA app. The sales reps were typing 13 kWh values and 13 prices by hand for every lead.
	</p>
	<p>
		The question had three parts. Could an AI model do that job with prompt engineering alone, no
		training, and get it right often enough to trust? If so, which model was the cheapest? And
		would that still be a reasonable cost at {perMonth} or more bills a month?
	</p>

	{#if inputExample}
		<Figure
			n={1}
			caption="The input: the usage chart from a LUMA bill. Each model has to return the 13 monthly kWh bars and the 13 prices on the cost line below them."
		>
			<img src={asset(/** @type {any} */ (inputExample))} alt="LUMA bill chart: 13 monthly kWh bars from ago-24 to ago-25, and a cost-per-kWh line between $0.24 and $0.26" />
		</Figure>
	{/if}

	<h2>Setup</h2>
	<p>
		Every model gets the same prompt and must answer in the same JSON shape: 13 months, each with
		its label, kWh and cost per kWh. A harness runs every image against every model and checks each
		month against a hand-checked ground truth. A month counts only if the label matches, the kWh
		matches exactly and the price is within one cent.
	</p>
	<p>
		The dataset started with 25 real bills: phone photos at different angles and light, plus PDF
		exports. To test robustness without collecting hundreds of bills, each photo was copied with
		controlled damage (rotation, brightness, blur, JPEG compression and noise), for
		{data.final.imageCount} images in total.
	</p>

	<h2>Results</h2>
	<p>
		Five models ran on the first {data.allProviders.imageCount} images. Claude Sonnet 4.5 trailed far
		behind. Gemini 2.0 Flash scored highest on this small set, but only GPT-5.2 and Gemini 2.5
		Flash went on to the full run.
	</p>
	<Figure n={2} caption="First round, {data.allProviders.imageCount} original images. Accuracy, with the cost of one image under each model.">
		<BarChart rows={allRows} series={allSeries} min={0} legend={false} />
	</Figure>
	<p>
		On the full set the gap between the two finalists is five points, and the price gap is
		{costRatio}×.
	</p>
	<Figure
		n={3}
		caption="Final run, {data.final.date}: {data.final.imageCount} images, prompt {data.final.prompt}, resized to 1600px. The monthly cost assumes {perMonth} bills."
	>
		<Leaderboard providers={data.final.providers} />
	</Figure>
	<p>
		Splitting the images by how they were made shows where each one breaks. GPT-5.2 holds up under
		rotation; Gemini handles blur better.
	</p>
	<Figure n={4} caption="Final run split by image type. The axis starts at 40%.">
		<BarChart rows={categoryRows} series={finalSeries} />
	</Figure>

	<h2>Preprocessing: simpler won</h2>
	<p>
		Before the full run I tried four ways of cleaning the photos. Fixing the orientation and
		resizing to 1600px was the best method overall: it helped three of the four models and barely
		moved GPT-5.2. Straightening the perspective and boosting the contrast made most of them worse. On the full set, resizing alone took Gemini 2.5 Flash from
		{percent(geminiRaw.accuracy)} to {percent(gemini.accuracy)}.
	</p>
	<Figure n={5} caption="The same {data.preprocessing[0].imageCount} images under four preprocessing methods. The axis starts at 40%.">
		<BarChart rows={preRows} series={preSeries} />
	</Figure>

	<h2>What I'd ship</h2>
	<p>
		Gemini 2.5 Flash with the resize step, about {dollars(gemini.costPerMonth)} a month at {perMonth}
		bills, with GPT-5.2 as a second opinion for the bills Gemini gets wrong. GPT-5.2 alone would
		cost about {dollars(best.costPerMonth)} a month for {(best.accuracy - gemini.accuracy).toFixed(1)}
		more points.
	</p>

	<h2>Limitations</h2>
	<ul>
		<li>Real tilted photos fail for every model, between 0% and 58%. Prompting didn't fix it.</li>
		<li>Charts cut off at the edge of the photo lose the missing months.</li>
		<li>
			Synthetic rotation is easier than a real phone held at an angle, so the rotation numbers in
			Figure 4 are optimistic.
		</li>
		<li>The models give no confidence score: in production nothing flags a wrong read on its own.</li>
		<li>25 real bills is a small sample. The augmented copies widen it, but they come from the same photos.</li>
	</ul>

	<h2>Appendix: reproduce it</h2>
	<p>
		The harness and this page are in <a href={REPO}>Kiri23/AI-VISION-BENCHMARK</a>. The per-image
		results of the final run are in <a href={raw} download>this JSON file</a>: every image, every
		model, every month, with tokens and cost. To run it on your own bills, clone the repo, add API
		keys to <code>.env</code>, put the images in <code>sample/</code> with their values in
		<code>ground-truth.json</code>, and run <code>npm start</code>.
	</p>

	<footer>
		<a href="https://kiri231.com">kiri231.com</a>
	</footer>
</main>

<style>
	main {
		max-width: 42rem;
		margin-inline: auto;
		padding: var(--kiri-e-6) var(--kiri-e-4);
		font: var(--kiri-t-md) / var(--kiri-i-largo) var(--kiri-lectura);
	}
	.kicker {
		font: var(--kiri-t-sm) / var(--kiri-i-normal) var(--kiri-mono);
		color: var(--kiri-marca-texto);
		margin: 0 0 var(--kiri-e-3);
	}
	h1 {
		font: 600 clamp(var(--kiri-t-xl), 5vw, 2.4rem) / var(--kiri-i-apretado) var(--kiri-lectura);
		margin: 0 0 var(--kiri-e-3);
	}
	.byline {
		font: var(--kiri-t-sm) / var(--kiri-i-normal) var(--kiri-ui);
		color: var(--kiri-tinta-suave);
		margin: 0 0 var(--kiri-e-5);
	}
	.abstract {
		padding-left: var(--kiri-e-4);
		border-left: var(--kiri-b-firma) solid var(--kiri-marca);
		margin: 0 0 var(--kiri-e-5);
	}
	h2 {
		font: 600 var(--kiri-t-lg) / var(--kiri-i-apretado) var(--kiri-lectura);
		margin: var(--kiri-e-6) 0 var(--kiri-e-2);
	}
	p,
	ul {
		margin: 0 0 var(--kiri-e-3);
	}
	li + li {
		margin-top: var(--kiri-e-1);
	}
	a {
		color: var(--kiri-marca-texto);
		text-underline-offset: 0.18em;
	}
	code {
		font: 0.85em var(--kiri-mono);
	}
	img {
		display: block;
		width: 100%;
		height: auto;
		border: var(--kiri-b-hilo) solid var(--kiri-linea);
		border-radius: var(--kiri-r-sm);
		background: #fff;
	}
	footer {
		margin-top: var(--kiri-e-6);
		padding-top: var(--kiri-e-4);
		border-top: var(--kiri-b-hilo) solid var(--kiri-linea);
		font: var(--kiri-t-sm) / var(--kiri-i-normal) var(--kiri-ui);
	}
	footer a {
		color: var(--kiri-tinta-suave);
	}
</style>
