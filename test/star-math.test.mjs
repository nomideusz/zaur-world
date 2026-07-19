import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	equatorialToHorizontal,
	gmstHours,
	lstDegrees,
	projectStar,
	starBrightness,
} from "../dist/star-math.js";
import { STAR_CATALOG, STAR_COUNT } from "../dist/star-catalog.js";

const KRAKOW = { lat: 50.06, lon: 19.94 };
// J2000.0 epoch coordinates.
const POLARIS = { ra: 37.95, dec: 89.264 };
const SIRIUS = { ra: 101.287, dec: -16.716 };
const VEGA = { ra: 279.234, dec: 38.784 };

/** Max altitude of a star over 24h, sampled every 4 minutes. */
function transitAlt(star, lat, lon) {
	let max = -90;
	const start = Date.UTC(2026, 6, 19, 0, 0, 0);
	for (let m = 0; m < 24 * 60; m += 4) {
		const { altDeg } = equatorialToHorizontal(
			star.ra,
			star.dec,
			lat,
			lon,
			new Date(start + m * 60_000)
		);
		if (altDeg > max) max = altDeg;
	}
	return max;
}

describe("star-math", () => {
	it("GMST matches the J2000 epoch value", () => {
		const g = gmstHours(new Date(Date.UTC(2000, 0, 1, 12, 0, 0)));
		assert.ok(Math.abs(g - 18.6974) < 0.01, `gmst ${g}`);
	});

	it("LST wraps into 0..360", () => {
		const lst = lstDegrees(new Date(), -170);
		assert.ok(lst >= 0 && lst < 360);
	});

	it("Polaris altitude ≈ observer latitude, any time", () => {
		for (const hour of [0, 6, 13, 21]) {
			const { altDeg } = equatorialToHorizontal(
				POLARIS.ra,
				POLARIS.dec,
				KRAKOW.lat,
				KRAKOW.lon,
				new Date(Date.UTC(2026, 6, 19, hour, 0, 0))
			);
			assert.ok(
				Math.abs(altDeg - KRAKOW.lat) < 1.2,
				`h=${hour}: alt ${altDeg.toFixed(2)} vs lat ${KRAKOW.lat}`
			);
		}
	});

	it("Sirius and Vega transit at the textbook altitude from Kraków", () => {
		// Upper transit altitude = 90 − |lat − dec|.
		const sirius = transitAlt(SIRIUS, KRAKOW.lat, KRAKOW.lon);
		assert.ok(Math.abs(sirius - 23.22) < 0.6, `sirius ${sirius.toFixed(2)}`);
		const vega = transitAlt(VEGA, KRAKOW.lat, KRAKOW.lon);
		assert.ok(Math.abs(vega - 78.72) < 0.6, `vega ${vega.toFixed(2)}`);
	});

	it("southern-declination stars transit due south from the north", () => {
		let bestAlt = -90;
		let azAtBest = 0;
		const start = Date.UTC(2026, 6, 19, 0, 0, 0);
		for (let m = 0; m < 24 * 60; m += 2) {
			const { altDeg, azDeg } = equatorialToHorizontal(
				SIRIUS.ra,
				SIRIUS.dec,
				KRAKOW.lat,
				KRAKOW.lon,
				new Date(start + m * 60_000)
			);
			if (altDeg > bestAlt) {
				bestAlt = altDeg;
				azAtBest = azDeg;
			}
		}
		assert.ok(Math.abs(azAtBest - 180) < 3, `az ${azAtBest.toFixed(1)}`);
	});

	it("projects the horizon and hides what is below it", () => {
		assert.equal(projectStar(180, -5, 50), null);
		const south = projectStar(180, 0.01, 50);
		assert.ok(Math.abs(south.x - 0.5) < 1e-6);
		assert.ok(Math.abs(south.y - 0.66) < 0.01);
		const east = projectStar(90, 45, 50);
		assert.ok(Math.abs(east.x - 0.25) < 1e-6, `east x ${east.x}`);
		// Southern observer: mirrored so motion still reads left → right.
		const eastSouthern = projectStar(90, 45, -30);
		assert.ok(Math.abs(eastSouthern.x - 0.25) < 1e-6, `s x ${eastSouthern.x}`);
	});

	it("brightness is monotonic in magnitude", () => {
		assert.ok(starBrightness(-1.44) > starBrightness(1));
		assert.ok(starBrightness(1) > starBrightness(3.5));
		assert.ok(starBrightness(3.6) >= 0.22);
	});

	it("catalog is well-formed", () => {
		assert.equal(STAR_CATALOG.length, STAR_COUNT * 3);
		assert.ok(STAR_COUNT >= 300, `count ${STAR_COUNT}`);
		// Brightest first — Sirius.
		assert.equal(STAR_CATALOG[0], Math.round(101.2872 * 10));
		assert.equal(STAR_CATALOG[2], -14);
		for (let i = 0; i < STAR_CATALOG.length; i += 3) {
			assert.ok(STAR_CATALOG[i] >= 0 && STAR_CATALOG[i] <= 3600);
			assert.ok(STAR_CATALOG[i + 1] >= -900 && STAR_CATALOG[i + 1] <= 900);
		}
	});
});
