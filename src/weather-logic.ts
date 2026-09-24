import type { Cloudiness, Precipitation, WeatherConditions } from "./weather.js";

export interface OpenMeteoCurrent {
	temperature_2m: number;
	apparent_temperature?: number;
	weather_code: number;
	is_day?: number;
	precipitation?: number;
	wind_speed_10m?: number;
	wind_direction_10m?: number;
	wind_gusts_10m?: number;
	relative_humidity_2m?: number;
	cloud_cover?: number;
	cloud_cover_high?: number;
	pressure_msl?: number;
	visibility?: number;
	dew_point_2m?: number;
	/** Snowfall amount of the preceding hour, centimetres. */
	snowfall?: number;
}

export interface OpenMeteoDaily {
	sunrise?: string[];
	sunset?: string[];
	temperature_2m_max?: number[];
	temperature_2m_min?: number[];
}

export interface OpenMeteoHourly {
	time?: string[];
	temperature_2m?: number[];
	weather_code?: number[];
	precipitation?: number[];
	precipitation_probability?: number[];
	cloud_cover?: number[];
	cloud_cover_high?: number[];
	wind_speed_10m?: number[];
	wind_direction_10m?: number[];
	relative_humidity_2m?: number[];
	visibility?: number[];
	dew_point_2m?: number[];
	snowfall?: number[];
	is_day?: number[];
}

/** One hour of forecast, flattened from Open-Meteo's parallel arrays. */
export interface ForecastHour {
	/** Local wall-clock time, e.g. "2026-07-14T15:00". */
	timeISO: string;
	/** Local decimal hour 0..23 (derived from timeISO). */
	hour: number;
	temperatureC: number;
	weatherCode: number;
	precipMm: number;
	precipProbability: number | null;
	cloudCover: number | null;
	cloudCoverHigh?: number | null;
	windSpeed: number | null;
	/** Direction the wind blows *from*, degrees (0 = north). */
	windDirection: number | null;
	humidity: number | null;
	visibilityM: number | null;
	dewPointC: number | null;
	snowfallCm: number | null;
	isDay: boolean;
}

/**
 * "2026-07-11T04:34" → 4.57. With timezone=auto Open-Meteo returns local
 * wall-clock strings, so slicing avoids any Date/timezone round-trip.
 */
export function isoToHour(s: string | undefined): number | null {
	if (!s || s.length < 16) return null;
	const h = Number(s.slice(11, 13));
	const m = Number(s.slice(14, 16));
	return Number.isFinite(h) && Number.isFinite(m) ? h + m / 60 : null;
}

/**
 * Format an instant as "YYYY-MM-DDTHH:MM" in a fixed UTC offset (seconds east
 * of UTC) — matches Open-Meteo `timezone=auto` wall-clock strings so forecast
 * slot matching stays correct when the device TZ differs (e.g. VPN).
 */
export function isoInUtcOffset(d: Date, utcOffsetSeconds: number): string {
	const shifted = new Date(d.getTime() + utcOffsetSeconds * 1000);
	const pad = (n: number): string => String(n).padStart(2, "0");
	return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
		shifted.getUTCDate()
	)}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** Decimal hour 0..24 in a fixed UTC offset (seconds east of UTC). */
export function decimalHourInUtcOffset(d: Date, utcOffsetSeconds: number): number {
	const shifted = new Date(d.getTime() + utcOffsetSeconds * 1000);
	return (
		shifted.getUTCHours() +
		shifted.getUTCMinutes() / 60 +
		shifted.getUTCSeconds() / 3600
	);
}

/**
 * Return a Date whose *local* getters (`getHours`, …) show the wall clock at
 * `utcOffsetSeconds`, so the sky can stay keyed to the forecast location
 * even when the browser timezone disagrees.
 */
export function dateAsLocationLocal(d: Date, utcOffsetSeconds: number): Date {
	const systemOffsetSec = -d.getTimezoneOffset() * 60;
	return new Date(d.getTime() + (utcOffsetSeconds - systemOffsetSec) * 1000);
}

/** Great-circle distance in kilometres (WGS84 sphere). */
export function geoDistanceKm(
	a: { lat: number; lon: number },
	b: { lat: number; lon: number }
): number {
	const toRad = (d: number): number => (d * Math.PI) / 180;
	const r = 6371;
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * True when the forecast location's UTC offset disagrees with the browser
 * clock — common under VPN (IP geo in one zone, device TZ in another).
 */
export function timezoneOffsetMismatch(
	forecastOffsetSec: number | null | undefined,
	browserOffsetSec: number,
	thresholdSec = 45 * 60
): boolean {
	if (forecastOffsetSec == null || !Number.isFinite(forecastOffsetSec)) return false;
	return Math.abs(forecastOffsetSec - browserOffsetSec) >= thresholdSec;
}

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

/**
 * Continuous precip intensity 0..1 from WMO code + measured/forecast mm
 * (+ optional probability). Replaces the old 0.4 / 0.65 / 0.95 buckets so
 * drizzle, showers, and storms scale particle density smoothly.
 */
export function intensityFromPrecip(
	code: number,
	precipMm: number,
	precipProbability?: number | null
): number {
	const wet = RAIN_CODES.has(code) || SNOW_CODES.has(code);
	const mm = Number.isFinite(precipMm) ? Math.max(0, precipMm) : 0;

	// Soft floor from WMO severity — keeps "heavy" codes punchy even when
	// the hourly mm field is coarse or lagged.
	let codeFloor = 0;
	if ([55, 65, 67, 75, 82, 86, 99].includes(code)) codeFloor = 0.82;
	else if ([53, 63, 73, 81, 96].includes(code)) codeFloor = 0.55;
	else if ([51, 56, 57, 61, 66, 71, 77, 80, 85, 95].includes(code)) codeFloor = 0.32;

	// Continuous mm curve: ~0.2 mm ≈ light veil, ~2 mm ≈ solid rain, 8+ ≈ max.
	const fromMm = mm <= 0 ? 0 : Math.min(1, 0.18 + (1 - Math.exp(-mm / 2.4)) * 0.82);

	let intensity = Math.max(codeFloor, fromMm);

	// Forecast-only: a dry slot with high precip chance still shows a hint.
	if (
		intensity < 0.2 &&
		precipProbability != null &&
		Number.isFinite(precipProbability) &&
		precipProbability >= 40
	) {
		intensity = Math.max(intensity, (precipProbability / 100) * 0.42);
	}

	if (!wet && mm < 0.05 && intensity < 0.2) return 0;
	return Math.max(0, Math.min(1, intensity));
}

/** WMO weather code → the sky fields the renderer cares about. */
function skyFromCode(
	code: number,
	precipMm: number,
	precipProbability?: number | null
): Pick<WeatherConditions, "cloudiness" | "precipitation" | "intensity" | "thunder" | "fog"> {
	let cloudiness: Cloudiness = 0;
	if ([1, 2].includes(code)) cloudiness = 1;
	else if (code === 3 || (code >= 45 && code <= 99)) cloudiness = 2;

	let precipitation: Precipitation = "none";
	if (RAIN_CODES.has(code)) precipitation = "rain";
	else if (SNOW_CODES.has(code)) precipitation = "snow";

	return {
		cloudiness,
		precipitation,
		intensity: intensityFromPrecip(code, precipMm, precipProbability),
		thunder: [95, 96, 99].includes(code),
		fog: [45, 48].includes(code),
	};
}

/** Dry overcast still reads heavy: cloud cover lifts intensity up to 0.35. */
function coverLift(
	intensity: number,
	precipitation: Precipitation,
	cover: number | null | undefined
): number {
	return precipitation === "none" && cover != null
		? Math.max(intensity, Math.min(0.35, (cover / 100) * 0.35))
		: intensity;
}

/** Real cloud-cover % can promote the code-derived bucket (never demote). */
function refineCloudiness(base: Cloudiness, cover: number | null | undefined): Cloudiness {
	if (cover == null || !Number.isFinite(cover)) return base;
	const fromCover: Cloudiness = cover >= 85 ? 2 : cover >= 35 ? 1 : 0;
	return fromCover > base ? fromCover : base;
}

export function deriveConditions(
	c: OpenMeteoCurrent,
	daily?: OpenMeteoDaily
): WeatherConditions {
	const sky = skyFromCode(c.weather_code, c.precipitation ?? 0);
	return {
		...sky,
		cloudiness: refineCloudiness(sky.cloudiness, c.cloud_cover),
		// Cloud cover also lifts dry-overcast intensity slightly so a sealed
		// gray sky feels heavier than a clear day with the same code.
		intensity: coverLift(sky.intensity, sky.precipitation, c.cloud_cover),
		isDay: c.is_day !== 0,
		windSpeed: c.wind_speed_10m ?? 0,
		temperatureC: c.temperature_2m,
		sunriseH: isoToHour(daily?.sunrise?.[0]),
		sunsetH: isoToHour(daily?.sunset?.[0]),
		weatherCode: c.weather_code,
		humidity: c.relative_humidity_2m ?? null,
		cloudCover: c.cloud_cover ?? null,
		cloudCoverHigh: c.cloud_cover_high ?? null,
		pressureMsl: c.pressure_msl ?? null,
		windDirection: c.wind_direction_10m ?? null,
		windGusts: c.wind_gusts_10m ?? null,
		visibilityM: c.visibility ?? null,
		dewPointC: c.dew_point_2m ?? null,
		snowfallCm: c.snowfall ?? null,
		// Lightning potential comes only from the 15-min nowcast; the coarse
		// "current" block has no equivalent, so it starts unset.
		lightningPotential: null,
	};
}

/** Open-Meteo `minutely_15` block — 15-minute near-term series. */
export interface OpenMeteoMinutely15 {
	time?: string[];
	precipitation?: number[];
	weather_code?: number[];
	lightning_potential?: number[];
}

/** One 15-minute slot of near-term precipitation. */
export interface MinutelySlot {
	/** Local wall-clock slot start, e.g. "2026-07-19T06:15". */
	timeISO: string;
	/** Precipitation in this 15-minute slot, mm. */
	precipMm: number;
	weatherCode: number | null;
	/** 0..1 chance of lightning in this slot (normalized from %). */
	lightningPotential: number | null;
}

/**
 * Open-Meteo reports `lightning_potential` as a 0–100 percentage. Normalize it
 * to a 0..1 likelihood the renderer can consume directly.
 */
export function normalizeLightningPotential(v: number | null | undefined): number | null {
	if (v == null || !Number.isFinite(v)) return null;
	return Math.max(0, Math.min(1, v / 100));
}

/** Flatten Open-Meteo's parallel minutely_15 arrays into slot records. */
export function buildMinutely15(m: OpenMeteoMinutely15 | undefined): MinutelySlot[] {
	const times = m?.time;
	if (!m || !times) return [];
	const out: MinutelySlot[] = [];
	for (let i = 0; i < times.length; i++) {
		const t = times[i];
		if (!t || t.length < 16) continue;
		out.push({
			timeISO: t,
			precipMm: m.precipitation?.[i] ?? 0,
			weatherCode: m.weather_code?.[i] ?? null,
			lightningPotential: normalizeLightningPotential(m.lightning_potential?.[i]),
		});
	}
	return out;
}

/**
 * Refine current conditions with the active 15-minute slot, so rain and
 * thunder starting or stopping mid-hour reach the sky within minutes
 * instead of waiting out the coarse hourly value from the last refresh.
 *
 * `nowISO` is a location-local "YYYY-MM-DDTHH:MM" string. Returns `base`
 * itself when no slot covers now (empty/stale series) — callers can use
 * identity to skip change notifications.
 */
export function refineWithMinutely(
	base: WeatherConditions,
	slots: MinutelySlot[],
	nowISO: string
): WeatherConditions {
	if (slots.length === 0 || nowISO.length < 16) return base;
	// Last slot starting at or before now; slots are 15 min apart, so the
	// match must be within the current quarter-hour to be "covering".
	let active: MinutelySlot | null = null;
	for (const slot of slots) {
		if (slot.timeISO <= nowISO) active = slot;
		else break;
	}
	if (!active) return base;
	const minutes = Number(nowISO.slice(14, 16));
	if (!Number.isFinite(minutes)) return base;
	const quarter = String(Math.floor(minutes / 15) * 15).padStart(2, "0");
	if (active.timeISO !== `${nowISO.slice(0, 14)}${quarter}`) return base;

	const code = active.weatherCode ?? base.weatherCode;
	if (code == null) return base;
	// The intensity curve is tuned for hourly mm — scale the 15-min slot up.
	const sky = skyFromCode(code, active.precipMm * 4);
	const next: WeatherConditions = {
		...base,
		...sky,
		cloudiness: refineCloudiness(sky.cloudiness, base.cloudCover),
		weatherCode: code,
		// The active slot carries the real near-term lightning likelihood;
		// fall back to the previous value so a missing series doesn't jitter.
		lightningPotential: active.lightningPotential ?? base.lightningPotential,
	};
	// Dry sky: keep the cloud-cover intensity lift from deriveConditions so a
	// sealed overcast doesn't flatten to zero when the slot has no precip.
	next.intensity = coverLift(next.intensity, next.precipitation, base.cloudCover);
	if (
		next.cloudiness === base.cloudiness &&
		next.precipitation === base.precipitation &&
		next.intensity === base.intensity &&
		next.thunder === base.thunder &&
		next.fog === base.fog &&
		next.weatherCode === base.weatherCode &&
		next.lightningPotential === base.lightningPotential
	) {
		return base;
	}
	return next;
}

/** Flatten Open-Meteo's parallel hourly arrays into per-hour records. */
export function buildHourlyForecast(hourly: OpenMeteoHourly | undefined): ForecastHour[] {
	const times = hourly?.time;
	if (!hourly || !times) return [];
	const out: ForecastHour[] = [];
	for (let i = 0; i < times.length; i++) {
		const hour = isoToHour(times[i]);
		const temperatureC = hourly.temperature_2m?.[i];
		const weatherCode = hourly.weather_code?.[i];
		if (hour === null || temperatureC === undefined || weatherCode === undefined) continue;
		out.push({
			timeISO: times[i],
			hour,
			temperatureC,
			weatherCode,
			precipMm: hourly.precipitation?.[i] ?? 0,
			precipProbability: hourly.precipitation_probability?.[i] ?? null,
			cloudCover: hourly.cloud_cover?.[i] ?? null,
			cloudCoverHigh: hourly.cloud_cover_high?.[i] ?? null,
			windSpeed: hourly.wind_speed_10m?.[i] ?? null,
			windDirection: hourly.wind_direction_10m?.[i] ?? null,
			humidity: hourly.relative_humidity_2m?.[i] ?? null,
			visibilityM: hourly.visibility?.[i] ?? null,
			dewPointC: hourly.dew_point_2m?.[i] ?? null,
			snowfallCm: hourly.snowfall?.[i] ?? null,
			isDay: (hourly.is_day?.[i] ?? 1) !== 0,
		});
	}
	return out;
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/**
 * Conditions for a wall-clock hour, read from the hourly forecast.
 *
 * `hour` is a local decimal hour (0..24); the slot chosen is the *next*
 * occurrence of that hour at or after `nowISO` (a local "YYYY-MM-DDTHH:MM"
 * string), so a 24-hour sweep starting from the current hour naturally
 * rolls into tomorrow's forecast. Temperature, wind, intensity, cloud cover,
 * humidity, and precip chance interpolate toward the following slot;
 * sunrise/sunset/latitude carry over from `base`.
 * Returns null when the forecast doesn't cover the requested hour.
 */
export function forecastConditionsAt(
	forecast: ForecastHour[],
	hour: number,
	nowISO: string,
	base?: WeatherConditions | null
): WeatherConditions | null {
	if (forecast.length === 0 || nowISO.length < 13) return null;
	// Slot timestamps are top-of-hour; compare against the truncated now so
	// the current, partially elapsed hour still counts as upcoming.
	const nowKey = `${nowISO.slice(0, 13)}:00`;
	let start = forecast.findIndex((s) => s.timeISO >= nowKey);
	if (start === -1) return null;

	const wanted = ((Math.floor(hour) % 24) + 24) % 24;
	const frac = hour - Math.floor(hour);
	let idx = -1;
	for (let i = start; i < Math.min(forecast.length, start + 25); i++) {
		if (Math.floor(forecast[i].hour) === wanted) {
			idx = i;
			break;
		}
	}
	if (idx === -1) return null;

	const slot = forecast[idx];
	const next = forecast[idx + 1] ?? null;
	const sky = skyFromCode(slot.weatherCode, slot.precipMm, slot.precipProbability);
	const nextSky = next
		? skyFromCode(next.weatherCode, next.precipMm, next.precipProbability)
		: null;
	const windSpeed = slot.windSpeed ?? base?.windSpeed ?? 0;
	// Same dry-overcast lift as live conditions, or every tour/scrub would
	// jump between a gray "now" and a flat forecast hour.
	const i0 = coverLift(sky.intensity, sky.precipitation, slot.cloudCover);
	const intensity =
		next && nextSky && frac > 0
			? lerp(i0, coverLift(nextSky.intensity, nextSky.precipitation, next.cloudCover), frac)
			: i0;
	const cloudCover =
		next && slot.cloudCover != null && next.cloudCover != null && frac > 0
			? lerp(slot.cloudCover, next.cloudCover, frac)
			: slot.cloudCover;
	const humidity =
		next && slot.humidity != null && next.humidity != null && frac > 0
			? lerp(slot.humidity, next.humidity, frac)
			: slot.humidity;
	const visibilityM =
		next && slot.visibilityM != null && next.visibilityM != null && frac > 0
			? lerp(slot.visibilityM, next.visibilityM, frac)
			: slot.visibilityM;
	const dewPointC =
		next && slot.dewPointC != null && next.dewPointC != null && frac > 0
			? lerp(slot.dewPointC, next.dewPointC, frac)
			: slot.dewPointC;
	const snowfallCm =
		next && slot.snowfallCm != null && next.snowfallCm != null && frac > 0
			? lerp(slot.snowfallCm, next.snowfallCm, frac)
			: slot.snowfallCm;
	const precipProbability =
		next &&
		slot.precipProbability != null &&
		next.precipProbability != null &&
		frac > 0
			? lerp(slot.precipProbability, next.precipProbability, frac)
			: slot.precipProbability;
	return {
		...sky,
		intensity,
		cloudiness: refineCloudiness(sky.cloudiness, cloudCover),
		isDay: slot.isDay,
		windSpeed: next?.windSpeed != null ? lerp(windSpeed, next.windSpeed, frac) : windSpeed,
		temperatureC: next ? lerp(slot.temperatureC, next.temperatureC, frac) : slot.temperatureC,
		sunriseH: base?.sunriseH ?? null,
		sunsetH: base?.sunsetH ?? null,
		latitude: base?.latitude,
		weatherCode: slot.weatherCode,
		humidity,
		cloudCover,
		cloudCoverHigh: slot.cloudCoverHigh ?? null,
		visibilityM,
		dewPointC,
		snowfallCm,
		pressureMsl: base?.pressureMsl ?? null,
		windDirection: slot.windDirection ?? base?.windDirection ?? null,
		windGusts: null,
		precipProbability,
		// Forecast hours have no 15-min lightning data; thunder still gates the
		// legacy random cadence in the renderer.
		lightningPotential: null,
	};
}
