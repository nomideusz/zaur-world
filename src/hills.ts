export function generateBolt(w: number, h: number): Array<[number, number]> {
	const startX = w * (0.18 + Math.random() * 0.64);
	const segments = 7 + Math.floor(Math.random() * 5);
	const targetY = h * (0.32 + Math.random() * 0.28);
	const stepY = targetY / segments;
	const path: Array<[number, number]> = [[startX, 0]];
	let x = startX;
	let y = 0;
	for (let i = 0; i < segments; i++) {
		y += stepY;
		x += (Math.random() - 0.5) * 22;
		path.push([x, y]);
	}
	return path;
}

export function hillPath(
	seed: number,
	baseY: number,
	amp: number,
	segments: number,
	width: number
): Array<[number, number]> {
	let s = seed;
	const r = (): number => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
	const pts: Array<[number, number]> = [];
	for (let i = 0; i <= segments; i++) {
		const x = (i / segments) * width;
		const y = baseY + Math.sin(i * 0.7 + r() * 3) * amp + r() * amp * 0.4;
		pts.push([x, y]);
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
