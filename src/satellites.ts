// Real ISS tracking. Polls wheretheiss.at (public, keyless), extrapolates the
// ground track from recent samples, and plays a bright dot arcing across the
// night sky when a pass is overhead or predicted within ~15 minutes.

import {
	predictIssPass,
	type GroundTrackSample,
} from "./satellite-math.js";

export interface SatellitePass {
	/** 0..1 progress across the sky. */
	progress: number;
	/** Sample arc for demos — stays visible in daylight. */
	demo?: boolean;
}

export interface SatelliteWatcherOptions {
	/**
	 * Schedule sample ISS arcs when no real pass is active — useful for demos.
	 * Real passes still take priority.
	 */
	demo?: boolean;
}

const POLL_MS = 90_000;
const PASS_S = 45;
const COOLDOWN_MS = 30 * 60_000;
const DEMO_COOLDOWN_MS = 90_000;
const DEMO_INTERVAL_MS = 7 * 60_000;
const NEAR_DEG = 11;
const PREDICT_HORIZON_MS = 15 * 60_000;
const HISTORY_MAX = 6;

export class SatelliteWatcher {
	private passStart: number | null = null;
	private scheduledAt: number | null = null;
	private lastPassAt = 0;
	private demoPass = false;
	private demoEnabled: boolean;
	private readonly timer: number;
	private demoTimer: number | null;
	private readonly history: GroundTrackSample[] = [];

	constructor(
		private readonly geo: () => { lat: number; lon: number } | null,
		opts: SatelliteWatcherOptions = {}
	) {
		this.demoEnabled = opts.demo === true;
		void this.poll();
		this.timer = window.setInterval(() => void this.poll(), POLL_MS);
		if (this.demoEnabled) {
			this.scheduleDemoPass(12_000);
			this.demoTimer = window.setInterval(
				() => this.scheduleDemoPass(0),
				DEMO_INTERVAL_MS
			);
		} else {
			this.demoTimer = null;
		}
	}

	destroy(): void {
		window.clearInterval(this.timer);
		if (this.demoTimer !== null) window.clearInterval(this.demoTimer);
	}

	setDemo(enabled: boolean): void {
		if (enabled === this.demoEnabled) return;
		this.demoEnabled = enabled;
		if (this.demoTimer !== null) {
			window.clearInterval(this.demoTimer);
			this.demoTimer = null;
		}
		if (enabled) {
			this.scheduleDemoPass(12_000);
			this.demoTimer = window.setInterval(
				() => this.scheduleDemoPass(0),
				DEMO_INTERVAL_MS
			);
		}
	}

	current(): SatellitePass | null {
		const now = performance.now();
		if (this.passStart === null && this.scheduledAt !== null && now >= this.scheduledAt) {
			this.beginPass(this.demoPass);
		}
		if (this.passStart === null) return null;
		const progress = (now - this.passStart) / (PASS_S * 1000);
		if (progress >= 1) {
			this.passStart = null;
			this.demoPass = false;
			return null;
		}
		return { progress, demo: this.demoPass || undefined };
	}

	private beginPass(demo: boolean): void {
		this.passStart = performance.now();
		this.scheduledAt = null;
		this.demoPass = demo;
		this.lastPassAt = Date.now();
	}

	private scheduleDemoPass(delayMs: number): void {
		if (this.passStart !== null || this.scheduledAt !== null) return;
		if (Date.now() - this.lastPassAt < DEMO_COOLDOWN_MS) return;
		this.demoPass = true;
		this.scheduledAt = performance.now() + delayMs;
	}

	private async poll(): Promise<void> {
		const g = this.geo();
		if (!g || this.passStart !== null) return;
		if (Date.now() - this.lastPassAt < COOLDOWN_MS) return;
		try {
			const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
			if (!res.ok) return;
			const j = (await res.json()) as {
				latitude?: number;
				longitude?: number;
				timestamp?: number;
			};
			if (typeof j.latitude !== "number" || typeof j.longitude !== "number") return;

			const t = typeof j.timestamp === "number" ? j.timestamp * 1000 : Date.now();
			this.history.push({ lat: j.latitude, lon: j.longitude, t });
			if (this.history.length > HISTORY_MAX) this.history.shift();

			const prediction = predictIssPass(this.history, g, NEAR_DEG, PREDICT_HORIZON_MS);
			if (prediction === "now") {
				this.beginPass(false);
			} else if (prediction && this.scheduledAt === null) {
				this.demoPass = false;
				this.scheduledAt = performance.now() + prediction.startInMs;
			}
		} catch {
			/* transient — try again next poll */
		}
	}
}
