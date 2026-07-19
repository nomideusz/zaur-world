import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildMinutely15, refineWithMinutely } from "../dist/weather-logic.js";

const clearDay = {
	cloudiness: 0,
	precipitation: "none",
	intensity: 0,
	thunder: false,
	fog: false,
	isDay: true,
	windSpeed: 8,
	temperatureC: 21,
	sunriseH: 5,
	sunsetH: 21,
	latitude: 50,
	weatherCode: 0,
	humidity: 60,
	cloudCover: 0,
	pressureMsl: 1015,
	windDirection: 270,
	windGusts: null,
};

const series = (entries) => ({
	time: entries.map((e) => e[0]),
	precipitation: entries.map((e) => e[1]),
	weather_code: entries.map((e) => e[2]),
});

describe("buildMinutely15", () => {
	it("flattens parallel arrays into slots", () => {
		const slots = buildMinutely15(
			series([
				["2026-07-19T06:00", 0, 0],
				["2026-07-19T06:15", 0.4, 61],
			])
		);
		assert.equal(slots.length, 2);
		assert.deepEqual(slots[1], {
			timeISO: "2026-07-19T06:15",
			precipMm: 0.4,
			weatherCode: 61,
		});
	});

	it("returns empty for missing block", () => {
		assert.deepEqual(buildMinutely15(undefined), []);
		assert.deepEqual(buildMinutely15({}), []);
	});
});

describe("refineWithMinutely", () => {
	const slots = buildMinutely15(
		series([
			["2026-07-19T06:00", 0, 0],
			["2026-07-19T06:15", 0.6, 61],
			["2026-07-19T06:30", 1.2, 63],
			["2026-07-19T06:45", 0, 2],
		])
	);

	it("starts rain when the active slot turns wet", () => {
		const wet = refineWithMinutely(clearDay, slots, "2026-07-19T06:20");
		assert.equal(wet.precipitation, "rain");
		assert.equal(wet.weatherCode, 61);
		assert.ok(wet.intensity > 0.3);
		// untouched fields survive
		assert.equal(wet.temperatureC, 21);
		assert.equal(wet.windDirection, 270);
	});

	it("stops rain when the active slot turns dry", () => {
		const raining = {
			...clearDay,
			precipitation: "rain",
			intensity: 0.6,
			cloudiness: 2,
			weatherCode: 63,
		};
		const dry = refineWithMinutely(raining, slots, "2026-07-19T06:50");
		assert.equal(dry.precipitation, "none");
		assert.equal(dry.weatherCode, 2);
	});

	it("is identity when no slot covers now (stale or empty series)", () => {
		assert.equal(refineWithMinutely(clearDay, slots, "2026-07-19T08:00"), clearDay);
		assert.equal(refineWithMinutely(clearDay, [], "2026-07-19T06:20"), clearDay);
		assert.equal(refineWithMinutely(clearDay, slots, "2026-07-19T05:59"), clearDay);
	});

	it("is identity when the slot agrees with current state", () => {
		assert.equal(refineWithMinutely(clearDay, slots, "2026-07-19T06:05"), clearDay);
	});

	it("keeps the cloud-cover intensity lift on dry overcast", () => {
		const overcast = {
			...clearDay,
			cloudiness: 2,
			cloudCover: 100,
			intensity: 0.35,
			weatherCode: 3,
		};
		const stillGray = refineWithMinutely(
			overcast,
			buildMinutely15(series([["2026-07-19T06:45", 0, 3]])),
			"2026-07-19T06:50"
		);
		assert.equal(stillGray.cloudiness, 2);
		assert.equal(stillGray.intensity, 0.35);
	});

	it("scales 15-minute mm to the hourly intensity curve", () => {
		const heavy = refineWithMinutely(
			clearDay,
			buildMinutely15(series([["2026-07-19T06:30", 2.5, 65]])),
			"2026-07-19T06:40"
		);
		assert.ok(heavy.intensity >= 0.82, `intensity ${heavy.intensity}`);
	});
});
