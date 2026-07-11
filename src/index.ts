// @nomideusz/zaur-world — a living ambient sky on a single canvas.
//
// One call wires everything: DPR-aware sizing, resize handling, the render
// loop, and a per-visitor weather client (Open-Meteo + IP geolocation) that
// drives clouds, rain, snow, fog, thunder, wind, and real sunrise/sunset.

import { World } from "./world.js";
import { WeatherClient, type WeatherConditions } from "./weather.js";

export { World, type WorldOptions, type WorldState } from "./world.js";
export {
  WeatherClient,
  type WeatherClientOptions,
  type WeatherConditions,
  type Cloudiness,
  type Precipitation,
} from "./weather.js";

export interface CreateWorldOptions {
  /** Host element for the small ambient weather card. Omit for no card. */
  weatherCardParent?: HTMLElement;
  /** Foreground dot-grid color. Pass null to disable the grid. */
  gridColor?: string | null;
  /**
   * Custom weather source polled each frame. Replaces the built-in
   * Open-Meteo client entirely (no network calls are made). Return null
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

  const world = new World(
    { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 },
    { weather: conditions, gridColor: opts.gridColor }
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
    },
  };
}
