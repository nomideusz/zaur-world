import type { WeatherConditions } from "./weather.js";

/** Weather look layered over live conditions by `setWeatherPreview` / `preview`. */
export type WeatherPreview = "storm" | "snow" | "fog" | "overcast";

export const WEATHER_PREVIEWS: readonly WeatherPreview[] = [
  "storm",
  "snow",
  "fog",
  "overcast",
];

const FALLBACK_BASE: WeatherConditions = {
  cloudiness: 0,
  precipitation: "none",
  intensity: 0,
  thunder: false,
  fog: false,
  isDay: true,
  windSpeed: 12,
  temperatureC: 18,
  sunriseH: 6.5,
  sunsetH: 19,
};

/** Layer a named weather look over live (or fallback) conditions. */
export function applyWeatherPreview(
  live: WeatherConditions | null,
  preview: WeatherPreview
): WeatherConditions {
  const base = live ?? FALLBACK_BASE;
  switch (preview) {
    case "storm":
      return {
        ...base,
        cloudiness: 2,
        precipitation: "rain",
        intensity: Math.max(0.8, base.intensity),
        thunder: true,
        fog: false,
        windSpeed: Math.max(28, base.windSpeed),
      };
    case "snow":
      return {
        ...base,
        cloudiness: 2,
        precipitation: "snow",
        intensity: Math.max(0.6, base.intensity),
        thunder: false,
        fog: false,
        temperatureC: Math.min(-1, base.temperatureC),
      };
    case "fog":
      return {
        ...base,
        cloudiness: 1,
        precipitation: "none",
        intensity: 0,
        thunder: false,
        fog: true,
        windSpeed: Math.min(6, base.windSpeed),
      };
    case "overcast":
      return {
        ...base,
        cloudiness: 2,
        precipitation: "none",
        intensity: 0,
        thunder: false,
        fog: false,
      };
  }
}
