import type { WeatherConditions, Cloudiness, Precipitation } from "./weather.js";
import {
  daylight,
  duskAlpha,
  horizonGlowStrength,
  cloudAlphaFor,
} from "./sky-math.js";
import { lunarPhase, meteorRate, SUN_RISE, SUN_SET, warpHour } from "./solar.js";

/** Named sky mood for CSS hooks and share captions. */
export type AtmosphereMood =
  | "dawn"
  | "day"
  | "golden"
  | "dusk"
  | "night"
  | "storm"
  | "fog"
  | "snow";

/** Sparse, true-calendar (or live) events worth noticing. */
export type AtmosphereMoment =
  | "meteor-shower"
  | "full-moon"
  | "hard-frost"
  | "iss";

export interface AtmosphereSnapshot {
  isDay: boolean;
  /** 0..1 daylight envelope. */
  daylight: number;
  /** 0..1 dusk bat/firefly window strength. */
  dusk: number;
  /** 0..1 ground wetness after rain. */
  wetness: number;
  /** 0..1 settled snow on the ground. */
  snowCover: number;
  /** 0..1 frost sparkle (cold clear nights / mornings). */
  frost: number;
  precipitation: Precipitation;
  intensity: number;
  cloudiness: Cloudiness;
  temperatureC: number;
  windSpeed: number;
  /** 0..1 rain strength for CSS rain overlays. */
  rain: number;
  /** 0..1 snow strength for CSS snow overlays. */
  snow: number;
  /** 0..1 golden-hour / sunrise-sunset glow. */
  glow: number;
  mood: AtmosphereMood;
  moments: AtmosphereMoment[];
  city: string | null;
  /** Local decimal hour (wall clock, not warped). */
  localHour: number;
  /** Canonical warped hour used for sky drawing. */
  skyHour: number;
}

export function lunarIllumination(date: Date): number {
  const phase = lunarPhase(date);
  return (1 - Math.cos(phase * Math.PI * 2)) / 2;
}

export function isFullMoon(date: Date): boolean {
  return lunarIllumination(date) > 0.92;
}

export function isMeteorShowerNight(date: Date): boolean {
  return meteorRate(date) >= 4;
}

export function frostFactor(wx: WeatherConditions | null, h: number): number {
  if (!wx || wx.temperatureC > 0) return 0;
  if (wx.precipitation === "rain") return 0;
  const cold = Math.min(1, -wx.temperatureC / 8);
  const clear = 1 - cloudAlphaFor(wx) * 0.7;
  // Frost reads at night and early morning — melts visually by mid-morning.
  const window =
    h >= 20 || h < 9 ? 1 : h < 11 ? 1 - (h - 9) / 2 : 0;
  return cold * clear * window;
}

export function resolveMood(
  h: number,
  wx: WeatherConditions | null
): AtmosphereMood {
  if (wx?.thunder || (wx?.precipitation === "rain" && wx.intensity > 0.55)) {
    return "storm";
  }
  if (wx?.precipitation === "snow" && wx.intensity > 0.2) return "snow";
  if (wx?.fog) return "fog";
  const glow = horizonGlowStrength(h);
  if (glow > 0.25 && h > 12 && h < SUN_SET + 0.35) return "golden";
  if (h >= SUN_RISE - 0.3 && h <= SUN_RISE + 1.2) return "dawn";
  if (h >= SUN_SET - 0.2 && h <= SUN_SET + 1.2) return "dusk";
  if (daylight(h) < 0.15) return "night";
  return "day";
}

export function collectMoments(
  date: Date,
  wx: WeatherConditions | null,
  h: number,
  issActive: boolean
): AtmosphereMoment[] {
  const out: AtmosphereMoment[] = [];
  if (isMeteorShowerNight(date) && (h >= 21 || h < 4)) out.push("meteor-shower");
  if (isFullMoon(date) && daylight(h) < 0.35) out.push("full-moon");
  if (frostFactor(wx, h) > 0.35) out.push("hard-frost");
  if (issActive) out.push("iss");
  return out;
}

export function buildAtmosphere(input: {
  date: Date;
  wx: WeatherConditions | null;
  wetness: number;
  snowCover?: number;
  issActive: boolean;
  city?: string | null;
}): AtmosphereSnapshot {
  const { date, wx, wetness, issActive } = input;
  const snowCover = input.snowCover ?? 0;
  const localHour =
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const skyHour = warpHour(localHour, wx?.sunriseH ?? null, wx?.sunsetH ?? null);
  const day = daylight(skyHour);
  const precip = wx?.precipitation ?? "none";
  const intensity = wx?.intensity ?? 0;
  const frost = frostFactor(wx, skyHour);
  return {
    isDay: day > 0.35,
    daylight: day,
    dusk: duskAlpha(skyHour),
    wetness,
    snowCover,
    frost,
    precipitation: precip,
    intensity,
    cloudiness: wx?.cloudiness ?? 0,
    temperatureC: wx?.temperatureC ?? 18,
    windSpeed: wx?.windSpeed ?? 0,
    rain: precip === "rain" ? Math.max(0.25, intensity) : 0,
    snow: precip === "snow" ? Math.max(0.25, intensity) : 0,
    glow: horizonGlowStrength(skyHour),
    mood: resolveMood(skyHour, wx),
    moments: collectMoments(date, wx, skyHour, issActive),
    city: input.city ?? null,
    localHour,
    skyHour,
  };
}

/** Human caption for share cards, e.g. "Kraków · 21:14 · golden hour". */
export function formatAtmosphereCaption(a: AtmosphereSnapshot): string {
  const parts: string[] = [];
  if (a.city) parts.push(a.city);
  const h = Math.floor(a.localHour);
  const m = Math.round((a.localHour % 1) * 60) % 60;
  parts.push(`${h}:${String(m).padStart(2, "0")}`);
  parts.push(moodLabel(a.mood));
  if (a.moments.includes("meteor-shower")) parts.push("meteor shower");
  else if (a.moments.includes("full-moon")) parts.push("full moon");
  else if (a.moments.includes("hard-frost")) parts.push("frost");
  else if (a.moments.includes("iss")) parts.push("ISS pass");
  else if (a.temperatureC <= -1) parts.push(`${Math.round(a.temperatureC)}°C`);
  else if (a.snowCover > 0.35 && a.snow === 0) parts.push("snow on the ground");
  else if (a.wetness > 0.4 && a.rain === 0) parts.push("after rain");
  return parts.join(" · ");
}

function moodLabel(mood: AtmosphereMood): string {
  switch (mood) {
    case "dawn":
      return "dawn";
    case "day":
      return "day";
    case "golden":
      return "golden hour";
    case "dusk":
      return "dusk";
    case "night":
      return "night";
    case "storm":
      return "storm";
    case "fog":
      return "fog";
    case "snow":
      return "snow";
  }
}

/** Push atmosphere into CSS custom properties + data attributes on a root. */
export function applyAtmosphereCSS(
  root: HTMLElement,
  a: AtmosphereSnapshot
): void {
  const s = root.style;
  s.setProperty("--zw-daylight", a.daylight.toFixed(3));
  s.setProperty("--zw-dusk", a.dusk.toFixed(3));
  s.setProperty("--zw-wetness", a.wetness.toFixed(3));
  s.setProperty("--zw-snow-cover", a.snowCover.toFixed(3));
  s.setProperty("--zw-frost", a.frost.toFixed(3));
  s.setProperty("--zw-rain", a.rain.toFixed(3));
  s.setProperty("--zw-snow", a.snow.toFixed(3));
  s.setProperty("--zw-glow", a.glow.toFixed(3));
  s.setProperty("--zw-wind", Math.min(1, a.windSpeed / 40).toFixed(3));
  s.setProperty(
    "--zw-cloud",
    Math.min(1, a.cloudiness / 2 + a.intensity * 0.35 + (a.mood === "storm" ? 0.15 : 0)).toFixed(3)
  );
  root.dataset.zwMood = a.mood;
  root.dataset.zwPrecip = a.precipitation;
  root.dataset.zwDay = a.isDay ? "1" : "0";
  root.dataset.zwMoments = a.moments.join(" ") || undefined;
}

export function clearAtmosphereCSS(root: HTMLElement): void {
  const keys = [
    "--zw-daylight",
    "--zw-dusk",
    "--zw-wetness",
    "--zw-snow-cover",
    "--zw-frost",
    "--zw-rain",
    "--zw-snow",
    "--zw-glow",
    "--zw-wind",
    "--zw-cloud",
  ];
  for (const k of keys) root.style.removeProperty(k);
  delete root.dataset.zwMood;
  delete root.dataset.zwPrecip;
  delete root.dataset.zwDay;
  delete root.dataset.zwMoments;
}
