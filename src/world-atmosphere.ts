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
  const onLeft = h < 12;
  const cx = onLeft ? width * 0.18 : width * 0.82;
  const cy = height * 0.62;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.7);
  const a = (0.32 * strength).toFixed(3);
  grad.addColorStop(0, `rgba(255, 150, 70, ${a})`);
  grad.addColorStop(0.35, `rgba(240, 110, 60, ${(0.2 * strength).toFixed(3)})`);
  grad.addColorStop(0.7, `rgba(160, 70, 80, ${(0.1 * strength).toFixed(3)})`);
  grad.addColorStop(1, "rgba(60, 30, 60, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

export function drawFog(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "rgba(180, 184, 196, 0.04)");
  grad.addColorStop(0.55, "rgba(190, 192, 202, 0.18)");
  grad.addColorStop(1, "rgba(200, 200, 210, 0.32)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const t = performance.now() / 1000;
  const bandY = height * (0.55 + Math.sin(t * 0.06) * 0.04);
  const bandH = height * 0.18;
  const band = ctx.createLinearGradient(0, bandY - bandH, 0, bandY + bandH);
  band.addColorStop(0, "rgba(210, 212, 220, 0)");
  band.addColorStop(0.5, "rgba(210, 212, 220, 0.10)");
  band.addColorStop(1, "rgba(210, 212, 220, 0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY - bandH, width, bandH * 2);
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
  const t = performance.now() / 1000;
  const bands: Array<[number, number, number]> = [
    [120, 200, 180],
    [100, 180, 210],
    [180, 140, 200],
  ];
  for (let band = 0; band < bands.length; band++) {
    const [r, g, b] = bands[band];
    const peak = (0.1 + 0.04 * Math.sin(t * 0.5 + band)) * alpha;
    const grad = ctx.createLinearGradient(0, height * 0.1, 0, height * 0.5);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
    grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${peak.toFixed(3)})`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    const baseY = height * 0.12 + band * Math.max(18, height * 0.04);
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= width; x += 20) {
      const y = baseY + Math.sin(x * 0.012 + t * 0.3 + band) * 22;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height * 0.5);
    ctx.lineTo(0, height * 0.5);
    ctx.closePath();
    ctx.fill();
  }
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
 * Distant rain sheets hanging from the cloud base toward the ridge —
 * a downpour visibly marching in the distance behind the foreground
 * streaks. Slant follows the wind; shafts slowly cross the sky.
 */
export function drawRainCurtain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  wind: number
): void {
  const k = Math.min(1, (intensity - 0.45) / 0.55);
  if (k <= 0) return;
  const t = performance.now() / 1000;
  const slant = wind * width * 0.05;
  const top = height * 0.24;
  const bottom = height * 0.74;
  for (let i = 0; i < 3; i++) {
    const w = width * (0.18 + ((i * 37) % 20) / 100);
    const cx =
      width * ((((((i * 53 + 17) % 100) / 100 + t * 0.008 * (1 + i * 0.35)) % 1.3) + 1.3) % 1.3) -
      width * 0.15;
    const a = (0.06 + k * 0.1) * (0.7 + ((i * 13) % 40) / 100);
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    // Fade in at the top so there's no hard square edge under the clouds
    grad.addColorStop(0, "rgba(148, 162, 188, 0)");
    grad.addColorStop(0.2, `rgba(148, 162, 188, ${a.toFixed(3)})`);
    grad.addColorStop(0.8, `rgba(148, 162, 188, ${(a * 0.5).toFixed(3)})`);
    grad.addColorStop(1, "rgba(148, 162, 188, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, top);
    ctx.lineTo(cx + w / 2, top);
    ctx.lineTo(cx + w / 2 + slant, bottom);
    ctx.lineTo(cx - w / 2 + slant, bottom);
    ctx.closePath();
    ctx.fill();
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
