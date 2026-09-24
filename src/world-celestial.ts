/** Sun, moon, stars, and planets — celestial drawing helpers. */

import { rgbToCss, clampByte } from "./color.js";
import { lunarPhase, venusState, jupiterState, SUN_RISE, SUN_SET } from "./solar.js";
import { daylight } from "./sky-math.js";

export interface Star {
  x: number;
  y: number;
  brightness: number;
  twinklePhase: number;
}

export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: readonly Star[],
  alpha: number,
  height: number,
  /** The moon's disc [x, y, r]: stars behind it are occulted. */
  moon?: readonly [number, number, number] | null
): void {
  const t = performance.now() / 1000;
  for (const s of stars) {
    if (moon && (s.x - moon[0]) ** 2 + (s.y - moon[1]) ** 2 < moon[2] ** 2) continue;
    // Low stars shine through more air: dimmer (extinction) and twinkling
    // harder and faster than the steady ones overhead.
    const low = Math.min(1, s.y / (height * 0.7));
    const tw = 0.15 + low * 0.4;
    const twinkle =
      1 - tw + tw * (0.5 + 0.3 * Math.sin(t * 2.1 + s.twinklePhase) + 0.2 * Math.sin(t * 5.3 + s.twinklePhase * 7));
    const a = s.brightness * twinkle * alpha * (1 - low * 0.3);
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

/** One smooth radial falloff — a glow with no visible steps. */
function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r0: number,
  r1: number,
  rgb: string,
  a: number
): void {
  if (a < 0.004) return;
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  g.addColorStop(0, `rgba(${rgb}, ${a.toFixed(3)})`);
  g.addColorStop(0.2, `rgba(${rgb}, ${(a * 0.36).toFixed(3)})`);
  g.addColorStop(0.55, `rgba(${rgb}, ${(a * 0.08).toFixed(3)})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
}

function drawSun(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  horizonness: number,
  eclipseProgress: number,
  disc: number
): void {
  // Drawn larger low down, as the eye sees it (the Moon illusion works on the
  // sun too) — refraction itself only squashes it, see below.
  const r = 24 + 16 * horizonness;

  const ease = horizonness * horizonness;
  const easeExp = ease * horizonness;

  // A partial eclipse shrinks the sun, it doesn't tint it: what is left of
  // the disc stays exactly as white-hot, only the glare around it fades.
  const eclipseDim = 1 - Math.min(1, eclipseProgress * 1.05);

  // Core colors shift from warm white at zenith to deep red-orange at sunset
  const discR = 255;
  const discG = clampByte(248 - 120 * ease);
  const discB = clampByte(220 - 180 * easeExp);

  // Outer glow matches but is even richer
  const glowG = clampByte(220 - 100 * ease);
  const glowB = clampByte(180 - 150 * easeExp);

  // Glare: overhead a wide white-hot aureole; near the horizon extinction
  // shrinks it to a tight amber haze around a crisp disc you can look at.
  // Behind cloud the light spreads into a broad, soft, disc-less patch.
  const veil = 1 - disc;
  const k = 1 - horizonness * 0.6;
  glow(
    ctx, x, y, r * 0.5, r * (2.4 + 4.5 * k) * (1 + veil * 0.9),
    `255, ${glowG}, ${glowB}`,
    (0.5 * k + veil * 0.3) * eclipseDim
  );

  // A low sun's long path through the haze spreads a broad warm aureole.
  glow(
    ctx, x, y, r, r * 12, `255, ${clampByte(170 - 50 * ease)}, 90`,
    0.3 * ease * disc * eclipseDim
  );

  // Total eclipse: the pearly corona, streamers and a few pink prominences.
  if (eclipseProgress > 0.95) {
    const ca = (eclipseProgress - 0.95) * 20;
    glow(ctx, x, y, r, r * 4.5, "226, 232, 255", 0.75 * ca);
    // Streamers: nested wedges, each shorter one wider, so they taper
    // softly into the corona instead of ending in needle points.
    ctx.fillStyle = `rgba(232, 238, 255, ${(0.06 * ca).toFixed(3)})`;
    const spin = performance.now() / 40000;
    for (let i = 0; i < 6; i++) {
      const a = spin + i * 1.047 + Math.sin(i * 2.3) * 0.35;
      const len = r * (2 + (i % 3) * 0.6);
      for (let k = 1; k <= 3; k++) {
        const w = 0.12 + (3 - k) * 0.14;
        const l = r + (len - r) * (0.4 + k * 0.2);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a - w) * r, y + Math.sin(a - w) * r);
        ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.lineTo(x + Math.cos(a + w) * r, y + Math.sin(a + w) * r);
        ctx.fill();
      }
    }
    ctx.fillStyle = `rgba(255, 110, 140, ${(0.85 * ca).toFixed(3)})`;
    for (const a of [0.7, 2.6, 4.4]) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Overhead the disc is too bright to have an edge: a tight white bloom
  // swallows the limb. It dies away as the sun lowers and dims.
  glow(ctx, x, y, r, r * 2, "255, 253, 245", 0.5 * k * k * k * disc * eclipseDim);

  ctx.globalAlpha *= disc;
  if (disc < 0.02) return;

  // Refraction lifts the lower limb more than the upper, so a sun on the
  // ridge line is squashed into an oval.
  const squash = 1 - 0.12 * Math.max(0, Math.min(1, (horizonness - 0.6) / 0.25));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, squash);

  // Sun disc: white-hot center at zenith, but a rising/setting sun reads as
  // a deep-orange disc — the hot core fades out with horizonness. Once it
  // is dim enough to look at, the limb shows darker and redder than the
  // middle, as the real one does.
  const coreR = clampByte(255 - (255 - discR) * ease);
  const coreG = clampByte(255 - (255 - discG) * ease);
  const coreB = clampByte(255 - (255 - discB) * ease);
  const limb = 1 - 0.2 * ease;
  const discGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  discGrad.addColorStop(0, `rgba(${coreR}, ${coreG}, ${coreB}, 1)`);
  discGrad.addColorStop(0.6, `rgba(${discR}, ${discG}, ${discB}, 1)`);
  discGrad.addColorStop(
    1,
    `rgba(${clampByte(discR * limb)}, ${clampByte(discG * limb * limb)}, ${clampByte(discB * limb * limb)}, 1)`
  );
  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // The lower limb looks through more air than the upper, so it is redder.
  if (ease > 0.05) {
    const air = ctx.createLinearGradient(0, -r, 0, r);
    air.addColorStop(0, "rgba(220, 40, 20, 0)");
    air.addColorStop(1, `rgba(220, 40, 20, ${(0.4 * ease).toFixed(3)})`);
    ctx.fillStyle = air;
    ctx.fill();
  }

  // The eclipsing Moon (drawn as a dark circle moving across the sun).
  // Clipped to the sun disc: the real moon is invisible against the sky,
  // so only the overlapping bite should show.
  if (eclipseProgress > 0) {
    ctx.clip();
    ctx.fillStyle = "#0a0a0c";
    ctx.beginPath();
    // Progress 0 -> 1 sweeps it from top-right to the centre.
    const offset = r * 2.2 * (1 - eclipseProgress);
    ctx.arc(offset, -offset, r * 1.01, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The Moon is tidally locked, so its face is a fact: the near-side maria as
 * seen from the northern hemisphere (north up), as [x, y, rx, ry, depth] in
 * disc radii — Procellarum and Imbrium to the left, Crisium on the right
 * limb. Baked once and stamped under the phase.
 */
const MARIA: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [-0.6, 0, 0.34, 0.56, 0.4], // Oceanus Procellarum
  [-0.3, -0.42, 0.34, 0.28, 0.46], // Imbrium
  [0.18, -0.4, 0.2, 0.19, 0.46], // Serenitatis
  [0.34, -0.06, 0.26, 0.22, 0.42], // Tranquillitatis
  [0.72, -0.3, 0.12, 0.14, 0.5], // Crisium
  [0.58, 0.18, 0.14, 0.2, 0.36], // Fecunditatis
  [0.4, 0.34, 0.12, 0.12, 0.34], // Nectaris
  [-0.2, 0.38, 0.22, 0.16, 0.34], // Nubium
  [-0.52, 0.42, 0.12, 0.12, 0.4], // Humorum
  [-0.05, -0.72, 0.46, 0.09, 0.3], // Frigoris
  [0, -0.18, 0.14, 0.12, 0.34], // Vaporum
  [-0.3, 0.02, 0.18, 0.15, 0.3], // Insularum
  [-0.28, 0.2, 0.14, 0.11, 0.3], // Cognitum
];

let mariaSprite: HTMLCanvasElement | null | undefined;

function moonFace(): HTMLCanvasElement | null {
  if (mariaSprite !== undefined) return mariaSprite;
  mariaSprite = null;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const m = c.getContext("2d");
  if (!m) return null;
  m.translate(48, 48);
  m.scale(48, 48);
  // Blurred so the seas run together into one dark shape, as they do to the eye.
  m.filter = "blur(2.5px)";
  for (const [x, y, rx, ry, d] of MARIA) {
    m.save();
    m.translate(x, y);
    m.scale(rx, ry);
    const g = m.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(56, 58, 76, ${d})`);
    g.addColorStop(0.5, `rgba(56, 58, 76, ${d * 0.85})`);
    g.addColorStop(1, "rgba(56, 58, 76, 0)");
    m.fillStyle = g;
    m.fillRect(-1, -1, 2, 2);
    m.restore();
  }
  return (mariaSprite = c);
}

function drawMoon(
  ctx: CanvasRenderingContext2D,
  [x, y, horizonness, tilt]: readonly number[],
  phase: number,
  eclipseProgress: number,
  disc: number,
  day: number
): void {
  // Atmospheric refraction: moon appears larger near the horizon (Moon Illusion)
  // Near the sun's size: both span the same half-degree of real sky.
  const r = moonRadius(horizonness);

  // During a lunar eclipse, the moon is full (illum = 1)
  const isEclipse = eclipseProgress > 0;
  const illum = isEclipse ? 1 : (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const waxing = phase < 0.5;
  // A day-old moon is lost in the sun's glare.
  if (illum < 0.02) return;

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

  // The moon's east-west axis lies along its arc — the ecliptic — so the
  // lit limb faces the sun: up as it rises in daylight, down toward the set
  // sun as an evening crescent. North tilts with it, maria and all.
  ctx.translate(x, y);
  ctx.rotate(tilt);
  // In daylight it is a pale ghost: the blue sky shows through, and a thin
  // crescent all but vanishes.
  ctx.globalAlpha *= 1 - day * (0.75 - 0.35 * illum);

  // Moonlight halo — one smooth falloff that grows with the phase, widens
  // in low-horizon haze, and spreads into a soft patch behind cloud. It
  // centres on the lit part, so a crescent's dark side isn't outlined.
  glow(
    ctx, (waxing ? r : -r) * 0.6 * (1 - illum), 0, r * 0.9, r * (2.6 + illum * 2.4) * (1 + horizonness * 0.2 + (1 - disc) * 0.8),
    `${clampByte(220 + 35 * ease)}, ${clampByte(228 - 10 * ease)}, ${clampByte(245 - 65 * ease)}`,
    ((0.06 + 0.14 * illum) * (1 + horizonness * 0.3) + (1 - disc) * 0.08) * (1 - eclipseProgress * 0.7) * (1 - day)
  );

  ctx.globalAlpha *= disc;
  if (disc < 0.02) return;

  // The unlit side is never darker than the sky in front of it, so it is
  // not painted — only a young or old crescent's earthshine is added on.
  // (Stars behind it are skipped in drawStars.)
  // Earthshine needs a dark sky: twilight drowns it well before the crescent.
  const earthshine = (Math.max(0, 0.28 - illum) / 0.28) * Math.max(0, 1 - day * 2);
  if (earthshine > 0.02) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(40, 46, 70, ${(0.2 * earthshine).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // The lit part as one path — the bright limb, then back along the
  // terminator — so a veiled moon fades as a single shape, with no seams
  // where stacked half-discs overlap.
  const xt = r * (1 - 2 * illum) * (waxing ? 1 : -1);
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, !waxing);
  ctx.ellipse(0, 0, Math.abs(xt), r, 0, Math.PI / 2, -Math.PI / 2, xt > 0);
  ctx.fillStyle = litCss;
  ctx.fill();

  // No limb darkening: the real full Moon is famously flat-lit to the edge.
  const face = moonFace();
  if (face) {
    ctx.clip();
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(face, -r, -r, r * 2, r * 2);
  }
}

const moonRadius = (horizonness: number): number => 20 + 12 * horizonness;

let dogSprite: HTMLCanvasElement | null | undefined;

/** A sun dog, baked once: red on the sun's side, then white, then a pale tail. */
function sunDog(): HTMLCanvasElement | null {
  if (dogSprite !== undefined) return dogSprite;
  dogSprite = null;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 32;
  const m = c.getContext("2d");
  if (!m) return null;
  m.filter = "blur(2.5px)";
  const g = m.createLinearGradient(6, 0, 58, 0);
  g.addColorStop(0, "rgba(255, 120, 90, 0)");
  g.addColorStop(0.08, "rgba(255, 130, 90, 0.9)");
  g.addColorStop(0.2, "rgba(255, 238, 196, 1)");
  g.addColorStop(0.36, "rgba(214, 228, 255, 0.6)");
  g.addColorStop(1, "rgba(230, 236, 255, 0)");
  m.fillStyle = g;
  m.beginPath();
  m.ellipse(24, 16, 17, 10, 0, 0, Math.PI * 2);
  m.fill();
  return (dogSprite = c);
}

/**
 * Ice-crystal optics in a cirrostratus veil: the 22° ring — sharp and
 * reddish inside, fading white outward — and, with the sun low, the two
 * sun dogs on the ring's level.
 */
function drawHalo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  R: number,
  a: number,
  dogs: number,
  inner: string
): void {
  if (a < 0.01) return;
  const g = ctx.createRadialGradient(x, y, R * 0.85, x, y, R * 1.25);
  g.addColorStop(0.2, `rgba(${inner}, 0)`);
  g.addColorStop(0.3, `rgba(${inner}, ${(a * 0.7).toFixed(3)})`);
  g.addColorStop(0.4, `rgba(250, 246, 240, ${a.toFixed(3)})`);
  g.addColorStop(1, "rgba(235, 240, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - R * 1.25, y - R * 1.25, R * 2.5, R * 2.5);
  const dog = dogs > 0.02 && sunDog();
  if (!dog) return;
  const k = R / 100;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.globalAlpha *= Math.min(1, a * 4) * dogs;
    ctx.translate(x + side * R * (0.9 + 0.3 * (1 - dogs)), y);
    ctx.scale(side * k, k);
    ctx.drawImage(dog, 0, -16);
    ctx.restore();
  }
}

/**
 * Where the sun or moon stands on its arc at hour `h` of its own day: x, y,
 * how low it sits, and the direction of travel (westward) as an angle.
 */
function arcPoint(width: number, height: number, h: number): [number, number, number, number] {
  const t = (h - SUN_RISE) / (SUN_SET - SUN_RISE);
  const riseY = height * 0.68;
  const lift = riseY - height * 0.09;
  return [
    width * (0.08 + t * 0.84),
    riseY - Math.sin(t * Math.PI) * lift,
    // Air mass, not clock time, reddens and swells the disc.
    1 - Math.sin(t * Math.PI),
    Math.atan2(-lift * Math.PI * Math.cos(t * Math.PI), width * 0.84),
  ];
}

/**
 * The moon rides the sun's arc `phase` of a day late: a new moon rises with
 * the sun, first quarter at noon, full at sunset, last quarter at midnight.
 * Null while it is below the horizon.
 */
function moonArc(width: number, height: number, h: number, phase: number) {
  const hm = (h + 24 - phase * 24) % 24;
  return hm < SUN_RISE || hm > SUN_SET ? null : arcPoint(width, height, hm);
}

/** The moon's disc [x, y, r] when it is up — for occulting stars, lighting clouds. */
export function moonDisc(
  width: number,
  height: number,
  h: number,
  date: Date,
  /** A lunar eclipse is always at full moon. */
  eclipsed = false
): [number, number, number] | null {
  const m = moonArc(width, height, h, eclipsed ? 0.5 : lunarPhase(date));
  return m && [m[0], m[1], moonRadius(m[2])];
}

export function drawCelestial(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  h: number,
  dim: number,
  date: Date,
  eclipse?: { type: "solar" | "lunar"; progress: number },
  /** 0..1 cirrostratus veil for ice haloes. */
  halo = 0
): void {
  if (dim < 0.02) return;

  ctx.save();
  // A broken sky dims the light on average, but an unobstructed disc stays
  // solid: only a real deck (dim well under ~0.8) starts to veil it.
  ctx.globalAlpha = Math.max(0, Math.min(1, dim / 0.8));

  // Thick cloud hides the disc long before it hides the light.
  const disc = Math.max(0, Math.min(1, (dim - 0.5) / 0.25));
  const progress = (type: "solar" | "lunar"): number =>
    eclipse?.type === type ? eclipse.progress : 0;

  const lunar = progress("lunar");
  const phase = lunar > 0 ? 0.5 : lunarPhase(date);
  const moon = moonArc(width, height, h, phase);
  const day = daylight(h);
  // A halo needs the veil lit and the disc visible through it.
  halo *= disc;
  const R = Math.max(110, Math.min(width, height) * 0.22);
  if (moon) {
    ctx.save();
    // A bright moon rings itself too, colourless to the night eye.
    drawHalo(ctx, moon[0], moon[1], R, 0.12 * halo * (1 - day) * (1 - Math.cos(phase * Math.PI * 2)) / 2, 0, "226, 230, 240");
    drawMoon(ctx, moon, phase, lunar, disc, day);
    ctx.restore();
  }
  if (h >= SUN_RISE && h <= SUN_SET) {
    const [x, y, horizonness] = arcPoint(width, height, h);
    drawHalo(ctx, x, y, R, 0.2 * halo, Math.min(1, horizonness * 1.8), "255, 190, 160");
    drawSun(ctx, x, y, horizonness, progress("solar"), disc);
  }

  ctx.restore();
}

/**
 * Venus and Jupiter keep their real places: like the moon, each rides the
 * sun's arc late by its elongation, so an evening Venus sets hours after
 * the sun and an opposition Jupiter crosses the sky all night. Neither
 * twinkles; Venus pierces the twilight, Jupiter waits for a darker sky.
 */
export function drawPlanets(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  h: number,
  date: Date,
  cloudAlpha: number
): void {
  const day = daylight(h);
  for (const venus of [true, false]) {
    const p = (venus ? venusState : jupiterState)(date);
    if (p.elong < 12) continue;
    const pos = moonArc(width, height, h, p.evening ? p.elong / 360 : 1 - p.elong / 360);
    if (!pos) continue;
    const a =
      Math.min(1, ((venus ? 0.75 : 0.45) - day) / 0.4) * (1 - pos[2] * 0.5) * (1 - cloudAlpha) * 0.95;
    if (a < 0.03) continue;
    const ix = pos[0] | 0;
    const iy = pos[1] | 0;
    ctx.fillStyle = `rgba(255, 250, 236, ${(a * 0.15).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(ix + 1, iy + 1, venus ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    // Bright cross — both outshine every star.
    ctx.fillStyle = `rgba(255, 252, 240, ${(a * (venus ? 0.6 : 0.42)).toFixed(3)})`;
    ctx.fillRect(ix - 2, iy, 6, 2);
    ctx.fillRect(ix, iy - 2, 2, 6);
    ctx.fillStyle = `rgba(255, ${venus ? 255 : 246}, ${venus ? 255 : 226}, ${a.toFixed(3)})`;
    ctx.fillRect(ix, iy, 2, 2);
  }
}
