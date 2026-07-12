/** Canonical sun window (decimal hours) used for sky keyframes and arcs. */
export const SUN_RISE = 5.8;
export const SUN_SET = 18.2;

const MOON_REF_MS = Date.UTC(2000, 0, 6, 18, 14);
const MOON_SYNODIC_MS = 29.530588 * 86_400_000;

/**
 * Piecewise-linear time warp: real sunrise → SUN_RISE, real sunset →
 * SUN_SET, night stretched/compressed to fill the rest.
 */
export function warpHour(h: number, rise: number | null, set: number | null): number {
	if (rise == null || set == null) return h;
	const dayLen = set - rise;
	if (dayLen < 1 || dayLen > 23) return h;
	if (h >= rise && h <= set) {
		return SUN_RISE + ((h - rise) / dayLen) * (SUN_SET - SUN_RISE);
	}
	const nightLen = 24 - dayLen;
	const sinceSet = (h - set + 24) % 24;
	return (SUN_SET + (sinceSet / nightLen) * (24 - SUN_SET + SUN_RISE)) % 24;
}

/** Aurora strength by latitude — strongest above ~60°, fading below ~45°. */
export function auroraLatFactor(lat: number | null | undefined): number {
	if (lat == null) return 0.35;
	const abs = Math.abs(lat);
	if (abs >= 60) return 1;
	if (abs >= 45) return (abs - 45) / 15;
	return 0;
}

/**
 * Shooting-star frequency multiplier around major meteor-shower peaks
 * (day-of-year ±3).
 */
export function meteorRate(date: Date): number {
	const start = Date.UTC(date.getUTCFullYear(), 0, 0);
	const doy = Math.floor((date.getTime() - start) / 86_400_000);
	const peaks: Array<[number, number]> = [
		[3, 4],
		[112, 2],
		[126, 2],
		[224, 5],
		[294, 2],
		[348, 6],
	];
	for (const [p, rate] of peaks) {
		if (Math.abs(doy - p) <= 3) return rate;
	}
	return 1;
}

export function venusState(date: Date): { elong: number; evening: boolean } {
	const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
	const LE = ((100.46 + 0.9856474 * d) * Math.PI) / 180;
	const LV = ((181.98 + 1.6021302 * d) * Math.PI) / 180;
	const ex = Math.cos(LE);
	const ey = Math.sin(LE);
	const gx = 0.723 * Math.cos(LV) - ex;
	const gy = 0.723 * Math.sin(LV) - ey;
	const sunLon = Math.atan2(-ey, -ex);
	const venLon = Math.atan2(gy, gx);
	let diff = venLon - sunLon;
	while (diff > Math.PI) diff -= Math.PI * 2;
	while (diff < -Math.PI) diff += Math.PI * 2;
	return { elong: Math.abs((diff * 180) / Math.PI), evening: diff > 0 };
}

/** Lunar phase fraction in [0, 1): 0 = new, 0.5 = full. */
export function lunarPhase(date: Date): number {
	const elapsed = date.getTime() - MOON_REF_MS;
	return (((elapsed % MOON_SYNODIC_MS) + MOON_SYNODIC_MS) % MOON_SYNODIC_MS) / MOON_SYNODIC_MS;
}

/**
 * Subtle golden warmth on summer-afternoon skies within ~15 days of solstice.
 * Hemisphere-aware via latitude sign.
 */
export function solsticeWarmth(date: Date, latitude = 50): number {
	const start = Date.UTC(date.getUTCFullYear(), 0, 0);
	const doy = Math.floor((date.getTime() - start) / 86_400_000);
	const peak = latitude >= 0 ? 172 : 355;
	let dist = Math.abs(doy - peak);
	if (dist > 182) dist = 365 - dist;
	if (dist > 15) return 0;
	const h = date.getHours() + date.getMinutes() / 60;
	if (h < 10 || h > 18) return 0;
	return 0.08 * (1 - dist / 15);
}
