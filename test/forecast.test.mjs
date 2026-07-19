import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildHourlyForecast, forecastConditionsAt } from "../dist/weather-logic.js";

/** 48 hourly slots starting 2026-07-14T00:00 — clear, then evening rain. */
function sampleHourly() {
	const time = [];
	const temperature_2m = [];
	const weather_code = [];
	const precipitation = [];
	const precipitation_probability = [];
	const cloud_cover = [];
	const wind_speed_10m = [];
	const wind_direction_10m = [];
	const relative_humidity_2m = [];
	const is_day = [];
	for (let i = 0; i < 48; i++) {
		const day = i < 24 ? "14" : "15";
		const h = i % 24;
		time.push(`2026-07-${day}T${String(h).padStart(2, "0")}:00`);
		temperature_2m.push(10 + h); // rises through each day
		weather_code.push(h === 18 ? 61 : h === 19 ? 95 : 0); // rain 18:00, storm 19:00
		precipitation.push(h === 18 ? 1.2 : 0);
		precipitation_probability.push(h === 18 ? 80 : 5);
		cloud_cover.push(h === 18 ? 95 : 40);
		wind_speed_10m.push(h); // == hour, handy for interpolation checks
		wind_direction_10m.push(h === 18 ? 270 : 90);
		relative_humidity_2m.push(60);
		is_day.push(h >= 6 && h <= 20 ? 1 : 0);
	}
	return {
		time,
		temperature_2m,
		weather_code,
		precipitation,
		precipitation_probability,
		cloud_cover,
		wind_speed_10m,
		wind_direction_10m,
		relative_humidity_2m,
		is_day,
	};
}

describe("buildHourlyForecast", () => {
	it("flattens parallel arrays into per-hour records", () => {
		const f = buildHourlyForecast(sampleHourly());
		assert.equal(f.length, 48);
		assert.equal(f[18].hour, 18);
		assert.equal(f[18].weatherCode, 61);
		assert.equal(f[18].precipProbability, 80);
		assert.equal(f[18].humidity, 60);
		assert.equal(f[3].isDay, false);
	});

	it("returns empty for missing data", () => {
		assert.deepEqual(buildHourlyForecast(undefined), []);
		assert.deepEqual(buildHourlyForecast({}), []);
	});
});

describe("forecastConditionsAt", () => {
	const forecast = buildHourlyForecast(sampleHourly());
	const now = "2026-07-14T13:20";
	const base = { sunriseH: 5.5, sunsetH: 21.1, latitude: 50.06 };

	it("maps an upcoming rainy hour", () => {
		const wx = forecastConditionsAt(forecast, 18, now, base);
		assert.equal(wx.precipitation, "rain");
		assert.equal(wx.cloudiness, 2);
		assert.equal(wx.temperatureC, 28);
		assert.equal(wx.precipProbability, 80);
		assert.equal(wx.sunriseH, 5.5);
		assert.equal(wx.latitude, 50.06);
		assert.equal(wx.windDirection, 270);
	});

	it("keeps thunder hours thundery", () => {
		const wx = forecastConditionsAt(forecast, 19, now, base);
		assert.equal(wx.thunder, true);
	});

	it("wraps hours earlier than now into tomorrow", () => {
		const wx = forecastConditionsAt(forecast, 6, now, base);
		// Tomorrow 06:00 slot — same synthetic pattern, but proves the roll-over.
		assert.equal(wx.temperatureC, 16);
		assert.equal(wx.isDay, true);
	});

	it("interpolates temperature and wind between slots", () => {
		const wx = forecastConditionsAt(forecast, 14.5, now, base);
		assert.equal(wx.temperatureC, 24.5); // halfway 24 → 25
		assert.equal(wx.windSpeed, 14.5);
	});

	it("interpolates intensity and cloud cover toward the next hour", () => {
		// 17:30 sits between clear 17:00 and rainy 18:00.
		const wx = forecastConditionsAt(forecast, 17.5, now, base);
		const at17 = forecastConditionsAt(forecast, 17, now, base);
		const at18 = forecastConditionsAt(forecast, 18, now, base);
		assert.ok(wx.intensity > at17.intensity);
		assert.ok(wx.intensity < at18.intensity);
		assert.equal(wx.cloudCover, (40 + 95) / 2);
	});

	it("returns null without forecast coverage", () => {
		assert.equal(forecastConditionsAt([], 12, now, base), null);
		assert.equal(forecastConditionsAt(forecast, 12, "2026-07-20T00:00", base), null);
	});
});
