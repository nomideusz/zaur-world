import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

// The service worker is a classic worker script, so it is loaded into a stub
// global rather than imported. Only strategyFor is exercised; the cache plumbing
// around it is browser-side and verified by actually installing the demo.
const swPath = fileURLToPath(new URL("../demo/public/sw.js", import.meta.url));
const origin = "https://dino.zaur.app";

const context = createContext({
	URL,
	Set,
	Promise,
	fetch: () => Promise.reject(new Error("not called")),
	caches: {},
	self: {
		addEventListener() {},
		skipWaiting() {},
		clients: { claim() {} },
		location: { origin },
	},
});
runInContext(readFileSync(swPath, "utf8"), context);
const { strategyFor } = context;

/** @param {string} href @param {object} [init] */
const route = (href, init = {}) =>
	strategyFor({ method: "GET", mode: "no-cors", ...init }, new URL(href));

describe("service worker routing", () => {
	it("serves navigations network-first so a deploy is picked up", () => {
		assert.equal(route(`${origin}/`, { mode: "navigate" }), "network-first");
		assert.equal(route(`${origin}/?wx=snow`, { mode: "navigate" }), "network-first");
	});

	it("serves hashed assets and icons cache-first", () => {
		assert.equal(route(`${origin}/assets/index-a1b2c3.js`), "cache-first");
		assert.equal(route(`${origin}/assets/index-d4e5f6.css`), "cache-first");
		assert.equal(route(`${origin}/icons/icon-192.png`), "cache-first");
		assert.equal(route(`${origin}/manifest.webmanifest`), "cache-first");
	});

	it("caches the web fonts so typography survives offline", () => {
		assert.equal(route("https://fonts.googleapis.com/css2?family=Syne"), "cache-first");
		assert.equal(route("https://fonts.gstatic.com/s/syne/v22/font.woff2"), "cache-first");
	});

	// Regression: v1 treated every same-origin GET as a static asset, which
	// swallowed the analytics that Netlify proxies through this origin. The
	// beacon carries a fresh id per pageview, so the cache grew one entry per
	// visit, and the unhashed scripts could never update.
	it("never caches same-origin analytics, proxied or otherwise", () => {
		for (const path of [
			"/proxy.js",
			"/auto-events.js",
			"/simple/simple.gif?page_id=8c7f34a9&session_id=8b0209a9&time=1789792437683",
			"/api/anything",
		]) {
			assert.equal(route(`${origin}${path}`), "pass", path);
		}
	});

	// The library keeps its own localStorage fallback with freshness rules. A
	// second cache in front of these would serve stale skies it cannot invalidate.
	it("never caches the live data APIs", () => {
		for (const href of [
			"https://api.open-meteo.com/v1/forecast?latitude=50&longitude=19",
			"https://api.open-meteo.com/v1/elevation?latitude=50&longitude=19",
			"https://geocoding-api.open-meteo.com/v1/search?name=Krakow",
			"https://get.geojs.io/v1/ip/geo.json",
			"https://api.bigdatacloud.net/data/reverse-geocode-client",
			"https://api.wheretheiss.at/v1/satellites/25544",
		]) {
			assert.equal(route(href), "pass", href);
		}
	});

	it("passes through non-GET requests", () => {
		assert.equal(route(`${origin}/`, { method: "POST", mode: "navigate" }), "pass");
	});
});
