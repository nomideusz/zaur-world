// Real star positions: equatorial catalog coordinates → local horizontal
// (alt/az) via sidereal time, then a cylindrical projection onto the canvas.
// Pure functions — the World feeds them the clock and the visitor's geo.

const DEG = Math.PI / 180;

/**
 * Greenwich mean sidereal time in hours (0..24) for an instant.
 * Standard polynomial (Meeus, simplified): accurate to well under a second
 * per century — far beyond what a 1-2px star needs.
 */
export function gmstHours(date: Date): number {
	const jd = date.getTime() / 86_400_000 + 2_440_587.5;
	const d = jd - 2_451_545.0;
	const gmst = 18.697_374_558 + 24.065_709_824_419_08 * d;
	return ((gmst % 24) + 24) % 24;
}

/** Local sidereal time in degrees (0..360) at a longitude (east positive). */
export function lstDegrees(date: Date, lonDeg: number): number {
	const lst = gmstHours(date) * 15 + lonDeg;
	return ((lst % 360) + 360) % 360;
}

/**
 * Equatorial (RA/Dec, degrees) → horizontal (altitude/azimuth, degrees)
 * for an observer at `latDeg`/`lonDeg` at `date`. Azimuth is from north,
 * increasing eastward (N=0, E=90, S=180, W=270).
 */
export function equatorialToHorizontal(
	raDeg: number,
	decDeg: number,
	latDeg: number,
	lonDeg: number,
	date: Date
): { altDeg: number; azDeg: number } {
	const H = (lstDegrees(date, lonDeg) - raDeg) * DEG; // hour angle
	const dec = decDeg * DEG;
	const lat = latDeg * DEG;
	const sinAlt =
		Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
	const altDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / DEG;
	const azRad = Math.atan2(
		-Math.sin(H) * Math.cos(dec),
		Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H)
	);
	const azDeg = ((azRad / DEG) % 360 + 360) % 360;
	return { altDeg, azDeg };
}

/**
 * Cylindrical sky projection: the full 360° of azimuth spans the canvas
 * width, centered on the equator-facing direction (south for northern
 * observers, north for southern ones) so stars sweep the same way as the
 * sun. Altitude maps 0°→ridge line, 90°→near the top. Returns fractions
 * of width/height, or null when the star is below the horizon.
 */
export function projectStar(
	azDeg: number,
	altDeg: number,
	latDeg: number
): { x: number; y: number } | null {
	if (altDeg <= 0) return null;
	const facing = latDeg >= 0 ? 180 : 0;
	// Signed offset from the facing direction, -180..180 → 0..1 across.
	let off = azDeg - facing;
	off = ((off % 360) + 360) % 360;
	if (off > 180) off -= 360;
	// Southern observers see the sky mirrored (east on the right when
	// facing north) — flip so stars still travel left → right like the sun.
	const dir = latDeg >= 0 ? 1 : -1;
	const x = 0.5 + (dir * off) / 360;
	const y = 0.66 - (altDeg / 90) * 0.62;
	return { x, y };
}

/** Perceptual brightness 0..1 from visual magnitude (-1.5 bright .. 3.6 dim). */
export function starBrightness(mag: number): number {
	// Steep curve: the handful of first-magnitude stars should clearly
	// dominate, the mag-3 crowd should read as an ordinary starfield.
	return Math.max(0.3, Math.min(1, 1 - (mag + 1.5) / 4.6));
}
