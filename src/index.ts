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
  SUN_RISE,
  SUN_SET,
} from "./solar.js";
export { resolveQuality, type Quality, type ResolvedQuality } from "./quality.js";
export { prefersReducedMotion } from "./motion.js";

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
  /** Custom weather source — replaces the built-in client (no network calls). */
  weather?: () => WeatherConditions | null;
  /** Skip IP geolocation; use this location for weather, terrain, and seasons. */
  geo?: GeoLocation;
  /** Persist geo in localStorage. Default true. */
  cache?: boolean;
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
}

export interface WorldHandle {
  world: World;
  conditions: () => WeatherConditions | null;
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
        onConditionsChange: opts.onConditionsChange,
      });
  const conditions = opts.weather ?? (() => client?.conditions() ?? null);

  let terrainProfile: TerrainProfile | null = null;
  if (opts.terrain && client) {
    void waitForGeo(client).then(async (g) => {
      if (g) terrainProfile = await fetchTerrain(g.lat, g.lon, { cache: opts.cache });
    });
  }

  const watcher =
    opts.satellites && client ? new SatelliteWatcher(() => client.location()) : null;

  const world = new World(
    { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 },
    {
      weather: conditions,
      gridColor: opts.gridColor,
      terrain: () => terrainProfile,
      satellites: watcher ? () => watcher.current() : undefined,
      time: opts.time,
      quality: resolvedQuality,
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
    destroy(): void {
      stopLoop();
      window.removeEventListener("resize", applySize);
      document.removeEventListener("visibilitychange", onVisibility);
      client?.destroy();
      watcher?.destroy();
    },
  };
}

async function waitForGeo(
  client: WeatherClient,
  tries = 30
): Promise<{ lat: number; lon: number } | null> {
  for (let i = 0; i < tries; i++) {
    const g = client.location();
    if (g) return g;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}
