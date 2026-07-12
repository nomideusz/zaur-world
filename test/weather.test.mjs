import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveConditions, isoToHour } from "../dist/weather-logic.js";

describe("isoToHour", () => {
	it("parses Open-Meteo local time strings", () => {
		assert.equal(isoToHour("2026-07-11T04:34"), 4 + 34 / 60);
	});

	it("returns null for invalid input", () => {
		assert.equal(isoToHour(undefined), null);
		assert.equal(isoToHour("bad"), null);
	});
});

describe("deriveConditions", () => {
	it("maps a clear day", () => {
		const wx = deriveConditions(
			{ temperature_2m: 24, weather_code: 0, is_day: 1, wind_speed_10m: 8 },
			{ sunrise: ["2026-07-12T05:30"], sunset: ["2026-07-12T21:10"] }
		);
		assert.equal(wx.cloudiness, 0);
		assert.equal(wx.precipitation, "none");
		assert.equal(wx.isDay, true);
		assert.equal(wx.temperatureC, 24);
		assert.ok(wx.sunriseH !== null);
	});

	it("detects thunderstorms", () => {
		const wx = deriveConditions({ temperature_2m: 18, weather_code: 95, is_day: 0 });
		assert.equal(wx.thunder, true);
		assert.equal(wx.precipitation, "rain");
	});
});
