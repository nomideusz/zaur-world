import type { WeatherConditions } from "./weather.js";
import { SUN_RISE, SUN_SET } from "./solar.js";

export function cloudAlphaFor(wx: WeatherConditions): number {
	let a = 0;
	if (wx.cloudiness === 1) a = 0.28;
	// A genuinely overcast sky is closed — no blue — even without precip.
	else if (wx.cloudiness === 2) a = 0.72;
	// Real cloud-cover % (when known) smooths the three buckets into a
	// continuum — a 60% sky reads hazier than a lone puff, without ever
	// thinning what the buckets already promise.
	if (wx.cloudCover != null) {
		a = Math.max(a, Math.min(1, Math.max(0, wx.cloudCover / 100)) * 0.75);
	}
	if (wx.thunder) a = Math.max(a, 0.6);
	if (wx.precipitation === "rain") a = Math.max(a, 0.38);
	if (wx.precipitation === "snow") a = Math.max(a, 0.35);
	const i = Math.max(0, Math.min(1, wx.intensity));
	// Intensity opens the dial: drizzle is a veil, 100% is a sealed deck.
	a += i * 0.22 + i * i * 0.45;
	return Math.min(1, a);
}

export function starAlpha(h: number): number {
	if (h >= 20 || h <= 4) return 1;
	if (h > 18 && h < 20) return (h - 18) / 2;
	if (h > 4 && h < 6) return 1 - (h - 4) / 2;
	return 0;
}

export function auroraAlpha(h: number): number {
	if (h >= 21 || h <= 4) return 1;
	if (h > 19 && h < 21) return (h - 19) / 2;
	if (h > 4 && h < 6) return 1 - (h - 4) / 2;
	return 0;
}

export function heatFactor(tempC: number, cloudAlpha: number, h: number): number {
	const t = (tempC - 27) / 8;
	if (t <= 0) return 0;
	return Math.min(1, t) * daylight(h) * (1 - cloudAlpha);
}

/**
 * 0..1 haze strength from horizontal visibility (metres). Clear air (~10 km+)
 * reads crisp; mist closes in below ~6 km and is thick under ~0.6 km. Overcast
 * already reads gray, so visibility haze adds less on top of it. Unknown
 * visibility = no haze (keeps hand-rolled weather sources unchanged).
 */
export function hazeFactor(
	visibilityM: number | null | undefined,
	cloudAlpha: number
): number {
	if (visibilityM == null || !Number.isFinite(visibilityM)) return 0;
	const visKm = visibilityM / 1000;
	const raw = visKm >= 10 ? 0 : visKm <= 0.6 ? 1 : 1 - (visKm - 0.6) / (10 - 0.6);
	return Math.max(0, Math.min(1, raw)) * (1 - cloudAlpha * 0.3);
}

/**
 * 0..1 crepuscular-ray (god ray) strength. Rays need the sun up and gaps in
 * the deck: they peak around broken cloud and vanish when it's clear (nothing
 * to cast shafts) or sealed (the sun is hidden). A low sun throws longer, more
 * dramatic shafts; noon stays subtle.
 */
export function godRayFactor(cloudAlpha: number, h: number): number {
	if (h <= SUN_RISE || h >= SUN_SET) return 0;
	const t = (h - SUN_RISE) / (SUN_SET - SUN_RISE);
	const gaps = Math.max(0, 1 - Math.abs(cloudAlpha - 0.42) / 0.42);
	if (gaps <= 0) return 0;
	// 0 at noon, 1 at sunrise/sunset — low sun throws the longest shafts.
	const low = Math.abs(t - 0.5) * 2;
	return gaps * (0.35 + 0.65 * low);
}

export function daylight(h: number): number {
	if (h <= SUN_RISE - 1 || h >= SUN_SET + 1) return 0;
	if (h < SUN_RISE + 1) return (h - (SUN_RISE - 1)) / 2;
	if (h > SUN_SET - 1) return ((SUN_SET + 1) - h) / 2;
	return 1;
}

export function dayCreatureAlpha(h: number): number {
	if (h <= SUN_RISE - 0.5 || h >= SUN_SET + 0.5) return 0;
	if (h < SUN_RISE + 1) return (h - (SUN_RISE - 0.5)) / 1.5;
	if (h > SUN_SET - 1) return Math.max(0, ((SUN_SET + 0.5) - h) / 1.5);
	return 1;
}

export function duskAlpha(h: number): number {
	const dt = h - SUN_SET;
	if (dt <= 0 || dt >= 1.4) return 0;
	return Math.sin((dt / 1.4) * Math.PI);
}

export function fireflyAlpha(h: number): number {
	if (h >= 19.5 && h < 23) return Math.min(1, (h - 19.5) / 1.5);
	if (h >= 23 || h < 1) return 1;
	if (h >= 1 && h < 3) return 1 - (h - 1) / 2;
	return 0;
}

export function horizonGlowStrength(h: number): number {
	const dRise = Math.abs(h - SUN_RISE);
	const dSet = Math.abs(h - SUN_SET);
	const d = Math.min(dRise, dSet);
	// Wider window (~90 min) so golden hour actually reads as golden.
	if (d > 1.6) return 0;
	const t = 1 - d / 1.6;
	return t * t * (0.85 + 0.15 * t);
}
