/** Self-contained atmosphere overlays drawn over the sky gradient. */

import { daylight, horizonGlowStrength } from "./sky-math.js";
import { SUN_RISE, SUN_SET } from "./solar.js";

export function drawHorizonGlow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  h: number
): void {
  const strength = horizonGlowStrength(h);
  if (strength <= 0.02) return;
  // A flat band hugging the horizon — real dawn/dusk glow has no bright
  // center; it's a wash that fades evenly with altitude.
  const grad = ctx.createLinearGradient(0, height * 0.42, 0, height);
  grad.addColorStop(0, "rgba(255, 150, 70, 0)");
  grad.addColorStop(0.5, `rgba(245, 125, 62, ${(0.1 * strength).toFixed(3)})`);
  grad.addColorStop(1, `rgba(255, 150, 70, ${(0.28 * strength).toFixed(3)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Clear dusk and dawn: Earth's own shadow climbs the sky opposite the sun —
 * a low slate-blue dome on the far horizon, capped by the pink Belt of
 * Venus — and dissolves into the night as the sun sinks deeper.
 */
export function drawEarthShadow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  h: number,
  clear: number
): void {
  const dusk = h > 12;
  const dt = dusk ? h - SUN_SET : SUN_RISE - h;
  if (dt < -0.15 || dt > 0.75) return;
  const s = Math.sin(((dt + 0.15) / 0.9) * Math.PI) * clear;
  if (s < 0.02) return;
  // Centred on the anti-solar point: east at dusk, west at dawn.
  const top = height * (0.12 + 0.14 * Math.max(0, dt) / 0.75);
  ctx.save();
  ctx.translate(width * (dusk ? 0.08 : 0.92), height * 0.6);
  ctx.scale((width * 0.7) / top, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, top);
  g.addColorStop(0, `rgba(44, 50, 88, ${(0.42 * s).toFixed(3)})`);
  g.addColorStop(0.3, `rgba(50, 54, 96, ${(0.32 * s).toFixed(3)})`);
  g.addColorStop(0.58, `rgba(230, 150, 170, ${(0.16 * s).toFixed(3)})`);
  g.addColorStop(1, "rgba(236, 156, 170, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(-top, -top, top * 2, top);
  ctx.restore();
}

export function drawFog(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Fog is milky air, not a gray sky: a light veil up high, and a dense
  // ground bank that genuinely swallows the hills — that loss of the
  // horizon is what separates fog from mere overcast.
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "rgba(196, 199, 208, 0.3)");
  grad.addColorStop(0.45, "rgba(200, 202, 211, 0.48)");
  grad.addColorStop(0.75, "rgba(206, 207, 215, 0.62)");
  grad.addColorStop(1, "rgba(211, 212, 219, 0.75)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Two slow-breathing banks give the murk motion without particles.
  const t = performance.now() / 1000;
  for (let k = 0; k < 2; k++) {
    const bandY = height * (0.58 + k * 0.16 + Math.sin(t * 0.05 + k * 2.4) * 0.05);
    const bandH = height * (0.16 + k * 0.08);
    const band = ctx.createLinearGradient(0, bandY - bandH, 0, bandY + bandH);
    band.addColorStop(0, "rgba(214, 215, 222, 0)");
    band.addColorStop(0.5, `rgba(214, 215, 222, ${(0.16 + k * 0.06).toFixed(2)})`);
    band.addColorStop(1, "rgba(214, 215, 222, 0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, bandY - bandH, width, bandH * 2);
  }
}

/**
 * Visibility-driven haze and ground mist. Unlike `drawFog` (the hard WMO fog
 * overlay), this is the soft continuum: a thin milky veil on hazy days and a
 * low mist that hugs the horizon as visibility closes in. Dims at night so the
 * mist doesn't read as a bright band against a dark sky.
 */
export function drawHaze(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: number,
  h: number
): void {
  if (k < 0.02) return;
  const day = 0.35 + daylight(h) * 0.65;
  const t = performance.now() / 1000;

  // Horizon mist band — rises and thickens as visibility drops.
  const bandBase = height * (0.34 - k * 0.14);
  const bandH = height * (0.18 + k * 0.26);
  const y = bandBase + Math.sin(t * 0.05) * height * 0.012;
  const band = ctx.createLinearGradient(0, y, 0, y + bandH);
  band.addColorStop(0, "rgba(198, 203, 216, 0)");
  band.addColorStop(0.5, `rgba(206, 210, 222, ${(0.17 * k * day).toFixed(3)})`);
  band.addColorStop(1, "rgba(214, 217, 228, 0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, y, width, bandH);

  // A lower, denser veil hugging the ground — ground fog / morning mist.
  const ground = ctx.createLinearGradient(0, height * 0.7, 0, height);
  ground.addColorStop(0, "rgba(212, 215, 226, 0)");
  ground.addColorStop(1, `rgba(220, 223, 233, ${(0.26 * k * day).toFixed(3)})`);
  ctx.fillStyle = ground;
  ctx.fillRect(0, height * 0.7, width, height * 0.3);
}

export function drawWetSheen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  wetness: number
): void {
  const a = 0.22 * wetness;
  const grad = ctx.createLinearGradient(0, height * 0.82, 0, height);
  grad.addColorStop(0, "rgba(180, 200, 230, 0)");
  grad.addColorStop(0.55, `rgba(170, 195, 230, ${(a * 0.45).toFixed(3)})`);
  grad.addColorStop(1, `rgba(200, 220, 245, ${a.toFixed(3)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, height * 0.82, width, height * 0.18);

  // Specular glints — wet ground catches the sky.
  if (wetness > 0.35) {
    const t = performance.now() / 1000;
    const n = Math.round(8 + wetness * 14);
    for (let i = 0; i < n; i++) {
      const x = ((i * 97 + t * 12) % width + width) % width;
      const y = height * (0.88 + ((i * 13) % 10) / 100);
      const ga = (0.08 + wetness * 0.12) * (0.5 + 0.5 * Math.sin(t * 2 + i));
      ctx.fillStyle = `rgba(230, 240, 255, ${ga.toFixed(3)})`;
      ctx.fillRect(x | 0, y | 0, 2, 1);
    }
  }
}

/** Settled snow blanket along the ground — builds while snowing, holds in the cold. */
export function drawSnowCover(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cover: number
): void {
  if (cover < 0.02) return;
  const a = 0.55 * cover;
  const grad = ctx.createLinearGradient(0, height * 0.78, 0, height);
  grad.addColorStop(0, "rgba(245, 250, 255, 0)");
  grad.addColorStop(0.4, `rgba(235, 244, 255, ${(a * 0.35).toFixed(3)})`);
  grad.addColorStop(1, `rgba(248, 252, 255, ${a.toFixed(3)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, height * 0.78, width, height * 0.22);

  // Soft uneven drifts — denser as cover builds.
  const t = performance.now() / 1000;
  const n = Math.round(12 + cover * 28);
  for (let i = 0; i < n; i++) {
    const x = ((i * 89 + Math.sin(t * 0.05 + i) * 6) % width + width) % width;
    const y = height * (0.86 + ((i * 17) % 12) / 100);
    const w = 3 + (i % 5);
    const ga = cover * (0.12 + 0.2 * ((i * 7) % 5) / 5);
    ctx.fillStyle = `rgba(255, 255, 255, ${ga.toFixed(3)})`;
    ctx.fillRect(x | 0, y | 0, w, 2);
  }
}

/** Cold-clear frost sparkle along the lower sky / ridge. */
export function drawFrost(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frost: number
): void {
  if (frost < 0.05) return;
  const band = ctx.createLinearGradient(0, height * 0.72, 0, height);
  band.addColorStop(0, "rgba(200, 220, 245, 0)");
  band.addColorStop(1, `rgba(210, 230, 255, ${(0.1 * frost).toFixed(3)})`);
  ctx.fillStyle = band;
  ctx.fillRect(0, height * 0.72, width, height * 0.28);

  const t = performance.now() / 1000;
  const n = Math.round(20 + frost * 40);
  for (let i = 0; i < n; i++) {
    const x = ((i * 67 + Math.sin(t * 0.2 + i) * 8) % width + width) % width;
    const y = height * (0.78 + ((i * 19) % 20) / 100);
    const a = frost * (0.25 + 0.35 * Math.abs(Math.sin(t * 1.5 + i * 0.7)));
    ctx.fillStyle = `rgba(235, 245, 255, ${a.toFixed(3)})`;
    ctx.fillRect(x | 0, y | 0, 1, 1);
  }
}

export function drawHeatHaze(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: number
): void {
  const t = performance.now() / 1000;
  for (let i = 0; i < 2; i++) {
    const y = height * (0.6 + i * 0.07) + Math.sin(t * (0.8 + i * 0.3) + i * 2) * 3;
    const bandH = height * 0.05;
    const grad = ctx.createLinearGradient(0, y - bandH, 0, y + bandH);
    grad.addColorStop(0, "rgba(255, 232, 180, 0)");
    grad.addColorStop(0.5, `rgba(255, 232, 180, ${(0.05 * k).toFixed(3)})`);
    grad.addColorStop(1, "rgba(255, 232, 180, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - bandH, width, bandH * 2);
  }
}

export function drawAurora(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  alpha: number
): void {
  // Rayed curtains, not a band: a sharp green lower hem where the rays hit
  // the thicker air, fading up into a faint violet crown. The hem folds
  // slowly, the rays shimmer along it, and the curtain brightens and fades
  // along its length, so it never rules a line across the sky that reads as
  // a horizon.
  const t = performance.now() / 1000;
  const grad = ctx.createLinearGradient(0, height * 0.14, 0, height * 0.5);
  grad.addColorStop(0, "rgba(190, 80, 160, 0)");
  grad.addColorStop(0.45, "rgba(170, 90, 170, 0.2)");
  grad.addColorStop(0.8, "rgba(90, 230, 150, 0.75)");
  grad.addColorStop(1, "rgba(130, 255, 190, 1)");
  ctx.fillStyle = grad;
  const step = Math.max(4, width / 180);
  for (let x = 0; x < width; x += step) {
    const u = x / width;
    const e = 0.5 + 0.5 * Math.sin(u * 4.4 + t * 0.03 + Math.sin(u * 2 - t * 0.02));
    if (e < 0.1) continue;
    const fold = Math.sin(u * 6.3 + t * 0.11) * 0.6 + Math.sin(u * 15.7 - t * 0.17) * 0.4;
    const ray = 0.5 + 0.5 * Math.sin(u * 95 + t * 0.8 + Math.sin(u * 11 + t * 0.25) * 3);
    // Low over the ranges, as seen from mid-latitudes; the hem dips behind them.
    const hem = height * (0.47 - fold * 0.03);
    const len = height * (0.08 + ray * 0.1 + Math.max(0, fold) * 0.04);
    const a = alpha * e * e * (0.14 + ray * 0.22) * (0.6 + 0.4 * Math.abs(fold));
    ctx.globalAlpha = a;
    ctx.fillRect(x, hem - len, step + 0.5, len);
    // The hem glows down into the air below instead of ending on a hard edge.
    for (let k = 0; k < 4; k++) {
      ctx.globalAlpha = a * (0.4 - k * 0.1);
      ctx.fillRect(x, hem + k * height * 0.01, step + 0.5, height * 0.01);
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * High thin cirrus filaments — the look of a lightly veiled (~10–40%
 * cover) sky that the puffy cumulus layers can't express. Deterministic
 * seeds keep the pattern stable; filaments drift slowly, blush warm at
 * golden hour, and fade to a faint veil at night.
 */
export function drawCirrus(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  alpha: number,
  h: number
): void {
  const day = daylight(h);
  const vis = alpha * (0.3 + day * 0.7);
  if (vis <= 0.02) return;
  const t = performance.now() / 1000;
  const glow = horizonGlowStrength(h);
  const r = Math.round(232 + glow * 23);
  const g = Math.round(236 - glow * 46);
  const b = Math.round(246 - glow * 96);
  for (let i = 0; i < 7; i++) {
    const seed = i * 137 + 31;
    const y = height * (0.05 + ((seed * 29) % 26) / 100);
    const len = width * (0.2 + ((seed * 13) % 28) / 100);
    const drift = t * (0.0022 + (i % 3) * 0.0008);
    const x = width * (((((seed * 61) % 100) / 100 + drift) % 1.24) - 0.12);
    const a = vis * (0.14 + ((seed * 7) % 26) / 130);
    const grad = ctx.createLinearGradient(x - len / 2, 0, x + len / 2, 0);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
    grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = grad;
    // A long filament with two thinner feathers riding above and below.
    const ry = 1.8 + ((seed * 3) % 4);
    ctx.beginPath();
    ctx.ellipse(x, y, len / 2, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - len * 0.12, y - ry * 2.2, len * 0.34, ry * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + len * 0.16, y + ry * 2.6, len * 0.28, ry * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCityGlow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  h: number,
  cloudAlpha: number
): void {
  const night = 1 - daylight(h);
  if (night < 0.3) return;
  const cx = width * 0.3;
  const cy = height * 0.68;
  const r = width * 0.22;
  const a = 0.09 * night * (0.6 + cloudAlpha * 0.8);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, `rgba(255, 178, 108, ${a.toFixed(3)})`);
  grad.addColorStop(0.6, `rgba(255, 150, 90, ${(a * 0.4).toFixed(3)})`);
  grad.addColorStop(1, "rgba(255, 140, 80, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

export function drawRainbow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  h: number,
  alpha: number
): void {
  const t = (h - SUN_RISE) / (SUN_SET - SUN_RISE);
  const cx = width - width * (0.08 + t * 0.84);
  const cy = height * 0.95;
  const r = Math.min(width, height) * 0.55;
  const bands = ["255,60,60", "255,150,40", "250,230,70", "90,200,90", "70,140,235", "150,90,220"];
  ctx.save();
  ctx.lineWidth = Math.max(2, r * 0.016);
  for (let i = 0; i < bands.length; i++) {
    ctx.strokeStyle = `rgba(${bands[i]}, ${(alpha * 0.35).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r - i * ctx.lineWidth, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Crepuscular rays — soft shafts of sunlight fanning down from the sun through
 * gaps in broken cloud. Each shaft drifts slowly; a low sun widens the fan and
 * warms the tint toward gold.
 */
export function drawGodRays(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  h: number,
  alpha: number
): void {
  if (alpha < 0.02) return;
  const p = (h - SUN_RISE) / (SUN_SET - SUN_RISE);
  const sunX = width * (0.08 + p * 0.84);
  const riseY = height * 0.68;
  const topY = height * 0.09;
  const sunY = riseY - Math.sin(p * Math.PI) * (riseY - topY);
  const now = performance.now() / 1000;

  const warmth = 1 - Math.abs(p - 0.5) * 2;
  const r = Math.round(248 + warmth * 7);
  const g = Math.round(225 + warmth * 25);
  const b = Math.round(180 + warmth * 40);

  const rays = 9;
  const fan = 1.25; // radians of spread around straight down
  for (let i = 0; i < rays; i++) {
    const home = Math.PI / 2 - fan / 2 + (i / (rays - 1)) * fan;
    const angle = home + Math.sin(now * 0.08 + i * 1.9) * 0.045;
    const halfWidth = (16 + (i % 3) * 9) * (0.7 + warmth * 0.6);
    const reach = height - sunY + height * 0.12;
    const bx = sunX + Math.cos(angle) * reach;
    const by = sunY + Math.sin(angle) * reach;
    const ux = -Math.sin(angle) * halfWidth;
    const uy = Math.cos(angle) * halfWidth;

    const a = alpha * 0.17 * (0.6 + 0.4 * Math.sin(now * 0.25 + i * 0.9));
    const grad = ctx.createLinearGradient(sunX, sunY, bx, by);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(bx - ux, by - uy);
    ctx.lineTo(bx + ux, by + uy);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Distant rain sheets hanging from the cloud base toward the ridge —
 * a downpour visibly marching in the distance behind the foreground
 * streaks. Slant follows the wind; shafts slowly cross the sky.
 */
let shaftSprite: HTMLCanvasElement | null | undefined;

/** One rain shaft, baked once: fibrous streaks that fade out at every edge. */
function rainShaft(): HTMLCanvasElement | null {
  if (shaftSprite !== undefined) return shaftSprite;
  shaftSprite = null;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 64;
  const m = c.getContext("2d");
  if (!m) return null;
  m.fillStyle = "rgb(148, 162, 188)";
  m.fillRect(0, 0, 32, 64);
  // Thin the sheet into strands where the rain falls heavier and lighter.
  m.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 14; i++) {
    m.fillStyle = `rgba(0, 0, 0, ${0.3 + ((i * 7) % 5) / 10})`;
    m.fillRect((i * 23) % 32, 0, 1 + (i % 3), 64);
  }
  m.globalCompositeOperation = "destination-in";
  const across = m.createLinearGradient(0, 0, 32, 0);
  across.addColorStop(0, "rgba(0, 0, 0, 0)");
  across.addColorStop(0.3, "#000");
  across.addColorStop(0.7, "#000");
  across.addColorStop(1, "rgba(0, 0, 0, 0)");
  m.fillStyle = across;
  m.fillRect(0, 0, 32, 64);
  // Out of the cloud base, thinning as it nears the ground.
  const down = m.createLinearGradient(0, 0, 0, 64);
  down.addColorStop(0, "rgba(0, 0, 0, 0)");
  down.addColorStop(0.2, "#000");
  down.addColorStop(0.8, "rgba(0, 0, 0, 0.5)");
  down.addColorStop(1, "rgba(0, 0, 0, 0)");
  m.fillStyle = down;
  m.fillRect(0, 0, 32, 64);
  return (shaftSprite = c);
}

export function drawRainCurtain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  wind: number,
  light: number
): void {
  const k = Math.min(1, (intensity - 0.45) / 0.55);
  const img = rainShaft();
  if (k <= 0 || !img) return;
  const t = performance.now() / 1000;
  const top = height * 0.24;
  const bottom = height * 0.74;
  const lean = (wind * width * 0.05) / (bottom - top);
  for (let i = 0; i < 3; i++) {
    const w = width * (0.18 + ((i * 37) % 20) / 100);
    const cx =
      width * ((((((i * 53 + 17) % 100) / 100 + t * 0.008 * (1 + i * 0.35)) % 1.3) + 1.3) % 1.3) -
      width * 0.15;
    const a = (0.06 + k * 0.1) * (0.7 + ((i * 13) % 40) / 100);
    ctx.save();
    ctx.globalAlpha *= Math.min(1, a * 1.3 * light);
    ctx.transform(1, 0, lean, 1, cx - w / 2 - lean * top, 0);
    ctx.drawImage(img, 0, top, w, bottom - top);
    ctx.restore();
  }
}

export function drawSeaBand(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const t = performance.now() / 1000;
  const y = height * 0.655;
  const grad = ctx.createLinearGradient(0, y, 0, y + height * 0.05);
  const a = 0.1 + 0.03 * Math.sin(t * 0.8);
  grad.addColorStop(0, `rgba(210, 225, 240, ${a.toFixed(3)})`);
  grad.addColorStop(1, "rgba(210, 225, 240, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, y, width, height * 0.05);
}
