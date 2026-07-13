import type { WeatherConditions } from "./weather.js";
import { SUN_RISE, SUN_SET } from "./solar.js";

export function cloudAlphaFor(wx: WeatherConditions): number {
	let a = 0;
	if (wx.cloudiness === 1) a = 0.35;
	else if (wx.cloudiness === 2) a = 0.65;
	if (wx.thunder) a = Math.max(a, 0.85);
	if (wx.precipitation === "rain") a = Math.max(a, 0.55);
	if (wx.precipitation === "snow") a = Math.max(a, 0.5);
	return Math.min(1, a + wx.intensity * 0.1);
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
