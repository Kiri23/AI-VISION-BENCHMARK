/**
 * Fails if the page is wider than the viewport at phone and desktop widths, and names the
 * elements that stick out. Catches the class of bug where an image, table or <pre> breaks
 * the layout on mobile.
 *
 * Uses the installed Google Chrome (playwright-core downloads no browser).
 *
 * Usage: node scripts/check-overflow.js [url]   (default http://localhost:8080/)
 */
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:8080/";
const WIDTHS = [375, 1280];

const browser = await chromium.launch({ channel: "chrome" });
let failed = false;

for (const width of WIDTHS) {
	const page = await browser.newPage({ viewport: { width, height: 800 } });
	await page.goto(url, { waitUntil: "networkidle" });

	const { scrollWidth, offenders } = await page.evaluate(() => {
		const vw = document.documentElement.clientWidth;
		const offenders = [...document.querySelectorAll("body *")]
			.filter((el) => el.getBoundingClientRect().right > vw + 1)
			// Only the outermost: a wide figure's children would all be listed too.
			.filter((el) => !(el.parentElement?.getBoundingClientRect().right > vw + 1))
			.slice(0, 5)
			.map((el) => `${el.tagName.toLowerCase()}${el.className ? "." + el.className : ""}`);
		return { scrollWidth: document.documentElement.scrollWidth, offenders };
	});

	const ok = scrollWidth <= width;
	console.log(`${width}px: page is ${scrollWidth}px wide ${ok ? "ok" : "OVERFLOW"}`);
	if (!ok) {
		failed = true;
		for (const o of offenders) console.log(`  sticks out: ${o}`);
	}
	await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
