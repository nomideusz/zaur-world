// A manually pinned location must survive reloads: stored with a "fixed"
// marker, restored as a pin on the next visit (instead of being overwritten
// by IP detection), and fully cleared when the visitor returns to auto.
import { test } from "node:test";
import assert from "node:assert";

const store = new Map();
globalThis.localStorage = {
	getItem: (k) => store.get(k) ?? null,
	setItem: (k, v) => store.set(k, v),
	removeItem: (k) => store.delete(k),
};
globalThis.window = {
	setTimeout: setTimeout.bind(globalThis),
	clearTimeout: clearTimeout.bind(globalThis),
	setInterval: () => 0,
	clearInterval() {},
	addEventListener() {},
	location: { hostname: "test" },
};
globalThis.document = {
	addEventListener() {},
	removeEventListener() {},
	visibilityState: "visible",
};
// Offline: geo/weather fetches fail, so only cache/fallback paths run.
globalThis.fetch = () => Promise.reject(new Error("offline"));

const { WeatherClient } = await import("../dist/weather.js");
const KEY = "zaur-world-geo";

test("setGeo stores the pin with a fixed marker", async () => {
	store.clear();
	const c = new WeatherClient({});
	await c.setGeo({ lat: 50.06, lon: 19.94, city: "Kraków" });
	const saved = JSON.parse(store.get(KEY));
	assert.equal(saved.src, "fixed");
	assert.equal(saved.city, "Kraków");
});

test("a stored pin restores as a manual pin on the next visit", () => {
	store.set(KEY, JSON.stringify({ lat: 50.06, lon: 19.94, city: "Kraków", src: "fixed" }));
	const c = new WeatherClient({});
	assert.deepEqual(c.manualGeo, { lat: 50.06, lon: 19.94, city: "Kraków" });
});

test("a plain cache entry does not become a pin", () => {
	store.set(KEY, JSON.stringify({ lat: 51.5, lon: -0.1, city: "London" }));
	const c = new WeatherClient({});
	assert.equal(c.manualGeo, null);
});

test("setGeo(null) drops the pin; re-detected geo is cached unmarked", async () => {
	store.clear();
	const c = new WeatherClient({});
	await c.setGeo({ lat: 50.06, lon: 19.94, city: "Kraków" });
	await c.setGeo(null);
	const after = JSON.parse(store.get(KEY) ?? "null");
	assert.equal(after?.src, undefined);
	const fresh = new WeatherClient({});
	assert.equal(fresh.manualGeo, null);
});
