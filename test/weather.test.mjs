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

	it("carries the detailed current fields through", () => {
		const wx = deriveConditions({
			temperature_2m: 21,
			weather_code: 2,
			is_day: 1,
			wind_speed_10m: 14,
			wind_direction_10m: 225,
			wind_gusts_10m: 32,
			relative_humidity_2m: 68,
			cloud_cover: 55,
			pressure_msl: 1013.2,
		});
		assert.equal(wx.weatherCode, 2);
		assert.equal(wx.humidity, 68);
		assert.equal(wx.cloudCover, 55);
		assert.equal(wx.pressureMsl, 1013.2);
		assert.equal(wx.windDirection, 225);
		assert.equal(wx.windGusts, 32);
	});

	it("promotes cloudiness when real cloud cover disagrees with the code", () => {
		const clearButGray = deriveConditions({
			temperature_2m: 15,
			weather_code: 0,
			cloud_cover: 92,
		});
		assert.equal(clearButGray.cloudiness, 2);
		const overcastCode = deriveConditions({
			temperature_2m: 15,
			weather_code: 3,
			cloud_cover: 10,
		});
		// Never demoted below what the code promises.
		assert.equal(overcastCode.cloudiness, 2);
	});
});
