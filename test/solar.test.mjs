import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { warpHour, auroraLatFactor, meteorRate, venusState, lunarPhase } from "../dist/solar.js";

describe("warpHour", () => {
	it("maps real sunrise and sunset onto the canonical window", () => {
		assert.equal(warpHour(6, 6, 20), 5.8);
		assert.equal(warpHour(20, 6, 20), 18.2);
	});

	it("returns the input hour when sun times are unknown", () => {
		assert.equal(warpHour(12, null, null), 12);
	});
});

describe("auroraLatFactor", () => {
	it("is strongest at high latitudes", () => {
		assert.equal(auroraLatFactor(65), 1);
		assert.equal(auroraLatFactor(20), 0);
	});

	it("ramps between 45° and 60°", () => {
		assert.ok(auroraLatFactor(52) > 0.4);
	});
});

describe("meteorRate", () => {
	it("spikes near the Perseids peak", () => {
		const perseids = new Date("2026-08-12T12:00:00Z");
		assert.equal(meteorRate(perseids), 5);
	});
});

describe("venusState", () => {
	it("returns elongation and evening flag", () => {
		const v = venusState(new Date("2026-07-12T20:00:00Z"));
		assert.ok(v.elong >= 0);
		assert.equal(typeof v.evening, "boolean");
	});
});

describe("lunarPhase", () => {
	it("returns a fraction between 0 and 1", () => {
		const p = lunarPhase(new Date());
		assert.ok(p >= 0 && p < 1);
	});
});
