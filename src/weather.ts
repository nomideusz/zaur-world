// Per-visitor weather. Independent of the shared archive — each visitor
// fetches their own location-derived conditions, sees a small ambient card
// that fades in and back out on its own, and the World reads `conditions()`
// each frame to tint the sky with clouds and precipitation.

import { deriveConditions } from "./weather-logic.js";
import type { OpenMeteoCurrent, OpenMeteoDaily } from "./weather-logic.js";

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
}

export class WeatherClient {
  private state: WeatherConditions | null = null;
  private cachedGeo: Geo | null = null;
  private readonly card: WeatherCard | null;
  private readonly timers: number[] = [];
  private readonly cache: boolean;
  private readonly onChange: ((conditions: WeatherConditions) => void) | null;

  constructor(opts: WeatherClientOptions = {}) {
    this.cache = opts.cache !== false;
    this.onChange = opts.onConditionsChange ?? null;
    const cardOpts = opts.weatherCard ?? (opts.cardParent ? { parent: opts.cardParent } : null);
    this.card = cardOpts ? new WeatherCard(cardOpts) : null;
    if (opts.geo) {
      this.cachedGeo = {
        lat: opts.geo.lat,
        lon: opts.geo.lon,
        city: opts.geo.city ?? "your area",
      };
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

  /** Resolved approximate location (null until the first geo lookup). */
  location(): { lat: number; lon: number } | null {
    return this.cachedGeo ? { lat: this.cachedGeo.lat, lon: this.cachedGeo.lon } : null;
  }

  /** Re-fetch weather (e.g. when the tab becomes visible again). */
  refresh(): Promise<void> {
    return this.fetchWeather();
  }

  private async fetchWeather(): Promise<void> {
    try {
      const geo = await this.geo();
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(geo.lat));
      url.searchParams.set("longitude", String(geo.lon));
      url.searchParams.set(
        "current",
        "temperature_2m,apparent_temperature,weather_code,is_day,precipitation,wind_speed_10m"
      );
      url.searchParams.set("daily", "sunrise,sunset");
      url.searchParams.set("forecast_days", "1");
      url.searchParams.set("timezone", "auto");
      const res = await fetchWithTimeout(url, { headers: { accept: "application/json" } });
      if (!res.ok) return;
      const data = (await res.json()) as {
        current?: OpenMeteoCurrent;
        daily?: OpenMeteoDaily;
      };
      const c = data.current;
      if (!c) return;

      const next = { ...deriveConditions(c, data.daily), latitude: geo.lat };
      const changed = !this.state || !conditionsEqual(this.state, next);
      this.state = next;
      if (changed) this.onChange?.(next);
      if (this.card) {
        this.card.update(formatLine(geo.city, c), this.state);
        window.setTimeout(() => this.card?.show(CARD_DURATION_MS), FIRST_SHOW_DELAY_MS);
      }
    } catch {
      // Network / CORS error — leave previous state intact, no card update.
    }
  }

  private async geo(): Promise<Geo> {
    if (this.cachedGeo) return this.cachedGeo;
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
          return this.cachedGeo;
        }
      }
    } catch {
      /* fall through */
    }
    if (this.cache) {
      try {
        const saved = localStorage.getItem(GEO_CACHE_KEY);
        if (saved) {
          const g = JSON.parse(saved) as Partial<Geo>;
          if (Number.isFinite(g.lat) && Number.isFinite(g.lon) && typeof g.city === "string") {
            this.cachedGeo = { lat: g.lat as number, lon: g.lon as number, city: g.city };
            return this.cachedGeo;
          }
        }
      } catch {
        /* fall through */
      }
    }
    this.cachedGeo = FALLBACK_GEO;
    return this.cachedGeo;
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
    a.latitude === b.latitude
  );
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

function describeWeather(code: number, isDay: boolean): string {
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

  constructor(opts: WeatherCardOptions) {
    injectStylesOnce();
    this.el = document.createElement("div");
    this.el.className = "wx-card";
    if (opts.position) this.el.dataset.position = opts.position;
    this.el.setAttribute("role", "status");
    this.el.setAttribute("aria-live", "polite");
    this.el.innerHTML = `
      <span class="wx-card__icon" aria-hidden="true">☁</span>
      <span class="wx-card__line"></span>
    `;
    opts.parent.appendChild(this.el);
  }

  update(line: string, conditions: WeatherConditions): void {
    const lineEl = this.el.querySelector<HTMLSpanElement>(".wx-card__line");
    const iconEl = this.el.querySelector<HTMLSpanElement>(".wx-card__icon");
    if (lineEl) lineEl.textContent = line;
    if (iconEl) iconEl.textContent = iconFor(conditions);
  }

  remove(): void {
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.el.remove();
  }

  show(durationMs: number): void {
    this.el.classList.add("wx-card--visible");
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.el.classList.remove("wx-card--visible");
      this.hideTimer = null;
    }, durationMs);
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
    @media (prefers-reduced-motion: reduce) {
      .wx-card { transition: opacity 200ms ease; transform: none; }
    }
  `;
  document.head.appendChild(style);
}

export { deriveConditions, isoToHour } from "./weather-logic.js";
