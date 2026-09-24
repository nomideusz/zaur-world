import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hazeFactor, godRayFactor } from "../dist/sky-math.js";

describe("hazeFactor", () => {
	it("stays clear when visibility is unknown", () => {
		assert.equal(hazeFactor(undefined, 0), 0);
		assert.equal(hazeFactor(null, 0), 0);
	});

	it("is crisp in clear air and thick in dense mist", () => {
		assert.equal(hazeFactor(10000, 0), 0);
		assert.equal(hazeFactor(600, 0), 1);
	});

	it("ramps down as visibility opens up", () => {
		assert.ok(Math.abs(hazeFactor(5300, 0) - 0.5) < 1e-9);
	});

	it("adds less on top of an already-gray overcast", () => {
		const full = hazeFactor(600, 0);
		const muted = hazeFactor(600, 0.9);
		assert.ok(muted < full);
	});
});

describe("godRayFactor", () => {
	it("needs the sun up", () => {
		assert.equal(godRayFactor(0.42, 5.8), 0); // at sunrise
		assert.equal(godRayFactor(0.42, 20), 0); // night
	});

	it("vanishes when clear (nothing to cast shafts) or sealed (sun hidden)", () => {
		assert.equal(godRayFactor(0, 12), 0);
		assert.equal(godRayFactor(1, 12), 0);
		assert.equal(godRayFactor(0.72, 12), 0); // overcast deck: no gaps
	});

	it("peaks around broken cloud at low sun", () => {
		assert.ok(Math.abs(godRayFactor(0.42, 12) - 0.35) < 1e-9); // noon: subtle
		assert.ok(godRayFactor(0.42, 5.9) > godRayFactor(0.42, 12)); // low sun: dramatic
	});
});
