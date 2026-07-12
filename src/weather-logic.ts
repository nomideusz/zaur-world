import type { Cloudiness, Precipitation, WeatherConditions } from "./weather.js";

export interface OpenMeteoCurrent {
	temperature_2m: number;
	apparent_temperature?: number;
	weather_code: number;
	is_day?: number;
	precipitation?: number;
	wind_speed_10m?: number;
}

export interface OpenMeteoDaily {
	sunrise?: string[];
	sunset?: string[];
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

export function deriveConditions(
	c: OpenMeteoCurrent,
	daily?: OpenMeteoDaily
): WeatherConditions {
	const code = c.weather_code;
	const isDay = c.is_day !== 0;
	const precipMm = c.precipitation ?? 0;

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
		isDay,
		windSpeed: c.wind_speed_10m ?? 0,
		temperatureC: c.temperature_2m,
		sunriseH: isoToHour(daily?.sunrise?.[0]),
		sunsetH: isoToHour(daily?.sunset?.[0]),
	};
}
