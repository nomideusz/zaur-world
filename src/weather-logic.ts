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
	pressure_msl?: number;
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
	wind_speed_10m?: number[];
	relative_humidity_2m?: number[];
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
	windSpeed: number | null;
	humidity: number | null;
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

/** WMO weather code → the sky fields the renderer cares about. */
function skyFromCode(
	code: number,
	precipMm: number
): Pick<WeatherConditions, "cloudiness" | "precipitation" | "intensity" | "thunder" | "fog"> {
	let cloudiness: Cloudiness = 0;
	if ([1, 2].includes(code)) cloudiness = 1;
	else if (code === 3 || (code >= 45 && code <= 99)) cloudiness = 2;

	let precipitation: Precipitation = "none";
	if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) {
		precipitation = "rain";
	} else if ([71, 73, 75, 77, 85, 86].includes(code)) {
		precipitation = "snow";
	}

	let intensity = 0.4;
	if ([55, 65, 67, 75, 82, 86, 99].includes(code)) intensity = 0.95;
	else if ([53, 63, 73, 81, 96].includes(code)) intensity = 0.65;
	else if (precipMm >= 1) intensity = Math.min(0.9, 0.35 + precipMm * 0.05);

	return {
		cloudiness,
		precipitation,
		intensity,
		thunder: [95, 96, 99].includes(code),
		fog: [45, 48].includes(code),
	};
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
		isDay: c.is_day !== 0,
		windSpeed: c.wind_speed_10m ?? 0,
		temperatureC: c.temperature_2m,
		sunriseH: isoToHour(daily?.sunrise?.[0]),
		sunsetH: isoToHour(daily?.sunset?.[0]),
		weatherCode: c.weather_code,
		humidity: c.relative_humidity_2m ?? null,
		cloudCover: c.cloud_cover ?? null,
		pressureMsl: c.pressure_msl ?? null,
		windDirection: c.wind_direction_10m ?? null,
		windGusts: c.wind_gusts_10m ?? null,
	};
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
			windSpeed: hourly.wind_speed_10m?.[i] ?? null,
			humidity: hourly.relative_humidity_2m?.[i] ?? null,
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
 * rolls into tomorrow's forecast. Temperature and wind interpolate toward
 * the following slot; sunrise/sunset/latitude carry over from `base`.
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
	const sky = skyFromCode(slot.weatherCode, slot.precipMm);
	const windSpeed = slot.windSpeed ?? base?.windSpeed ?? 0;
	return {
		...sky,
		cloudiness: refineCloudiness(sky.cloudiness, slot.cloudCover),
		isDay: slot.isDay,
		windSpeed: next?.windSpeed != null ? lerp(windSpeed, next.windSpeed, frac) : windSpeed,
		temperatureC: next ? lerp(slot.temperatureC, next.temperatureC, frac) : slot.temperatureC,
		sunriseH: base?.sunriseH ?? null,
		sunsetH: base?.sunsetH ?? null,
		latitude: base?.latitude,
		weatherCode: slot.weatherCode,
		humidity: slot.humidity,
		cloudCover: slot.cloudCover,
		pressureMsl: base?.pressureMsl ?? null,
		windDirection: base?.windDirection ?? null,
		windGusts: null,
		precipProbability: slot.precipProbability,
	};
}
