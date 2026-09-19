// Offline shell for the zaur.world demo. Hand-rolled on purpose: Vite hashes
// every asset filename, so cache-first needs no precache manifest and no
// Workbox build step.
//
// Weather, geocoding and ISS calls are deliberately NOT cached here — the
// library keeps its own localStorage fallback with freshness rules, and a
// second cache in front of it would serve stale skies it cannot invalidate.

const CACHE = "zw-v1";

// Cached so the typography survives offline; both are immutable-by-URL.
const FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

// Enough to boot with no network. Hashed JS/CSS fills in on first visit.
const SHELL = [
	"/",
	"/manifest.webmanifest",
	"/icons/favicon-32.png",
	"/icons/icon-192.png",
	"/icons/icon-512.png",
	"/icons/apple-touch-icon.png",
];

/**
 * Which strategy a request gets. Pure, so test/sw-routing.test.mjs can drive it
 * without a browser.
 *
 * - "network-first"  navigations: a deploy changes index.html at a stable URL
 * - "cache-first"    hashed assets, icons, fonts: URL changes when bytes change
 * - "pass"           everything else, notably the live weather APIs
 *
 * @returns {"network-first" | "cache-first" | "pass"}
 */
function strategyFor(request, url) {
	if (request.method !== "GET") return "pass";
	if (request.mode === "navigate") return "network-first";
	if (url.origin === self.location.origin) return "cache-first";
	if (FONT_HOSTS.has(url.host)) return "cache-first";
	return "pass";
}

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			// Individually, so one 404 cannot fail the whole install.
			.then((cache) => Promise.allSettled(SHELL.map((path) => cache.add(path))))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

async function networkFirst(request) {
	try {
		const fresh = await fetch(request);
		if (fresh.ok) {
			const cache = await caches.open(CACHE);
			await cache.put("/", fresh.clone());
		}
		return fresh;
	} catch {
		// Offline: any cached navigation is better than the browser's error page.
		const cached = (await caches.match("/")) ?? (await caches.match(request));
		if (cached) return cached;
		throw new Error("offline and no cached shell");
	}
}

async function cacheFirst(request) {
	const cached = await caches.match(request);
	if (cached) return cached;
	const fresh = await fetch(request);
	// Opaque cross-origin font responses report status 0 — still worth keeping.
	if (fresh.ok || fresh.type === "opaque") {
		const cache = await caches.open(CACHE);
		await cache.put(request, fresh.clone());
	}
	return fresh;
}

self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);
	switch (strategyFor(event.request, url)) {
		case "network-first":
			event.respondWith(networkFirst(event.request));
			break;
		case "cache-first":
			event.respondWith(cacheFirst(event.request));
			break;
		// "pass" — no respondWith, the request goes straight to the network.
	}
});

// ponytail: cache grows across deploys — superseded hashed assets are never
// evicted, only whole-cache-version drops clear them. A few hundred KB per
// deploy; add an activate-time sweep against the live asset list if it matters.
