import type { WeatherConditions, Cloudiness } from "./weather.js";

/** Weather look layered over live conditions by `setWeatherPreview` / `preview`. */
export type WeatherPreview = "storm" | "snow" | "fog" | "overcast";

/** Field-level overrides layered after live weather / named previews. */
export type WeatherOverride = Partial<
  Pick<
    WeatherConditions,
    | "cloudiness"
    | "precipitation"
    | "intensity"
    | "fog"
    | "thunder"
    | "windSpeed"
    | "temperatureC"
  >
> & {
  forceEclipse?: "solar" | "lunar" | null;
};

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
      return normalizeWeather({
        ...base,
        cloudiness: 2,
        precipitation: "rain",
        intensity: Math.max(0.8, base.intensity),
        thunder: true,
        fog: false,
        windSpeed: Math.max(28, base.windSpeed),
      });
    case "snow":
      return normalizeWeather({
        ...base,
        cloudiness: 2,
        precipitation: "snow",
        intensity: Math.max(0.6, base.intensity),
        thunder: false,
        fog: false,
        temperatureC: Math.min(-1, base.temperatureC),
      });
    case "fog":
      return normalizeWeather({
        ...base,
        cloudiness: 1,
        precipitation: "none",
        intensity: 0,
        thunder: false,
        fog: true,
        windSpeed: Math.min(6, base.windSpeed),
      });
    case "overcast":
      return normalizeWeather({
        ...base,
        cloudiness: 2,
        precipitation: "none",
        intensity: 0,
        thunder: false,
        fog: false,
      });
  }
}

/** Merge field overrides over a conditions base (live, preview, or fallback). */
export function applyWeatherOverride(
  base: WeatherConditions | null,
  override: WeatherOverride
): WeatherConditions {
  return normalizeWeather({ ...(base ?? FALLBACK_BASE), ...override });
}

/**
 * Keep conditions physically coherent for the sky renderer.
 * - Snow above ~1°C melts into rain; rain below freezing falls as snow.
 * - Snow stays at or below 0°C; fog can't coexist with a gale.
 * - Precip / thunder always bring enough cloud cover.
 */
export function normalizeWeather(wx: WeatherConditions): WeatherConditions {
  let next = { ...wx };

  // Phase of precipitation follows air temperature.
  if (next.precipitation === "snow" && next.temperatureC > 1) {
    next.precipitation = "rain";
  } else if (next.precipitation === "rain" && next.temperatureC < 0) {
    next.precipitation = "snow";
  }

  // Settled snow weather stays at or below freezing.
  if (next.precipitation === "snow" && next.temperatureC > 0) {
    next.temperatureC = 0;
  }

  // A stiff breeze tears fog apart — keep foggy scenes calm.
  if (next.fog && next.windSpeed > 14) {
    next.windSpeed = 14;
  }

  // Fog with a clear deck looks empty; give it a light veil of cloud.
  if (next.fog && next.cloudiness === 0) {
    next.cloudiness = 1;
  }

  // Thunder needs a storm deck (and rarely rides along with snow).
  if (next.thunder && next.precipitation === "none") {
    next.precipitation = next.temperatureC < 0 ? "snow" : "rain";
    next.intensity = Math.max(0.55, next.intensity);
  }

  if (next.precipitation === "none" && !next.thunder && !next.fog) return next;

  const minClouds: Cloudiness =
    next.thunder || next.intensity > 0.55 || next.precipitation === "snow"
      ? 2
      : 1;
  if (next.cloudiness < minClouds) next.cloudiness = minClouds;
  return next;
}
