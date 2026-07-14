// Per-visitor weather. Independent of the shared archive — each visitor
// fetches their own location-derived conditions, sees a small ambient card
// that fades in and back out on its own, and the World reads `conditions()`
// each frame to tint the sky with clouds and precipitation.

import { buildHourlyForecast, deriveConditions, forecastConditionsAt } from "./weather-logic.js";
import type {
  ForecastHour,
  OpenMeteoCurrent,
  OpenMeteoDaily,
  OpenMeteoHourly,
} from "./weather-logic.js";

export type Cloudiness = 0 | 1 | 2; // none / scattered / overcast
export type Precipitation = "none" | "rain" | "snow";

export interface WeatherConditions {
  cloudiness: Cloudiness;
  precipitation: Precipitation;
  /** 0..1 — used to scale particle density / overlay strength. */
  intensity: number;
  thunder: boolean;
  fog: boolean;
  isDay: boolean;
  /** Wind speed in km/h — drives cloud drift, rain slant, gust amplitude. */
  windSpeed: number;
  /** Air temperature °C — drives frost caps and heat haze. */
  temperatureC: number;
  /** Today's real sunrise/sunset as local decimal hours, null if unknown. */
  sunriseH: number | null;
  sunsetH: number | null;
  /** Approximate visitor latitude in degrees — drives hemisphere-aware
   *  seasons. Optional so hand-rolled weather sources stay valid. */
  latitude?: number | null;
  /** WMO weather code from the provider — feed to `describeWeather`. */
  weatherCode?: number | null;
  /** Relative humidity, %. */
  humidity?: number | null;
  /** Total cloud cover, % — smooths the three-bucket cloudiness. */
  cloudCover?: number | null;
  /** Mean sea-level pressure, hPa. */
  pressureMsl?: number | null;
  /** Direction the wind blows *from*, degrees (0 = north). */
  windDirection?: number | null;
  /** Wind gusts, km/h. */
  windGusts?: number | null;
  /** Chance of precipitation, % (forecast hours only). */
  precipProbability?: number | null;
}

export interface GeoLocation {
  lat: number;
  lon: number;
  city?: string;
}

export type WeatherCardPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export interface WeatherCardOptions {
  parent: HTMLElement;
  position?: WeatherCardPosition;
}

interface Geo {
  lat: number;
  lon: number;
  city: string;
}

const REFRESH_MS = 15 * 60_000;
const FIRST_SHOW_DELAY_MS = 4_000;
const REPEAT_SHOW_INTERVAL_MS = 6 * 60_000;
const CARD_DURATION_MS = 9_000;
const WEATHER_FETCH_TIMEOUT_MS = 8_000;
const FALLBACK_GEO: Geo = { lat: 51.5074, lon: -0.1278, city: "London" };
const GEO_CACHE_KEY = "zaur-world-geo";

export interface WeatherClientOptions {
  /** @deprecated Use `weatherCard.parent` instead. */
  cardParent?: HTMLElement | null;
  /** Small ambient weather card host and placement. */
  weatherCard?: WeatherCardOptions;
  /** Skip IP geolocation — use this fixed location instead. */
  geo?: GeoLocation;
  /** Persist geo in localStorage between visits. Default true. */
  cache?: boolean;
  /** Called when conditions change after a successful fetch. */
  onConditionsChange?: (conditions: WeatherConditions) => void;
  /**
   * After IP geolocation fails, ask the browser for precise location.
   * Requires user consent. Default false.
   */
  geolocation?: boolean;
}

export class WeatherClient {
  private state: WeatherConditions | null = null;
  private hourly: ForecastHour[] = [];
  private todayHighC: number | null = null;
  private todayLowC: number | null = null;
  private cachedGeo: Geo | null = null;
  private readonly card: WeatherCard | null;
  private readonly timers: number[] = [];
  private readonly cache: boolean;
  private readonly onChange: ((conditions: WeatherConditions) => void) | null;
  private readonly useGeolocation: boolean;
  private readonly seedGeo: Geo | null;
  private readonly located: Promise<{ lat: number; lon: number }>;
  private resolveLocated!: (g: { lat: number; lon: number }) => void;

  constructor(opts: WeatherClientOptions = {}) {
    this.cache = opts.cache !== false;
    this.onChange = opts.onConditionsChange ?? null;
    this.useGeolocation = opts.geolocation === true;
    const cardOpts = opts.weatherCard ?? (opts.cardParent ? { parent: opts.cardParent } : null);
    this.card = cardOpts ? new WeatherCard(cardOpts) : null;
    this.located = new Promise((resolve) => {
      this.resolveLocated = resolve;
    });
    if (opts.geo) {
      this.seedGeo = {
        lat: opts.geo.lat,
        lon: opts.geo.lon,
        city: opts.geo.city ?? "your area",
      };
      this.cachedGeo = this.seedGeo;
      this.resolveLocated({ lat: this.seedGeo.lat, lon: this.seedGeo.lon });
    } else {
      this.seedGeo = null;
    }
    void this.refresh();
    this.timers.push(window.setInterval(() => void this.refresh(), REFRESH_MS));
    if (this.card) {
      this.timers.push(
        window.setInterval(() => this.card?.show(CARD_DURATION_MS), REPEAT_SHOW_INTERVAL_MS)
      );
    }
  }

  /** Stop polling and remove the card (if any). */
  destroy(): void {
    for (const t of this.timers) window.clearInterval(t);
    this.card?.remove();
  }

  /** Read by the World each frame to drive cloud / rain rendering. */
  conditions(): WeatherConditions | null {
    return this.state;
  }

  /** Hourly forecast for the next ~48 h (empty until the first fetch). */
  forecast(): ForecastHour[] {
    return this.hourly;
  }

  /**
   * Forecast conditions at a local decimal hour (0..24) — the next
   * occurrence of that hour, so sweeping 24 h ahead rolls into tomorrow.
   * Null until the forecast has loaded.
   */
  conditionsAtHour(hour: number): WeatherConditions | null {
    return forecastConditionsAt(this.hourly, hour, localIso(new Date()), this.state);
  }

  /** Today's forecast high/low °C, or null until known. */
  todayRange(): { highC: number; lowC: number } | null {
    return this.todayHighC !== null && this.todayLowC !== null
      ? { highC: this.todayHighC, lowC: this.todayLowC }
      : null;
  }

  /** Resolved approximate location (null until the first geo lookup). */
  location(): { lat: number; lon: number } | null {
    return this.cachedGeo ? { lat: this.cachedGeo.lat, lon: this.cachedGeo.lon } : null;
  }

  /** City label from geo (null until known). */
  city(): string | null {
    return this.cachedGeo?.city ?? null;
  }

  /** Resolves once approximate location is known (IP, cache, seed, or fallback). */
  whenLocated(): Promise<{ lat: number; lon: number }> {
    return this.located;
  }

  /** Re-fetch weather (e.g. when the tab becomes visible again). */
  refresh(): Promise<void> {
    return this.fetchWeather();
  }

  /** Show or hide the ambient weather card. */
  setCardVisible(visible: boolean): void {
    this.card?.setVisible(visible);
  }

  private async fetchWeather(): Promise<void> {
    try {
      const geo = await this.geo();
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(geo.lat));
      url.searchParams.set("longitude", String(geo.lon));
      url.searchParams.set(
        "current",
        "temperature_2m,apparent_temperature,weather_code,is_day,precipitation," +
          "wind_speed_10m,wind_direction_10m,wind_gusts_10m," +
          "relative_humidity_2m,cloud_cover,pressure_msl"
      );
      url.searchParams.set("daily", "sunrise,sunset,temperature_2m_max,temperature_2m_min");
      url.searchParams.set(
        "hourly",
        "temperature_2m,weather_code,precipitation,precipitation_probability," +
          "cloud_cover,wind_speed_10m,relative_humidity_2m,is_day"
      );
      url.searchParams.set("forecast_days", "2");
      url.searchParams.set("timezone", "auto");
      const res = await fetchWithTimeout(url, { headers: { accept: "application/json" } });
      if (!res.ok) return;
      const data = (await res.json()) as {
        current?: OpenMeteoCurrent;
        daily?: OpenMeteoDaily;
        hourly?: OpenMeteoHourly;
      };
      const c = data.current;
      if (!c) return;

      this.hourly = buildHourlyForecast(data.hourly);
      this.todayHighC = data.daily?.temperature_2m_max?.[0] ?? null;
      this.todayLowC = data.daily?.temperature_2m_min?.[0] ?? null;
      const next = { ...deriveConditions(c, data.daily), latitude: geo.lat };
      const changed = !this.state || !conditionsEqual(this.state, next);
      this.state = next;
      if (changed) this.onChange?.(next);
      if (this.card) {
        this.card.update(formatLine(geo.city, c), formatDetails(c, this.todayRange()), this.state);
        window.setTimeout(() => this.card?.show(CARD_DURATION_MS), FIRST_SHOW_DELAY_MS);
      }
    } catch {
      // Network / CORS error — leave previous state intact, no card update.
    }
  }

  private async geo(): Promise<Geo> {
    if (this.cachedGeo) return this.cachedGeo;
    if (this.seedGeo) {
      this.cachedGeo = this.seedGeo;
      this.resolveLocated({ lat: this.cachedGeo.lat, lon: this.cachedGeo.lon });
      return this.cachedGeo;
    }
    try {
      const res = await fetchWithTimeout("https://get.geojs.io/v1/ip/geo.json");
      if (res.ok) {
        const j = (await res.json()) as {
          latitude?: string | number;
          longitude?: string | number;
          city?: string;
        };
        const lat = Number(j.latitude);
        const lon = Number(j.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          this.cachedGeo = {
            lat,
            lon,
            city: typeof j.city === "string" && j.city.length > 0 ? j.city : "your area",
          };
          if (this.cache) {
            try {
              localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(this.cachedGeo));
            } catch {
              /* private mode */
            }
          }
          this.resolveLocated({ lat: this.cachedGeo.lat, lon: this.cachedGeo.lon });
          return this.cachedGeo;
        }
      }
    } catch {
      /* fall through */
    }
    if (this.useGeolocation) {
      const browser = await this.browserGeo();
      if (browser) {
        this.cachedGeo = browser;
        if (this.cache) {
          try {
            localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(this.cachedGeo));
          } catch {
            /* private mode */
          }
        }
        this.resolveLocated({ lat: this.cachedGeo.lat, lon: this.cachedGeo.lon });
        return this.cachedGeo;
      }
    }
    if (this.cache) {
      try {
        const saved = localStorage.getItem(GEO_CACHE_KEY);
        if (saved) {
          const g = JSON.parse(saved) as Partial<Geo>;
          if (Number.isFinite(g.lat) && Number.isFinite(g.lon) && typeof g.city === "string") {
            this.cachedGeo = { lat: g.lat as number, lon: g.lon as number, city: g.city };
            this.resolveLocated({ lat: this.cachedGeo.lat, lon: this.cachedGeo.lon });
            return this.cachedGeo;
          }
        }
      } catch {
        /* fall through */
      }
    }
    this.cachedGeo = FALLBACK_GEO;
    this.resolveLocated({ lat: this.cachedGeo.lat, lon: this.cachedGeo.lon });
    return this.cachedGeo;
  }

  private browserGeo(): Promise<Geo | null> {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            city: "your area",
          }),
        () => resolve(null),
        { timeout: 12_000, maximumAge: 600_000 }
      );
    });
  }
}

function conditionsEqual(a: WeatherConditions, b: WeatherConditions): boolean {
  return (
    a.cloudiness === b.cloudiness &&
    a.precipitation === b.precipitation &&
    a.intensity === b.intensity &&
    a.thunder === b.thunder &&
    a.fog === b.fog &&
    a.isDay === b.isDay &&
    a.windSpeed === b.windSpeed &&
    a.temperatureC === b.temperatureC &&
    a.sunriseH === b.sunriseH &&
    a.sunsetH === b.sunsetH &&
    a.latitude === b.latitude &&
    a.weatherCode === b.weatherCode &&
    a.humidity === b.humidity &&
    a.cloudCover === b.cloudCover &&
    a.pressureMsl === b.pressureMsl &&
    a.windDirection === b.windDirection &&
    a.windGusts === b.windGusts
  );
}

/** Local wall-clock "YYYY-MM-DDTHH:MM" — comparable to Open-Meteo strings. */
function localIso(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timeout = window.setTimeout(() => ctrl.abort(), WEATHER_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function formatLine(city: string, c: OpenMeteoCurrent): string {
  const desc = describeWeather(c.weather_code, c.is_day !== 0);
  const t = Math.round(c.temperature_2m);
  const feels =
    c.apparent_temperature !== undefined ? Math.round(c.apparent_temperature) : t;
  let line = `${city}: ${desc}, ${t}°C`;
  if (Math.abs(feels - t) >= 2) line += ` (feels ${feels}°)`;
  return line;
}

/** Compass point (8-wind) for a meteorological wind direction in degrees. */
export function compassDir(deg: number): string {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Second card line: wind, humidity, pressure, and today's high/low. */
function formatDetails(
  c: OpenMeteoCurrent,
  range: { highC: number; lowC: number } | null
): string {
  const parts: string[] = [];
  if (c.wind_speed_10m !== undefined) {
    let wind = `wind ${Math.round(c.wind_speed_10m)} km/h`;
    if (c.wind_direction_10m !== undefined) wind += ` ${compassDir(c.wind_direction_10m)}`;
    const gusts = c.wind_gusts_10m;
    if (gusts !== undefined && gusts >= 20 && gusts >= c.wind_speed_10m * 1.5) {
      wind += `, gusts ${Math.round(gusts)}`;
    }
    parts.push(wind);
  }
  if (c.relative_humidity_2m !== undefined) {
    parts.push(`humidity ${Math.round(c.relative_humidity_2m)}%`);
  }
  if (c.pressure_msl !== undefined) parts.push(`${Math.round(c.pressure_msl)} hPa`);
  if (range) parts.push(`↑${Math.round(range.highC)}° ↓${Math.round(range.lowC)}°`);
  return parts.join(" · ");
}

/** Human-readable phrase for a WMO weather code. */
export function describeWeather(code: number, isDay: boolean): string {
  switch (code) {
    case 0:
      return isDay ? "clear skies" : "clear night";
    case 1:
    case 2:
      return "mostly sunny";
    case 3:
      return "overcast";
    case 45:
    case 48:
      return "foggy";
    case 51:
    case 53:
    case 55:
      return "drizzling";
    case 56:
    case 57:
      return "freezing drizzle";
    case 61:
    case 63:
    case 65:
      return "raining";
    case 66:
    case 67:
      return "freezing rain";
    case 71:
    case 73:
    case 75:
      return "snowing";
    case 77:
      return "snow grains";
    case 80:
    case 81:
    case 82:
      return "rain showers";
    case 85:
    case 86:
      return "snow showers";
    case 95:
      return "thunderstorm";
    case 96:
    case 99:
      return "thunderstorm with hail";
    default:
      return "weathering";
  }
}

class WeatherCard {
  private readonly el: HTMLDivElement;
  private hideTimer: number | null = null;
  /** `pinned` = always visible; `ambient` = peek then fade; `hidden` = off. */
  private mode: "ambient" | "pinned" | "hidden" = "ambient";

  constructor(opts: WeatherCardOptions) {
    injectStylesOnce();
    this.el = document.createElement("div");
    this.el.className = "wx-card";
    if (opts.position) this.el.dataset.position = opts.position;
    this.el.setAttribute("role", "status");
    this.el.setAttribute("aria-live", "polite");
    this.el.innerHTML = `
      <span class="wx-card__icon" aria-hidden="true">☁</span>
      <span class="wx-card__body">
        <span class="wx-card__line"></span>
        <span class="wx-card__details" hidden></span>
      </span>
    `;
    opts.parent.appendChild(this.el);
  }

  update(line: string, details: string, conditions: WeatherConditions): void {
    const lineEl = this.el.querySelector<HTMLSpanElement>(".wx-card__line");
    const detailsEl = this.el.querySelector<HTMLSpanElement>(".wx-card__details");
    const iconEl = this.el.querySelector<HTMLSpanElement>(".wx-card__icon");
    if (lineEl) lineEl.textContent = line;
    if (detailsEl) {
      detailsEl.textContent = details;
      detailsEl.hidden = details.length === 0;
    }
    if (iconEl) iconEl.textContent = iconFor(conditions);
  }

  remove(): void {
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.el.remove();
  }

  show(durationMs: number): void {
    if (this.mode === "hidden") return;
    this.el.hidden = false;
    this.el.classList.add("wx-card--visible");
    if (this.mode === "pinned") {
      if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
      return;
    }
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.el.classList.remove("wx-card--visible");
      this.hideTimer = null;
    }, durationMs);
  }

  setVisible(visible: boolean): void {
    this.mode = visible ? "pinned" : "hidden";
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.mode === "hidden") {
      this.el.classList.remove("wx-card--visible");
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;
    this.el.classList.add("wx-card--visible");
  }
}

function iconFor(c: WeatherConditions): string {
  if (c.thunder) return "⚡";
  if (c.precipitation === "snow") return "❄";
  if (c.precipitation === "rain") return "☂";
  if (c.fog) return "≋";
  if (c.cloudiness === 2) return "☁";
  if (c.cloudiness === 1) return "⛅";
  return c.isDay ? "☀" : "☾";
}

let stylesInjected = false;
function injectStylesOnce(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .wx-card {
      position: fixed;
      top: 14px;
      right: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: var(--paper, #1f1e26);
      color: var(--ink, #e8e4d8);
      border: 1px solid var(--ink-soft, #8a8678);
      border-radius: 2px;
      font: 500 11.5px/1.3 "Ioskeley Mono", ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
      letter-spacing: 0.04em;
      box-shadow: 0 4px 0 rgba(0, 0, 0, 0.22);
      pointer-events: none;
      opacity: 0;
      transform: translateY(-6px);
      transition: opacity 360ms ease, transform 360ms cubic-bezier(.2,.7,.2,1.4);
      z-index: 12;
      max-width: min(64vw, 320px);
    }
    .wx-card[data-position="top-left"] { top: 14px; right: auto; left: 14px; }
    .wx-card[data-position="bottom-right"] { top: auto; bottom: 14px; right: 14px; }
    .wx-card[data-position="bottom-left"] { top: auto; bottom: 14px; right: auto; left: 14px; }
    .wx-card--visible {
      opacity: 1;
      transform: translateY(0);
    }
    .wx-card__icon {
      font-size: 14px;
      line-height: 1;
      opacity: 0.85;
    }
    .wx-card__body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .wx-card__details {
      font-size: 10px;
      letter-spacing: 0.03em;
      opacity: 0.72;
    }
    @media (prefers-reduced-motion: reduce) {
      .wx-card { transition: opacity 200ms ease; transform: none; }
    }
  `;
  document.head.appendChild(style);
}

export {
  buildHourlyForecast,
  deriveConditions,
  forecastConditionsAt,
  isoToHour,
  type ForecastHour,
  type OpenMeteoCurrent,
  type OpenMeteoDaily,
  type OpenMeteoHourly,
} from "./weather-logic.js";
