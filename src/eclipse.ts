export interface EclipseEvent {
	type: "solar" | "lunar";
	peakMs: number;
	durationMs: number;
	magnitude: number;
	// For solar eclipses, approximate path data
	lat?: number;
	lon?: number;
	radiusDeg?: number;
}

// A curated list of major upcoming eclipses (2024 - 2030)
// Extracted from NASA eclipse predictions.
export const KNOWN_ECLIPSES: EclipseEvent[] = [
	// --- Lunar Eclipses ---
	{
		type: "lunar",
		peakMs: Date.UTC(2024, 2, 25, 7, 12), // Mar 25, 2024 (Penumbral)
		durationMs: 4 * 3600 * 1000,
		magnitude: 0.9,
	},
	{
		type: "lunar",
		peakMs: Date.UTC(2024, 8, 18, 2, 44), // Sep 18, 2024 (Partial)
		durationMs: 4 * 3600 * 1000,
		magnitude: 1.0,
	},
	{
		type: "lunar",
		peakMs: Date.UTC(2025, 2, 14, 6, 58), // Mar 14, 2025 (Total)
		durationMs: 6 * 3600 * 1000,
		magnitude: 1.1,
	},
	{
		type: "lunar",
		peakMs: Date.UTC(2025, 8, 7, 18, 12), // Sep 7, 2025 (Total)
		durationMs: 5 * 3600 * 1000,
		magnitude: 1.1,
	},
	{
		type: "lunar",
		peakMs: Date.UTC(2026, 2, 3, 11, 34), // Mar 3, 2026 (Total)
		durationMs: 5 * 3600 * 1000,
		magnitude: 1.1,
	},

	// --- Solar Eclipses ---
	{
		type: "solar",
		peakMs: Date.UTC(2024, 3, 8, 18, 17), // Apr 8, 2024 (Total, North America)
		durationMs: 4 * 3600 * 1000,
		magnitude: 1.0,
		lat: 25.3,
		lon: -104.1,
		radiusDeg: 60,
	},
	{
		type: "solar",
		peakMs: Date.UTC(2024, 9, 2, 18, 45), // Oct 2, 2024 (Annular, South America)
		durationMs: 4 * 3600 * 1000,
		magnitude: 0.9,
		lat: -22.0,
		lon: -114.5,
		radiusDeg: 60,
	},
	{
		type: "solar",
		peakMs: Date.UTC(2026, 7, 12, 17, 47), // Aug 12, 2026 (Total, Spain/Arctic)
		durationMs: 4 * 3600 * 1000,
		magnitude: 1.0,
		lat: 65.2,
		lon: -25.3,
		radiusDeg: 60,
	},
	{
		type: "solar",
		peakMs: Date.UTC(2027, 7, 2, 10, 7), // Aug 2, 2027 (Total, North Africa)
		durationMs: 4 * 3600 * 1000,
		magnitude: 1.0,
		lat: 25.5,
		lon: 33.2,
		radiusDeg: 70,
	}
];

export interface EclipseState {
	/** 0 = no eclipse, 1 = maximum eclipse */
	progress: number;
	type: "solar" | "lunar";
}

/** Distance between two coordinates in degrees. Highly approximate. */
function geoDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	// A simple equirectangular approximation is enough for a 60-degree radius check
	const dLat = lat2 - lat1;
	const dLon = (lon2 - lon1) * Math.cos((lat1 * Math.PI) / 180);
	return Math.sqrt(dLat * dLat + dLon * dLon);
}

/** 
 * Returns the state of an eclipse right now, if one is happening.
 * Uses the provided location to determine if a solar eclipse is visible.
 */
export function currentEclipse(
	date: Date,
	lat: number | null | undefined,
	lon: number | null | undefined
): EclipseState | null {
	const now = date.getTime();
	for (const e of KNOWN_ECLIPSES) {
		const start = e.peakMs - e.durationMs / 2;
		const end = e.peakMs + e.durationMs / 2;
		
		if (now >= start && now <= end) {
			// Calculate how close we are to the peak (0 to 1)
			const distFromPeak = Math.abs(now - e.peakMs);
			const timeProgress = Math.max(0, 1 - (distFromPeak / (e.durationMs / 2)));
			
			if (e.type === "lunar") {
				// Lunar eclipses are visible everywhere it's night, but the drawing logic
				// already naturally handles this because the moon is only drawn when it's up.
				return { type: "lunar", progress: timeProgress * e.magnitude };
			} else if (e.type === "solar") {
				// Solar eclipses are highly localized.
				if (lat == null || lon == null || e.lat == null || e.lon == null || e.radiusDeg == null) {
					// If we don't know the location, assume it's slightly visible to be safe
					return { type: "solar", progress: timeProgress * 0.2 };
				}
				
				// Calculate distance from the point of maximum eclipse
				// (this is a very rough circular approximation of the eclipse path)
				const dist = geoDistance(lat, lon, e.lat, e.lon);
				if (dist > e.radiusDeg) return null;
				
				// Peak totality only near the center, dropping off linearly
				const geoProgress = Math.max(0, 1 - dist / e.radiusDeg);
				const finalProgress = timeProgress * geoProgress * e.magnitude;
				
				if (finalProgress > 0.01) {
					return { type: "solar", progress: finalProgress };
				}
			}
		}
	}
	return null;
}
