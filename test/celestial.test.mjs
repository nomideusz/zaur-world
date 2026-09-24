import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { moonDisc } from "../dist/world-celestial.js";

const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const at = (phase) => new Date(NEW_MOON + phase * 29.530588 * 86_400_000);

describe("moonDisc", () => {
	it("a full moon is down at noon, low and swollen at moonrise, high and small at midnight", () => {
		const full = at(0.5);
		assert.equal(moonDisc(1200, 675, 12, full), null);
		const [, riseY, riseR] = moonDisc(1200, 675, 18.6, full);
		const [midX, topY, topR] = moonDisc(1200, 675, 0, full);
		assert.ok(riseY > topY && riseR > topR);
		assert.ok(Math.abs(midX - 600) < 1, "midnight sits mid-sky");
	});

	it("a first-quarter moon is up in the afternoon and down before dawn", () => {
		assert.ok(moonDisc(1200, 675, 15, at(0.25)));
		assert.equal(moonDisc(1200, 675, 3, at(0.25)), null);
	});

	it("a lunar eclipse puts the moon where a full one stands", () => {
		const [x, y] = moonDisc(1200, 675, 0, at(0.1), true);
		assert.ok(Math.abs(x - 600) < 1 && y < 100, "high overhead at midnight");
	});
});
