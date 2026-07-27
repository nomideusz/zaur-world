// Zaur — the pixel dinosaur, ported from the retired dino news app.
// Body: walking (horizontal only, gravity owns the vertical), napping,
// sitting, stargazing, blinking. Mind: a small routine picker weighted by
// the SKY's hour — scrub the day strip to night and he gets sleepy.
// ponytail: no platforms — he walks the viewport floor only; hop/read
// verbs from the original stayed behind with the text terrain.

import {
	SPRITE_FRAMES,
	SPRITE_GRID_H,
	SPRITE_GRID_W,
	ZAUR_INK,
	type FrameId,
} from "./spriteFrames.js";

interface RenderedFrame {
	right: HTMLCanvasElement;
	left: HTMLCanvasElement;
}

const SWEATER = "#c25b3f";
const WET_INK = "#b6c3cb";
const WET_SWEATER = "#8f4430";

/**
 * Sweater band rows per frame, hand-picked — a width heuristic put the
 * band on his neck/head in the look-up and read poses.
 */
const TORSO_BAND: Record<FrameId, [number, number]> = {
	idle: [8, 10],
	walk_a: [8, 10],
	walk_b: [8, 10],
	look_up: [8, 10],
	happy: [8, 10],
	angry: [8, 10],
	sad: [9, 11],
	blink: [8, 10],
	sleep: [13, 15],
	read: [9, 10],
	sit: [14, 15],
	surprise: [8, 10],
	cheer: [7, 9],
};

/** Topmost body cell per column, per frame — where snow settles and drips spawn. */
const TOP_CELLS: Record<FrameId, Array<[number, number]>> = (() => {
	const out = {} as Record<FrameId, Array<[number, number]>>;
	for (const id of Object.keys(SPRITE_FRAMES) as FrameId[]) {
		const rows = SPRITE_FRAMES[id];
		const cells: Array<[number, number]> = [];
		for (let x = 0; x < SPRITE_GRID_W; x++) {
			for (let y = 0; y < SPRITE_GRID_H; y++) {
				if ((rows[y] ?? "")[x] === "X") {
					cells.push([x, y]);
					break;
				}
			}
		}
		out[id] = cells;
	}
	return out;
})();

function mirrored(right: HTMLCanvasElement): HTMLCanvasElement {
	const left = document.createElement("canvas");
	left.width = right.width;
	left.height = right.height;
	const lctx = left.getContext("2d")!;
	lctx.imageSmoothingEnabled = false;
	lctx.translate(right.width, 0);
	lctx.scale(-1, 1);
	lctx.drawImage(right, 0, 0);
	return left;
}

function buildFrames(
	scale: number,
	color: string,
	opts: { sweater?: boolean; wet?: boolean } = {}
): Record<FrameId, RenderedFrame> {
	const ink = opts.wet ? WET_INK : color;
	const wool = opts.wet ? WET_SWEATER : SWEATER;
	const out = {} as Record<FrameId, RenderedFrame>;
	for (const id of Object.keys(SPRITE_FRAMES) as FrameId[]) {
		const rows = SPRITE_FRAMES[id];
		const [bandLo, bandHi] = opts.sweater ? TORSO_BAND[id] : [-10, -10];
		const w = SPRITE_GRID_W * scale;
		const h = SPRITE_GRID_H * scale;
		const right = document.createElement("canvas");
		right.width = w;
		right.height = h;
		const ctx = right.getContext("2d")!;
		ctx.imageSmoothingEnabled = false;
		for (let y = 0; y < SPRITE_GRID_H; y++) {
			const row = rows[y] ?? "";
			ctx.fillStyle = y >= bandLo && y <= bandHi ? wool : ink;
			for (let x = 0; x < SPRITE_GRID_W; x++) {
				if (row[x] === "X") ctx.fillRect(x * scale, y * scale, scale, scale);
			}
		}
		out[id] = { right, left: mirrored(right) };
	}
	return out;
}

/**
 * Snow crest along each frame's top outline — one cell settled ON the body
 * plus one raised above it, so the accumulation visibly changes his
 * silhouette instead of vanishing white-on-cream.
 */
function buildCaps(scale: number): Record<FrameId, RenderedFrame> {
	const out = {} as Record<FrameId, RenderedFrame>;
	for (const id of Object.keys(SPRITE_FRAMES) as FrameId[]) {
		const right = document.createElement("canvas");
		right.width = SPRITE_GRID_W * scale;
		right.height = SPRITE_GRID_H * scale;
		const ctx = right.getContext("2d")!;
		for (const [x, y] of TOP_CELLS[id]) {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(x * scale, (y - 1) * scale, scale, scale);
			ctx.fillStyle = "#e2ecf8";
			ctx.fillRect(x * scale, y * scale, scale, scale);
		}
		out[id] = { right, left: mirrored(right) };
	}
	return out;
}

interface Drip {
	x: number;
	y: number;
	vy: number;
}

type Mood = "happy" | "sad" | "surprised" | "curious";
type Activity = "walk" | "idle" | "look" | "sleep" | "react" | "sit" | "stare";

const GRAVITY = 480; // px/s²
const MAX_FALL = 600;

class Body {
	x: number;
	y = 0;
	private targetX: number;
	private facing: 1 | -1 = 1;
	private speed = 36;
	activity: Activity = "idle";
	private nextDecisionAt = 0;
	private blinkUntil = 0;
	private wantsBlinkAt = 0;
	private animTick = 0;
	private frames: Record<FrameId, RenderedFrame>;
	private caps: Record<FrameId, RenderedFrame>;
	private vy = 0;
	private onGround = false;
	mood: Mood = "curious";
	/** 0..1 — soaked from rain; dries slowly once it stops. */
	private wet = 0;
	/** 0..1 — snow settled on his back while it snows; melts above freezing. */
	private snowCap = 0;
	private sweater = false;
	private frameStyle = "";
	private drips: Drip[] = [];
	private nextDripAt = 0;

	constructor(
		private scale: number,
		private worldW: number,
		private floorY: number
	) {
		this.frames = buildFrames(scale, ZAUR_INK);
		this.caps = buildCaps(scale);
		this.x = worldW * 0.5;
		this.y = floorY - this.heightPx;
		this.targetX = this.x;
		this.onGround = true;
		this.scheduleNextDecision(performance.now() + 1500);
		this.scheduleNextBlink(performance.now());
	}

	get widthPx(): number {
		return SPRITE_GRID_W * this.scale;
	}
	get heightPx(): number {
		return SPRITE_GRID_H * this.scale;
	}

	get isAvailable(): boolean {
		return this.activity !== "react" && this.activity !== "sleep";
	}

	resize(worldW: number, floorY: number): void {
		this.worldW = worldW;
		const newScale = Math.max(2, Math.min(4, Math.round(Math.min(worldW, floorY) / 240)));
		if (newScale !== this.scale) {
			this.scale = newScale;
			this.frames = buildFrames(newScale, ZAUR_INK, { sweater: this.sweater, wet: this.wet > 0.5 });
			this.caps = buildCaps(newScale);
		}
		// Floor moved (day strip toggled, window resized) — keep his feet on it.
		if (this.onGround) this.y = floorY - this.heightPx;
		this.floorY = floorY;
		this.x = clamp(this.x, this.minX, this.maxX);
		this.targetX = clamp(this.targetX, this.minX, this.maxX);
	}

	contains(px: number, py: number): boolean {
		const halfW = this.widthPx / 2;
		return px >= this.x - halfW - 6 && px <= this.x + halfW + 6 && py >= this.y - 6 && py <= this.y + this.heightPx + 6;
	}

	goTo(x: number): void {
		this.activity = "walk";
		this.targetX = clamp(x, this.minX, this.maxX);
		this.speed = 52;
		this.faceToward(this.targetX);
		this.nextDecisionAt = Number.POSITIVE_INFINITY;
	}

	react(mood: Mood, durationMs = 2200): void {
		this.mood = mood;
		this.activity = "react";
		this.targetX = this.x;
		this.nextDecisionAt = performance.now() + durationMs;
	}

	nap(ms: number): void {
		this.activity = "sleep";
		this.targetX = this.x;
		this.nextDecisionAt = performance.now() + ms;
	}

	stargaze(ms: number): void {
		this.activity = "stare";
		this.targetX = this.x;
		this.nextDecisionAt = performance.now() + ms;
	}

	sitFor(ms: number): void {
		this.activity = "sit";
		this.targetX = this.x;
		this.nextDecisionAt = performance.now() + ms;
	}

	hasArrived(eps = 8): boolean {
		return Math.abs(this.targetX - this.x) <= eps;
	}

	/** Fold the sky's weather into wetness, snow cap, and wardrobe. */
	tickWeather(
		wx: { precipitation: "none" | "rain" | "snow"; temperatureC: number } | null,
		dtMs: number
	): void {
		const dt = dtMs / 1000;
		const raining = wx?.precipitation === "rain";
		const snowing = wx?.precipitation === "snow";
		this.wet = clamp(this.wet + (raining ? dt / 8 : -dt / 25), 0, 1);
		const t = wx?.temperatureC;
		const melting = t != null && t > 0;
		this.snowCap = clamp(this.snowCap + (snowing ? dt / 10 : melting ? -dt / 12 : 0), 0, 1);
		// Hysteresis so a temperature hovering at the threshold doesn't
		// have him yanking the sweater on and off.
		if (t != null) {
			if (t <= 5) this.sweater = true;
			else if (t > 8) this.sweater = false;
		}
		const style = `${this.sweater ? "s" : ""}${this.wet > 0.3 ? "w" : ""}`;
		if (style !== this.frameStyle) {
			this.frameStyle = style;
			this.frames = buildFrames(this.scale, ZAUR_INK, {
				sweater: this.sweater,
				wet: this.wet > 0.3,
			});
		}
	}

	update(now: number, dtMs: number): void {
		const dtSec = dtMs / 1000;

		if (
			now >= this.wantsBlinkAt &&
			this.activity !== "sleep" &&
			this.activity !== "sit" &&
			this.activity !== "react"
		) {
			this.blinkUntil = now + 130;
			this.scheduleNextBlink(now);
		}

		if (!this.onGround) {
			this.vy = Math.min(this.vy + GRAVITY * dtSec, MAX_FALL);
			this.y += this.vy * dtSec;
			if (this.vy >= 0 && this.y + this.heightPx >= this.floorY) {
				this.y = this.floorY - this.heightPx;
				this.vy = 0;
				this.onGround = true;
			}
		}

		if (this.activity === "walk") {
			const dx = this.targetX - this.x;
			const dist = Math.abs(dx);
			const step = this.speed * dtSec;
			if (dist <= 1.5 || step >= dist) {
				this.x = this.targetX;
				this.activity = "idle";
				this.scheduleNextDecision(now + 700 + Math.random() * 2200);
			} else {
				this.x += Math.sign(dx) * step;
				if (dist > 0.5) this.facing = dx >= 0 ? 1 : -1;
			}
		}

		if (now >= this.nextDecisionAt) this.pickNextActivity(now);
		this.animTick += dtMs;

		// Soaked: beads roll off his back and fall to the ground.
		if (this.wet > 0.3 && now >= this.nextDripAt) {
			this.nextDripAt = now + 150 + Math.random() * 500 * (1.3 - this.wet);
			const cells = TOP_CELLS[this.currentFrameId()];
			if (cells.length > 0) {
				const [gx, gy] = cells[Math.floor(Math.random() * cells.length)];
				const col = this.facing === 1 ? gx : SPRITE_GRID_W - 1 - gx;
				this.drips.push({
					x: this.x - this.widthPx / 2 + (col + 0.5) * this.scale,
					y: this.y + gy * this.scale,
					vy: 20,
				});
			}
		}
		for (const d of this.drips) {
			d.vy = Math.min(MAX_FALL, d.vy + GRAVITY * dtSec);
			d.y += d.vy * dtSec;
		}
		this.drips = this.drips.filter((d) => d.y < this.floorY);
	}

	draw(ctx: CanvasRenderingContext2D): void {
		const frame = this.currentFrame();
		const img = this.facing === 1 ? frame.right : frame.left;
		const moving = this.activity === "walk" && this.onGround;
		let bob = 0;
		if (moving) bob = Math.round(Math.sin(this.animTick / 110));
		else if (this.activity === "idle") bob = Math.sin(this.animTick / 800) * 0.6;

		if (this.onGround) {
			ctx.save();
			ctx.globalAlpha = 0.15;
			ctx.fillStyle = "#000";
			ctx.beginPath();
			ctx.ellipse(
				Math.round(this.x),
				Math.round(this.y + this.heightPx + 1),
				this.widthPx * 0.3,
				3,
				0,
				0,
				Math.PI * 2
			);
			ctx.fill();
			ctx.restore();
		}

		ctx.drawImage(img, Math.round(this.x - this.widthPx / 2), Math.round(this.y + bob));

		if (this.snowCap > 0.05) {
			const cap = this.caps[this.currentFrameId()];
			ctx.save();
			ctx.globalAlpha = Math.min(1, this.snowCap * 1.2);
			ctx.drawImage(
				this.facing === 1 ? cap.right : cap.left,
				Math.round(this.x - this.widthPx / 2),
				Math.round(this.y + bob)
			);
			ctx.restore();
		}

		if (this.drips.length > 0) {
			ctx.fillStyle = "rgba(170, 195, 225, 0.9)";
			const s = Math.max(2, Math.round(this.scale * 0.75));
			for (const d of this.drips) {
				ctx.fillRect(Math.round(d.x), Math.round(d.y), s, Math.round(s * 1.6));
			}
		}

		if (this.activity === "sleep") this.drawZzz(ctx);
	}

	private drawZzz(ctx: CanvasRenderingContext2D): void {
		const s = this.scale;
		const headX = this.x + (this.facing === 1 ? 1 : -1) * s * 5;
		const headY = this.y + this.heightPx - s * 6;
		ctx.save();
		ctx.fillStyle = ZAUR_INK;
		ctx.font = `${s * 3}px ui-monospace, monospace`;
		ctx.textAlign = "center";
		for (let i = 0; i < 3; i++) {
			const t = (this.animTick / 1800 + i * 0.33) % 1;
			const alpha = t < 0.1 ? t * 10 : 1 - (t - 0.1) / 0.9;
			ctx.globalAlpha = Math.max(0, alpha * 0.6);
			const dx = Math.sin(t * Math.PI * 2 + i) * s * 1.5;
			ctx.fillText("z", Math.round(headX + dx + t * s * 3), Math.round(headY - t * s * 9));
		}
		ctx.restore();
	}

	private currentFrameId(): FrameId {
		if (this.activity === "sleep") return "sleep";
		if (this.activity === "sit") return "sit";
		if (this.activity === "stare") return "look_up";
		if (!this.onGround) return this.vy < 0 ? "cheer" : "surprise";
		if (performance.now() < this.blinkUntil) return "blink";
		if (this.activity === "react") {
			if (this.mood === "happy") return "happy";
			if (this.mood === "sad") return "sad";
			if (this.mood === "surprised") return "surprise";
			return "look_up";
		}
		if (this.activity === "look") return "look_up";
		if (this.activity === "walk") {
			return Math.floor(this.animTick / 180) % 2 === 0 ? "walk_a" : "walk_b";
		}
		return "idle";
	}

	private currentFrame(): RenderedFrame {
		return this.frames[this.currentFrameId()];
	}

	private pickNextActivity(now: number): void {
		const r = Math.random();
		if (this.activity === "sleep" && r < 0.55) {
			this.react("curious", 700 + Math.random() * 600);
			return;
		}
		if (r < 0.07) {
			const emotes: Mood[] = ["happy", "sad", "surprised", "curious"];
			this.react(emotes[Math.floor(Math.random() * emotes.length)], 1100 + Math.random() * 700);
			return;
		}
		if (r < 0.8) {
			this.activity = "idle";
			this.scheduleNextDecision(now + 1500 + Math.random() * 3000);
		} else {
			this.activity = "look";
			this.scheduleNextDecision(now + 900 + Math.random() * 1100);
		}
	}

	private faceToward(x: number): void {
		if (Math.abs(x - this.x) > 0.5) this.facing = x >= this.x ? 1 : -1;
	}

	private get minX(): number {
		return this.widthPx / 2 + 8;
	}
	private get maxX(): number {
		return this.worldW - this.widthPx / 2 - 8;
	}

	private scheduleNextDecision(at: number): void {
		this.nextDecisionAt = at;
	}
	private scheduleNextBlink(now: number): void {
		this.wantsBlinkAt = now + 2200 + Math.random() * 3800;
	}
}

// ── Mind — routines weighted by the sky's hour ─────────────────────────

type Step =
	| { kind: "walk"; x: number }
	| { kind: "pause"; ms: number; pose?: "curious" | "sit" }
	| { kind: "nap"; ms: number }
	| { kind: "stare"; ms: number };

type Routine = "patrol" | "home" | "nap" | "stargaze";

class Mind {
	private steps: Step[] = [];
	private stepStarted = false;
	private stepStartedAt = 0;
	private stepDeadline = 0;
	private nextPlanAt = performance.now() + 5_000;
	private holdUntil = 0;

	constructor(
		private readonly body: Body,
		private readonly viewW: () => number,
		/** The SKY's local hour — scrubbed / toured hours included. */
		private readonly skyHour: () => number,
		private readonly precip: () => "none" | "rain" | "snow" = () => "none"
	) {}

	deferFor(ms: number): void {
		this.holdUntil = Math.max(this.holdUntil, performance.now() + ms);
		this.steps = [];
		this.stepStarted = false;
	}

	tick(now: number): void {
		if (now < this.holdUntil) return;

		if (this.steps.length === 0) {
			if (now >= this.nextPlanAt && this.body.isAvailable && this.body.activity !== "walk") {
				this.plan();
			}
			return;
		}

		const step = this.steps[0];
		if (!this.stepStarted) {
			if (!this.body.isAvailable && this.body.activity !== "sleep") return;
			this.startStep(step, now);
			return;
		}
		if (now > this.stepDeadline) {
			this.steps = [];
			this.stepStarted = false;
			this.nextPlanAt = now + 6_000 + Math.random() * 8_000;
			return;
		}
		if (this.isStepDone(step, now)) {
			this.steps.shift();
			this.stepStarted = false;
			if (this.steps.length === 0) this.nextPlanAt = now + 8_000 + Math.random() * 18_000;
		}
	}

	private startStep(step: Step, now: number): void {
		if (this.body.activity === "sleep") {
			this.body.react("surprised", 700);
			return;
		}
		this.stepStarted = true;
		this.stepStartedAt = now;
		this.stepDeadline = now + 14_000;
		switch (step.kind) {
			case "walk": {
				this.body.goTo(step.x);
				const dist = Math.abs(step.x - this.body.x);
				this.stepDeadline = now + (dist / 45) * 1000 + 10_000;
				break;
			}
			case "pause":
				this.stepDeadline = now + step.ms + 2_000;
				if (step.pose === "sit") this.body.sitFor(step.ms);
				else if (step.pose && Math.random() < 0.7) this.body.react(step.pose, Math.min(step.ms, 2_600));
				break;
			case "nap":
				this.body.nap(step.ms);
				this.stepDeadline = now + step.ms + 8_000;
				break;
			case "stare":
				this.body.stargaze(step.ms);
				this.stepDeadline = now + step.ms + 4_000;
				break;
		}
	}

	private isStepDone(step: Step, now: number): boolean {
		const elapsed = now - this.stepStartedAt;
		switch (step.kind) {
			case "walk":
				return this.body.hasArrived(10);
			case "pause":
				return elapsed >= step.ms;
			case "nap":
				return (
					elapsed >= step.ms ||
					(elapsed > 2_000 && this.body.activity !== "sleep" && this.body.activity !== "react")
				);
			case "stare":
				return elapsed >= step.ms || (elapsed > 1_000 && this.body.activity !== "stare");
		}
	}

	private plan(): void {
		const hour = ((this.skyHour() % 24) + 24) % 24;
		const night = hour >= 22 || hour < 6;
		let weights: Record<Routine, number>;
		if (night) weights = { patrol: 1, home: 2, nap: 4, stargaze: 3 };
		else if (hour < 11) weights = { patrol: 4, home: 1.5, nap: 0.4, stargaze: 0.4 };
		else if (hour < 17) weights = { patrol: 3.5, home: 1.5, nap: 1, stargaze: 0.4 };
		else weights = { patrol: 2, home: 3, nap: 1, stargaze: 2 };

		// Weather trumps the clock: no stargazing under a precipitating sky,
		// and rain sends him toward home; snow is worth wandering in.
		const precip = this.precip();
		if (precip !== "none") weights.stargaze = 0;
		if (precip === "rain") {
			weights.home += 2.5;
			weights.patrol *= 0.4;
		}

		const total = Object.values(weights).reduce((a, b) => a + b, 0);
		let r = Math.random() * total;
		let routine: Routine = "patrol";
		for (const [key, w] of Object.entries(weights) as [Routine, number][]) {
			r -= w;
			if (r <= 0) {
				routine = key;
				break;
			}
		}

		const w = this.viewW();
		switch (routine) {
			case "patrol": {
				const stops = 2 + Math.floor(Math.random() * 2);
				this.steps = [];
				for (let i = 0; i < stops; i++) {
					this.steps.push(
						{ kind: "walk", x: (0.1 + Math.random() * 0.8) * w },
						{
							kind: "pause",
							ms: 2_000 + Math.random() * 3_500,
							pose: Math.random() < 0.5 ? "curious" : undefined,
						}
					);
				}
				break;
			}
			case "home":
				this.steps = [
					{ kind: "walk", x: Math.max(70, w * 0.08) },
					{ kind: "pause", ms: 6_000 + Math.random() * 8_000, pose: "sit" },
				];
				break;
			case "nap": {
				const ms = night ? 30_000 + Math.random() * 45_000 : 9_000 + Math.random() * 9_000;
				this.steps = [{ kind: "walk", x: Math.max(70, w * 0.08) }, { kind: "nap", ms }];
				break;
			}
			case "stargaze":
				this.steps = [
					{ kind: "walk", x: w * (0.6 + Math.random() * 0.3) },
					{ kind: "stare", ms: 5_000 + Math.random() * 5_000 },
				];
				break;
		}
		this.stepStarted = false;
	}
}

// ── Mount ──────────────────────────────────────────────────────────────

export interface ZaurHandle {
	destroy(): void;
}

/**
 * Mount Zaur on his own canvas above the sky. `floorY` returns the ground
 * line in CSS px (so he stands on top of the day strip when it's open);
 * `skyHour` feeds the mind so his routines follow the sky being shown.
 */
export function mountZaur(opts: {
	floorY: () => number;
	skyHour: () => number;
	/** Polled each frame — drives wetness, sweater, snow cap, and reactions. */
	weather?: () => {
		precipitation: "none" | "rain" | "snow";
		temperatureC: number;
		thunder?: boolean;
	} | null;
}): ZaurHandle {
	const canvas = document.createElement("canvas");
	canvas.id = "zaur-canvas";
	canvas.setAttribute("aria-hidden", "true");
	document.body.appendChild(canvas);
	const ctx = canvas.getContext("2d")!;

	let cssW = window.innerWidth;
	let cssH = window.innerHeight;
	let dpr = Math.max(1, window.devicePixelRatio || 1);
	let floor = opts.floorY();

	const scale = Math.max(2, Math.min(4, Math.round(Math.min(cssW, floor) / 240)));
	const body = new Body(scale, cssW, floor);
	const mind = new Mind(
		body,
		() => cssW,
		opts.skyHour,
		() => opts.weather?.()?.precipitation ?? "none"
	);

	function applySize(): void {
		cssW = window.innerWidth;
		cssH = window.innerHeight;
		dpr = Math.max(1, window.devicePixelRatio || 1);
		canvas.width = Math.round(cssW * dpr);
		canvas.height = Math.round(cssH * dpr);
		canvas.style.width = `${cssW}px`;
		canvas.style.height = `${cssH}px`;
		body.resize(cssW, floor);
	}
	applySize();
	window.addEventListener("resize", applySize);

	// Poke: he reacts, then the mind stays out of the user's way for a bit.
	function onPointerDown(e: PointerEvent): void {
		if (body.contains(e.clientX, e.clientY)) {
			body.react(Math.random() < 0.7 ? "happy" : "surprised", 1600);
			mind.deferFor(6_000);
		}
	}
	window.addEventListener("pointerdown", onPointerDown);

	let raf = 0;
	let last = performance.now();
	let floorCheck = 0;
	let lastPrecip: "none" | "rain" | "snow" = "none";
	let lastThunder = false;
	const step = (now: number): void => {
		const dtMs = Math.min(100, now - last);
		last = now;
		// The floor moves when the day strip opens/closes — re-measure ~2×/s.
		if (now >= floorCheck) {
			floorCheck = now + 500;
			const f = opts.floorY();
			if (Math.abs(f - floor) > 1) {
				floor = f;
				body.resize(cssW, floor);
			}
		}
		// Weather: soak/dry/dress, and a one-shot reaction when it turns.
		const wx = opts.weather?.() ?? null;
		body.tickWeather(wx, dtMs);
		const precip = wx?.precipitation ?? "none";
		if (precip !== lastPrecip) {
			if (body.isAvailable) {
				if (precip === "rain") body.react("sad", 2400);
				else if (precip === "snow") body.react("happy", 2400);
				if (precip !== "none") mind.deferFor(4_000);
			}
			lastPrecip = precip;
		}
		const thunder = !!wx?.thunder;
		if (thunder && !lastThunder && body.isAvailable) {
			body.react("surprised", 1800);
			mind.deferFor(3_000);
		}
		lastThunder = thunder;
		mind.tick(now);
		body.update(now, dtMs);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, cssW, cssH);
		body.draw(ctx);
		raf = requestAnimationFrame(step);
	};
	raf = requestAnimationFrame(step);

	return {
		destroy(): void {
			cancelAnimationFrame(raf);
			window.removeEventListener("resize", applySize);
			window.removeEventListener("pointerdown", onPointerDown);
			canvas.remove();
		},
	};
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}
