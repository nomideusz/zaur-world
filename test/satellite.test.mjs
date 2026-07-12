import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { angularDistanceDeg, predictIssPass } from "../dist/satellite-math.js";

describe("angularDistanceDeg", () => {
	it("returns zero for the same point", () => {
		assert.equal(angularDistanceDeg(50, 20, 50, 20), 0);
	});
});

describe("predictIssPass", () => {
	it("detects an immediate pass", () => {
		const history = [
			{ lat: 50.2, lon: 20.1, t: 0 },
			{ lat: 50.1, lon: 20.05, t: 60_000 },
		];
		const result = predictIssPass(history, { lat: 50, lon: 20 }, 0.5, 600_000);
		assert.equal(result, "now");
	});

	it("predicts a future crossing", () => {
		const history = [
			{ lat: 45, lon: 15, t: 0 },
			{ lat: 47, lon: 17, t: 60_000 },
		];
		const result = predictIssPass(history, { lat: 50, lon: 20 }, 2, 900_000);
		assert.ok(result && result !== "now" && result.startInMs >= 0);
	});
});
