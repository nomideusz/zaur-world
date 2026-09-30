import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { warpHour, auroraLatFactor, meteorRate, venusState, jupiterState, lunarPhase } from "../dist/solar.js";

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
		assert.equal(auroraLatFactor(69.6), 1); // Tromsø
		assert.equal(auroraLatFactor(-70), 1);
		assert.equal(auroraLatFactor(20), 0);
	});

	it("stays dark at mid-latitudes and when the latitude is unknown", () => {
		assert.equal(auroraLatFactor(52), 0); // Poland
		assert.equal(auroraLatFactor(null), 0);
	});

	it("ramps between 60° and 67°", () => {
		const reykjavik = auroraLatFactor(64.1);
		assert.ok(reykjavik > 0.4 && reykjavik < 1);
	});
});

describe("meteorRate", () => {
	it("spikes near the Perseids peak", () => {
		const perseids = new Date("2026-08-12T12:00:00Z");
		assert.equal(meteorRate(perseids), 9);
	});
});

describe("venusState", () => {
	it("returns elongation and evening flag", () => {
		const v = venusState(new Date("2026-07-12T20:00:00Z"));
		assert.ok(v.elong >= 0);
		assert.equal(typeof v.evening, "boolean");
	});
});

describe("jupiterState", () => {
	it("opposes the sun at the 2026 and 2027 oppositions, joins it at conjunction", () => {
		assert.ok(jupiterState(new Date("2026-01-10T12:00:00Z")).elong > 175);
		assert.ok(jupiterState(new Date("2027-02-11T12:00:00Z")).elong > 175);
		assert.ok(jupiterState(new Date("2026-07-29T12:00:00Z")).elong < 5);
	});
});

describe("lunarPhase", () => {
	it("returns a fraction between 0 and 1", () => {
		const p = lunarPhase(new Date());
		assert.ok(p >= 0 && p < 1);
	});
});
