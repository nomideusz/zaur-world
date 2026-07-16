import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	formatForecastDetails,
	formatForecastLine,
	weatherIcon,
} from "../dist/weather.js";

/** Minimal forecast-hour conditions, as produced by forecastConditionsAt. */
function wx(overrides = {}) {
	return {
		cloudiness: 0,
		precipitation: "none",
		intensity: 0.4,
		thunder: false,
		fog: false,
		isDay: true,
		windSpeed: 14,
		temperatureC: 23.6,
		sunriseH: 5.5,
		sunsetH: 21.1,
		weatherCode: 0,
		humidity: 60,
		cloudCover: 20,
		precipProbability: 5,
		...overrides,
	};
}

describe("formatForecastLine", () => {
	it("shows the hour, description, and rounded temperature", () => {
		assert.equal(formatForecastLine(18, wx({ weatherCode: 61 })), "18:00 — raining, 24°C");
	});

	it("floors decimal hours and wraps past midnight", () => {
		assert.equal(formatForecastLine(24.5, wx()), "0:00 — clear skies, 24°C");
	});

	it("uses the night phrasing after dark", () => {
		assert.equal(
			formatForecastLine(2, wx({ isDay: false, temperatureC: 11 })),
			"2:00 — clear night, 11°C"
		);
	});
});

describe("formatForecastDetails", () => {
	it("joins precip chance, wind, and humidity", () => {
		assert.equal(
			formatForecastDetails(wx({ precipProbability: 80 })),
			"80% precip · wind 14 km/h · humidity 60%"
		);
	});

	it("omits negligible precip chance and missing humidity", () => {
		assert.equal(
			formatForecastDetails(wx({ precipProbability: 0, humidity: null })),
			"wind 14 km/h"
		);
	});
});

describe("weatherIcon", () => {
	it("prioritises thunder, then precipitation, then cloud", () => {
		assert.equal(weatherIcon(wx({ thunder: true })), "⚡");
		assert.equal(weatherIcon(wx({ precipitation: "snow" })), "❄");
		assert.equal(weatherIcon(wx({ precipitation: "rain" })), "☂");
		assert.equal(weatherIcon(wx({ fog: true })), "≋");
		assert.equal(weatherIcon(wx({ cloudiness: 2 })), "☁");
	});

	it("falls back to sun or moon on clear skies", () => {
		assert.equal(weatherIcon(wx()), "☀");
		assert.equal(weatherIcon(wx({ isDay: false })), "☾");
	});
});
