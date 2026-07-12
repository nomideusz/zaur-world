// Location-based terrain. Samples real elevations in a ~40 km ring around
// the visitor (Open-Meteo elevation API, Copernicus DEM) and reduces them to
// a tiny profile the World uses to shape its horizon: plains stay low and
// rolling, alpine regions get tall jagged ridges, coasts flatten toward a
// sea line. One request, cached per rounded location in localStorage.

export interface TerrainProfile {
  /** Elevation spread in meters across the sampled ring. */
  relief: number;
  /** True when any nearby sample sits at (or below) sea level. */
  coastal: boolean;
}

const CACHE_KEY = "zaur-world-terrain";
const RING_DEG = 0.35; // ~39 km of latitude

export async function fetchTerrain(
  lat: number,
  lon: number,
  opts: { cache?: boolean } = {}
): Promise<TerrainProfile | null> {
  const useCache = opts.cache !== false;
  const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  if (useCache) {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const j = JSON.parse(cached) as { key?: string; profile?: TerrainProfile };
        if (j.key === key && j.profile) return j.profile;
      }
    } catch {
      /* ignore */
    }
  }

  // Center plus a ring of 8 samples, longitude widened toward the poles.
  const lats: number[] = [lat];
  const lons: number[] = [lon];
  const lonScale = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    lats.push(lat + Math.sin(a) * RING_DEG);
    lons.push(lon + (Math.cos(a) * RING_DEG) / lonScale);
  }

  try {
    const url = new URL("https://api.open-meteo.com/v1/elevation");
    url.searchParams.set("latitude", lats.map((v) => v.toFixed(4)).join(","));
    url.searchParams.set("longitude", lons.map((v) => v.toFixed(4)).join(","));
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { elevation?: number[] };
    const el = data.elevation;
    if (!el || el.length === 0) return null;
    const profile: TerrainProfile = {
      relief: Math.max(...el) - Math.min(...el),
      coastal: Math.min(...el) <= 0,
    };
    if (useCache) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ key, profile }));
      } catch {
        /* private mode */
      }
    }
    return profile;
  } catch {
    return null;
  }
}
