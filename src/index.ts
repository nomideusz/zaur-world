// @nomideusz/zaur-world — a living ambient sky on a single canvas.
//
// One call wires everything: DPR-aware sizing, resize handling, the render
// loop, and a per-visitor weather client (Open-Meteo + IP geolocation) that
// drives clouds, rain, snow, fog, thunder, wind, and real sunrise/sunset.
// Optional extras shape the horizon from real nearby elevations and show
// the real ISS when it passes overhead.

import { World } from "./world.js";
import {
  WeatherClient,
  type ForecastHour,
  type WeatherConditions,
  type GeoLocation,
  type GeolocationMode,
  type LocationSource,
  type WeatherCardOptions,
} from "./weather.js";
import { fetchTerrain, type TerrainProfile } from "./terrain.js";
import { SatelliteWatcher } from "./satellites.js";
import { resolveQuality, type Quality } from "./quality.js";
import { sceneHour, type ScenePreset } from "./solar.js";
import {
  applyWeatherPreview,
  applyWeatherOverride,
  normalizeWeather,
  WEATHER_PREVIEWS,
  type WeatherPreview,
  type WeatherOverride,
} from "./weather-preview.js";
import {
  applyAtmosphereCSS,
  buildAtmosphere,
  clearAtmosphereCSS,
  formatAtmosphereCaption,
  type AtmosphereSnapshot,
} from "./atmosphere.js";
import {
  atmosphereEquals,
  captureWithCaption,
  type CaptureMomentResult,
} from "./capture.js";

export { World, type WorldOptions, type WorldState } from "./world.js";
export {
  WeatherClient,
  type WeatherClientOptions,
  type WeatherConditions,
  type Cloudiness,
  type Precipitation,
  type GeoLocation,
  type GeolocationMode,
  type LocationSource,
  type WeatherCardOptions,
  type WeatherCardPosition,
  type ForecastHour,
  type MinutelySlot,
  type OpenMeteoCurrent,
  type OpenMeteoDaily,
  type OpenMeteoHourly,
  type OpenMeteoMinutely15,
  buildHourlyForecast,
  buildMinutely15,
  compassDir,
  deriveConditions,
  describeWeather,
  forecastConditionsAt,
  formatForecastDetails,
  formatForecastLine,
  dateAsLocationLocal,
  decimalHourInUtcOffset,
  geoDistanceKm,
  intensityFromPrecip,
  isoInUtcOffset,
  isoToHour,
  refineWithMinutely,
  timezoneOffsetMismatch,
  weatherIcon,
} from "./weather.js";
export { fetchTerrain, type TerrainProfile } from "./terrain.js";
export { SatelliteWatcher, type SatellitePass } from "./satellites.js";
export {
  warpHour,
  venusState,
  lunarPhase,
  meteorRate,
  auroraLatFactor,
  solsticeWarmth,
  sceneHour,
  type ScenePreset,
  SUN_RISE,
  SUN_SET,
} from "./solar.js";
export { resolveQuality, type Quality, type ResolvedQuality } from "./quality.js";
export {
  equatorialToHorizontal,
  gmstHours,
  lstDegrees,
  projectStar,
  starBrightness,
} from "./star-math.js";
export { STAR_CATALOG, STAR_COUNT } from "./star-catalog.js";
export { prefersReducedMotion } from "./motion.js";
export { angularDistanceDeg, predictIssPass } from "./satellite-math.js";
export {
  applyWeatherPreview,
  applyWeatherOverride,
  normalizeWeather,
  WEATHER_PREVIEWS,
  type WeatherPreview,
  type WeatherOverride,
} from "./weather-preview.js";
export {
  buildAtmosphere,
  formatAtmosphereCaption,
  applyAtmosphereCSS,
  clearAtmosphereCSS,
  type AtmosphereSnapshot,
  type AtmosphereMood,
  type AtmosphereMoment,
} from "./atmosphere.js";
export type { CaptureMomentResult } from "./capture.js";

export interface CreateWorldOptions {
  /**
   * @deprecated Use `weatherCard: { parent }` instead.
   * Host element for the small ambient weather card. Omit for no card.
   */
  weatherCardParent?: HTMLElement;
  /** Weather card host and corner placement. */
  weatherCard?: WeatherCardOptions;
  /** Foreground dot-grid color. Pass null to disable the grid. */
  gridColor?: string | null;
  /** Shape the horizon from real elevations around the visitor. Default false. */
  terrain?: boolean;
  /** Show the real ISS when it passes near the visitor. Default false. */
  satellites?: boolean;
  /**
   * Schedule sample ISS arcs when no real pass is active (for demos).
   * Only applies when `satellites` is enabled.
   */
  satelliteDemo?: boolean;
  /** Custom weather source — replaces the built-in client (no network calls). */
  weather?: () => WeatherConditions | null;
  /** Skip IP geolocation; use this location for weather, terrain, and seasons. */
  geo?: GeoLocation;
  /** Persist geo in localStorage. Default true. */
  cache?: boolean;
  /**
   * Resolve coordinates via the browser Geolocation API.
   * `true` / `"prefer"` asks for GPS before IP (real location under VPN).
   * `"fallback"` keeps IP-first behavior. Default false.
   */
  geolocation?: GeolocationMode;
  /** Called when live weather conditions change. */
  onConditionsChange?: (conditions: WeatherConditions) => void;
  /**
   * Called when the derived atmosphere snapshot changes (mood, wetness, frost…).
   * Useful for theming the host page.
   */
  onAtmosphereChange?: (atmosphere: AtmosphereSnapshot) => void;
  /**
   * Element that receives `--zw-*` CSS vars and `data-zw-*` attributes.
   * Defaults to `document.documentElement`. Pass `null` to disable.
   */
  atmosphereRoot?: HTMLElement | null;
  /** Wall clock override for demos, screenshots, and tests. */
  time?: () => Date;
  /** Performance preset. `"auto"` lowers effects on mobile / reduced-motion. */
  quality?: Quality;
  /** Override the quality preset's max device pixel ratio. */
  maxDpr?: number;
  /** Pause the render loop while the tab is hidden. Default true. */
  pauseWhenHidden?: boolean;
  /** Day birds and seasonal migrating V-formations. Default true. */
  birds?: boolean;
  /** Summer-dusk bats. Default true. */
  bats?: boolean;
  /** Summer-evening fireflies in the lower sky band. Default true. */
  fireflies?: boolean;
}

export interface WorldHandle {
  world: World;
  conditions: () => WeatherConditions | null;
  /** Current atmosphere snapshot (mood, wetness, frost, moments…). */
  atmosphere: () => AtmosphereSnapshot;
  /** Snapshot the current canvas frame as a data URL. */
  capture(type?: string, quality?: number): string;
  /**
   * Snapshot with a burned-in caption (place · time · mood).
   * Pass `caption: false` for a clean frame using the same helper path.
   */
  captureMoment(opts?: {
    type?: string;
    quality?: number;
    caption?: boolean | string;
  }): CaptureMomentResult;
  /** Pause the render loop (independent of tab visibility). */
  pause(): void;
  /** Resume the render loop after `pause()`. */
  resume(): void;
  /** Toggle real-elevation horizon shaping without remounting. */
  setTerrain(enabled: boolean): void;
  /** Toggle ISS tracking without remounting. */
  setSatellites(enabled: boolean): void;
  /** Toggle sample ISS arcs when no real pass is active. */
  setSatelliteDemo(enabled: boolean): void;
  /** Show or hide the ambient weather card. */
  setWeatherCard(visible: boolean): void;
  /** Toggle the foreground dot grid. */
  setGrid(enabled: boolean): void;
  /** Override the wall clock, or pass undefined to use real time again. */
  setTime(fn?: () => Date): void;
  /**
   * Current decimal hour at the forecast location (browser clock before
   * the first weather fetch). Use for 24h tours so the sweep matches
   * sunrise/sunset and hourly forecast slots under a mismatched TZ/VPN.
   */
  localHour(date?: Date): number;
  /** UTC offset (seconds east of UTC) for the forecast location, or null. */
  utcOffsetSeconds(): number | null;
  /** City label from geo / reverse-geocode (null until known). */
  city(): string | null;
  /** Coordinates the sky is keyed to (pin → GPS/IP), or null until resolved. */
  location(): { lat: number; lon: number } | null;
  /** How coordinates were resolved (`gps`, `ip`, …). */
  locationSource(): LocationSource | null;
  /** VPN / mismatched-location hint for host UI, or null when confident. */
  locationHint(): string | null;
  /**
   * Drive the sky from the hourly forecast at a local decimal hour
   * (0..24) instead of current conditions — pairs with `setTime` so a
   * time sweep shows the weather each hour will actually bring. The next
   * occurrence of the hour is used, so sweeping ahead rolls into
   * tomorrow. The built-in weather card follows the sweep — it shows the
   * previewed hour's conditions and stays visible until the hour is
   * cleared. Pass `null` to return to current conditions. No-op until
   * the forecast has loaded, and with a custom `weather` source.
   */
  setForecastHour(hour: number | null): void;
  /** Hourly forecast for the next ~48 h (empty until loaded / custom source). */
  forecast(): ForecastHour[];
  /** Switch performance preset without remounting. */
  setQuality(quality: Quality): void;
  /**
   * @deprecated Use `setWeatherPreview("storm" | null)` instead.
   * Preview storm clouds, rain, and lightning using live weather as a base.
   */
  setStormPreview(enabled: boolean): void;
  /**
   * Layer a weather look over live conditions — storm, snow, fog, or
   * overcast. Pass `null` to return to live weather. Independent of the
   * clock, so it combines with `setTime` (e.g. snow at night).
   */
  setWeatherPreview(preview: WeatherPreview | null): void;
  /**
   * Override individual climate fields (intensity, temperature, wind,
   * clouds, precip, fog, thunder) on top of live weather / preview.
   * Pass `null` or `{}` to clear. Combines with `setWeatherPreview`.
   */
  setWeatherOverride(override: WeatherOverride | null): void;
  /**
   * Jump to a named scene — a time of day worth showing off, anchored to
   * the visitor's real sun times — or a weather look. Pass `null` to
   * return to the live clock and live weather.
   */
  preview(scene: ScenePreset | WeatherPreview | null): void;
  /** Toggle day birds and migrating flocks. */
  setBirds(enabled: boolean): void;
  /** Toggle summer-dusk bats. */
  setBats(enabled: boolean): void;
  /** Toggle summer-evening fireflies in the lower sky band. */
  setFireflies(enabled: boolean): void;
  /** Current terrain profile, or null while loading / disabled. */
  terrainProfile(): TerrainProfile | null;
  /**
   * Ask the browser for a precise location (works under VPN), refresh
   * weather and terrain, and return the new coordinates. Null if denied
   * or unavailable. Clears any manual `setGeo` pin.
   */
  relocate(): Promise<{ lat: number; lon: number } | null>;
  /**
   * Pin the sky to an explicit location, or pass `null` to clear and
   * re-detect (GPS/IP). Refreshes weather and terrain.
   */
  setGeo(geo: GeoLocation | null): Promise<{ lat: number; lon: number } | null>;
  destroy: () => void;
}

/**
 * Mount the living sky onto a canvas. The canvas must be sized by CSS
 * (e.g. `position: fixed; inset: 0; width: 100%; height: 100%`) — the
 * backing store resolution and device-pixel scaling are handled here.
 */
export function createWorld(
  canvas: HTMLCanvasElement,
  opts: CreateWorldOptions = {}
): WorldHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  let qualityMode: Quality = opts.quality ?? "auto";
  const resolvedQuality = resolveQuality(qualityMode);
  if (opts.maxDpr != null) resolvedQuality.maxDpr = opts.maxDpr;

  const client = opts.weather
    ? null
    : new WeatherClient({
        cardParent: opts.weatherCardParent ?? null,
        weatherCard: opts.weatherCard,
        geo: opts.geo,
        cache: opts.cache,
        geolocation: opts.geolocation,
        onConditionsChange: opts.onConditionsChange,
      });

  let weatherPreview: WeatherPreview | null = null;
  let weatherOverride: WeatherOverride | null = null;
  let forecastHour: number | null = null;
  const liveConditions = opts.weather ?? (() => client?.conditions() ?? null);
  const conditions = (): WeatherConditions | null => {
    let wx = liveConditions();
    if (forecastHour !== null && client) {
      wx = client.conditionsAtHour(forecastHour) ?? wx;
    }
    if (weatherPreview) wx = applyWeatherPreview(wx, weatherPreview);
    if (weatherOverride) wx = applyWeatherOverride(wx, weatherOverride);
    else if (wx) wx = normalizeWeather(wx);
    return wx;
  };

  /** Runtime pin from setGeo; falls back to createWorld({ geo }). */
  let runtimeGeo: GeoLocation | null | undefined = opts.geo;
  const location = (): { lat: number; lon: number } | null => {
    if (runtimeGeo) return { lat: runtimeGeo.lat, lon: runtimeGeo.lon };
    return client?.location() ?? null;
  };

  let terrainEnabled = opts.terrain === true;
  let terrainProfile: TerrainProfile | null = null;
  let satellitesEnabled = opts.satellites === true;
  let satelliteDemo = opts.satelliteDemo === true;
  let watcher: SatelliteWatcher | null = null;

  const loadTerrain = async (): Promise<void> => {
    const pinned = runtimeGeo ?? opts.geo;
    const g =
      pinned != null
        ? { lat: pinned.lat, lon: pinned.lon }
        : client
          ? await client.whenLocated()
          : location();
    if (g && terrainEnabled) {
      terrainProfile = await fetchTerrain(g.lat, g.lon, { cache: opts.cache });
    }
  };

  const ensureWatcher = (): void => {
    if (watcher) return;
    watcher = new SatelliteWatcher(location, { demo: satelliteDemo });
  };

  if (terrainEnabled) void loadTerrain();
  if (satellitesEnabled) ensureWatcher();

  let timeOverride: (() => Date) | undefined = opts.time;
  /** Wall clock in the forecast location's timezone when offset is known. */
  const locationClock = (): Date => client?.locationDate() ?? new Date();
  const resolveTime = (): Date => (timeOverride ? timeOverride() : locationClock());

  const world = new World(
    { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 },
    {
      weather: conditions,
      gridColor: opts.gridColor,
      terrain: () => (terrainEnabled ? terrainProfile : null),
      satellites: () => (satellitesEnabled ? watcher?.current() ?? null : null),
      // Real night sky: catalog stars at their true positions for the
      // visitor's coordinates (pin → GPS/IP), falling back to decorative.
      location,
      time: resolveTime,
      quality: resolvedQuality,
      birds: opts.birds !== false,
      bats: opts.bats !== false,
      fireflies: opts.fireflies !== false,
    }
  );

  const applySize = (): void => {
    const dpr = Math.min(
      resolvedQuality.maxDpr,
      Math.max(1, window.devicePixelRatio || 1)
    );
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    world.resize({ width: w, height: h });
  };

  const applyQualityPreset = (quality: Quality): void => {
    const next = resolveQuality(quality);
    if (opts.maxDpr != null) next.maxDpr = opts.maxDpr;
    const dprChanged = resolvedQuality.maxDpr !== next.maxDpr;
    resolvedQuality.maxDpr = next.maxDpr;
    resolvedQuality.particleScale = next.particleScale;
    resolvedQuality.ambientEffects = next.ambientEffects;
    resolvedQuality.showGrid = next.showGrid;
    world.applyQuality(next);
    if (dprChanged) applySize();
  };
  applySize();

  const resizeObserver = new ResizeObserver(() => applySize());
  resizeObserver.observe(canvas);

  const pauseWhenHidden = opts.pauseWhenHidden !== false;
  let raf = 0;
  let last = performance.now();
  let pausedByUser = false;
  let lastAtmosphere: AtmosphereSnapshot | null = null;
  let atmosphereAcc = 0;
  const atmosphereRoot =
    opts.atmosphereRoot === null
      ? null
      : (opts.atmosphereRoot ?? document.documentElement);
  const onAtmosphere = opts.onAtmosphereChange ?? null;

  const snapshotAtmosphere = (): AtmosphereSnapshot =>
    buildAtmosphere({
      date: resolveTime(),
      wx: conditions(),
      wetness: world.getWetness(),
      snowCover: world.getSnowCover(),
      issActive: !!(satellitesEnabled && watcher?.current()),
      city: runtimeGeo?.city ?? client?.city() ?? null,
    });

  const publishAtmosphere = (force = false): void => {
    const next = snapshotAtmosphere();
    if (!force && lastAtmosphere && atmosphereEquals(lastAtmosphere, next)) {
      return;
    }
    lastAtmosphere = next;
    if (atmosphereRoot) applyAtmosphereCSS(atmosphereRoot, next);
    onAtmosphere?.(next);
  };

  const frame = (now: number): void => {
    const dt = Math.min(64, now - last);
    last = now;
    ctx.clearRect(0, 0, world.width, world.height);
    world.update(dt);
    world.draw(ctx);
    atmosphereAcc += dt;
    if (atmosphereAcc >= 500) {
      atmosphereAcc = 0;
      publishAtmosphere();
    }
    raf = requestAnimationFrame(frame);
  };

  const startLoop = (): void => {
    if (raf !== 0 || pausedByUser) return;
    if (pauseWhenHidden && document.visibilityState === "hidden") return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const stopLoop = (): void => {
    if (raf === 0) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  startLoop();
  publishAtmosphere(true);

  const onVisibility = (): void => {
    if (document.visibilityState === "hidden") {
      if (pauseWhenHidden) stopLoop();
      return;
    }
    last = performance.now();
    startLoop();
    void client?.refresh();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const autoListeners: Array<{ mql: MediaQueryList; fn: () => void }> = [];
  {
    const onAutoChange = (): void => {
      if (qualityMode === "auto") applyQualityPreset("auto");
    };
    for (const query of ["(prefers-reduced-motion: reduce)", "(max-width: 767px)"]) {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onAutoChange);
      autoListeners.push({ mql, fn: onAutoChange });
    }
  }

  return {
    world,
    conditions,
    atmosphere: snapshotAtmosphere,
    capture(type = "image/png", quality?: number): string {
      return canvas.toDataURL(type, quality);
    },
    captureMoment(opts = {}): CaptureMomentResult {
      const atmosphere = snapshotAtmosphere();
      const captionText =
        opts.caption === false
          ? ""
          : typeof opts.caption === "string"
            ? opts.caption
            : formatAtmosphereCaption(atmosphere);
      const type = opts.type ?? "image/png";
      const dataUrl =
        captionText.length > 0
          ? captureWithCaption(canvas, captionText, type, opts.quality)
          : canvas.toDataURL(type, opts.quality);
      return {
        dataUrl,
        caption: captionText || formatAtmosphereCaption(atmosphere),
        atmosphere,
      };
    },
    pause(): void {
      pausedByUser = true;
      stopLoop();
    },
    resume(): void {
      pausedByUser = false;
      startLoop();
    },
    setTerrain(enabled: boolean): void {
      if (terrainEnabled === enabled) return;
      terrainEnabled = enabled;
      if (!enabled) {
        terrainProfile = null;
        return;
      }
      if (!terrainProfile) void loadTerrain();
    },
    setSatellites(enabled: boolean): void {
      if (satellitesEnabled === enabled) return;
      satellitesEnabled = enabled;
      if (!enabled) {
        watcher?.destroy();
        watcher = null;
        return;
      }
      ensureWatcher();
    },
    setSatelliteDemo(enabled: boolean): void {
      if (satelliteDemo === enabled) return;
      satelliteDemo = enabled;
      watcher?.setDemo(enabled);
    },
    setWeatherCard(visible: boolean): void {
      client?.setCardVisible(visible);
    },
    setGrid(enabled: boolean): void {
      world.setGrid(enabled);
    },
    setTime(fn?: () => Date): void {
      timeOverride = fn;
      // Keep the World on resolveTime so clearing the override returns to
      // the forecast location clock (not the browser TZ).
      world.setTime(resolveTime);
      publishAtmosphere(true);
    },
    localHour(date?: Date): number {
      if (timeOverride) {
        const d = timeOverride();
        return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
      }
      if (client) return client.localHour(date);
      const d = date ?? new Date();
      return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    },
    utcOffsetSeconds(): number | null {
      return client?.utcOffsetSeconds() ?? null;
    },
    city(): string | null {
      return runtimeGeo?.city ?? client?.city() ?? null;
    },
    location(): { lat: number; lon: number } | null {
      return location();
    },
    locationSource(): LocationSource | null {
      if (runtimeGeo) return "fixed";
      return client?.locationSource() ?? null;
    },
    locationHint(): string | null {
      if (runtimeGeo) return null;
      return client?.locationHint() ?? null;
    },
    setForecastHour(hour: number | null): void {
      // No publishAtmosphere here — tours call this per frame; the regular
      // 500 ms atmosphere cadence picks the change up.
      forecastHour = hour;
      client?.previewHour(hour);
    },
    forecast(): ForecastHour[] {
      return client?.forecast() ?? [];
    },
    setQuality(quality: Quality): void {
      qualityMode = quality;
      applyQualityPreset(quality);
    },
    setStormPreview(enabled: boolean): void {
      weatherPreview = enabled ? "storm" : null;
      publishAtmosphere(true);
    },
    setWeatherPreview(preview: WeatherPreview | null): void {
      weatherPreview = preview;
      publishAtmosphere(true);
    },
    setWeatherOverride(override: WeatherOverride | null): void {
      if (!override || Object.keys(override).length === 0) {
        weatherOverride = null;
      } else {
        weatherOverride = { ...override };
      }
      publishAtmosphere(true);
    },
    preview(scene: ScenePreset | WeatherPreview | null): void {
      if (scene !== null && WEATHER_PREVIEWS.includes(scene as WeatherPreview)) {
        weatherPreview = scene as WeatherPreview;
        timeOverride = undefined;
        world.setTime(resolveTime);
        publishAtmosphere(true);
        return;
      }
      weatherPreview = null;
      if (scene === null) {
        timeOverride = undefined;
        world.setTime(resolveTime);
        publishAtmosphere(true);
        return;
      }
      const fn = (): Date => {
        const wx = liveConditions();
        const h = sceneHour(scene as ScenePreset, wx?.sunriseH ?? null, wx?.sunsetH ?? null);
        const d = new Date();
        d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
        return d;
      };
      timeOverride = fn;
      world.setTime(resolveTime);
      publishAtmosphere(true);
    },
    setFireflies(enabled: boolean): void {
      world.setFireflies(enabled);
    },
    setBirds(enabled: boolean): void {
      world.setBirds(enabled);
    },
    setBats(enabled: boolean): void {
      world.setBats(enabled);
    },
    terrainProfile(): TerrainProfile | null {
      return terrainEnabled ? terrainProfile : null;
    },
    async relocate(): Promise<{ lat: number; lon: number } | null> {
      if (!client) return null;
      runtimeGeo = undefined;
      const g = await client.relocate();
      if (g && terrainEnabled) {
        terrainProfile = await fetchTerrain(g.lat, g.lon, { cache: opts.cache });
      }
      publishAtmosphere(true);
      return g;
    },
    async setGeo(geo: GeoLocation | null): Promise<{ lat: number; lon: number } | null> {
      if (!client) return null;
      runtimeGeo = geo;
      const g = await client.setGeo(geo);
      if (g && terrainEnabled) {
        terrainProfile = await fetchTerrain(g.lat, g.lon, { cache: opts.cache });
      } else if (!g) {
        terrainProfile = null;
      }
      publishAtmosphere(true);
      return g;
    },
    destroy(): void {
      stopLoop();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      for (const { mql, fn } of autoListeners) mql.removeEventListener("change", fn);
      if (atmosphereRoot) clearAtmosphereCSS(atmosphereRoot);
      client?.destroy();
      watcher?.destroy();
    },
  };
}
