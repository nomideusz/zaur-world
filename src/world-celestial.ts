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
  horizonness: number,
  eclipseProgress = 0
): void {
  // Atmospheric refraction: sun appears significantly larger near the horizon
  const r = 24 + 16 * horizonness;
  
  const ease = horizonness * horizonness;
  const easeExp = ease * horizonness;
  
  // During a solar eclipse, the sun dims
  const eclipseDim = 1 - Math.min(1, eclipseProgress * 1.05);

  // Core colors shift from warm white at zenith to deep red-orange at sunset
  const discR = 255;
  const discG = clampByte((248 - 120 * ease) * eclipseDim);
  const discB = clampByte((220 - 180 * easeExp) * eclipseDim);

  // Outer glow matches but is even richer
  const glowR = clampByte(255 * eclipseDim);
  const glowG = clampByte((220 - 100 * ease) * eclipseDim);
  const glowB = clampByte((180 - 150 * easeExp) * eclipseDim);

  // Impressive, simple wide glow (wider at sunset)
  const glowSteps = 4;
  for (let i = glowSteps; i >= 0; i--) {
    const a = (0.04 + (glowSteps - i) * 0.02) * (1 + horizonness * 0.4);
    ctx.fillStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r * (1 + i * (0.6 + horizonness * 0.4)), 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Total eclipse corona
  if (eclipseProgress > 0.95) {
    const coronaAlpha = (eclipseProgress - 0.95) * 20; // 0 to 1
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.3 * coronaAlpha).toFixed(3)})`;
    for(let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x, y, r * (2 + i * 1.5), 0, Math.PI * 2);
        ctx.fill();
    }
    // Solar flares
    ctx.strokeStyle = `rgba(255, 200, 200, ${(0.8 * coronaAlpha).toFixed(3)})`;
    ctx.lineWidth = 2;
    for(let i=0; i<4; i++) {
        ctx.beginPath();
        const angle = i * Math.PI / 2 + (performance.now() / 10000);
        ctx.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
        ctx.lineTo(x + Math.cos(angle) * r * 1.4, y + Math.sin(angle) * r * 1.4);
        ctx.stroke();
    }
  }

  // Simpler, cleaner gradient for the sun disc: white hot center to colored edge
  const discGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
  discGrad.addColorStop(0, `rgba(${clampByte(255*eclipseDim)}, ${clampByte(255*eclipseDim)}, ${clampByte(255*eclipseDim)}, 1)`);
  discGrad.addColorStop(0.5, `rgba(${clampByte(255*eclipseDim)}, ${clampByte(255*eclipseDim)}, ${clampByte(255 - 50 * ease)*eclipseDim}, 1)`);
  discGrad.addColorStop(1, `rgba(${discR}, ${discG}, ${discB}, 1)`);
  
  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // The eclipsing Moon (drawn as a dark circle moving across the sun)
  if (eclipseProgress > 0) {
    ctx.fillStyle = "#0a0a0c";
    ctx.beginPath();
    // Progress 0 -> 1 means moon moves from edge to center
    // Let's sweep it from top-right to bottom-left
    const offset = r * 2.2 * (1 - eclipseProgress);
    ctx.arc(x + offset, y - offset, r * 1.01, 0, Math.PI * 2);
    ctx.fill();
  }
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
  date: Date,
  horizonness: number,
  eclipseProgress = 0
): void {
  // Atmospheric refraction: moon appears larger near the horizon (Moon Illusion)
  const r = 16 + 12 * horizonness;
  const phase = lunarPhase(date);
  
  // During a lunar eclipse, the moon is full (illum = 1)
  const isEclipse = eclipseProgress > 0;
  const illum = isEclipse ? 1 : (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const waxing = phase < 0.5;

  const ease = horizonness * horizonness;

  // Harvest Moon effect: white/silver at zenith, warm yellow/orange near horizon
  let litR = clampByte(226 + 29 * ease);
  let litG = clampByte(227 - 10 * ease);
  let litB = clampByte(235 - 75 * ease);
  
  // Blood moon effect during lunar eclipse
  if (isEclipse) {
    const bloodPhase = Math.min(1, eclipseProgress * 1.5); // Reaches full blood before peak
    litR = clampByte(litR * (1 - bloodPhase) + 180 * bloodPhase);
    litG = clampByte(litG * (1 - bloodPhase) + 40 * bloodPhase);
    litB = clampByte(litB * (1 - bloodPhase) + 20 * bloodPhase);
  }
  
  const litCss = rgbToCss([litR, litG, litB]);

  // Halo colors matching the moon tint
  const haloR = clampByte(220 + 35 * ease);
  const haloG = clampByte(228 - 10 * ease);
  const haloB = clampByte(245 - 65 * ease);

  // Simpler, cleaner halo (fewer steps) but wider near the horizon
  const haloBoost = 0.05 * illum + (illum > 0.9 ? 0.08 : 0);
  const haloSteps = 3;
  for (let i = haloSteps; i >= 0; i--) {
    // Halo dims during eclipse
    const a = (0.02 + (haloSteps - i) * 0.02 + haloBoost * 0.5) * (1 + horizonness * 0.3) * (1 - eclipseProgress * 0.7);
    ctx.fillStyle = `rgba(${haloR}, ${haloG}, ${haloB}, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r * (1 + i * (illum > 0.9 ? 0.9 : 0.75) * (1 + horizonness * 0.2)), 0, Math.PI * 2);
    ctx.fill();
  }

  const earthshine = Math.max(0, 0.28 - illum) / 0.28;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  const darkR = clampByte(36 + 18 * earthshine + 20 * ease);
  const darkG = clampByte(38 + 18 * earthshine + 10 * ease);
  const darkB = clampByte(54 + 22 * earthshine);
  const darkCss = rgbToCss([darkR, darkG, darkB]);
  ctx.fillStyle = darkCss;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

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

  // Simpler limb darkening shadow to make it a sphere
  const limbGrad = ctx.createRadialGradient(x, y, r * 0.85, x, y, r);
  limbGrad.addColorStop(0, "rgba(0,0,0,0)");
  limbGrad.addColorStop(1, `rgba(20, 18, 28, ${0.4 + ease * 0.2})`);
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
  date: Date,
  eclipse?: { type: "solar" | "lunar"; progress: number }
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
  const riseY = height * 0.68;
  const topY = height * 0.09;
  const y = riseY - Math.sin(t * Math.PI) * (riseY - topY);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, dim));

  const horizonness = Math.min(1, Math.abs(t - 0.5) * 2);
  
  let solarProg = 0;
  let lunarProg = 0;
  if (eclipse) {
      if (eclipse.type === "solar") solarProg = eclipse.progress;
      if (eclipse.type === "lunar") lunarProg = eclipse.progress;
  }

  if (isSun) {
    drawSun(ctx, x, y, horizonness, solarProg);
  } else {
    drawMoon(ctx, x, y, date, horizonness, lunarProg);
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
