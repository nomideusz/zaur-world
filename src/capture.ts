import {
  applyAtmosphereCSS,
  buildAtmosphere,
  clearAtmosphereCSS,
  formatAtmosphereCaption,
  type AtmosphereSnapshot,
} from "./atmosphere.js";

export interface CaptureMomentResult {
  /** PNG (or requested type) data URL with an optional caption bar. */
  dataUrl: string;
  /** Share line, e.g. "Kraków · 21:14 · golden hour". */
  caption: string;
  /** Atmosphere used for the caption. */
  atmosphere: AtmosphereSnapshot;
}

/** Draw the live canvas into a new canvas and burn a caption strip under it. */
export function captureWithCaption(
  source: HTMLCanvasElement,
  caption: string,
  type = "image/png",
  quality?: number
): string {
  const pad = Math.max(28, Math.round(source.height * 0.045));
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height + pad;
  const ctx = out.getContext("2d");
  if (!ctx) return source.toDataURL(type, quality);

  ctx.drawImage(source, 0, 0);
  ctx.fillStyle = "rgba(10, 10, 16, 0.82)";
  ctx.fillRect(0, source.height, out.width, pad);

  const fontPx = Math.max(11, Math.round(pad * 0.42));
  ctx.fillStyle = "rgba(232, 228, 216, 0.92)";
  ctx.font = `600 ${fontPx}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  ctx.fillText(caption, Math.round(pad * 0.45), source.height + pad / 2);

  ctx.fillStyle = "rgba(142, 197, 255, 0.95)";
  ctx.font = `500 ${Math.max(9, fontPx - 2)}px "IBM Plex Mono", ui-monospace, monospace`;
  const brand = "zaur.world";
  const tw = ctx.measureText(brand).width;
  ctx.fillText(brand, out.width - tw - Math.round(pad * 0.45), source.height + pad / 2);

  return out.toDataURL(type, quality);
}

export function atmosphereEquals(a: AtmosphereSnapshot, b: AtmosphereSnapshot): boolean {
  return (
    a.mood === b.mood &&
    a.precipitation === b.precipitation &&
    a.isDay === b.isDay &&
    a.moments.join() === b.moments.join() &&
    Math.abs(a.daylight - b.daylight) < 0.04 &&
    Math.abs(a.wetness - b.wetness) < 0.05 &&
    Math.abs(a.frost - b.frost) < 0.05 &&
    Math.abs(a.rain - b.rain) < 0.05 &&
    Math.abs(a.glow - b.glow) < 0.05 &&
    a.city === b.city
  );
}

export {
  applyAtmosphereCSS,
  buildAtmosphere,
  clearAtmosphereCSS,
  formatAtmosphereCaption,
  type AtmosphereSnapshot,
};
