import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	applyWeatherPreview,
	applyWeatherOverride,
	normalizeWeather,
} from "../dist/weather-preview.js";
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

describe("applyWeatherOverride", () => {
	it("merges intensity and temperature over live weather", () => {
		const next = applyWeatherOverride(clear, {
			intensity: 0.45,
			temperatureC: -3,
			precipitation: "snow",
		});
		assert.equal(next.intensity, 0.45);
		assert.equal(next.temperatureC, -3);
		assert.equal(next.precipitation, "snow");
		assert.equal(next.windSpeed, clear.windSpeed);
		assert.equal(next.sunriseH, clear.sunriseH);
	});

	it("uses fallback when base is null", () => {
		const next = applyWeatherOverride(null, { windSpeed: 40, thunder: true });
		assert.equal(next.windSpeed, 40);
		assert.equal(next.thunder, true);
		assert.equal(next.cloudiness, 2); // thunder always brings a full deck
	});

	it("layers on top of a named preview", () => {
		const previewed = applyWeatherPreview(clear, "storm");
		const next = applyWeatherOverride(previewed, { intensity: 0.3, windSpeed: 5 });
		assert.equal(next.precipitation, "rain");
		assert.equal(next.thunder, true);
		assert.equal(next.intensity, 0.3);
		assert.equal(next.windSpeed, 5);
	});

	it("raises cloudiness when rain falls under a clear sky", () => {
		const next = normalizeWeather({
			...clear,
			precipitation: "rain",
			intensity: 0.4,
			cloudiness: 0,
		});
		assert.equal(next.cloudiness, 1);
	});

	it("fills the cloud deck for heavy snow or thunder", () => {
		assert.equal(
			normalizeWeather({
				...clear,
				precipitation: "snow",
				intensity: 0.3,
				cloudiness: 0,
				temperatureC: -2,
			}).cloudiness,
			2
		);
		assert.equal(
			normalizeWeather({
				...clear,
				precipitation: "rain",
				intensity: 0.9,
				cloudiness: 1,
				thunder: true,
			}).cloudiness,
			2
		);
	});

	it("turns warm snow into rain", () => {
		const next = normalizeWeather({
			...clear,
			precipitation: "snow",
			intensity: 0.7,
			temperatureC: 20,
		});
		assert.equal(next.precipitation, "rain");
		assert.equal(next.temperatureC, 20);
	});

	it("keeps snow at or below freezing", () => {
		const next = normalizeWeather({
			...clear,
			precipitation: "snow",
			intensity: 0.5,
			temperatureC: 0.5,
		});
		assert.equal(next.precipitation, "snow");
		assert.equal(next.temperatureC, 0);
	});

	it("turns subzero rain into snow", () => {
		const next = normalizeWeather({
			...clear,
			precipitation: "rain",
			intensity: 0.8,
			temperatureC: -20,
			thunder: true,
		});
		assert.equal(next.precipitation, "snow");
		assert.equal(next.temperatureC, -20);
		assert.equal(next.thunder, true);
		assert.equal(next.cloudiness, 2);
	});

	it("caps wind when foggy", () => {
		const next = normalizeWeather({
			...clear,
			fog: true,
			windSpeed: 40,
			cloudiness: 0,
		});
		assert.equal(next.fog, true);
		assert.equal(next.windSpeed, 14);
		assert.equal(next.cloudiness, 1);
	});

	it("gives thunder something to flash through", () => {
		const next = normalizeWeather({
			...clear,
			thunder: true,
			precipitation: "none",
			intensity: 0,
			temperatureC: 18,
		});
		assert.equal(next.precipitation, "rain");
		assert.ok(next.intensity >= 0.55);
		assert.equal(next.cloudiness, 2);
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
