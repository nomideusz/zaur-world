import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { solsticeWarmth } from "../dist/solar.js";

describe("solsticeWarmth", () => {
	it("peaks near northern summer solstice afternoon", () => {
		const midsummer = new Date("2026-06-21T14:00:00");
		assert.ok(solsticeWarmth(midsummer, 50) > 0.04);
	});

	it("is zero in winter", () => {
		const winter = new Date("2026-01-15T14:00:00");
		assert.equal(solsticeWarmth(winter, 50), 0);
	});
});
