# @nomideusz/zaur-world

A living ambient sky for any web page, on a single `<canvas>`. Zero dependencies.

Born as the backdrop of [dino.zaur.app](https://dino.zaur.app), where a small dinosaur
named Zaur walks on the day's news under it.

## What it renders

- **A real day** — sky colors keyed to the visitor's actual sunrise and sunset
  (Open-Meteo), so summer evenings stay light late and winter days end early.
  Sun arcs by day; a phase-accurate moon with craters and earthshine by night.
- **Live weather** — per-visitor IP geolocation drives clouds (three parallax
  layers), rain with splashes, snow, fog, thunderstorms with procedural
  lightning, and wind speed that slants the rain and hurries the clouds.
  Overcast desaturates the whole sky; clear days are genuinely blue.
- **Golden hour** — horizon glow, and cloud undersides that catch fire
  at sunrise and sunset.
- **Seasons and small life** — birds by day (sheltering from rain, sparse in
  winter), fireflies on summer nights, aurora veils in deep night, shooting
  stars a few minutes apart, heat haze above 27 °C, and ground that stays
  visibly wet for a few minutes after rain stops. Seasons flip with the
  visitor's hemisphere.
- **A believable traffic of sky objects** — airplanes with dissolving
  contrails by day and blinking navigation lights by night, migrating
  V-formations in spring and autumn, a stylized satellite train gliding
  over rarely at night, a rainbow when the sun meets a clearing shower,
  and shooting-star rates that spike on real meteor-shower peaks
  (Perseids, Geminids, Quadrantids, Lyrids, Eta Aquariids, Orionids).

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

## Usage

```ts
import { createWorld } from "@nomideusz/zaur-world";

const canvas = document.querySelector("canvas")!;
const sky = createWorld(canvas);

// later, e.g. on component unmount:
sky.destroy();
```

The canvas must be sized by CSS — the device-pixel scaling and render loop
are handled for you:

```css
canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
```

Content layered above the sky reads best on a translucent "frosted" panel:

```css
.card {
  background: rgba(20, 20, 26, 0.55);
  backdrop-filter: blur(10px);
}
```

### Options

```ts
createWorld(canvas, {
  // Show the small "Krakow: clear skies, 24°C" status card in this element.
  weatherCardParent: document.body,

  // Foreground graph-paper dot grid; null disables it.
  gridColor: "rgba(232, 228, 216, 0.06)",

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

Reacting to conditions elsewhere in your UI:

```ts
const sky = createWorld(canvas);
setInterval(() => {
  const wx = sky.conditions();
  if (wx) document.body.classList.toggle("theme-day", wx.isDay);
}, 1000);
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

## License

MIT
