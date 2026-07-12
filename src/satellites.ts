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
}

const POLL_MS = 90_000;
const PASS_S = 45;
const COOLDOWN_MS = 30 * 60_000;
const NEAR_DEG = 11;
const PREDICT_HORIZON_MS = 15 * 60_000;
const HISTORY_MAX = 6;

export class SatelliteWatcher {
	private passStart: number | null = null;
	private scheduledAt: number | null = null;
	private lastPassAt = 0;
	private readonly timer: number;
	private readonly history: GroundTrackSample[] = [];

	constructor(private readonly geo: () => { lat: number; lon: number } | null) {
		void this.poll();
		this.timer = window.setInterval(() => void this.poll(), POLL_MS);
	}

	destroy(): void {
		window.clearInterval(this.timer);
	}

	current(): SatellitePass | null {
		const now = performance.now();
		if (this.passStart === null && this.scheduledAt !== null && now >= this.scheduledAt) {
			this.passStart = now;
			this.scheduledAt = null;
			this.lastPassAt = Date.now();
		}
		if (this.passStart === null) return null;
		const progress = (now - this.passStart) / (PASS_S * 1000);
		if (progress >= 1) {
			this.passStart = null;
			return null;
		}
		return { progress };
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
				this.passStart = performance.now();
				this.scheduledAt = null;
				this.lastPassAt = Date.now();
			} else if (prediction && this.scheduledAt === null) {
				this.scheduledAt = performance.now() + prediction.startInMs;
			}
		} catch {
			/* transient — try again next poll */
		}
	}
}
