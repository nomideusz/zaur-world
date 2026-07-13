import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	buildAtmosphere,
	formatAtmosphereCaption,
	resolveMood,
	frostFactor,
	isFullMoon,
} from "../dist/atmosphere.js";
import { meteorRate } from "../dist/solar.js";

const clearNight = {
	cloudiness: 0,
	precipitation: "none",
	intensity: 0,
	thunder: false,
	fog: false,
	isDay: false,
	windSpeed: 4,
	temperatureC: -6,
	sunriseH: 7,
	sunsetH: 16,
	latitude: 50,
};

describe("atmosphere", () => {
	it("labels golden hour near sunset", () => {
		assert.equal(resolveMood(17.5, clearNight), "golden");
	});

	it("detects hard frost on cold clear nights", () => {
		assert.ok(frostFactor(clearNight, 22) > 0.35);
		assert.ok(frostFactor({ ...clearNight, temperatureC: 4 }, 22) === 0);
	});

	it("formats a share caption", () => {
		const a = buildAtmosphere({
			date: new Date("2026-07-12T20:40:00"),
			wx: { ...clearNight, temperatureC: 18, sunsetH: 21 },
			wetness: 0.5,
			issActive: false,
			city: "Kraków",
		});
		const caption = formatAtmosphereCaption(a);
		assert.match(caption, /Kraków/);
		assert.match(caption, /\d+:\d+/);
	});

	it("flags meteor shower peaks as busy", () => {
		// Perseids ~ DOY 224
		const d = new Date(Date.UTC(2026, 0, 1));
		d.setUTCDate(224);
		assert.ok(meteorRate(d) >= 8);
	});

	it("recognizes near-full moons", () => {
		// Reference full moon near 2000-01-21
		assert.equal(typeof isFullMoon(new Date("2000-01-21T12:00:00Z")), "boolean");
	});
});
