/** Sun, moon, stars, and Venus — celestial drawing helpers. */

import { rgbToCss, clampByte } from "./color.js";
import { lunarPhase, venusState, SUN_RISE, SUN_SET } from "./solar.js";

export interface Star {
  x: number;
  y: number;
  brightness: number;
  twinklePhase: number;
}

export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: readonly Star[],
  alpha: number
): void {
  const t = performance.now() / 1000;
  for (const s of stars) {
    const twinkle = 0.65 + 0.35 * Math.sin(t * 1.4 + s.twinklePhase);
    const a = s.brightness * twinkle * alpha;
    if (a < 0.02) continue;
    
    // Subtle star colors based on pseudo-random phase: some blue-white, some yellow-white, some pure white
    const colorType = (s.twinklePhase * 10) % 3;
    let r = 232, g = 228, b = 216; // default warm white
    if (colorType < 1) { r = 200; g = 220; b = 255; } // blueish
    else if (colorType < 2) { r = 255; g = 245; b = 210; } // yellowish
    
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
    const ix = s.x | 0;
    const iy = s.y | 0;
    
    ctx.fillRect(ix, iy, 1, 1);
    
    if (s.brightness > 0.6) {
      // Small cross for medium-bright stars
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(a * 0.6).toFixed(3)})`;
      ctx.fillRect(ix - 1, iy, 3, 1);
      ctx.fillRect(ix, iy - 1, 1, 3);
    }
    if (s.brightness > 0.85) {
      // Larger cross/glow for the brightest stars
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(a * 0.3).toFixed(3)})`;
      ctx.fillRect(ix - 2, iy, 5, 1);
      ctx.fillRect(ix, iy - 2, 1, 5);
    }
  }
}

export function drawSun(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  horizonness: number
): void {
  const r = 28 + 8 * horizonness;
  const ease = horizonness * horizonness;
  const discR = clampByte(255);
  const discG = clampByte(228 - 48 * ease);
  const discB = clampByte(168 - 84 * ease);
  const glowR = clampByte(255);
  const glowG = clampByte(210 - 30 * ease);
  const glowB = clampByte(140 - 40 * ease);

  // Softer, wider glow with more steps
  for (let i = 6; i >= 0; i--) {
    const a = 0.03 + (6 - i) * 0.015;
    ctx.fillStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r * (1 + i * 0.7), 0, Math.PI * 2);
    ctx.fill();
  }

  // Dynamic rays
  if (horizonness > 0.2) {
    const rayAlpha = (horizonness - 0.2) * 0.4;
    ctx.strokeStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${rayAlpha.toFixed(3)})`;
    ctx.lineWidth = 1.5;
    const t = performance.now() * 0.00003;
    
    // Outer long rays
    ctx.beginPath();
    const rayCount = 12;
    const innerR = r * 1.5;
    const outerR = r * 6.5;
    for (let i = 0; i < rayCount; i++) {
      const a = (i / rayCount) * Math.PI * 2 + t;
      const cx = Math.cos(a);
      const sy = Math.sin(a);
      // Fade rays out at the ends
      const rayGrad = ctx.createLinearGradient(x + cx * innerR, y + sy * innerR, x + cx * outerR, y + sy * outerR);
      rayGrad.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${rayAlpha.toFixed(3)})`);
      rayGrad.addColorStop(1, `rgba(${glowR}, ${glowG}, ${glowB}, 0)`);
      ctx.strokeStyle = rayGrad;
      
      ctx.beginPath();
      ctx.moveTo(x + cx * innerR, y + sy * innerR);
      ctx.lineTo(x + cx * outerR, y + sy * outerR);
      ctx.stroke();
    }
    
    // Inner short rotating rays
    ctx.lineWidth = 2;
    const shortRayCount = 24;
    const shortOuterR = r * 2.5;
    for (let i = 0; i < shortRayCount; i++) {
      const a = (i / shortRayCount) * Math.PI * 2 - t * 1.5;
      const cx = Math.cos(a);
      const sy = Math.sin(a);
      const rayGrad = ctx.createLinearGradient(x + cx * innerR, y + sy * innerR, x + cx * shortOuterR, y + sy * shortOuterR);
      rayGrad.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${(rayAlpha * 0.8).toFixed(3)})`);
      rayGrad.addColorStop(1, `rgba(${glowR}, ${glowG}, ${glowB}, 0)`);
      ctx.strokeStyle = rayGrad;
      
      ctx.beginPath();
      ctx.moveTo(x + cx * innerR, y + sy * innerR);
      ctx.lineTo(x + cx * shortOuterR, y + sy * shortOuterR);
      ctx.stroke();
    }
  }

  // Hot bright center, warmer edges
  const discGrad = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, 0, x, y, r);
  discGrad.addColorStop(0, "rgba(255, 255, 255, 1)");
  discGrad.addColorStop(0.3, rgbToCss([clampByte(discR + 20), clampByte(discG + 20), clampByte(discB + 10)]));
  discGrad.addColorStop(0.8, rgbToCss([discR, discG, discB]));
  discGrad.addColorStop(1, rgbToCss([clampByte(discR - 20), clampByte(discG - 30), clampByte(discB - 40)]));
  
  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner corona
  ctx.strokeStyle = `rgba(255, 255, 255, 0.4)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCraters(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  waxing: boolean,
  illum: number
): void {
  const craters: Array<[number, number, number]> = [
    [0.32, -0.18, 0.22],
    [-0.3, 0.28, 0.16],
    [0.1, 0.45, 0.12],
    [-0.48, -0.36, 0.1],
    [0.55, 0.06, 0.09],
  ];

  ctx.fillStyle = "rgba(150, 152, 168, 0.50)";
  ctx.beginPath();
  for (const [dx, dy, cr] of craters) {
    const onLitHalf = waxing ? dx > 0 : dx < 0;
    if (illum < 0.15 && !onLitHalf) continue;
    ctx.moveTo(x + r * dx + r * cr, y + r * dy);
    ctx.arc(x + r * dx, y + r * dy, r * cr, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  ctx.beginPath();
  for (const [dx, dy, cr] of craters) {
    const onLitHalf = waxing ? dx > 0 : dx < 0;
    if (illum < 0.3 && !onLitHalf) continue;
    const hx = x + r * dx + (waxing ? -r * cr * 0.35 : r * cr * 0.35);
    const hy = y + r * dy - r * cr * 0.35;
    ctx.moveTo(hx + r * cr * 0.45, hy);
    ctx.arc(hx, hy, r * cr * 0.45, 0, Math.PI * 2);
  }
  ctx.fill();
}

export function drawMoon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  date: Date
): void {
  const r = 18;
  const phase = lunarPhase(date);
  const illum = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const waxing = phase < 0.5;

  // Richer halo
  const haloBoost = 0.05 * illum + (illum > 0.9 ? 0.08 : 0);
  for (let i = 5; i >= 0; i--) {
    const a = 0.02 + (5 - i) * 0.015 + haloBoost * 0.5;
    ctx.fillStyle = `rgba(220, 228, 245, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r * (1 + i * (illum > 0.9 ? 0.9 : 0.75)), 0, Math.PI * 2);
    ctx.fill();
  }

  const earthshine = Math.max(0, 0.28 - illum) / 0.28;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  const darkR = clampByte(36 + 18 * earthshine);
  const darkG = clampByte(38 + 18 * earthshine);
  const darkB = clampByte(54 + 22 * earthshine);
  const darkCss = rgbToCss([darkR, darkG, darkB]);
  ctx.fillStyle = darkCss;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  const litCss = "#e2e3eb";
  ctx.fillStyle = litCss;
  if (waxing) {
    ctx.fillRect(x, y - r, r, r * 2);
  } else {
    ctx.fillRect(x - r, y - r, r, r * 2);
  }

  const ellipseRx = r * Math.abs(1 - 2 * illum);
  if (illum < 0.5) {
    ctx.fillStyle = darkCss;
    ctx.beginPath();
    ctx.ellipse(x, y, ellipseRx, r, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (illum > 0.5) {
    ctx.fillStyle = litCss;
    ctx.beginPath();
    ctx.ellipse(x, y, ellipseRx, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCraters(ctx, x, y, r, waxing, illum);

  const limbGrad = ctx.createRadialGradient(x, y, r * 0.85, x, y, r);
  limbGrad.addColorStop(0, "rgba(0,0,0,0)");
  limbGrad.addColorStop(1, "rgba(20, 18, 28, 0.40)");
  ctx.fillStyle = limbGrad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  ctx.restore();
}

export function drawCelestial(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  h: number,
  dim: number,
  date: Date
): void {
  if (dim < 0.02) return;

  const isSun = h >= SUN_RISE && h <= SUN_SET;

  let t: number;
  if (isSun) {
    t = (h - SUN_RISE) / (SUN_SET - SUN_RISE);
  } else {
    let moonH = h - SUN_SET;
    if (moonH < 0) moonH += 24;
    const moonSpan = 24 - SUN_SET + SUN_RISE;
    t = moonH / moonSpan;
  }

  const x = width * (0.08 + t * 0.84);
  // Arc endpoints sit below the ridge line (hills paint over the body), so
  // the sun/moon visibly rise from and set behind the hills — the handoff
  // at sunrise/sunset happens out of sight instead of popping mid-sky.
  // The noon/midnight apex stays at 9% height, same as before.
  const riseY = height * 0.68;
  const topY = height * 0.09;
  const y = riseY - Math.sin(t * Math.PI) * (riseY - topY);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, dim));

  if (isSun) {
    const horizonness = Math.min(1, Math.abs(t - 0.5) * 2);
    drawSun(ctx, x, y, horizonness);
  } else {
    drawMoon(ctx, x, y, date);
  }

  ctx.restore();
}

export function drawVenus(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  h: number,
  date: Date,
  cloudAlpha: number
): void {
  const v = venusState(date);
  if (v.elong < 12) return;
  const visH = (v.elong / 47) * 3.0;
  let p: number;
  let x: number;
  if (v.evening) {
    const dt = h - SUN_SET;
    if (dt < 0.15 || dt > visH) return;
    p = dt / visH;
    x = width * 0.88;
  } else {
    const dt = SUN_RISE - h;
    if (dt < 0.15 || dt > visH) return;
    p = dt / visH;
    x = width * 0.12;
  }
  const y = height * (0.4 + p * 0.22);
  const twilight = Math.min(1, (v.evening ? h - SUN_SET : SUN_RISE - h) / 0.5);
  const a = twilight * (1 - p * 0.5) * (1 - cloudAlpha) * 0.95;
  if (a < 0.03) return;
  const ix = x | 0;
  const iy = y | 0;
  
  // Soft outer glow for Venus
  ctx.fillStyle = `rgba(255, 252, 240, ${(a * 0.15).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(ix + 1, iy + 1, 6, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = `rgba(255, 252, 240, ${a.toFixed(3)})`;
  ctx.fillRect(ix, iy, 2, 2);
  
  // Bright cross
  ctx.fillStyle = `rgba(255, 252, 240, ${(a * 0.6).toFixed(3)})`;
  ctx.fillRect(ix - 2, iy, 6, 2);
  ctx.fillRect(ix, iy - 2, 2, 6);
  
  // Sharp center
  ctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
  ctx.fillRect(ix, iy, 2, 2);
}
