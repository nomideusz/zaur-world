export interface GroundTrackSample {
	lat: number;
	lon: number;
	/** Unix epoch milliseconds. */
	t: number;
}

/** Great-circle-ish angular distance in degrees (longitude scaled by cos(lat)). */
export function angularDistanceDeg(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const dLat = lat2 - lat1;
	let dLon = lon2 - lon1;
	while (dLon > 180) dLon -= 360;
	while (dLon < -180) dLon += 360;
	const dLonScaled = dLon * Math.cos((lat1 * Math.PI) / 180);
	return Math.hypot(dLat, dLonScaled);
}

function normalizeLon(lon: number): number {
	while (lon > 180) lon -= 360;
	while (lon < -180) lon += 360;
	return lon;
}

/**
 * Extrapolate ISS ground track and predict entry into the visibility disc.
 * Returns `"now"` if already inside, `{ startInMs }` for a future crossing,
 * or `null` if no pass is likely within the horizon.
 */
export function predictIssPass(
	history: GroundTrackSample[],
	observer: { lat: number; lon: number },
	nearDeg: number,
	horizonMs: number
): "now" | { startInMs: number } | null {
	if (history.length < 2) return null;
	const a = history[history.length - 2]!;
	const b = history[history.length - 1]!;
	const dt = b.t - a.t;
	if (dt <= 0) return null;

	const vLat = (b.lat - a.lat) / dt;
	let dLon = b.lon - a.lon;
	while (dLon > 180) dLon -= 360;
	while (dLon < -180) dLon += 360;
	const vLon = dLon / dt;

	const distNow = angularDistanceDeg(observer.lat, observer.lon, b.lat, b.lon);
	if (distNow <= nearDeg) return "now";

	for (let ms = 20_000; ms <= horizonMs; ms += 20_000) {
		const lat = b.lat + vLat * ms;
		const lon = normalizeLon(b.lon + vLon * ms);
		const dist = angularDistanceDeg(observer.lat, observer.lon, lat, lon);
		if (dist > nearDeg) continue;
		const lat2 = b.lat + vLat * (ms + 20_000);
		const lon2 = normalizeLon(b.lon + vLon * (ms + 20_000));
		const distAfter = angularDistanceDeg(observer.lat, observer.lon, lat2, lon2);
		if (distAfter <= dist + 0.15) {
			return { startInMs: Math.max(0, ms - 4000) };
		}
	}
	return null;
}
