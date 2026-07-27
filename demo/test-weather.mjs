// Smoke check for Zaur's weather states — run with: node demo/test-weather.mjs
// (build first: pnpm run build:types). Mounts dist/zaur.js against a stub
// DOM, drives the rAF loop through 12s of rain then 40s of freezing snow,
// and asserts the observable outputs: wet-ink rebuild, drip particles,
// sweater rebuild, snow-cap overlay draw.
import assert from "node:assert";

const rec = { fills: new Set(), drawImages: 0, alphas: [] };
const mkCtx = () =>
	new Proxy(
		{ globalAlpha: 1 },
		{
			get: (t, p) => {
				if (p === "fillStyle" || p === "globalAlpha") return t[p];
				return () => {
					if (p === "fillRect") rec.fills.add(String(t.fillStyle));
					if (p === "drawImage") {
						rec.drawImages++;
						rec.alphas.push(t.globalAlpha);
					}
				};
			},
			set: (t, p, v) => {
				t[p] = v;
				return true;
			},
		}
	);
globalThis.document = {
	createElement: () => ({
		width: 0,
		height: 0,
		getContext: mkCtx,
		style: {},
		remove() {},
		setAttribute() {},
	}),
	body: { appendChild() {} },
};
globalThis.window = {
	innerWidth: 800,
	innerHeight: 600,
	devicePixelRatio: 1,
	addEventListener() {},
};
let rafCb = null;
globalThis.requestAnimationFrame = (cb) => ((rafCb = cb), 1);

const { mountZaur } = await import(new URL("../dist/zaur.js", import.meta.url));
let wx = { precipitation: "rain", temperatureC: 20, thunder: false };
mountZaur({ floorY: () => 500, skyHour: () => 12, weather: () => wx });
let t = performance.now();
const run = (frames) => {
	for (let f = 0; f < frames; f++) rafCb((t += 16.7));
};

run(720); // 12s warm rain
assert(rec.fills.has("#b6c3cb"), "wet ink rebuild after rain");
assert(rec.fills.has("rgba(170, 195, 225, 0.9)"), "drips drawn while soaked");

wx = { precipitation: "snow", temperatureC: -3, thunder: false };
run(2400); // 40s freezing snow
assert(rec.fills.has("#c25b3f"), "sweater rebuild in the cold");
rec.drawImages = 0;
rec.alphas = [];
run(1);
assert.equal(rec.drawImages, 2, "one frame draws sprite + snow cap");
assert.equal(rec.alphas[1], 1, "snow cap at full alpha after sustained snow");

console.log("zaur weather states: all checks passed");
