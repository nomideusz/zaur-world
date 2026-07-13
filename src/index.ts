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
  type WeatherConditions,
  type GeoLocation,
  type WeatherCardOptions,
} from "./weather.js";
import { fetchTerrain, type TerrainProfile } from "./terrain.js";
import { SatelliteWatcher } from "./satellites.js";
import { resolveQuality, type Quality } from "./quality.js";
import { sceneHour, type ScenePreset } from "./solar.js";

export { World, type WorldOptions, type WorldState } from "./world.js";
export {
  WeatherClient,
  type WeatherClientOptions,
  type WeatherConditions,
  type Cloudiness,
  type Precipitation,
  type GeoLocation,
  type WeatherCardOptions,
  type WeatherCardPosition,
  deriveConditions,
  isoToHour,
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
export { prefersReducedMotion } from "./motion.js";
export { angularDistanceDeg, predictIssPass } from "./satellite-math.js";

/** Weather look layered over live conditions by `setWeatherPreview` / `preview`. */
export type WeatherPreview = "storm" | "snow" | "fog" | "overcast";

const WEATHER_PREVIEWS: readonly WeatherPreview[] = ["storm", "snow", "fog", "overcast"];

export interface CreateWorldOptions {
  /** Host element for the small ambient weather card. Omit for no card. */
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
   * After IP geolocation fails, ask the browser for precise location.
   * Requires user consent. Default false.
   */
  geolocation?: boolean;
  /** Called when live weather conditions change. */
  onConditionsChange?: (conditions: WeatherConditions) => void;
  /** Wall clock override for demos, screenshots, and tests. */
  time?: () => Date;
  /** Performance preset. `"auto"` lowers effects on mobile / reduced-motion. */
  quality?: Quality;
  /** Override the quality preset's max device pixel ratio. */
  maxDpr?: number;
  /** Pause the render loop while the tab is hidden. Default true. */
  pauseWhenHidden?: boolean;
  /** Summer-evening fireflies in the lower sky band. Default true. */
  fireflies?: boolean;
}

export interface WorldHandle {
  world: World;
  conditions: () => WeatherConditions | null;
  /** Snapshot the current canvas frame as a data URL. */
  capture(type?: string, quality?: number): string;
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
  /** Switch performance preset without remounting. */
  setQuality(quality: Quality): void;
  /** Preview storm clouds, rain, and lightning using live weather as a base. */
  setStormPreview(enabled: boolean): void;
  /**
   * Layer a weather look over live conditions — storm, snow, fog, or
   * overcast. Pass `null` to return to live weather. Independent of the
   * clock, so it combines with `setTime` (e.g. snow at night).
   */
  setWeatherPreview(preview: WeatherPreview | null): void;
  /**
   * Jump to a named scene — a time of day worth showing off, anchored to
   * the visitor's real sun times — or a weather look. Pass `null` to
   * return to the live clock and live weather.
   */
  preview(scene: ScenePreset | WeatherPreview | null): void;
  /** Toggle summer-evening fireflies in the lower sky band. */
  setFireflies(enabled: boolean): void;
  /** Current terrain profile, or null while loading / disabled. */
  terrainProfile(): TerrainProfile | null;
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

  const resolvedQuality = resolveQuality(opts.quality);
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
  const liveConditions = opts.weather ?? (() => client?.conditions() ?? null);
  const conditions = (): WeatherConditions | null => {
    const live = liveConditions();
    if (!weatherPreview) return live;
    const base: WeatherConditions = live ?? {
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
    switch (weatherPreview) {
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
  };

  const location = (): { lat: number; lon: number } | null => {
    if (opts.geo) return { lat: opts.geo.lat, lon: opts.geo.lon };
    return client?.location() ?? null;
  };

  let terrainEnabled = opts.terrain === true;
  let terrainProfile: TerrainProfile | null = null;
  let satellitesEnabled = opts.satellites === true;
  let satelliteDemo = opts.satelliteDemo === true;
  let watcher: SatelliteWatcher | null = null;

  const loadTerrain = async (): Promise<void> => {
    const g = await resolveLocation(location, client);
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

  const world = new World(
    { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 },
    {
      weather: conditions,
      gridColor: opts.gridColor,
      terrain: () => (terrainEnabled ? terrainProfile : null),
      satellites: () => (satellitesEnabled ? watcher?.current() ?? null : null),
      time: opts.time,
      quality: resolvedQuality,
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
  window.addEventListener("resize", applySize);

  const pauseWhenHidden = opts.pauseWhenHidden !== false;
  let raf = 0;
  let last = performance.now();

  const frame = (now: number): void => {
    const dt = Math.min(64, now - last);
    last = now;
    ctx.clearRect(0, 0, world.width, world.height);
    world.update(dt);
    world.draw(ctx);
    raf = requestAnimationFrame(frame);
  };

  const startLoop = (): void => {
    if (raf !== 0) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const stopLoop = (): void => {
    if (raf === 0) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  startLoop();

  const onVisibility = (): void => {
    if (document.visibilityState === "hidden") {
      if (pauseWhenHidden) stopLoop();
      return;
    }
    last = performance.now();
    if (pauseWhenHidden) startLoop();
    void client?.refresh();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    world,
    conditions,
    capture(type = "image/png", quality?: number): string {
      return canvas.toDataURL(type, quality);
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
      world.setTime(fn);
    },
    setQuality(quality: Quality): void {
      applyQualityPreset(quality);
    },
    setStormPreview(enabled: boolean): void {
      weatherPreview = enabled ? "storm" : null;
    },
    setWeatherPreview(preview: WeatherPreview | null): void {
      weatherPreview = preview;
    },
    preview(scene: ScenePreset | WeatherPreview | null): void {
      if (scene !== null && WEATHER_PREVIEWS.includes(scene as WeatherPreview)) {
        weatherPreview = scene as WeatherPreview;
        world.setTime();
        return;
      }
      weatherPreview = null;
      if (scene === null) {
        world.setTime();
        return;
      }
      world.setTime(() => {
        const wx = liveConditions();
        const h = sceneHour(scene as ScenePreset, wx?.sunriseH ?? null, wx?.sunsetH ?? null);
        const d = new Date();
        d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
        return d;
      });
    },
    setFireflies(enabled: boolean): void {
      world.setFireflies(enabled);
    },
    terrainProfile(): TerrainProfile | null {
      return terrainEnabled ? terrainProfile : null;
    },
    destroy(): void {
      stopLoop();
      window.removeEventListener("resize", applySize);
      document.removeEventListener("visibilitychange", onVisibility);
      client?.destroy();
      watcher?.destroy();
    },
  };
}

async function resolveLocation(
  location: () => { lat: number; lon: number } | null,
  client: WeatherClient | null,
  tries = 30
): Promise<{ lat: number; lon: number } | null> {
  for (let i = 0; i < tries; i++) {
    const g = location();
    if (g) return g;
    if (!client) return null;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}
