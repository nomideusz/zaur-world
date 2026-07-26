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

function buildFrames(scale: number, color: string): Record<FrameId, RenderedFrame> {
	const out = {} as Record<FrameId, RenderedFrame>;
	for (const id of Object.keys(SPRITE_FRAMES) as FrameId[]) {
		const rows = SPRITE_FRAMES[id];
		const w = SPRITE_GRID_W * scale;
		const h = SPRITE_GRID_H * scale;
		const right = document.createElement("canvas");
		right.width = w;
		right.height = h;
		const ctx = right.getContext("2d")!;
		ctx.imageSmoothingEnabled = false;
		ctx.fillStyle = color;
		for (let y = 0; y < SPRITE_GRID_H; y++) {
			const row = rows[y] ?? "";
			for (let x = 0; x < SPRITE_GRID_W; x++) {
				if (row[x] === "X") ctx.fillRect(x * scale, y * scale, scale, scale);
			}
		}
		const left = document.createElement("canvas");
		left.width = w;
		left.height = h;
		const lctx = left.getContext("2d")!;
		lctx.imageSmoothingEnabled = false;
		lctx.translate(w, 0);
		lctx.scale(-1, 1);
		lctx.drawImage(right, 0, 0);
		out[id] = { right, left };
	}
	return out;
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
	private vy = 0;
	private onGround = false;
	mood: Mood = "curious";

	constructor(
		private scale: number,
		private worldW: number,
		private floorY: number
	) {
		this.frames = buildFrames(scale, ZAUR_INK);
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
			this.frames = buildFrames(newScale, ZAUR_INK);
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

	private currentFrame(): RenderedFrame {
		if (this.activity === "sleep") return this.frames.sleep;
		if (this.activity === "sit") return this.frames.sit;
		if (this.activity === "stare") return this.frames.look_up;
		if (!this.onGround) return this.vy < 0 ? this.frames.cheer : this.frames.surprise;
		if (performance.now() < this.blinkUntil) return this.frames.blink;
		if (this.activity === "react") {
			if (this.mood === "happy") return this.frames.happy;
			if (this.mood === "sad") return this.frames.sad;
			if (this.mood === "surprised") return this.frames.surprise;
			return this.frames.look_up;
		}
		if (this.activity === "look") return this.frames.look_up;
		if (this.activity === "walk") {
			return Math.floor(this.animTick / 180) % 2 === 0 ? this.frames.walk_a : this.frames.walk_b;
		}
		return this.frames.idle;
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
		private readonly skyHour: () => number
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
export function mountZaur(opts: { floorY: () => number; skyHour: () => number }): ZaurHandle {
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
		opts.skyHour
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
