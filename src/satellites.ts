// Real ISS tracking. Polls wheretheiss.at (public, keyless) and, when the
// station is genuinely within ~1200 km of the visitor, plays a bright dot
// arcing across the sky — the same pass you could walk outside and watch.

export interface SatellitePass {
  /** 0..1 progress across the sky. */
  progress: number;
}

const POLL_MS = 120_000;
const PASS_S = 45;
const COOLDOWN_MS = 30 * 60_000;
const NEAR_DEG = 11; // ~1200 km — roughly where the ISS clears the horizon

export class SatelliteWatcher {
  private passStart: number | null = null;
  private lastPassAt = 0;
  private readonly timer: number;

  constructor(private readonly geo: () => { lat: number; lon: number } | null) {
    void this.poll();
    this.timer = window.setInterval(() => void this.poll(), POLL_MS);
  }

  destroy(): void {
    window.clearInterval(this.timer);
  }

  /** The active pass, advanced by the wall clock; null between passes. */
  current(): SatellitePass | null {
    if (this.passStart === null) return null;
    const progress = (performance.now() - this.passStart) / (PASS_S * 1000);
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
      const j = (await res.json()) as { latitude?: number; longitude?: number };
      if (typeof j.latitude !== "number" || typeof j.longitude !== "number") return;
      const dLat = Math.abs(j.latitude - g.lat);
      let dLon = Math.abs(j.longitude - g.lon);
      if (dLon > 180) dLon = 360 - dLon;
      dLon *= Math.cos((g.lat * Math.PI) / 180);
      if (Math.hypot(dLat, dLon) <= NEAR_DEG) {
        this.passStart = performance.now();
        this.lastPassAt = Date.now();
      }
    } catch {
      /* transient — try again next poll */
    }
  }
}
