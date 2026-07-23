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

// A curated list of major upcoming eclipses (2026 - 2040)
// Extracted from NASA eclipse predictions. Excludes penumbral/minor partials.
export const KNOWN_ECLIPSES: EclipseEvent[] = [
	// --- Lunar Eclipses ---
	{
		type: "lunar",
		peakMs: Date.UTC(2026, 7, 28, 4, 14), // Aug 28, 2026 (Partial)
		durationMs: 4 * 3600 * 1000,
		magnitude: 0.9,
	},
	{
		type: "lunar",
		peakMs: Date.UTC(2028, 0, 12, 4, 14), // Jan 12, 2028 (Partial)
		durationMs: 4 * 3600 * 1000,
		magnitude: 0.9,
	},
	{
		type: "lunar",
		peakMs: Date.UTC(2028, 11, 31, 16, 53), // Dec 31, 2028 (Total)
		durationMs: 5 * 3600 * 1000,
		magnitude: 1.2,
	},
	{
		type: "lunar",
		peakMs: Date.UTC(2029, 5, 26, 3, 23), // Jun 26, 2029 (Total)
		durationMs: 5 * 3600 * 1000,
		magnitude: 1.8,
	},
	{
		type: "lunar",
		peakMs: Date.UTC(2029, 11, 20, 22, 43), // Dec 20, 2029 (Total)
		durationMs: 5 * 3600 * 1000,
		magnitude: 1.1,
	},
	{
		type: "lunar",
		peakMs: Date.UTC(2032, 3, 25, 15, 14), // Apr 25, 2032 (Total)
		durationMs: 5 * 3600 * 1000,
		magnitude: 1.1,
	},
	{
		type: "lunar",
		peakMs: Date.UTC(2032, 9, 18, 19, 3), // Oct 18, 2032 (Total)
		durationMs: 5 * 3600 * 1000,
		magnitude: 1.1,
	},
	{
		type: "lunar",
		peakMs: Date.UTC(2033, 3, 14, 18, 13), // Apr 14, 2033 (Total)
		durationMs: 5 * 3600 * 1000,
		magnitude: 1.0,
	},
	{
		type: "lunar",
		peakMs: Date.UTC(2033, 9, 8, 10, 56), // Oct 8, 2033 (Total)
		durationMs: 5 * 3600 * 1000,
		magnitude: 1.3,
	},

	// --- Solar Eclipses ---
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
		peakMs: Date.UTC(2027, 7, 2, 10, 7), // Aug 2, 2027 (Total, North Africa/Middle East)
		durationMs: 4 * 3600 * 1000,
		magnitude: 1.0,
		lat: 25.5,
		lon: 33.2,
		radiusDeg: 70,
	},
	{
		type: "solar",
		peakMs: Date.UTC(2028, 6, 22, 2, 56), // Jul 22, 2028 (Total, Australia/NZ)
		durationMs: 4 * 3600 * 1000,
		magnitude: 1.0,
		lat: -15.6,
		lon: 126.9,
		radiusDeg: 60,
	},
	{
		type: "solar",
		peakMs: Date.UTC(2030, 5, 1, 6, 27), // Jun 1, 2030 (Annular, Europe/Asia)
		durationMs: 4 * 3600 * 1000,
		magnitude: 0.95,
		lat: 36.5,
		lon: 29.3,
		radiusDeg: 60,
	},
	{
		type: "solar",
		peakMs: Date.UTC(2030, 10, 25, 6, 51), // Nov 25, 2030 (Total, South Africa/Australia)
		durationMs: 4 * 3600 * 1000,
		magnitude: 1.0,
		lat: -43.6,
		lon: 71.2,
		radiusDeg: 60,
	},
	{
		type: "solar",
		peakMs: Date.UTC(2033, 2, 30, 18, 2), // Mar 30, 2033 (Total, Alaska/Russia)
		durationMs: 4 * 3600 * 1000,
		magnitude: 1.0,
		lat: 71.3,
		lon: -155.8,
		radiusDeg: 60,
	},
	{
		type: "solar",
		peakMs: Date.UTC(2034, 2, 20, 10, 18), // Mar 20, 2034 (Total, Africa/Middle East)
		durationMs: 4 * 3600 * 1000,
		magnitude: 1.0,
		lat: 16.1,
		lon: 22.2,
		radiusDeg: 60,
	},
	{
		type: "solar",
		peakMs: Date.UTC(2035, 8, 2, 1, 56), // Sep 2, 2035 (Total, China/Japan/Pacific)
		durationMs: 4 * 3600 * 1000,
		magnitude: 1.0,
		lat: 29.1,
		lon: 158.0,
		radiusDeg: 60,
	},
	{
		type: "solar",
		peakMs: Date.UTC(2037, 6, 13, 2, 40), // Jul 13, 2037 (Total, Australia/NZ)
		durationMs: 4 * 3600 * 1000,
		magnitude: 1.0,
		lat: -24.8,
		lon: 139.1,
		radiusDeg: 60,
	},
	{
		type: "solar",
		peakMs: Date.UTC(2038, 11, 26, 1, 0), // Dec 26, 2038 (Total, Australia/NZ)
		durationMs: 4 * 3600 * 1000,
		magnitude: 1.0,
		lat: -43.4,
		lon: 142.1,
		radiusDeg: 60,
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
