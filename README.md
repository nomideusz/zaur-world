# @nomideusz/zaur-world

A living ambient sky for any web page, on a single `<canvas>`.

**~25 kB min+gzip · zero dependencies · no API keys · no build step required.**

Born as a page backdrop; now a small weather product of its own at
[dino.zaur.app](https://dino.zaur.app), where a pixel dinosaur named Zaur
walks beneath it.

**[Live demo](https://dino.zaur.app)** — opens on a clear, unobstructed sky
with a small toggle in the corner to reveal the controls. Hit **▶ Play 24
hours** for a 30-second tour through dawn, golden hour, dusk, and the night
sky, with the hourly forecast riding along beside the clock — or scrub the
**day strip** along the bottom edge to jump the sky to any of the next 24
hours. On a VPN, tap **Use my location** so the tour matches your real sky.
It installs as a PWA — add it to a home screen and it opens full-screen,
with the last sky still drawing when there is no network.

| Golden hour | Night |
| --- | --- |
| ![Golden hour — the sun sinking behind layered ridges, cloud bases lit rose from below](https://raw.githubusercontent.com/nomideusz/zaur-world/main/docs/golden.png) | ![Night — phase-accurate moon with its real maria, stars, a faint aurora over the ranges](https://raw.githubusercontent.com/nomideusz/zaur-world/main/docs/night.png) |

## What it renders

- **A real day** — sky colors keyed to the visitor's actual sunrise and sunset
  (Open-Meteo), so summer evenings stay light late and winter days end early.
  Sun arcs by day. The moon shows its real phase and near-side maria and
  keeps its real hours — a full moon rising at sunset, a quarter moon pale
  in the daytime sky — its lit limb turned toward the sun. At clear dusk
  and dawn Earth's shadow and the pink Belt of Venus climb the sky opposite
  the sun; under a cirrus veil the sun (or a bright moon) wears a 22° halo,
  with sun dogs when it is low. Fractal ridgelines fade range by range into
  the sky behind them.
- **The real night sky** — once location is known, the stars are the ~330
  brightest (Yale catalog, to magnitude 3.6) at their true positions for that
  place and moment: Orion in winter, the Summer Triangle in July, wheeling
  with the sidereal clock over a faint scatter for the rest. Falls back to a
  decorative field until a location resolves.
- **Live weather** — per-visitor location (IP by default, or browser GPS with
  `geolocation: "prefer"` / `sky.relocate()` — accurate even on a VPN) drives
  clouds (three parallax layers), rain with splashes, snow, fog, thunderstorms
  with lightning timed to the real 15-minute nowcast, and wind that slants
  rain, drives flakes sideways, and hurries the clouds. Intensity scales the
  whole scene: light
  drizzle is a veil; 100% is a sealed, slowly drifting stratus deck with no
  sun visible. Overcast
  desaturates the sky; clear days are genuinely blue, and lightly veiled ones
  (~10–40% real cover) show high thin cirrus filaments. Conditions stay
  physically coherent (warm snow melts to rain; sub-zero rain falls as snow),
  a 15-minute nowcast lands precipitation within a minute of its slot, and
  the sky catches up instantly when a backgrounded tab wakes again.
- **Golden hour** — horizon glow, a broad warm aureole round the low sun,
  backlit slopes falling into warm shadow, and cloud bases lit rose from
  beneath at sunrise and sunset.
- **Seasons and small life** — birds by day (sheltering from rain, sparse in
  winter), fireflies on summer nights, aurora veils in deep night, shooting
  stars a few minutes apart, heat haze above 27 °C, visibility-driven mist
  and haze that closes in on humid days, frost that forms as the air nears
  its dew point, ground that stays visibly wet after rain, and snow that
  accumulates from the real snowfall amount and lingers while the air stays
  cold. Seasons flip with the visitor's hemisphere.
- **A believable traffic of sky objects** — airplanes with dissolving
  contrails by day and blinking navigation lights by night, migrating
  V-formations in spring and autumn, a stylized satellite train gliding
  over rarely at night, a rainbow when the sun meets a clearing shower,
  crepuscular rays (god rays) fanning down while a cloud edge crosses the sun, and
  shooting-star rates that spike on real meteor-shower peaks
  (Perseids, Geminids, Quadrantids, Lyrids, Eta Aquariids, Orionids).
- **The real Venus and Jupiter** — tracked from orbital elements (to a
  degree or two) at their true elongation from the sun: Venus bright and
  steady in the west after sunset or ahead of the sunrise, Jupiter
  crossing the sky all night near opposition, both gone near conjunction. Bats flit through the dusk on summer evenings,
  and a warm dome of city light sits beyond the ridge at night — brighter
  under overcast, the way clouds really bounce a town's light back down.

## Optional extras

```ts
createWorld(canvas, {
  terrain: true,     // shape the horizon from real nearby elevations
  satellites: true,  // show the real ISS when it passes near the visitor
});
```

- **`terrain`** samples elevations in a ~40 km ring around the visitor (one
  cached Open-Meteo call): plains get low rolling hills, alpine regions get
  tall jagged ridges with a third distant peak line, and coastlines flatten
  toward a shimmering sea band.
- **`satellites`** polls wheretheiss.at (keyless) every two minutes and,
  when the ISS is genuinely within ~1200 km, plays a bright dot arcing
  across the night sky — the same pass you could walk outside and watch.

## Zaur

The pixel dinosaur the package is named for — opt-in, off by default:

```ts
import { mountZaur } from "@nomideusz/zaur-world/zaur";

const sky = createWorld(canvas);
const zaur = mountZaur({
  // The ground line he walks on, in CSS px from the viewport top.
  floorY: () => window.innerHeight - 8,
  // The sky's hour drives his routines — he naps at night, patrols by day.
  skyHour: () => new Date().getHours() + new Date().getMinutes() / 60,
  // Optional: give him the sky's weather and he lives in it.
  weather: () => sky.conditions(),
});
// zaur.destroy() to unmount
```

He walks a fixed full-viewport overlay canvas of his own (`#zaur-canvas`,
`pointer-events: none` — clicks pass through, though poking his pixels gets
a reaction). With `weather` wired he gets soaked in rain and drips dry,
pulls on a sweater below 5 °C, collects a crest of snow while it flakes,
startles at the first thunderclap, and heads home when it pours.

## Usage

```ts
import { createWorld } from "@nomideusz/zaur-world";

const canvas = document.querySelector("canvas")!;
const sky = createWorld(canvas);

// later, e.g. on component unmount:
sky.destroy();
```

### No build step — script tag / CDN

The `auto` entry mounts a full-viewport sky behind the page on its own:

```html
<script>
  window.zaurWorldConfig = { terrain: true, satellites: true }; // optional
</script>
<script type="module" src="https://esm.sh/@nomideusz/zaur-world/auto"></script>
```

It adopts a `<canvas data-zaur-world>` if one exists (or the `canvas` CSS
selector from the config), otherwise it creates a fixed canvas at
`z-index: -1`. The handle is exposed as `window.zaurWorld`.

The canvas must be sized by CSS — the device-pixel scaling and render loop
are handled for you:

```css
canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  height: 100lvh; /* mobile: don't resize when the URL bar collapses */
  z-index: 0;
  pointer-events: none;
}
```

Content layered above the sky reads best on a translucent panel. The sky
writes CSS variables onto `document.documentElement` so your UI can live
*under* the weather:

```css
.card {
  background: rgba(20, 20, 26, calc(0.55 + var(--zw-wetness, 0) * 0.15));
  backdrop-filter: blur(calc(10px + var(--zw-frost, 0) * 8px));
  box-shadow: inset 0 0 calc(var(--zw-frost, 0) * 16px)
    rgba(200, 220, 255, calc(var(--zw-frost, 0) * 0.3));
}

/* Optional rain streaks */
.card::after {
  content: "";
  position: absolute;
  inset: 0;
  opacity: calc(var(--zw-rain, 0) * 0.5);
  background: repeating-linear-gradient(
    -18deg,
    transparent 0 7px,
    rgba(180, 200, 230, 0.08) 7px 8px
  );
  pointer-events: none;
}

html[data-zw-mood="golden"] .headline { color: #ffe0c2; }
html[data-zw-day="0"] .meta { color: rgba(200, 210, 240, 0.75); }
```

Variables: `--zw-daylight`, `--zw-dusk`, `--zw-wetness`, `--zw-snow-cover`,
`--zw-frost`, `--zw-rain`, `--zw-snow`, `--zw-glow`, `--zw-wind`, `--zw-cloud`.
Attributes: `data-zw-mood`, `data-zw-precip`, `data-zw-day`, `data-zw-moments`.
Pass `atmosphereRoot: null` to disable, or `onAtmosphereChange` to react in JS.

### Hero background

The sky works well as a living hero-section backdrop. Scope the canvas to the
section instead of the viewport, and dim it with plain CSS so text stays
readable:

```css
.hero {
  position: relative;
}
.hero canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  opacity: 0.8; /* dim to taste */
}
.hero > * {
  position: relative;
  z-index: 1;
}
```

### Scenes

Jump straight to a moment worth showing — anchored to the visitor's *real*
sun times, so "golden" is their golden hour:

```ts
sky.preview("golden"); // "dawn" | "noon" | "golden" | "dusk" | "night"
sky.preview("storm");  // or a weather look:
                       // "clear" | "rain" | "storm" | "snow" | "fog" | "overcast"
sky.preview(null);     // back to the live clock and live weather
```

Weather looks are layered over live conditions and are independent of the
clock, so they combine — snow at night:

```ts
sky.preview("night");          // jump the clock to night…
sky.setWeatherPreview("snow"); // …then layer snow over it
```

Dial individual climate fields on top of live weather or a preview —
intensity, temperature, wind, clouds, precip, fog, thunder:

```ts
sky.setWeatherPreview("storm");
sky.setWeatherOverride({ intensity: 1, windSpeed: 45 }); // sealed overcast gale
sky.setWeatherOverride(null); // clear field overrides
```

`normalizeWeather()` (also applied automatically) keeps impossible combos
coherent — e.g. snow above ~1 °C becomes rain; rain below freezing becomes
snow.

### Forecast

The weather fetch also brings back ~48 hours of hourly forecast. Pair
`setForecastHour` with `setTime` to show the weather an hour will *actually*
bring — the demo's "Play 24 hours" tour is exactly this:

```ts
sky.setTime(() => hourAsDate(18));  // jump the clock to 18:00…
sky.setForecastHour(18);            // …and the sky rains if 18:00 will rain
sky.setForecastHour(null);          // back to current conditions
sky.forecast();                     // raw ForecastHour[] for your own UI
```

Hours earlier than now roll into tomorrow, so sweeping a full day from the
current hour always shows the *coming* 24 hours. While a forecast hour is
active the built-in weather card follows along — "18:00 — raining, 24°C"
with precip chance, wind, and humidity — and stays on screen until you pass
`null`. Building your own readout instead? `formatForecastLine(hour, wx)`,
`formatForecastDetails(wx)`, and `weatherIcon(wx)` are exported.

The sky clock and forecast slots use the **location's** timezone (from
Open-Meteo), not the browser TZ — so a 24h tour stays coherent under VPN.
Use `sky.localHour()` when starting your own sweep.

![24-hour tour paused near sunset — the forecast rides beside the clock, the tour controls sit under Tweaks](https://raw.githubusercontent.com/nomideusz/zaur-world/main/docs/tour.png)

The demo turns this API into a **day strip** — one cell per coming hour with
icon, temperature, and precip-probability meter, a temperature curve across
the day, sunrise/sunset marks, and shaded night hours. Click or drag to pin
the sky to that hour:

![Day strip — the coming 24 hours as scrubbable cells with a temperature curve; the sky pinned to 18:00, golden hour](https://raw.githubusercontent.com/nomideusz/zaur-world/main/docs/daystrip.png)

Current conditions carry detail too: `humidity`, `cloudCover`,
`cloudCoverHigh`, `pressureMsl`, `windDirection`, `windGusts`, and `weatherCode` (feed it to
`describeWeather()`). Intensity scales continuously from precip mm (and
WMO code), and forecast hours interpolate intensity, cloud cover, humidity,
and precip chance between slots.

### Location (VPN-safe)

```ts
createWorld(canvas, { geolocation: "prefer" }); // GPS first, IP fallback

await sky.relocate();           // re-ask for GPS; reverse-geocodes the city
await sky.setGeo({ lat: 50.06, lon: 19.94, city: "Kraków" }); // pin a place
await sky.setGeo(null);         // clear pin → re-detect
sky.city();                     // "Kraków" (from IP, GPS, or reverse-geocode)
sky.locationSource();           // "gps" | "ip" | "fixed" | …
sky.locationHint();             // VPN/mismatch tip for your UI, or null
```

`locationHint()` is non-null when the forecast timezone disagrees with the
device clock (typical VPN). The demo pulses the place name in that case —
clicking it opens the location panel: GPS, city search, or a preset city
(`?lat=&lon=&city=` shareable).

### Options

```ts
createWorld(canvas, {
  // Show the small "Krakow: clear skies, 24°C" status card.
  weatherCard: { parent: document.body, position: "top-right" },

  // Foreground graph-paper dot grid; null disables it.
  gridColor: "rgba(232, 228, 216, 0.06)",

  // Fixed location — skips IP geolocation.
  geo: { lat: 50.06, lon: 19.94, city: "Kraków" },

  // React to weather without polling.
  onConditionsChange(wx) {
    document.body.classList.toggle("theme-day", wx.isDay);
  },

  // Performance preset: "auto" | "low" | "high" (default "auto").
  quality: "auto",

  // Pause rendering while the tab is hidden (default true).
  pauseWhenHidden: true,

  // Manual pause/resume also available: sky.pause() / sky.resume()

  // Day birds + migrating flocks, dusk bats, summer fireflies (all default true).
  birds: true,
  bats: true,
  fireflies: true,

  // Prefer browser GPS over IP (real location under VPN). Opt-in.
  // Also: "fallback" (IP first), or sky.relocate() after mount.
  geolocation: "prefer",

  // Wall clock override for demos and screenshots.
  time: () => new Date("2026-07-12T19:30:00"),

  // Bring your own weather (disables all network calls).
  weather: () => ({
    cloudiness: 1,        // 0 none · 1 scattered · 2 overcast
    precipitation: "rain", // "none" | "rain" | "snow"
    intensity: 0.6,        // 0..1
    thunder: false,
    fog: false,
    isDay: true,
    windSpeed: 18,         // km/h
    temperatureC: 21,
    latitude: 50.1,        // optional; flips seasons south of the equator
    sunriseH: 4.5,         // local decimal hours, null = built-in defaults
    sunsetH: 21.0,
  }),
});
```

### React

```tsx
import { useZaurWorld } from "@nomideusz/zaur-world/react";

export function Sky() {
  const { canvasRef, worldRef } = useZaurWorld({ terrain: true, satellites: true });
  // Options apply at mount; later tweaks go through worldRef.current
  // (preview, setTerrain, capture, …) or remount with a new key.
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0 }} />;
}
```

Or without the hook:

```tsx
import { useEffect, useRef } from "react";
import { createWorld } from "@nomideusz/zaur-world";

export function Sky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sky = createWorld(canvas, { terrain: true });
    return () => sky.destroy();
  }, []);

  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0 }} />;
}
```

### Subpath imports

```ts
import { deriveConditions } from "@nomideusz/zaur-world/weather";
import { warpHour, solsticeWarmth } from "@nomideusz/zaur-world/solar";
```

### Snapshot

```ts
const sky = createWorld(canvas);
const png = sky.capture("image/png");

// Shareable still with place · time · mood burned in:
const moment = sky.captureMoment();
console.log(moment.caption); // "Kraków · 21:14 · golden hour"
// moment.dataUrl → download or share
```

Cinematic demo links work the same way — open `?wx=snow` or
`?eclipse=solar&city=Tokyo&lat=35.68&lon=139.69` on the live demo, or use
the **Golden** / **Night** buttons on the day strip to jump the sky to the
moment worth seeing.

Reacting to conditions elsewhere in your UI:

```ts
const sky = createWorld(canvas, {
  onConditionsChange(wx) {
    document.body.classList.toggle("theme-day", wx.isDay);
  },
});
```

`World` and `WeatherClient` are also exported individually if you want to own
the render loop yourself.

## Network & privacy

With default options the package calls two public endpoints from the
visitor's browser: [geojs.io](https://www.geojs.io) once per session for
approximate IP location (cached in `localStorage`), and
[Open-Meteo](https://open-meteo.com) every 15 minutes for current conditions
and sun times. `terrain: true` adds one cached Open-Meteo elevation call;
`satellites: true` polls [wheretheiss.at](https://wheretheiss.at) every two
minutes. No keys, no cookies, nothing sent beyond the IP request itself.
Pass your own `weather` function to make zero network calls.

See [CHANGELOG.md](./CHANGELOG.md) for version history.

`localStorage` keys used when caching is enabled (default): `zaur-world-geo`,
`zaur-world-terrain`. Pass `cache: false` to disable persistence.

## Development

```bash
pnpm install
pnpm test          # unit tests
pnpm run demo:dev  # local demo
```

## License

MIT
