import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyWeatherPreview } from "../dist/weather-preview.js";
import { resolveQuality } from "../dist/quality.js";

const clear = {
	cloudiness: 0,
	precipitation: "none",
	intensity: 0.2,
	thunder: false,
	fog: false,
	isDay: true,
	windSpeed: 10,
	temperatureC: 22,
	sunriseH: 5.5,
	sunsetH: 21,
};

describe("applyWeatherPreview", () => {
	it("layers storm over live conditions", () => {
		const next = applyWeatherPreview(clear, "storm");
		assert.equal(next.cloudiness, 2);
		assert.equal(next.precipitation, "rain");
		assert.equal(next.thunder, true);
		assert.ok(next.intensity >= 0.8);
		assert.ok(next.windSpeed >= 28);
		assert.equal(next.sunriseH, clear.sunriseH);
	});

	it("layers snow and cools the air", () => {
		const next = applyWeatherPreview(clear, "snow");
		assert.equal(next.precipitation, "snow");
		assert.ok(next.temperatureC <= -1);
		assert.equal(next.thunder, false);
	});

	it("uses a fallback base when live weather is null", () => {
		const next = applyWeatherPreview(null, "fog");
		assert.equal(next.fog, true);
		assert.equal(next.precipitation, "none");
		assert.ok(next.windSpeed <= 6);
	});

	it("overcast clears precipitation flags", () => {
		const rainy = { ...clear, precipitation: "rain", intensity: 0.9, thunder: true };
		const next = applyWeatherPreview(rainy, "overcast");
		assert.equal(next.cloudiness, 2);
		assert.equal(next.precipitation, "none");
		assert.equal(next.intensity, 0);
		assert.equal(next.thunder, false);
	});
});

describe("resolveQuality", () => {
	it("returns a fresh object so maxDpr overrides cannot leak", () => {
		const a = resolveQuality("high");
		const b = resolveQuality("high");
		a.maxDpr = 1;
		assert.equal(b.maxDpr, 2);
		assert.notEqual(a, b);
	});

	it("low preset disables the grid and scales particles down", () => {
		const q = resolveQuality("low");
		assert.equal(q.showGrid, false);
		assert.ok(q.particleScale < 1);
		assert.ok(q.ambientEffects < 1);
	});
});
