import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sceneHour } from "../dist/solar.js";

describe("sceneHour", () => {
	it("anchors dawn, golden, and dusk to the real sun times", () => {
		assert.equal(sceneHour("dawn", 5.5, 21.5), 5.75);
		assert.equal(sceneHour("golden", 5.5, 21.5), 21.15);
		assert.equal(sceneHour("dusk", 5.5, 21.5), 22.1);
	});

	it("falls back to canonical sun times while weather is loading", () => {
		assert.equal(sceneHour("dawn", null, null), 6.75);
		assert.equal(sceneHour("golden", null, null), 18.65);
	});

	it("uses fixed hours for noon and night", () => {
		assert.equal(sceneHour("noon", 5.5, 21.5), 13);
		assert.equal(sceneHour("night", 5.5, 21.5), 23.5);
	});

	it("never returns a negative hour", () => {
		assert.ok(sceneHour("golden", 0, 0.2) >= 0);
	});
});
