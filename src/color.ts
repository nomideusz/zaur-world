export type RGB = [number, number, number];

export function rgb(hex: string): RGB {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function rgbToCss(c: RGB): string {
	return `rgb(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0})`;
}

/** Mix a color toward its own luminance gray — overcast-sky desaturation. */
export function desatRGB(c: RGB, k: number): RGB {
	const l = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
	return lerpRGB(c, [l, l, l], k);
}

export function lerpRGB(a: RGB, b: RGB, t: number): RGB {
	const k = Math.max(0, Math.min(1, t));
	return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export function clampByte(v: number): number {
	return Math.max(0, Math.min(255, Math.round(v)));
}
