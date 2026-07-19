import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	decimalHourInUtcOffset,
	deriveConditions,
	geoDistanceKm,
	intensityFromPrecip,
	isoInUtcOffset,
	isoToHour,
	timezoneOffsetMismatch,
} from "../dist/weather-logic.js";

describe("isoToHour", () => {
	it("parses Open-Meteo local time strings", () => {
		assert.equal(isoToHour("2026-07-11T04:34"), 4 + 34 / 60);
	});

	it("returns null for invalid input", () => {
		assert.equal(isoToHour(undefined), null);
		assert.equal(isoToHour("bad"), null);
	});
});

describe("isoInUtcOffset", () => {
	it("formats an instant in a fixed UTC offset", () => {
		// 2026-07-14T12:00:00.000Z + 2h → 14:00 local
		const d = new Date("2026-07-14T12:00:00.000Z");
		assert.equal(isoInUtcOffset(d, 7200), "2026-07-14T14:00");
		assert.equal(isoInUtcOffset(d, -14400), "2026-07-14T08:00");
	});
});

describe("decimalHourInUtcOffset", () => {
	it("returns the location wall-clock hour", () => {
		const d = new Date("2026-07-14T12:30:00.000Z");
		assert.equal(decimalHourInUtcOffset(d, 7200), 14.5);
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

	it("scales intensity continuously with precip mm", () => {
		const drizzle = deriveConditions({
			temperature_2m: 12,
			weather_code: 51,
			precipitation: 0.2,
		});
		const heavy = deriveConditions({
			temperature_2m: 12,
			weather_code: 65,
			precipitation: 6,
		});
		assert.ok(drizzle.intensity > 0.25 && drizzle.intensity < 0.55);
		assert.ok(heavy.intensity > drizzle.intensity);
		assert.ok(heavy.intensity > 0.8);
	});
});

describe("intensityFromPrecip", () => {
	it("returns 0 for dry clear skies", () => {
		assert.equal(intensityFromPrecip(0, 0), 0);
	});

	it("ramps with mm between light and heavy rain", () => {
		const light = intensityFromPrecip(61, 0.4);
		const heavy = intensityFromPrecip(61, 5);
		assert.ok(light < heavy);
		assert.ok(heavy > 0.7);
	});
});

describe("geoDistanceKm", () => {
	it("is ~0 for the same point", () => {
		assert.ok(geoDistanceKm({ lat: 50, lon: 20 }, { lat: 50, lon: 20 }) < 0.01);
	});

	it("measures a known city pair roughly", () => {
		// London ↔ Paris is ~340 km
		const km = geoDistanceKm(
			{ lat: 51.5074, lon: -0.1278 },
			{ lat: 48.8566, lon: 2.3522 }
		);
		assert.ok(km > 300 && km < 400);
	});
});

describe("timezoneOffsetMismatch", () => {
	it("flags VPN-sized offset gaps", () => {
		assert.equal(timezoneOffsetMismatch(7200, -14400), true);
		assert.equal(timezoneOffsetMismatch(7200, 7200), false);
		assert.equal(timezoneOffsetMismatch(null, 7200), false);
	});
});
