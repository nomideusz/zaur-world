// @nomideusz/zaur-world — a living ambient sky on a single canvas.
//
// One call wires everything: DPR-aware sizing, resize handling, the render
// loop, and a per-visitor weather client (Open-Meteo + IP geolocation) that
// drives clouds, rain, snow, fog, thunder, wind, and real sunrise/sunset.
// Optional extras shape the horizon from real nearby elevations and show
// the real ISS when it passes overhead.

import { World } from "./world.js";
import { WeatherClient, type WeatherConditions } from "./weather.js";
import { fetchTerrain, type TerrainProfile } from "./terrain.js";
import { SatelliteWatcher } from "./satellites.js";

export { World, type WorldOptions, type WorldState } from "./world.js";
export {
  WeatherClient,
  type WeatherClientOptions,
  type WeatherConditions,
  type Cloudiness,
  type Precipitation,
} from "./weather.js";
export { fetchTerrain, type TerrainProfile } from "./terrain.js";
export { SatelliteWatcher, type SatellitePass } from "./satellites.js";

export interface CreateWorldOptions {
  /** Host element for the small ambient weather card. Omit for no card. */
  weatherCardParent?: HTMLElement;
  /** Foreground dot-grid color. Pass null to disable the grid. */
  gridColor?: string | null;
  /**
   * Shape the horizon from real elevations around the visitor (one cached
   * Open-Meteo call): plains, mountains, coastlines. Default false.
   */
  terrain?: boolean;
  /**
   * Show the real ISS crossing the sky when it actually passes near the
   * visitor (keyless wheretheiss.at poll every 2 min). Default false.
   */
  satellites?: boolean;
  /**
   * Custom weather source polled each frame. Replaces the built-in
   * Open-Meteo client entirely (no weather/geo network calls are made,
   * which also disables the terrain and satellites extras). Return null
   * for a clear sky.
   */
  weather?: () => WeatherConditions | null;
}

export interface WorldHandle {
  /** The underlying renderer, for advanced use. */
  world: World;
  /** Current conditions (null until the first weather fetch resolves). */
  conditions: () => WeatherConditions | null;
  /** Stop the render loop, weather polling, and listeners. */
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

  const client = opts.weather
    ? null
    : new WeatherClient({ cardParent: opts.weatherCardParent ?? null });
  const conditions = opts.weather ?? (() => client?.conditions() ?? null);

  // Terrain arrives async (geo lookup → elevation fetch); the World re-bakes
  // its hills whenever this reference changes.
  let terrainProfile: TerrainProfile | null = null;
  if (opts.terrain && client) {
    void waitForGeo(client).then(async (g) => {
      if (g) terrainProfile = await fetchTerrain(g.lat, g.lon);
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
    }
  );

  const applySize = (): void => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    world.resize({ width: w, height: h });
  };
  applySize();
  window.addEventListener("resize", applySize);

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
  raf = requestAnimationFrame(frame);

  return {
    world,
    conditions,
    destroy(): void {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", applySize);
      client?.destroy();
      watcher?.destroy();
    },
  };
}

/** The weather client resolves geo lazily; wait (up to ~30 s) for it. */
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
