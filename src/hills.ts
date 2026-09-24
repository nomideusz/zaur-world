/** Seeded LCG — the same seed always gives the same silhouette. */
function lcg(seed: number): () => number {
	let s = seed;
	return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

/**
 * A lightning channel: midpoint-displaced so it forks and kinks at every
 * scale like a real one, plus a couple of side branches that die out. A
 * `[NaN, NaN]` entry starts a new stroke (branch).
 */
export function generateBolt(w: number, h: number): Array<[number, number]> {
	const r = Math.random;
	const out: Array<[number, number]> = [];
	const channel = (x0: number, y0: number, x1: number, y1: number, depth: number): void => {
		let pts: Array<[number, number]> = [[x0, y0], [x1, y1]];
		for (let d = 0; d < depth; d++) {
			const next: Array<[number, number]> = [pts[0]];
			for (let i = 1; i < pts.length; i++) {
				const [ax, ay] = pts[i - 1];
				const [bx, by] = pts[i];
				const len = Math.hypot(bx - ax, by - ay);
				next.push([(ax + bx) / 2 + (r() - 0.5) * len * 0.55, (ay + by) / 2 + (r() - 0.5) * len * 0.12], [bx, by]);
			}
			pts = next;
		}
		if (out.length) out.push([NaN, NaN]);
		out.push(...pts);
	};
	const x0 = w * (0.18 + r() * 0.64);
	// Most strikes reach the ridge line; the rest stay inside the cloud deck.
	const y1 = h * (r() < 0.65 ? 0.6 + r() * 0.06 : 0.3 + r() * 0.2);
	const x1 = x0 + (r() - 0.5) * w * 0.12;
	channel(x0, 0, x1, y1, 5);
	const trunk = out.slice();
	for (let b = 0, n = 1 + Math.floor(r() * 3); b < n; b++) {
		const [bx, by] = trunk[4 + Math.floor(r() * (trunk.length * 0.6))];
		const reach = (y1 - by) * (0.3 + r() * 0.3);
		channel(bx, by, bx + (r() - 0.5) * reach * 1.4, by + reach, 4);
	}
	return out;
}

/**
 * A natural ridgeline: fractal value noise sampled every few pixels, so the
 * silhouette has detail at every scale — broad swells, shoulders, and a
 * ragged crest — instead of straight segments between random vertices.
 * `segments` sets how many features fit across the width; `ridged` folds
 * the noise into sharp crests and rounded valleys, the shape of eroded
 * mountains.
 */
export function hillPath(
	seed: number,
	baseY: number,
	amp: number,
	segments: number,
	width: number,
	ridged = false
): Array<[number, number]> {
	const r = lcg(seed);
	const lattice = Array.from({ length: 256 }, r);
	const noise = (x: number): number => {
		const i = Math.floor(x);
		const f = x - i;
		const u = f * f * (3 - 2 * f);
		return lattice[i & 255] + (lattice[(i + 1) & 255] - lattice[i & 255]) * u;
	};
	const step = Math.max(3, width / 480);
	const pts: Array<[number, number]> = [];
	for (let x = 0; x <= width + step; x += step) {
		let y = 0;
		let a = 1;
		let norm = 0;
		let f = segments / 6 / width;
		for (let o = 0; o < 6; o++) {
			y += (noise(x * f + o * 31.7) * 2 - 1) * a;
			norm += a;
			a *= 0.46;
			f *= 2.13;
		}
		y /= norm;
		// Folding the whole sum (not each octave) keeps the crests sharp and
		// the flanks naturally rough, without crenellating every summit. The
		// valleys are compressed into saddles, not canyons cut below the range.
		if (ridged) {
			y = y * 0.5 + 0.3 - Math.abs(y) * 1.4;
			if (y < 0) y *= 0.4;
		}
		pts.push([x, baseY - y * amp * 1.9]);
	}
	return pts;
}

export function fillHillPath(
	ctx: CanvasRenderingContext2D,
	pts: Array<[number, number]>,
	width: number,
	height: number
): void {
	ctx.beginPath();
	ctx.moveTo(0, height);
	for (const [x, y] of pts) ctx.lineTo(x, y);
	ctx.lineTo(width, height);
	ctx.closePath();
	ctx.fill();
}
