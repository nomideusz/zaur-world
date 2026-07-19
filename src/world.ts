// The world. A time-of-day sky that interpolates between color keyframes
// based on the user's local clock, with a sun arcing across by day, a moon
// by night, and twinkling stars that fade in at dusk and out at dawn.
//
// The dot grid stays as a quiet graph-paper texture in the foreground.
// Vivid palette rendered at full canvas opacity: real cerulean at noon,
// golden dawns, fiery dusks. Overcast weather desaturates the sky toward
// gray, so the mood tracks the actual conditions outside. Text readability
// is handled by the frosted terrain cards in CSS, not by muting the sky.

import type { WeatherConditions } from "./weather.js";
import type { TerrainProfile } from "./terrain.js";
import type { SatellitePass } from "./satellites.js";
import type { ResolvedQuality } from "./quality.js";
import type { RGB } from "./color.js";
import { rgb, rgbToCss, desatRGB, lerpRGB } from "./color.js";
import { fillHillPath, generateBolt, hillPath } from "./hills.js";
import {
  cloudAlphaFor,
  starAlpha,
  auroraAlpha,
  heatFactor,
  daylight,
  dayCreatureAlpha,
  duskAlpha,
  fireflyAlpha,
  horizonGlowStrength,
} from "./sky-math.js";
import {
  SUN_RISE,
  SUN_SET,
  warpHour,
  auroraLatFactor,
  meteorRate,
  solsticeWarmth,
  lunarPhase,
} from "./solar.js";
import {
  drawAurora,
  drawCirrus,
  drawCityGlow,
  drawFog,
  drawFrost,
  drawRainCurtain,
  drawHeatHaze,
  drawHorizonGlow,
  drawRainbow,
  drawSeaBand,
  drawWetSheen,
  drawSnowCover,
} from "./world-atmosphere.js";
import {
  drawCelestial,
  drawStars,
  drawVenus,
  type Star,
} from "./world-celestial.js";
import { STAR_CATALOG } from "./star-catalog.js";
import {
  equatorialToHorizontal,
  projectStar,
  starBrightness,
} from "./star-math.js";

export interface WorldState {
  width: number;
  height: number;
}

export interface WorldOptions {
  /** Polled each frame for current weather. Returning null = clear sky. */
  weather?: () => WeatherConditions | null;
  /** Foreground dot-grid color. Pass null to disable the grid. */
  gridColor?: string | null;
  /** Polled for the local terrain profile; null = default rolling hills. */
  terrain?: () => TerrainProfile | null;
  /** Polled each frame for an active ISS pass (see SatelliteWatcher). */
  satellites?: () => SatellitePass | null;
  /**
   * Polled for the visitor's coordinates. When known, the night sky shows
   * the real brightest stars (Yale BSC to mag 3.6) at their true positions
   * for that place and time; null keeps the seeded decorative layout.
   */
  location?: () => { lat: number; lon: number } | null;
  /** Wall clock override for demos and tests. */
  time?: () => Date;
  /** Performance / effects preset (resolved before passing in). */
  quality?: ResolvedQuality;
  /** Day birds and seasonal migrating V-formations. Default true. */
  birds?: boolean;
  /** Summer-dusk bats. Default true. */
  bats?: boolean;
  /** Summer-evening fireflies in the lower sky band. Default true. */
  fireflies?: boolean;
}

const DEFAULT_GRID = "rgba(232, 228, 216, 0.06)";

interface SkyKeyframe {
  /** Hour of day, 0..24. KEYFRAMES must be sorted ascending. */
  hour: number;
  /** Top-of-screen color. */
  top: RGB;
  /** Bottom-of-screen color. */
  bottom: RGB;
}

// Sky color stops across a 24-hour day. The narrator interpolates between
// adjacent keyframes so transitions are smooth, not steppy.
const SKY: SkyKeyframe[] = [
  { hour:  0,   top: rgb("#0d1026"), bottom: rgb("#1c2144") }, // deep night
  { hour:  5,   top: rgb("#2b2350"), bottom: rgb("#7a3d5e") }, // pre-dawn
  { hour:  6.5, top: rgb("#5f56a6"), bottom: rgb("#f0956a") }, // dawn
  { hour:  9,   top: rgb("#3e8ede"), bottom: rgb("#b8e0f8") }, // morning
  { hour: 13,   top: rgb("#2e83e0"), bottom: rgb("#a6d9f7") }, // midday
  { hour: 16,   top: rgb("#4f86c9"), bottom: rgb("#f2c88e") }, // afternoon warming
  { hour: 17.4, top: rgb("#6a4a8a"), bottom: rgb("#ff9a4a") }, // golden hour peak
  { hour: 18.2, top: rgb("#53387f"), bottom: rgb("#ef5a28") }, // sunset fire
  { hour: 19.2, top: rgb("#3a2868"), bottom: rgb("#c45a4a") }, // civil dusk
  { hour: 20.5, top: rgb("#241d4e"), bottom: rgb("#64346a") }, // evening
  { hour: 22,   top: rgb("#12132e"), bottom: rgb("#1e2242") }, // night
];

// Canonical sun window — see solar.ts for SUN_RISE / SUN_SET and warpHour().

const GRID_PX = 24;
interface Cloud {
  /** Anchor x in [0, 1] of world width — wraps at edges. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Drift speed, fraction of world width per second. */
  drift: number;
  /** Per-cloud silhouette seed so each puff looks slightly different. */
  seed: number;
  /** Depth band: 0 = far/back, 1 = mid, 2 = near/front. Drives parallax + opacity. */
  layer: 0 | 1 | 2;
}

interface Drop {
  x: number;
  y: number;
  vy: number;
  /** Sideways drift amplitude in pixels (snow only). */
  sway: number;
  swayPhase: number;
  /** Snow only: per-flake size class (0 = tiny, 1 = small, 2 = medium). */
  size: 0 | 1 | 2;
}

interface Splash {
  x: number;
  y: number;
  /** 0..1 — life progress; visual fades with progress. */
  age: number;
}

interface Bird {
  /** Position fraction across the world width [0, 1+]. */
  x: number;
  /** Vertical position fraction in the upper sky [0, 1]. */
  y: number;
  /** Drift across the world width per second. */
  speed: number;
  /** Wing-flap phase. */
  flapPhase: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  /** Total lifetime in seconds. */
  life: number;
}

interface Bat {
  x: number;
  y: number;
  vx: number;
  vy: number;
  flapPhase: number;
}

interface Firefly {
  /** Stable per-firefly column offset. */
  bx: number;
  /** Phase offsets so each fly flickers and drifts on its own rhythm. */
  driftPhase: number;
  bobPhase: number;
  blinkPhase: number;
}

export class World {
  private stars: Star[] = [];
  private clouds: Cloud[] = [];
  private drops: Drop[] = [];
  private splashes: Splash[] = [];
  private birds: Bird[] = [];
  private fireflies: Firefly[] = [];
  /** Two layers of horizon silhouette (far + near) — regenerated on resize. */
  private hillsFar: Array<[number, number]> = [];
  private hillsNear: Array<[number, number]> = [];
  private dropsKind: "rain" | "snow" | "none" = "none";
  /** Slowly varying horizontal wind, [-1, 1]. Drives rain angle + cloud sway. */
  private wind = 0;
  private windPhase = Math.random() * Math.PI * 2;
  /** Seconds until the next lightning flash. Only ticks while thunder is on. */
  private lightningTimer = 4 + Math.random() * 6;
  /** 0..1 — current flash brightness, decays each frame after a strike. */
  private lightningIntensity = 0;
  /** Procedural bolt path (or null between strikes). */
  private bolt: Array<[number, number]> | null = null;
  private boltAge = 0;
  /** One meteor at a time, minutes apart — rarity is what makes it a delight. */
  private shooting: ShootingStar | null = null;
  private shootingTimer = 90 + Math.random() * 240;
  /** 0..1 — ground wetness. Builds while it rains, dries over ~5 minutes. */
  private wetness = 0;
  /** 0..1 — settled snow on the ground. Builds while snowing, holds when cold. */
  private snowCover = 0;
  /** Last precip intensity — regen drops when the slider moves. */
  private dropsIntensity = -1;
  /** Last WMO code used to size the drop field (drizzle vs showers). */
  private dropsCode: number | null = null;
  /** Wind speed (km/h) sampled with the current drop field. */
  private dropsWind = 0;
  /** Terrain profile currently baked into the hill paths. */
  private appliedTerrain: TerrainProfile | null = null;
  /** Third distant peak line — only in properly mountainous places. */
  private hillsPeaks: Array<[number, number]> = [];
  private coastal = false;
  /** Migrating V-formation (spring/autumn) — one flock at a time. */
  private flock: { x: number; y: number } | null = null;
  private flockTimer = 240 + Math.random() * 480;
  /** One airplane at a time: contrail by day, blinking light by night. */
  private plane: { x: number; y: number; dir: 1 | -1; age: number } | null = null;
  private planeTimer = 420 + Math.random() * 900;
  /** Stylized satellite train gliding across the night sky, rarely. */
  private train: { x: number; y: number; vx: number; vy: number; age: number } | null = null;
  private trainTimer = 1500 + Math.random() * 2100;
  /** Summer-dusk bats — erratic flitting silhouettes. */
  private bats: Bat[] = [];
  private readonly weatherFn: () => WeatherConditions | null;
  private readonly baseGridColor: string | null;
  private gridColor: string | null;
  private readonly terrainFn: () => TerrainProfile | null;
  private readonly satFn: () => SatellitePass | null;
  private timeFn: () => Date;
  private particleScale: number;
  private ambientEffects: number;
  private showGrid: boolean;
  private gridEnabled: boolean;
  private gridPattern: CanvasPattern | null = null;
  private readonly locationFn: () => { lat: number; lon: number } | null;
  /** Memo of the last real-star computation (time bucket, geo, size). */
  private realStarKey = "";
  /** Seeded decorative layout — the sky when no geo, the faint backdrop when real stars show. */
  private baseStars: Star[] = [];
  private birdsEnabled: boolean;
  private batsEnabled: boolean;
  private firefliesEnabled: boolean;

  constructor(private state: WorldState, opts: WorldOptions = {}) {
    this.weatherFn = opts.weather ?? (() => null);
    this.birdsEnabled = opts.birds !== false;
    this.batsEnabled = opts.bats !== false;
    this.firefliesEnabled = opts.fireflies !== false;
    const q = opts.quality;
    this.particleScale = q?.particleScale ?? 1;
    this.ambientEffects = q?.ambientEffects ?? 1;
    this.showGrid = q?.showGrid ?? true;
    this.gridEnabled = true;
    this.baseGridColor = opts.gridColor === undefined ? DEFAULT_GRID : opts.gridColor;
    this.gridColor = this.showGrid && this.baseGridColor ? this.baseGridColor : null;
    this.terrainFn = opts.terrain ?? (() => null);
    this.satFn = opts.satellites ?? (() => null);
    this.locationFn = opts.location ?? (() => null);
    this.timeFn = opts.time ?? (() => new Date());
    this.regenStars();
    this.regenClouds();
    this.regenHills();
    this.regenBirds();
    this.regenFireflies();
    this.regenBats();
    this.regenGridPattern();
  }

  resize(state: WorldState): void {
    const sizeChanged =
      this.state.width !== state.width || this.state.height !== state.height;
    this.state = state;
    if (!sizeChanged) return;
    this.regenStars();
    this.regenClouds();
    this.regenHills();
    this.regenBirds();
    this.regenFireflies();
    this.regenBats();
    this.regenGridPattern();
    this.drops = [];
    this.splashes = [];
    this.dropsKind = "none";
    this.bolt = null;
  }

  get width(): number {
    return this.state.width;
  }
  get height(): number {
    return this.state.height;
  }

  /** Toggle the foreground dot grid without remounting. */
  setGrid(enabled: boolean): void {
    this.gridEnabled = enabled;
    this.syncGridColor();
  }

  /** Grid draws only when both the user toggle and the quality preset allow it. */
  private syncGridColor(): void {
    this.gridColor =
      this.gridEnabled && this.showGrid && this.baseGridColor
        ? this.baseGridColor
        : null;
    this.regenGridPattern();
  }

  /** Override the wall clock, or pass undefined to use real time again. */
  setTime(fn?: () => Date): void {
    this.timeFn = fn ?? (() => new Date());
  }

  /** Update particle density, ambient effect scaling, and grid visibility. */
  applyQuality(q: ResolvedQuality): void {
    this.particleScale = q.particleScale;
    this.ambientEffects = q.ambientEffects;
    if (this.showGrid !== q.showGrid) {
      this.showGrid = q.showGrid;
      this.syncGridColor();
    }
  }

  /** Toggle day birds and migrating flocks without remounting. */
  setBirds(enabled: boolean): void {
    this.birdsEnabled = enabled;
    if (!enabled) this.flock = null;
  }

  /** Toggle summer-dusk bats without remounting. */
  setBats(enabled: boolean): void {
    this.batsEnabled = enabled;
  }

  /** Toggle summer-evening fireflies without remounting. */
  setFireflies(enabled: boolean): void {
    this.firefliesEnabled = enabled;
  }

  // The world is fully driven by the wall clock — nothing to advance per frame
  // for the sky itself, but we do step weather particles and atmospherics.
  update(dtMs: number): void {
    const wx = this.weatherFn();
    const dt = dtMs / 1000;
    this.tickWind(wx, dt);
    this.tickClouds(wx, dt);
    this.tickDrops(wx, dt);
    this.tickSplashes(dt);
    this.tickLightning(wx, dt);
    if (this.birdsEnabled) this.tickBirds(dt);
    const date = this.now();
    const h = this.currentHour(wx, date);
    this.tickShootingStar(dt, starAlpha(h), date);
    this.tickWetness(wx, dt);
    this.tickSnowCover(wx, dt);
    this.applyTerrain();
    const m = this.seasonMonth(date, wx);
    const migrating = m === 2 || m === 3 || m === 8 || m === 9;
    const fairDay = (!wx || wx.precipitation === "none") && daylight(h) > 0.5;
    if (this.birdsEnabled) this.tickFlock(dt, migrating && fairDay);
    this.tickPlane(wx, dt);
    this.tickTrain(dt, starAlpha(h));
    if (this.batsEnabled && duskAlpha(h) > 0) this.tickBats(dt);
  }

  /** Re-bake the hill paths when a terrain profile (async fetch) arrives or clears. */
  private applyTerrain(): void {
    const t = this.terrainFn();
    if (t !== this.appliedTerrain) {
      this.appliedTerrain = t;
      this.regenHills();
    }
  }

  /** Ground wetness 0..1 — for atmosphere CSS / captions. */
  getWetness(): number {
    return this.wetness;
  }

  /** Settled snow cover 0..1 — for atmosphere CSS / captions. */
  getSnowCover(): number {
    return this.snowCover;
  }

  /** Calendar month shifted six months in the southern hemisphere. */
  private seasonMonth(date: Date, wx: WeatherConditions | null): number {
    const m = date.getMonth();
    return (wx?.latitude ?? 50) < 0 ? (m + 6) % 12 : m;
  }

  private now(): Date {
    return this.timeFn();
  }

  /** The canonical (sun-warped) hour — see warpHour. */
  private currentHour(wx: WeatherConditions | null, date?: Date): number {
    const d = date ?? this.now();
    const hReal = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    return warpHour(hReal, wx?.sunriseH ?? null, wx?.sunsetH ?? null);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.state;
    const date = this.now();
    const wx = this.weatherFn();
    // All drawing below runs on the warped (canonical) clock — see warpHour.
    const h = this.currentHour(wx, date);

    // Sky gradient. Overcast pulls the colors toward gray, so a clear day is
    // genuinely blue and a stormy one genuinely leaden — weather owns the mood.
    const cloudAlpha = wx ? cloudAlphaFor(wx) : 0;
    const intensity = wx?.intensity ?? 0;
    let [topRGB, bottomRGB] = this.skyAt(h);
    const warmth = solsticeWarmth(date, wx?.latitude ?? 50);
    if (warmth > 0) {
      bottomRGB = lerpRGB(bottomRGB, [240, 170, 100], warmth);
      topRGB = lerpRGB(topRGB, [255, 200, 140], warmth * 0.35);
    }
    if (cloudAlpha > 0) {
      const desat = cloudAlpha * (0.45 + intensity * 0.2 + intensity * intensity * 0.25);
      topRGB = desatRGB(topRGB, Math.min(0.85, desat));
      bottomRGB = desatRGB(bottomRGB, Math.min(0.85, desat));
    }
    // Full moon nights lift the whole sky a touch — you can feel the silver.
    const moonIllum = (1 - Math.cos(lunarPhase(date) * Math.PI * 2)) / 2;
    if (moonIllum > 0.85 && daylight(h) < 0.2) {
      const lift = (moonIllum - 0.85) / 0.15 * 0.12 * (1 - cloudAlpha * 0.6);
      topRGB = lerpRGB(topRGB, [40, 48, 78], lift);
      bottomRGB = lerpRGB(bottomRGB, [55, 62, 95], lift);
    }
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, rgbToCss(topRGB));
    grad.addColorStop(1, rgbToCss(bottomRGB));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Horizon glow at sunrise/sunset — soft warm wash low on the screen.
    // Gone under a solid overcast.
    if (cloudAlpha < 0.92) drawHorizonGlow(ctx, width, height, h);

    // Aurora bands at deep night when the sky is reasonably clear — drawn
    // before stars so it reads as a soft veil behind them.
    const auroraA = auroraAlpha(h) * auroraLatFactor(wx?.latitude) * (1 - cloudAlpha * 0.85);
    if (auroraA > 0.01) drawAurora(ctx, width, height, auroraA);

    // Stars (only at night-ish hours; heavy clouds also dim them).
    const sa = starAlpha(h) * Math.max(0, 1 - cloudAlpha * (0.85 + intensity * 0.2));
    if (sa > 0.01) {
      this.updateRealStars(date);
      drawStars(ctx, this.stars, sa);
    }
    if (this.shooting) this.drawShootingStar(ctx, sa);
    if (this.train && sa > 0.3) this.drawTrain(ctx, sa);
    const issPass = this.satFn();
    if (issPass) {
      const issA = issPass.demo ? Math.max(sa, 0.4) : sa;
      if (issA > 0.2) this.drawIss(ctx, issPass.progress, issA);
    }

    // Venus — evening or morning star per its real 584-day cycle.
    drawVenus(ctx, width, height, h, date, cloudAlpha);

    // High thin cirrus for lightly veiled skies — real cover % that is
    // too sparse for the puffy buckets. Fades out as those take over.
    const cirrusA =
      wx && wx.precipitation === "none" && !wx.fog && wx.cloudCover != null
        ? Math.min(1, Math.max(0, (wx.cloudCover - 5) / 28)) *
          Math.max(0, 1 - cloudAlpha * 2.4)
        : 0;
    if (cirrusA > 0.03) drawCirrus(ctx, width, height, cirrusA, h);

    // Distant cloud layer sits *behind* the sun/moon for a sense of depth.
    if (this.clouds.length > 0 && cloudAlpha > 0) {
      this.drawCloudLayer(ctx, 0, cloudAlpha, wx, h);
    }

    // Sun / moon: full intensity overcast blacks them out completely.
    const celestialDim = Math.max(
      0,
      1 - cloudAlpha * (0.75 + intensity * intensity * 0.5)
    );
    drawCelestial(ctx, width, height, h, celestialDim, date);

    // Warm dome of city light beyond the ridge — the visitor's IP resolved
    // to a town, after all. Overcast makes it stronger: clouds bounce the
    // light back down, exactly like a real city night.
    drawCityGlow(ctx, width, height, h, cloudAlpha);

    // Distant horizon silhouettes — derived from the bottom sky color so they
    // always sit *between* the sky and the foreground cloud band.
    this.drawHills(ctx, h, bottomRGB);

    // Rain-slicked ground: a low reflective sheen that lingers after a shower.
    if (this.wetness > 0.02) drawWetSheen(ctx, width, height, this.wetness);

    // Settled snow — builds while it flakes, stays while the air stays cold.
    if (this.snowCover > 0.02) drawSnowCover(ctx, width, height, this.snowCover);

    // Hard frost sparkle on cold clear nights and early mornings.
    const frost =
      wx && wx.temperatureC <= 0
        ? Math.min(1, -wx.temperatureC / 8) *
          (1 - cloudAlpha * 0.7) *
          (h >= 20 || h < 9 ? 1 : h < 11 ? 1 - (h - 9) / 2 : 0)
        : 0;
    if (frost > 0.05) drawFrost(ctx, width, height, frost);

    // Hot, clear afternoons get a faint shimmer hovering over the horizon.
    const heat = wx ? heatFactor(wx.temperatureC, cloudAlpha, h) : 0;
    if (heat > 0.02) drawHeatHaze(ctx, width, height, heat);

    // A rainbow when the sun and a clearing shower share the sky.
    const rainbowA = this.rainbowAlpha(wx, cloudAlpha, h);
    if (rainbowA > 0.02) drawRainbow(ctx, width, height, h, rainbowA);

    // Distant rain shafts under the deck give a heavy downpour depth.
    if (wx?.precipitation === "rain" && intensity > 0.45) {
      drawRainCurtain(ctx, width, height, intensity, this.wind);
    }

    // Mid + near cloud layers in front of the celestial body.
    if (this.clouds.length > 0 && cloudAlpha > 0) {
      this.drawCloudLayer(ctx, 1, cloudAlpha, wx, h);
      this.drawCloudLayer(ctx, 2, cloudAlpha, wx, h);
    }

    // Pixel birds drifting across the upper sky on clear-ish days. They
    // shelter during precipitation, and winter skies are emptier. Seasons
    // flip with the hemisphere.
    const month = this.seasonMonth(date, wx);
    const winter = month === 11 || month <= 1;
    const sheltering = !!wx && wx.precipitation !== "none";
    const dayA = this.birdsEnabled
      ? sheltering
        ? 0
        : dayCreatureAlpha(h) * (1 - cloudAlpha * 0.6)
      : 0;
    if (dayA > 0.05) this.drawBirds(ctx, dayA, winter ? 0.4 : 1);
    if (this.flock && dayA > 0.05) this.drawFlock(ctx, dayA);
    if (this.plane) this.drawPlane(ctx, h);

    // Fireflies near the lower sky band on clear nights — May to September;
    // fireflies in a January frost would break the spell.
    const flySeason = month >= 4 && month <= 8 ? 1 : 0;
    const flyA = this.firefliesEnabled
      ? fireflyAlpha(h) * flySeason * (1 - cloudAlpha * 0.85)
      : 0;
    if (flyA > 0.05) this.drawFireflies(ctx, flyA);

    // Bats own the brief dusk window on summer evenings.
    const batA = this.batsEnabled
      ? duskAlpha(h) * flySeason * (1 - cloudAlpha * 0.7)
      : 0;
    if (batA > 0.05) this.drawBats(ctx, batA);

    // Fog haze — gradient overlay denser near the ground.
    if (wx?.fog) drawFog(ctx, width, height);

    // Rain / snow particles in front of the clouds.
    if (this.drops.length > 0) this.drawDrops(ctx);
    if (this.splashes.length > 0) this.drawSplashes(ctx);

    // Lightning: brief screen-wide flash + procedural bolt during thunder.
    if (this.lightningIntensity > 0) this.drawLightning(ctx);

    // Quiet graph-paper dot grid on top (tiled pattern — cheap per frame).
    if (this.gridPattern) {
      ctx.fillStyle = this.gridPattern;
      ctx.fillRect(0, 0, width, height);
    }
  }

  /** Bake the dot grid into a repeating pattern (regenerated on resize). */
  private regenGridPattern(): void {
    this.gridPattern = null;
    if (!this.gridColor) return;
    const tile = document.createElement("canvas");
    tile.width = GRID_PX;
    tile.height = GRID_PX;
    const tctx = tile.getContext("2d");
    if (!tctx) return;
    tctx.fillStyle = this.gridColor;
    tctx.fillRect(0, 0, 1, 1);
    this.gridPattern = tctx.createPattern(tile, "repeat");
  }

  /** Returns interpolated [top, bottom] sky colors for a given decimal hour. */
  private skyAt(h: number): [RGB, RGB] {
    for (let i = 0; i < SKY.length; i++) {
      const next = SKY[i];
      if (next.hour > h) {
        const prev =
          i === 0
            ? { ...SKY[SKY.length - 1], hour: SKY[SKY.length - 1].hour - 24 }
            : SKY[i - 1];
        const t = (h - prev.hour) / (next.hour - prev.hour);
        return [lerpRGB(prev.top, next.top, t), lerpRGB(prev.bottom, next.bottom, t)];
      }
    }
    // h is past the last keyframe — wrap around to the first
    const prev = SKY[SKY.length - 1];
    const next = { ...SKY[0], hour: SKY[0].hour + 24 };
    const t = (h - prev.hour) / (next.hour - prev.hour);
    return [lerpRGB(prev.top, next.top, t), lerpRGB(prev.bottom, next.bottom, t)];
  }







  private drawCloudLayer(
    ctx: CanvasRenderingContext2D,
    layer: 0 | 1 | 2,
    alpha: number,
    wx: WeatherConditions | null,
    h: number,
  ): void {
    const i = Math.max(0, Math.min(1, wx?.intensity ?? 0));
    const stormBase = !!(wx && (wx.thunder || wx.cloudiness === 2));
    // Heaviness drives color: light scattered puffs → charcoal storm bank.
    const heaviness = Math.min(
      1,
      (stormBase ? 0.35 : wx?.cloudiness === 1 ? 0.12 : 0) +
        i * 0.35 +
        i * i * 0.55 +
        (wx?.thunder ? 0.15 : 0)
    );
    let top = lerpRGB([220, 222, 232], [72, 74, 90], heaviness);
    let bot = lerpRGB([130, 132, 152], [26, 26, 38], heaviness);
    // Golden hour: the low sun lights clouds from below, so the shadowed
    // underside catches fire first and the top edge only blushes. Heavy
    // decks still glow, just ember-dim.
    const glow = horizonGlowStrength(h);
    if (glow > 0.02) {
      const k = glow * (0.45 + (1 - heaviness) * 0.7);
      bot = lerpRGB(bot, [255, 120, 55], Math.min(1, 0.85 * k));
      top = lerpRGB(top, [255, 190, 130], Math.min(1, 0.55 * k));
    }
    const [topR, topG, topB] = top;
    const [botR, botG, botB] = bot;
    // Distant clouds are dimmer (atmospheric perspective).
    const layerOpacity = layer === 0 ? 0.55 : layer === 1 ? 0.85 : 1.0;
    const baseAlpha =
      alpha * (0.38 + i * 0.28 + i * i * 0.28 + (wx?.thunder ? 0.12 : 0)) * layerOpacity;
    // Heavy weather swells the bank — same silhouettes, thicker coverage.
    const sizeMul = 1 + i * 0.35 + i * i * 0.75;

    for (const cloud of this.clouds) {
      if (cloud.layer !== layer) continue;

      const cx = cloud.x * this.state.width;
      const cy = cloud.y;
      const w = cloud.width * sizeMul;
      const ch = cloud.height * sizeMul;

      // Vertical light/shadow gradient per cloud — top reads brighter.
      const grad = ctx.createLinearGradient(0, cy - ch * 0.6, 0, cy + ch * 0.7);
      grad.addColorStop(0, `rgba(${topR}, ${topG}, ${topB}, ${baseAlpha.toFixed(3)})`);
      grad.addColorStop(1, `rgba(${botR}, ${botG}, ${botB}, ${(baseAlpha * 0.85).toFixed(3)})`);
      ctx.fillStyle = grad;

      // A cloud is 4–5 overlapping ellipses; the seed deterministically
      // varies the puff pattern so each one looks distinct.
      const lobes = 4 + (cloud.seed & 1) + (i > 0.7 ? 1 : 0);
      for (let n = 0; n < lobes; n++) {
        const offX = ((cloud.seed * (n + 1) * 31) % 100) / 100 - 0.5;
        const offY = ((cloud.seed * (n + 2) * 17) % 60) / 100 - 0.3;
        const rx = (w / 2) * (0.55 + ((cloud.seed * (n + 3) * 7) % 40) / 100);
        const ry = (ch / 2) * (0.65 + ((cloud.seed * (n + 4) * 5) % 30) / 100);
        ctx.beginPath();
        ctx.ellipse(cx + offX * w * 0.6, cy + offY * ch * 0.8, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }


  private drawDrops(ctx: CanvasRenderingContext2D): void {
    const i = Math.max(0, this.dropsIntensity);
    const windK = Math.min(1.5, this.dropsWind / 40);
    if (this.dropsKind === "rain") {
      // Wind tilts the streak — calm is near-vertical, a gale is a sheet.
      // Direction comes from tickWind (meteorological "from" + gust noise).
      const tilt = this.wind * (10 + i * 16) + windK * 18 * Math.sign(this.wind || 1);
      // Light intensity = fine drizzle threads; heavy = longer driving streaks.
      const drizzle = i < 0.38;
      const len = drizzle ? 3.5 + i * 8 : 6 + i * 16 + windK * 4;
      const alpha = drizzle ? 0.28 + i * 0.35 : 0.38 + i * 0.5;
      ctx.strokeStyle = `rgba(170, 190, 220, ${alpha.toFixed(3)})`;
      ctx.lineWidth = i > 0.75 ? 1.35 : drizzle ? 0.85 : 1;
      ctx.beginPath();
      for (const d of this.drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + tilt * 0.85, d.y + len);
      }
      ctx.stroke();
    } else if (this.dropsKind === "snow") {
      const alpha = 0.75 + i * 0.2;
      ctx.fillStyle = `rgba(232, 234, 244, ${alpha.toFixed(3)})`;
      for (const d of this.drops) {
        const ix = d.x | 0;
        const iy = d.y | 0;
        if (d.size === 0) {
          ctx.fillRect(ix, iy, 1, 1);
        } else if (d.size === 1) {
          ctx.fillRect(ix, iy, 1, 1);
          ctx.fillRect(ix + 1, iy, 1, 1);
          ctx.fillRect(ix, iy + 1, 1, 1);
        } else {
          // 3px cross — bigger flakes catch the eye.
          ctx.fillRect(ix, iy, 1, 1);
          ctx.fillRect(ix + 1, iy, 1, 1);
          ctx.fillRect(ix - 1, iy, 1, 1);
          ctx.fillRect(ix, iy + 1, 1, 1);
          ctx.fillRect(ix, iy - 1, 1, 1);
        }
      }
    }
  }

  private drawSplashes(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = "rgba(170, 190, 220, 0.5)";
    ctx.lineWidth = 1;
    for (const s of this.splashes) {
      const a = (1 - s.age) * 0.6;
      const w = 2 + s.age * 4;
      ctx.strokeStyle = `rgba(170, 190, 220, ${a.toFixed(3)})`;
      ctx.beginPath();
      // A short flat arc — looks like water bouncing off the surface.
      ctx.ellipse(s.x, s.y, w, 1, 0, Math.PI, 0);
      ctx.stroke();
    }
  }

  private drawLightning(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.state;
    // Screen-wide brightening — capped so it stays moody, not flashbang.
    const flashAlpha = this.lightningIntensity * 0.22 * this.ambientEffects;
    ctx.fillStyle = `rgba(220, 220, 240, ${flashAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);

    if (this.bolt && this.bolt.length > 1) {
      // Bolt fades faster than the flash — visible only in the first ~120ms.
      const boltAlpha = Math.max(0, 1 - this.boltAge * 8) * 0.85;
      if (boltAlpha > 0.02) {
        ctx.strokeStyle = `rgba(245, 245, 255, ${boltAlpha.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(this.bolt[0][0], this.bolt[0][1]);
        for (let i = 1; i < this.bolt.length; i++) {
          ctx.lineTo(this.bolt[i][0], this.bolt[i][1]);
        }
        ctx.stroke();
        // Faint outer glow on the bolt
        ctx.strokeStyle = `rgba(200, 210, 255, ${(boltAlpha * 0.35).toFixed(3)})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
  }

  private tickWind(wx: WeatherConditions | null, dt: number): void {
    // Real wind speed sets the amplitude; gusts add a little extra push.
    // Two summed sines keep the gusting organic. ~40 km/h reads as full
    // bluster; 60 km/h pushes past that into a driving gale.
    const speed = wx?.windSpeed ?? 8;
    const gusts = wx?.windGusts ?? speed;
    const strength = 0.2 + 0.9 * Math.min(1.35, speed / 40);
    const gustBoost = Math.min(0.35, Math.max(0, (gusts - speed) / 80));
    this.windPhase += dt * (0.07 + Math.min(0.08, speed / 500));
    const oscillate =
      Math.sin(this.windPhase) * 0.6 + Math.sin(this.windPhase * 0.31 + 2.1) * 0.4;
    // Meteorological "from" degrees → canvas horizontal (−1 = left, +1 = right).
    // Wind from the west (270°) drives rain streaks to the right.
    let directed = oscillate;
    if (wx?.windDirection != null && Number.isFinite(wx.windDirection)) {
      const axis = -Math.sin((wx.windDirection * Math.PI) / 180);
      directed = axis * 0.78 + oscillate * 0.22;
    }
    this.wind = directed * (strength + gustBoost);
  }

  private tickClouds(wx: WeatherConditions | null, dt: number): void {
    // Move whenever the sky is cloudy enough to draw — including precip
    // that forced cloudAlpha up while cloudiness was still catching up.
    if (!wx || cloudAlphaFor(wx) < 0.05) return;
    // A wind nudge on top of each cloud's intrinsic drift — with real wind
    // speed in this.wind's amplitude, a blustery day visibly hurries them.
    // Prefer meteorological direction so banks march with the prevailing wind.
    const windNudge = this.wind * 0.006;
    for (const cloud of this.clouds) {
      // Front-layer clouds are pushed harder — parallax sells depth.
      const layerScale = cloud.layer === 0 ? 0.35 : cloud.layer === 1 ? 1.0 : 1.6;
      cloud.x += (cloud.drift + windNudge) * layerScale * dt;
      // Wrap horizontally — fraction-of-width coordinates make this trivial.
      if (cloud.x > 1.15) cloud.x -= 1.3;
      else if (cloud.x < -0.15) cloud.x += 1.3;
    }
  }

  private tickDrops(wx: WeatherConditions | null, dt: number): void {
    const wantKind: "rain" | "snow" | "none" = wx?.precipitation ?? "none";
    const wantIntensity = wx?.intensity ?? 0;
    const wantCode = wx?.weatherCode ?? null;
    this.dropsWind = wx?.windSpeed ?? 0;
    if (
      wantKind !== this.dropsKind ||
      wantCode !== this.dropsCode ||
      Math.abs(wantIntensity - this.dropsIntensity) > 0.04
    ) {
      this.dropsKind = wantKind;
      this.dropsIntensity = wantIntensity;
      this.dropsCode = wantCode;
      this.regenDrops(wx);
    }
    if (this.drops.length === 0 || wantKind === "none") return;
    const { width, height } = this.state;
    const i = wantIntensity;
    const windK = Math.min(1.5, this.dropsWind / 40);
    const drift =
      this.wind * (wantKind === "snow" ? 55 + i * 80 : 35 + i * 55) +
      Math.sign(this.wind || 1) * windK * (wantKind === "snow" ? 140 : 95);
    for (const d of this.drops) {
      d.y += d.vy * dt;
      if (wantKind === "snow") {
        d.swayPhase += dt * (1.4 + i);
        d.x += (drift + Math.sin(d.swayPhase) * d.sway * 8) * dt;
      } else {
        d.x += drift * dt;
      }
      if (d.y > height + 8) {
        // Rain occasionally spawns a splash where it lands. Throttled by chance
        // and a hard cap — splashes are cheap, but a few hundred would chew CPU.
        const splashChance = 0.15 + i * 0.45;
        if (wantKind === "rain" && this.splashes.length < 30 + i * 50 && Math.random() < splashChance) {
          this.splashes.push({ x: d.x, y: height - 2, age: 0 });
        }
        d.y = -8;
        d.x = Math.random() * width;
      }
      if (d.x < -8) d.x += width + 16;
      else if (d.x > width + 8) d.x -= width + 16;
    }
  }

  private tickSplashes(dt: number): void {
    if (this.splashes.length === 0) return;
    for (const s of this.splashes) s.age += dt * 4; // ~250ms total life
    this.splashes = this.splashes.filter((s) => s.age < 1);
  }

  private tickLightning(wx: WeatherConditions | null, dt: number): void {
    if (!wx?.thunder) {
      this.lightningIntensity = 0;
      this.bolt = null;
      // Reset the timer so the first strike after thunder returns isn't immediate.
      this.lightningTimer = 4 + Math.random() * 6;
      return;
    }
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningIntensity = 0.6 + Math.random() * 0.4;
      // Rarely double-strike — the eye reads it as a louder storm.
      this.lightningTimer = (Math.random() < 0.18 ? 0.18 : 0) + 4 + Math.random() * 9;
      this.bolt = generateBolt(this.state.width, this.state.height);
      this.boltAge = 0;
    }
    if (this.lightningIntensity > 0) {
      // Fast exponential decay — 0.001^dt drops to ~0.07 over 1s.
      this.lightningIntensity *= Math.pow(0.001, dt);
      if (this.lightningIntensity < 0.01) this.lightningIntensity = 0;
    }
    if (this.bolt) {
      this.boltAge += dt;
      if (this.boltAge > 0.25) this.bolt = null;
    }
  }

  private regenClouds(): void {
    const count = Math.max(6, Math.round(this.state.width / 180));
    let seed = 7331;
    const rand = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    this.clouds = [];
    const skyBand = this.state.height * 0.42;
    for (let i = 0; i < count; i++) {
      // Distribute across three depth layers. Distant clouds are smaller and
      // higher in the frame; near clouds are larger and sit lower.
      const layerRoll = rand();
      const layer: 0 | 1 | 2 = layerRoll < 0.35 ? 0 : layerRoll < 0.75 ? 1 : 2;
      const sizeMul = layer === 0 ? 0.55 : layer === 1 ? 1.0 : 1.35;
      const w = (90 + rand() * 130) * sizeMul;
      const yJitter =
        layer === 0
          ? rand() * skyBand * 0.55
          : layer === 1
          ? skyBand * 0.2 + rand() * skyBand * 0.6
          : skyBand * 0.4 + rand() * skyBand * 0.6;
      this.clouds.push({
        x: rand() * 1.3 - 0.15,
        y: 30 + yJitter,
        width: w,
        height: w * (0.34 + rand() * 0.16),
        // Base drift speed; tickClouds applies the per-layer parallax scale.
        drift: (rand() < 0.5 ? -1 : 1) * (0.005 + rand() * 0.012),
        seed: 1 + Math.floor(rand() * 9999),
        layer,
      });
    }
  }

  private regenDrops(wx: WeatherConditions | null): void {
    if (!wx || wx.precipitation === "none") {
      this.drops = [];
      return;
    }
    const isRain = wx.precipitation === "rain";
    const i = Math.max(0, Math.min(1, wx.intensity));
    const code = wx.weatherCode ?? null;
    // Drizzle / light snow codes keep the field sparse; showers pack denser.
    const drizzle =
      code != null && [51, 53, 55, 56, 57, 71, 73, 77].includes(code);
    const shower = code != null && [80, 81, 82, 85, 86].includes(code);
    // Quadratic density: drizzle stays light, 100% is a wall of weather.
    const dens = (drizzle ? 0.14 : 0.2) + i * i * (shower ? 6.2 : 5.5);
    const baseCount = Math.round(
      (this.state.width * this.state.height) / (isRain ? (drizzle ? 16_000 : 12_000) : 18_000)
    );
    const count = Math.round(baseCount * dens * this.particleScale);
    this.drops = [];
    for (let n = 0; n < count; n++) {
      // Snow flake size distribution: lots of tiny, few medium — feels natural.
      // Heavy snow skews larger.
      const sizeRoll = Math.random();
      const bigBias = i * 0.2;
      const size: 0 | 1 | 2 =
        sizeRoll < 0.55 - bigBias ? 0 : sizeRoll < 0.9 - bigBias * 0.5 ? 1 : 2;
      this.drops.push({
        x: Math.random() * this.state.width,
        y: Math.random() * this.state.height,
        vy: isRain
          ? (drizzle ? 160 : 240) + i * (drizzle ? 220 : 340) + Math.random() * (160 + i * 280)
          : 22 + i * 45 + Math.random() * (35 + i * 50),
        sway: isRain ? 0 : 0.6 + Math.random() * (1.6 + i),
        swayPhase: Math.random() * Math.PI * 2,
        size,
      });
    }
  }

  /**
   * Deterministic seeded layout so stars don't shimmer between frames and
   * keep the same map until the window resizes.
   */
  private regenStars(): void {
    const count = Math.round((this.state.width * this.state.height) / 9000);
    let seed = 12345;
    const rand = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    this.baseStars = [];
    for (let i = 0; i < count; i++) {
      this.baseStars.push({
        x: rand() * this.state.width,
        // Keep stars in the upper ~70% so they read as "sky"
        y: rand() * (this.state.height * 0.7),
        brightness: 0.35 + rand() * 0.65,
        twinklePhase: rand() * Math.PI * 2,
      });
    }
    this.stars = this.baseStars;
    this.realStarKey = "";
  }

  /**
   * Replace the decorative layout with the real sky: catalog stars at
   * their true alt/az for the visitor's location and the displayed time.
   * Cheap enough to recompute whenever the memo key moves (30 s of real
   * time, a location change, a resize — or every frame during time sweeps).
   */
  private updateRealStars(date: Date): void {
    const loc = this.locationFn();
    if (!loc) return; // no geo yet — keep the seeded decorative stars
    const { width, height } = this.state;
    const key = `${Math.round(date.getTime() / 30_000)}|${loc.lat.toFixed(1)},${loc.lon.toFixed(1)}|${width}x${height}`;
    if (key === this.realStarKey) return;
    this.realStarKey = key;
    // A real sky also has thousands of stars fainter than the catalog cut —
    // keep the seeded scatter as a dim backdrop under the true bright stars.
    const stars: Star[] = this.baseStars.map((s) => ({
      ...s,
      brightness: s.brightness * 0.5,
    }));
    for (let i = 0; i < STAR_CATALOG.length; i += 3) {
      const { altDeg, azDeg } = equatorialToHorizontal(
        STAR_CATALOG[i] / 10,
        STAR_CATALOG[i + 1] / 10,
        loc.lat,
        loc.lon,
        date
      );
      const p = projectStar(azDeg, altDeg, loc.lat);
      if (!p) continue;
      stars.push({
        x: p.x * width,
        y: p.y * height,
        // Floor above the backdrop so every catalog star reads as "real".
        brightness: Math.max(0.4, starBrightness(STAR_CATALOG[i + 2] / 10)),
        // Golden-angle spread keeps each star's twinkle stable across frames.
        twinklePhase: (i / 3) * 2.399,
      });
    }
    this.stars = stars;
  }

  /** Horizon silhouette, shaped by the local terrain profile when present. */
  private regenHills(): void {
    const { width, height } = this.state;
    const t = this.appliedTerrain;
    const relief = t?.relief ?? 130; // default: gentle rolling hills
    this.coastal = t?.coastal ?? false;
    // Real elevation data gets a stronger silhouette than the procedural default.
    let amp = t
      ? Math.min(3.2, 0.6 + relief / 240)
      : Math.min(2.4, 0.45 + relief / 320);
    if (this.coastal) amp *= 0.55; // coasts read flat toward the water
    const seg = relief > 450 ? 30 : 22;
    this.hillsFar = hillPath(7331, height * 0.62, height * 0.028 * amp, seg, width);
    this.hillsNear = hillPath(919, height * 0.74, height * 0.036 * amp, Math.max(16, seg - 6), width);
    this.hillsPeaks =
      relief > 420 ? hillPath(2718, height * 0.56, height * 0.05 * amp, 34, width) : [];
  }

  private regenBirds(): void {
    // Bird density scales gently with width; a 1200px sky gets ~5 birds.
    const count = Math.max(3, Math.round(this.state.width / 240));
    let seed = 4242;
    const rand = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    this.birds = [];
    for (let i = 0; i < count; i++) {
      this.birds.push({
        x: rand(),
        y: 0.10 + rand() * 0.18,
        // Slightly different cruising speeds so the flock doesn't move in lockstep.
        speed: 0.012 + rand() * 0.012,
        flapPhase: rand() * Math.PI * 2,
      });
    }
  }

  private regenFireflies(): void {
    let seed = 808;
    const rand = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const count = Math.max(8, Math.round(this.state.width / 90));
    this.fireflies = [];
    for (let i = 0; i < count; i++) {
      this.fireflies.push({
        bx: rand() * this.state.width,
        driftPhase: rand() * Math.PI * 2,
        bobPhase: rand() * Math.PI * 2,
        blinkPhase: rand() * Math.PI * 2,
      });
    }
  }

  private drawHills(ctx: CanvasRenderingContext2D, h: number, bottomRGB: RGB): void {
    if (this.hillsFar.length === 0) return;
    const { width, height } = this.state;
    // Hills live: deep meadow green in daylight, cool indigo at night, with
    // the sky's horizon color bleeding in for atmospheric perspective.
    const bg = lerpRGB([0x1e, 0x16, 0x2d], [0x2f, 0x6b, 0x40], daylight(h));
    const farRGB = lerpRGB(bottomRGB, bg, 0.62);
    const nearRGB = lerpRGB(bottomRGB, bg, 0.84);

    if (this.hillsPeaks.length > 0) {
      ctx.fillStyle = rgbToCss(lerpRGB(bottomRGB, bg, 0.45));
      fillHillPath(ctx, this.hillsPeaks, width, height);
    }
    ctx.fillStyle = rgbToCss(farRGB);
    fillHillPath(ctx, this.hillsFar, width, height);
    if (this.coastal) drawSeaBand(ctx, width, height);
    ctx.fillStyle = rgbToCss(nearRGB);
    fillHillPath(ctx, this.hillsNear, width, height);
  }

  private tickBirds(dt: number): void {
    if (this.birds.length === 0) return;
    for (const b of this.birds) {
      b.x += b.speed * dt;
      b.flapPhase += dt * 6;
      if (b.x > 1.1) b.x -= 1.25; // wrap with a small buffer beyond the right edge
    }
  }

  private drawBirds(ctx: CanvasRenderingContext2D, alpha: number, frac = 1): void {
    if (this.birds.length === 0) return;
    const { width, height } = this.state;
    ctx.fillStyle = `rgba(20, 20, 28, ${(0.7 * alpha).toFixed(3)})`;
    const count = Math.max(1, Math.round(this.birds.length * frac));
    for (const b of this.birds.slice(0, count)) {
      const bx = b.x * width;
      const by = b.y * height;
      const flap = Math.sin(b.flapPhase);
      // Wings up vs. wings down — a 2-frame flap silhouette.
      if (flap > 0) {
        ctx.fillRect((bx | 0) - 3, (by | 0) - 1, 3, 1);
        ctx.fillRect(bx | 0, (by | 0) - 1, 3, 1);
      } else {
        ctx.fillRect((bx | 0) - 3, by | 0, 3, 1);
        ctx.fillRect(bx | 0, by | 0, 3, 1);
      }
    }
  }

  private tickShootingStar(dt: number, starA: number, date: Date): void {
    if (this.shooting) {
      this.shooting.age += dt;
      this.shooting.x += this.shooting.vx * dt;
      this.shooting.y += this.shooting.vy * dt;
      if (this.shooting.age > this.shooting.life) this.shooting = null;
      return;
    }
    if (starA < 0.5) return; // only when the stars are properly out
    if (this.ambientEffects < 0.05) return;
    this.shootingTimer -= dt;
    if (this.shootingTimer <= 0) {
      // Meteor-shower peaks multiply the base one-every-2–7-minutes rate.
      this.shootingTimer = (120 + Math.random() * 300) / (meteorRate(date) * this.ambientEffects);
      const { width, height } = this.state;
      const speed = 420 + Math.random() * 240;
      const angle = Math.PI * (0.12 + Math.random() * 0.16); // shallow descent
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.shooting = {
        x: width * (0.1 + Math.random() * 0.8),
        y: height * (0.04 + Math.random() * 0.22),
        vx: Math.cos(angle) * speed * dir,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 0.5 + Math.random() * 0.4,
      };
    }
  }

  private drawShootingStar(ctx: CanvasRenderingContext2D, alpha: number): void {
    const s = this.shooting;
    if (!s) return;
    // Sine envelope: flares in, burns, fades out.
    const a = Math.sin((s.age / s.life) * Math.PI) * alpha;
    if (a < 0.02) return;
    const trail = 0.09; // seconds of tail behind the head
    const tx = s.x - s.vx * trail;
    const ty = s.y - s.vy * trail;
    const grad = ctx.createLinearGradient(tx, ty, s.x, s.y);
    grad.addColorStop(0, "rgba(255, 252, 240, 0)");
    grad.addColorStop(1, `rgba(255, 252, 240, ${(0.9 * a).toFixed(3)})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
  }

  private tickWetness(wx: WeatherConditions | null, dt: number): void {
    if (wx?.precipitation === "rain") {
      const soak = 12 / (0.45 + wx.intensity * 1.8); // 100% soaks in ~5s
      this.wetness = Math.min(1, this.wetness + dt / soak);
    } else {
      this.wetness = Math.max(0, this.wetness - dt / 360); // dries over ~6 min
    }
  }

  private tickSnowCover(wx: WeatherConditions | null, dt: number): void {
    const temp = wx?.temperatureC ?? 18;
    const snowing = wx?.precipitation === "snow";
    if (snowing && temp <= 1) {
      const i = wx?.intensity ?? 0.5;
      const rate = 0.3 + i * i * 2.8; // 100% blankets in ~15s
      this.snowCover = Math.min(1, this.snowCover + (dt / 40) * rate);
      // Fresh snow covers wet ground.
      this.wetness = Math.max(0, this.wetness - dt / 8);
    } else if (temp > 0.5) {
      // Melt: slow just above freezing, faster in a thaw.
      const meltSec = temp < 4 ? 300 : Math.max(60, 200 / temp);
      const melt = dt / meltSec;
      this.snowCover = Math.max(0, this.snowCover - melt);
      if (this.snowCover > 0.05 && temp > 2) {
        this.wetness = Math.min(1, this.wetness + melt * 0.4);
      }
    }
    // Below freezing and not snowing: cover holds.
  }



  private tickFlock(dt: number, migrating: boolean): void {
    const { width } = this.state;
    if (this.flock) {
      this.flock.x += width * 0.02 * dt; // ~50 s to cross
      if (this.flock.x > width * 1.3) this.flock = null;
      return;
    }
    if (!migrating) return;
    this.flockTimer -= dt;
    if (this.flockTimer <= 0) {
      this.flockTimer = 240 + Math.random() * 480; // every 4–12 min in season
      this.flock = {
        x: -width * 0.25,
        y: this.state.height * (0.1 + Math.random() * 0.12),
      };
    }
  }

  private drawFlock(ctx: CanvasRenderingContext2D, alpha: number): void {
    const f = this.flock;
    if (!f) return;
    ctx.fillStyle = `rgba(20, 20, 28, ${(0.75 * alpha).toFixed(3)})`;
    const t = performance.now() / 1000;
    // A V of seven, wingbeats staggered down each arm.
    for (let i = -3; i <= 3; i++) {
      const bx = f.x - Math.abs(i) * 14;
      const by = f.y + Math.abs(i) * 7 + i * 1.5;
      const flap = Math.sin(t * 7 + i * 0.9);
      if (flap > 0) {
        ctx.fillRect((bx | 0) - 4, (by | 0) - 1, 4, 1);
        ctx.fillRect(bx | 0, (by | 0) - 1, 4, 1);
      } else {
        ctx.fillRect((bx | 0) - 4, by | 0, 4, 1);
        ctx.fillRect(bx | 0, by | 0, 4, 1);
      }
    }
  }

  private tickPlane(wx: WeatherConditions | null, dt: number): void {
    const { width, height } = this.state;
    if (this.plane) {
      this.plane.age += dt;
      this.plane.x += this.plane.dir * width * 0.012 * dt; // ~80 s to cross
      if (this.plane.x < -width * 0.2 || this.plane.x > width * 1.2) this.plane = null;
      return;
    }
    // Planes stay grounded (visually) in storms and heavy cover.
    if (wx && (cloudAlphaFor(wx) > 0.5 || wx.thunder)) return;
    this.planeTimer -= dt;
    if (this.planeTimer <= 0) {
      this.planeTimer = 420 + Math.random() * 900; // one every 7–22 min
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      this.plane = {
        x: dir === 1 ? -width * 0.05 : width * 1.05,
        y: height * (0.08 + Math.random() * 0.14),
        dir,
        age: 0,
      };
    }
  }

  private drawPlane(ctx: CanvasRenderingContext2D, h: number): void {
    const p = this.plane;
    if (!p) return;
    const day = daylight(h);
    const { width } = this.state;
    if (day > 0.3) {
      // Contrail: brightest just behind the plane, dissolving downwind.
      const trailLen = Math.min(width * 0.35, p.age * width * 0.012);
      const tx = p.x - p.dir * trailLen;
      const grad = ctx.createLinearGradient(tx, p.y, p.x, p.y);
      grad.addColorStop(0, "rgba(255, 255, 255, 0)");
      grad.addColorStop(1, `rgba(255, 255, 255, ${(0.3 * day).toFixed(3)})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx, p.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(230, 235, 245, ${(0.8 * day).toFixed(3)})`;
      ctx.fillRect((p.x - 1) | 0, (p.y - 1) | 0, 3, 2);
    } else {
      // Night: a slow blinking navigation light crossing the sky.
      const blink = Math.sin(p.age * 6) > 0.4 ? 1 : 0.15;
      ctx.fillStyle = `rgba(255, 210, 190, ${(0.8 * blink).toFixed(3)})`;
      ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
    }
  }

  private tickTrain(dt: number, starA: number): void {
    if (this.train) {
      this.train.age += dt;
      this.train.x += this.train.vx * dt;
      this.train.y += this.train.vy * dt;
      if (this.train.age > 40) this.train = null;
      return;
    }
    if (starA < 0.5) return;
    this.trainTimer -= dt;
    if (this.trainTimer <= 0) {
      this.trainTimer = 1500 + Math.random() * 2100; // every 25–60 min
      const { width, height } = this.state;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const speed = width / 35; // a satellite glide, not a meteor streak
      this.train = {
        x: dir === 1 ? -width * 0.1 : width * 1.1,
        y: height * (0.08 + Math.random() * 0.2),
        vx: speed * dir,
        vy: speed * 0.12,
        age: 0,
      };
    }
  }

  /** A short pearl-string of satellites — the classic just-launched train. */
  private drawTrain(ctx: CanvasRenderingContext2D, alpha: number): void {
    const tr = this.train;
    if (!tr) return;
    const len = Math.hypot(tr.vx, tr.vy);
    const ux = tr.vx / len;
    const uy = tr.vy / len;
    const spacing = 9;
    for (let i = 0; i < 7; i++) {
      const a = alpha * (0.55 - i * 0.05);
      ctx.fillStyle = `rgba(235, 238, 248, ${a.toFixed(3)})`;
      ctx.fillRect((tr.x - ux * spacing * i) | 0, (tr.y - uy * spacing * i) | 0, 1, 1);
    }
  }

  /** The real ISS: a bright steady dot arcing across, fading at each end. */
  private drawIss(ctx: CanvasRenderingContext2D, progress: number, alpha: number): void {
    const { width, height } = this.state;
    const x = width * (-0.05 + progress * 1.1);
    const y = height * 0.3 - Math.sin(progress * Math.PI) * height * 0.18;
    const a = Math.sin(progress * Math.PI) * alpha;
    ctx.fillStyle = `rgba(255, 250, 235, ${(0.95 * a).toFixed(3)})`;
    ctx.fillRect(x | 0, y | 0, 2, 2);
    ctx.fillStyle = `rgba(255, 250, 235, ${(0.25 * a).toFixed(3)})`;
    ctx.fillRect((x - 1) | 0, (y - 1) | 0, 4, 4);
  }

  private rainbowAlpha(wx: WeatherConditions | null, cloudAlpha: number, h: number): number {
    // Appears as the shower clears: ground still wet, rain stopped, sun out.
    if (!wx || wx.precipitation === "rain") return 0;
    if (h < SUN_RISE + 0.3 || h > SUN_SET - 0.3) return 0;
    return this.wetness * Math.max(0, 1 - cloudAlpha * 1.6) * 0.5;
  }


  private regenBats(): void {
    let seed = 606;
    const rand = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const count = Math.max(4, Math.round(this.state.width / 220));
    this.bats = [];
    for (let i = 0; i < count; i++) {
      this.bats.push({
        x: rand() * this.state.width,
        y: this.state.height * (0.25 + rand() * 0.3),
        vx: (rand() - 0.5) * 60,
        vy: (rand() - 0.5) * 30,
        flapPhase: rand() * Math.PI * 2,
      });
    }
  }

  private tickBats(dt: number): void {
    const { width, height } = this.state;
    const top = height * 0.18;
    const bottom = height * 0.6;
    for (const b of this.bats) {
      // Erratic flight: constant random steering, clamped speed, soft walls.
      b.vx += (Math.random() - 0.5) * 260 * dt;
      b.vy += (Math.random() - 0.5) * 200 * dt;
      const speed = Math.hypot(b.vx, b.vy);
      const max = 75;
      if (speed > max) {
        b.vx = (b.vx / speed) * max;
        b.vy = (b.vy / speed) * max;
      }
      if (b.y < top) b.vy += 60 * dt;
      if (b.y > bottom) b.vy -= 60 * dt;
      b.x = ((b.x + b.vx * dt) % width + width) % width;
      b.y += b.vy * dt;
      b.flapPhase += dt * 14; // frantic little wingbeats
    }
  }

  private drawBats(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.fillStyle = `rgba(12, 12, 18, ${(0.8 * alpha).toFixed(3)})`;
    for (const b of this.bats) {
      const ix = b.x | 0;
      const iy = b.y | 0;
      ctx.fillRect(ix, iy, 1, 1); // body
      if (Math.sin(b.flapPhase) > 0) {
        ctx.fillRect(ix - 2, iy - 1, 2, 1);
        ctx.fillRect(ix + 1, iy - 1, 2, 1);
      } else {
        ctx.fillRect(ix - 2, iy + 1, 2, 1);
        ctx.fillRect(ix + 1, iy + 1, 2, 1);
      }
    }
  }



  private drawFireflies(ctx: CanvasRenderingContext2D, alpha: number): void {
    if (this.fireflies.length === 0) return;
    const t = performance.now() / 1000;
    const { width, height } = this.state;
    const bandTop = height * 0.55;
    const bandH = height * 0.20;
    for (const f of this.fireflies) {
      const fx = ((f.bx + Math.sin(t * 0.35 + f.driftPhase) * 24) % width + width) % width;
      const fy = bandTop + (Math.sin(t * 0.7 + f.bobPhase) * 0.5 + 0.5) * bandH;
      const blink = 0.5 + 0.5 * Math.sin(t * 2 + f.blinkPhase);
      const a = blink * 0.7 * alpha;
      if (a > 0.02) {
        ctx.fillStyle = `rgba(232, 228, 140, ${a.toFixed(3)})`;
        ctx.fillRect(fx | 0, fy | 0, 2, 2);
      }
    }
  }
}
