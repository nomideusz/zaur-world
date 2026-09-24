# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-09-24

### Changed

- Ridgelines are fractal value noise instead of straight segments; alpine
  places get ridged crests over shallow saddles, and every place gets a third,
  hazier range. Ranges fade toward the sky right behind them (blue by day,
  dusky at sunset, dark silhouettes at night), and a low sun leaves the
  facing slopes in warm shadow
- Cumulus are baked as one body: flat condensation base, domes rising to the
  middle with knobbly cauliflower tops, lit on the side facing the sun or
  moon. At sunset their bases glow rose-gold from below. Under rain and
  snow they flatten into low nimbostratus banks, while thunderstorms keep
  their towers. Clouds are opaque and denser, and at partial cover whole
  clouds appear rather than every cloud turning ghostly
- The overcast deck carries a drifting stratocumulus texture (one baked,
  palette-free sprite) instead of a flat band
- Moon: its real near-side maria, softly blended and multiplied so they read
  faintly in earthshine, at about the sun's apparent size. Sun and moon glows
  are smooth radial falloffs; a low sun throws a broad warm aureole; totality
  shows a soft corona with tapered streamers and prominences, and its 360°
  sunset ring now sits on the ridge line instead of behind the hills
- Sun colour follows how low the disc actually sits (air mass), not the
  clock, so a 10 am sun is white. An unobstructed disc stays solid under a
  broken sky, and a sealed overcast hides it
- God rays appear only while a cloud crosses the sun, and never under a
  sealed deck
- Lightning is a midpoint-displaced channel with side branches and a
  return-stroke flicker; rain falls in two depths
- The aurora is a rayed curtain rising from behind the ranges, brightening
  and fading along its length, not a band across the sky
- Stars twinkle more and dim with extinction near the horizon
- Fireflies stay away on nights below ~12 °C (the demo status says so)
- Demo: Share and the address bar keep a pinned hour (`?h=`); the day strip
  scrolls to the pinned or touring hour and steps with ←/→; Esc closes an open
  panel before it resets the scene; weather presets fit one row and PNG/Share
  sit beside Quality; on touch the location popover no longer pops the
  keyboard (or zooms iOS), and segmented controls get finger-sized targets

## [1.1.1] - 2026-09-17

### Fixed

- `describeWeather` called WMO codes 1–2 "mostly sunny" after dark too; at
  night it now says "mostly clear", so the weather card and forecast lines no
  longer promise sun at 22:00

## [1.1.0] - 2026-08-20

### Added

- Lightning now strikes on the real 15-minute nowcast: Open-Meteo's
  `lightning_potential` sets the flash rhythm, so an active cell flashes every
  couple of seconds while a distant storm only rumbles and glows — no more
  random timer behind the thunder. Without nowcast data (previews, hand-rolled
  weather) the old cadence is kept
- Visibility now shapes the air: `visibility` (metres) drives a soft milky
  veil and a low ground mist that closes in as the air turns murky, dimming at
  night
- Frost follows the dew point: hoar frost forms as the air temperature closes
  on the dew point, so a dry sub-zero night stays frost-free instead of
  sparking on any cold, clear evening
- Crepuscular rays — soft god-ray shafts fanning down from the sun through
  broken cloud, longest and most golden near sunrise and sunset
- Snow accumulates from the real snowfall amount (cm/h) instead of a canned
  intensity curve — a heavy dump blankets the ground in seconds, a dusting
  takes minutes
- Demo: opens with a minimal UI — the full-screen sky is unobstructed and a
  corner toggle reveals the controls (`?ui=1` to open with them)

### Fixed

- Solar eclipse: the moon's disc is clipped to the sun, so the darkened sun
  no longer reads as a free-floating black ball

## [1.0.1] - 2026-07-27

### Fixed

- A manually pinned location now survives reloads. Pins were saved to the
  geo cache but the next visit's IP detection overwrote them, so visitors
  had to re-enter their place each time — and IP geolocation can sit a few
  km from the real spot, far enough for genuinely different weather (the
  "auto shows storm, my pin shows drizzle" report). Pins are now stored
  with a marker and restored as pins; "back to auto location" clears the
  marker so detection takes over again
- Demo: the location popover shows the restored pin state on load



The API is frozen from this release: `createWorld` options, `WorldHandle`,
and the `/weather`, `/solar`, `/react`, `/auto`, and `/zaur` entry points
follow semver — breaking changes require a major version.

### Added

- Zaur is part of the package: `import { mountZaur } from "@nomideusz/zaur-world/zaur"` — opt-in, off by default, on his own overlay canvas. With `weather` wired he soaks in rain (dripping dry afterward), pulls on a sweater below 5 °C, collects a crest of snow, startles at the first thunderclap, and heads home when it pours
- Weather previews `"clear"` and `"rain"` join storm/snow/fog/overcast — the full six-state vocabulary the sky can render, all reachable from the demo (`?wx=` param) and `setWeatherPreview` / `preview`
- Storms and gray skies now close overhead: a full-width overcast deck behind the cloud puffs, so precipitation falls out of cloud instead of out of blue air. Genuinely overcast conditions drain the blue from the sky entirely
- Fog rewritten as milky air: a dense ground bank that swallows the hills with slow-drifting banks above — clearly distinct from overcast
- Clouds render as cached soft sprites (blur baked in, directional sun/moon rim light, shadowed bellies) — cheaper per frame than the previous per-frame path fills
- Demo: `?h=13.5` pins the sky to an hour for reproducible shareable scenes; Clear and Rain preset chips
- VISION.md: product identity, the four-part feature filter, and the v1.0 checklist

### Fixed

- Demo: controls no longer float mid-screen on phones — removed padding
  reserved for a weather card the demo never mounts

### Removed

- **Breaking:** deprecated `WorldHandle.setStormPreview()` — use `setWeatherPreview("storm" | null)`
- **Breaking:** deprecated `weatherCardParent` / `cardParent` options — use `weatherCard: { parent }`
- Dead code found by the pre-1.0 audit: Zaur's unreachable jump/gravity system and `cheer`/`read`/`angry` sprite frames, a pass-through re-export block in capture, and seven internal helpers no longer exported

## [0.14.1] - 2026-07-28

### Changed

- npm homepage now points at the live sky: [dino.zaur.app](https://dino.zaur.app)

## [0.14.0] - 2026-07-27

### Added

- Solar eclipses now darken the world, not just the sun: ambient sky/cloud/hill light plunges quartically toward twilight-dark near totality, the brightest stars come out, and a 360° sunset-colored ring hugs the horizon at deep eclipse. Lunar eclipses remove the full-moon silver lift as the moon goes blood-red
- Demo is now the product page for dino.zaur.app: Zaur the pixel dinosaur walks the bottom of the page (ambient routines driven by the sky's hour — he gets sleepy when you scrub to night; on by default, Tweaks → Zaur or `?zaur=0` to hide, remembered per visitor), the header place name is the single location control (popover with GPS, city search, presets), one global "Back to live" reset (also Esc), Golden/Night one-click moments on the day strip, tour speeds ¼×–4×, and a Share button (native share sheet / link copy)

### Changed

- Sunrise/sunset light is flatter and more real: the sky gradient compresses into the bottom third (near-uniform sky overhead), the horizon glow is a horizontal band instead of a bright-centered radial, the low sun is a flat deep-orange disc (white-hot core and wide glare fade out with horizonness)
- Demo: Grid and ISS layers default off (`?grid=1` / `?iss=1` to enable); weather card, climate sliders, and lat/lon inputs removed in favor of the consolidated controls

### Fixed

- Canvas no longer blinks while scrolling on mobile: the resize path skips no-op reallocations (the collapsing URL bar fires them continuously) and repaints synchronously when a real resize clears the bitmap

## [0.12.0] - 2026-07-19

### Added

- `WorldHandle.location()` — resolved coordinates the sky is keyed to (manual pin → GPS/IP), `null` until known
- 15-minute precipitation nowcast: the weather fetch pulls Open-Meteo `minutely_15` (precipitation + weather code, next 2 h) and current conditions advance along it every minute — rain or thunder starting/stopping mid-hour reaches the sky within a minute of its slot instead of waiting out the coarse hourly value. Natively modelled in Europe/North America, interpolated elsewhere; degrades to previous behavior when the series is missing or stale
- Pure helpers `buildMinutely15` / `refineWithMinutely` and types `MinutelySlot` / `OpenMeteoMinutely15` exported for host pages
- Wake catch-up: when the tab becomes visible again or the network reconnects, the sky applies the current 15-minute slot immediately and re-fetches weather if the data is older than 5 minutes — a page left open all day (throttled background timers, phone sleep) no longer shows stale conditions; `refresh()` also guards against overlapping fetches
- The real night sky: when the visitor's location is known, stars are no longer decorative — the ~330 brightest (Yale BSC to magnitude 3.6, ~2 kB embedded) render at their true altitude/azimuth for that place and time via sidereal-time math, wheeling across the night and following time scrubs and the 24h tour; a dimmed seeded scatter stands in for the fainter thousands, and remains the whole sky until location resolves. Pure helpers `gmstHours`, `lstDegrees`, `equatorialToHorizontal`, `projectStar`, `starBrightness` and the `STAR_CATALOG` table are exported; `scripts/gen-star-catalog.mjs` regenerates the catalog
- Cirrus layer: lightly veiled skies (~10–40% real cloud cover, no precip) now show high thin feathery filaments instead of reading fully clear — deterministic pattern, slow drift, warm blush at golden hour, faint at night, fades out as the puffy layers take over
- Distant rain curtains: heavy rain (intensity > ~0.45) hangs three soft shafts from the cloud base toward the ridge, slanted with the wind and slowly crossing the sky — the downpour reads in the distance, not just as foreground streaks
- Demo: **Day strip** — a 24-hour forecast dock along the bottom edge: one cell per hour (time, condition icon, temperature, precip-probability meter), starting at the current hour in the forecast location's timezone (VPN-safe). Click or drag across it to pin the sky, clock, and weather card to that hour; click again, press Esc, or hit "Back to live" to return. Doubles as the progress bar for the 24-hour tour. Toggle via Tweaks → Day strip or `?strip=0`.
- Demo: the day strip carries a temperature curve across all 24 hours, sunrise ☀ / sunset ☽ hairline markers at their exact times, and darker night-hour cells — the whole day's shape reads at a glance
- Demo installs to a phone home screen: web app manifest (standalone display, 192/512 + maskable icons rendered from the brand mark), apple-touch-icon, and a proper favicon (fixing the 404 on every load)
- Demo: `theme-color` + `viewport-fit=cover` meta for a cleaner mobile chrome

### Fixed

- Demo: typing a city name into Tweaks → Location now actually takes you there — the name is forward-geocoded (Open-Meteo geocoding, keyless) when the coordinates weren't edited. Previously the city was only a label and the stale auto-filled coordinates silently won, so "Dublin" pinned Kraków's weather under a Dublin name. Editing the coordinates yourself still wins over the name
- Demo: the day strip re-renders when the pinned location changes within the same timezone (its cache key now includes the coordinates, not just the window start hour)
- The sun and moon now rise from and set behind the hills: the arc's endpoints sit below the ridge line, so the sunrise/sunset handoff happens out of sight — previously the moon vanished mid-sky at the right edge and the sun popped in already risen at the left (and vice versa at dusk). The noon/midnight apex is unchanged
- Pinning a location while boot geo-detection was still in flight (e.g. the GPS permission prompt open under `geolocation: "prefer"`) let the boot fetch's late response overwrite the pinned location's weather with detected-location conditions until the next 15-minute refresh — stale fetches are now discarded (per-fetch sequence guard) and a mid-flight manual pin wins over the detection result
- Demo: `sky.location()` was called but never existed on `WorldHandle`, so `updateStatus` threw on load — the status line, live clock refresh, and shareable `?lat=&lon=` apply were dead in v0.11.0
- Demo mobile: the weather card no longer covers the Install/links rows (chrome clears its full height while the day strip is visible); an open Tweaks panel now stays inside the viewport on small phones instead of pushing the header off-screen; day-strip cells grew to ≥42 px touch targets on coarse pointers

## [0.11.0] - 2026-07-19

### Added

- `geolocation: "prefer" | "fallback" | boolean` — GPS-first mode for real location under VPN (`true` means prefer)
- `sky.relocate()` / `WeatherClient.relocate()` — re-resolve via browser geolocation and refresh weather + terrain
- `sky.setGeo(geo | null)` / `WeatherClient.setGeo()` — pin an explicit location at runtime (or clear back to auto-detect)
- `sky.localHour()`, `utcOffsetSeconds()`, `city()`, `locationSource()`, `locationHint()` — location-aware clock and VPN mismatch hints
- Reverse-geocode for GPS pins (BigDataCloud, no API key) so the card shows a city name instead of "your area"
- Continuous precip intensity from mm + WMO code (`intensityFromPrecip`); forecast slots also interpolate intensity, cloud cover, humidity, and precip chance
- Hourly `wind_direction_10m` in the forecast; rain/snow slant and cloud drift follow meteorological wind direction + gusts
- Pure helpers: `isoInUtcOffset`, `decimalHourInUtcOffset`, `dateAsLocationLocal`, `geoDistanceKm`, `timezoneOffsetMismatch`
- Demo: **Use my location**; Tweaks → **Location** (lat/lon/city, city presets, shareable `?lat=&lon=&city=`); mobile weather card + action buttons; VPN hint pulses the locate button

### Changed

- Default live clock follows the forecast location timezone when the Open-Meteo offset is known (fixes 24h tour vs forecast mismatch under VPN)
- Drizzle vs shower WMO codes tune particle density and streak length
- Weather card on narrow viewports moves to the bottom to clear the brand block
- Demo Tweaks panel taller/scrollable to fit the location controls

## [0.10.0] - 2026-07-16

### Added

- The built-in weather card follows `setForecastHour` — while a forecast hour is active it shows that hour's conditions ("18:00 — raining, 24°C" plus precip chance, wind, humidity) and stays visible until the hour is cleared, then returns to current conditions and normal fade behavior
- `WeatherClient.previewHour(hour | null)` — point the card at a forecast hour directly (per-frame safe; DOM only updates when the text changes)
- `formatForecastLine(hour, wx)`, `formatForecastDetails(wx)`, and `weatherIcon(wx)` exported for host pages building their own forecast readouts
- Demo: the 24-hour tour shows the forecast beside the header clock — icon, description, temperature, and precip chance update as the sweep moves through the day

### Changed

- README screenshots refreshed to the current demo (golden hour, night), plus a new 24-hour-tour shot showing the forecast beside the clock

## [0.9.0] - 2026-07-14

### Added

- Hourly forecast: the weather fetch now pulls ~48 h of Open-Meteo hourly data — `WeatherClient.forecast()` / `conditionsAtHour(hour)`, pure `buildHourlyForecast()` / `forecastConditionsAt()`, and `ForecastHour` type
- `setForecastHour(hour | null)` on the world handle — drive the sky from the forecast at a given hour; pairs with `setTime` so a time sweep shows the weather each hour will actually bring (wraps into tomorrow)
- Richer current conditions on `WeatherConditions`: `weatherCode`, `humidity`, `cloudCover`, `pressureMsl`, `windDirection`, `windGusts`, `precipProbability`
- Weather card gained a detail line — wind speed + compass direction (gusts when notable), humidity, pressure, and today's forecast high/low
- `describeWeather(code, isDay)` and `compassDir(deg)` exported for host pages
- Demo: "Play 24 hours" tour follows the real hourly forecast (live weather mode) and narrates each hour — description, temperature, precip chance

### Changed

- Real cloud-cover % refines the sky: it can promote the code-derived cloudiness bucket and smooths cloud opacity into a continuum
- Demo tour button renamed "Play one day" → "Play 24 hours"

### Fixed

- `scripts/minify.mjs` resolved the dist path incorrectly on Windows (`C:\C:\…`)

## [0.8.0] - 2026-07-14

### Added

- `setWeatherOverride()` / `WeatherOverride` / `applyWeatherOverride()` — dial intensity, temperature, wind, clouds, precip, fog, and thunder on top of live weather or a named preview
- `normalizeWeather()` — keeps conditions physically coherent (warm snow → rain, sub-zero rain → snow, fog wind capped, thunder always has a deck)
- Settled snow cover on the ground — builds while snowing in the cold, holds below freezing, melts in a thaw (`getSnowCover()`, `--zw-snow-cover`, captions)
- Intensity-driven cloud deck: darker, larger, denser banks; 100% seals the sky and hides the sun/moon
- Wind drives rain slant and snow drift from real km/h, not just a gentle gust
- Demo: live place · mood line, clock, climate sliders, shareable `int` / `temp` / `wind` URL params

### Changed

- Precipitation intensity uses a quadratic density curve — 100% is extreme (wall of rain/snow, fast soak / snow blanket)
- Celestial dimming no longer floors at 20% opacity; full overcast blacks out sun and moon
- `--zw-cloud` reflects intensity and storm mood, not only cloudiness enum

## [0.7.1] - 2026-07-13

### Fixed

- `prepublishOnly` minifies after tests so the published tarball ships compressed ESM

## [0.7.0] - 2026-07-13

### Added

- `WorldHandle.pause()` / `resume()` — manual render-loop control (independent of tab visibility)
- `WeatherClient.whenLocated()` — promise that resolves once approximate location is known
- `applyWeatherPreview()` helper exported for weather look layering
- React hook returns `worldRef` alongside `canvasRef` for imperative API access
- `birds` / `bats` options and `setBirds` / `setBats` — toggle day birds (incl. migrating flocks) and dusk bats like fireflies
- Demo: compact chip-based Tweaks panel (replaces tall per-row switch list)
- Richer golden hour (dedicated sky keyframes, hotter cloud undersides, stronger horizon glow)
- Wetter post-rain ground with specular glints; frost sparkle on cold clear nights
- Calendar moments: busier meteor showers, brighter full moons, hard-frost detection, ISS in atmosphere
- `atmosphere()` / `onAtmosphereChange` / CSS `--zw-*` vars + `data-zw-*` on the document (page lives under the weather)
- `captureMoment()` — PNG with burned-in caption (`Kraków · 21:14 · golden hour`)

### Changed

- Canvas sizing uses `ResizeObserver` (hero / non-viewport canvases resize correctly)
- `@nomideusz/zaur-world/auto` waits for `DOMContentLoaded` when `document.body` is missing
- `quality: "auto"` re-evaluates when reduced-motion or the mobile breakpoint changes
- Terrain loading awaits geo resolution instead of polling for up to 30 seconds
- ISS poll uses an 8s abort timeout (same pattern as weather fetches)
- `weatherCardParent` and `setStormPreview` marked `@deprecated` (use `weatherCard` / `setWeatherPreview`)
- Split celestial and atmosphere drawing out of `world.ts` into `world-celestial` / `world-atmosphere`
- Publish build minifies ESM output; README size claim updated to measured ~17 kB min+gzip
- Demo brand mark redesigned (horizon glyph + Syne / IBM Plex Mono); Tweaks panel scrolls so status text stays readable

## [0.6.0] - 2026-07-13

### Added

- `WorldHandle.preview(scene)` — jump to a named scene (`"dawn" | "noon" | "golden" | "dusk" | "night"`, a weather look, or `null` for live), anchored to the visitor's real sun times
- `WorldHandle.setWeatherPreview(preview)` — layer `"storm" | "snow" | "fog" | "overcast"` over live conditions, independent of the clock (combines with `setTime`)
- `sceneHour(scene, sunriseH, sunsetH)` exported from `solar`
- `@nomideusz/zaur-world/auto` — self-mounting entry for script-tag / CDN use (config via `window.zaurWorldConfig`, handle on `window.zaurWorld`)
- Demo: "▶ Play one day" 30-second cinematic tour, Time group (live / golden / custom hour), weather preview picker (storm / snow / fog / overcast), snapshot button, and shareable scene URLs (`?mode=custom&t=21.5&wx=snow`)

### Fixed

- `setQuality("low")` now hides the dot grid at runtime, matching mount-time behavior; the grid draws only when both the user toggle and the quality preset allow it
- `resolveQuality()` returned shared preset objects — a `maxDpr` override could leak into later `createWorld` calls

## [0.5.1] - 2026-07-13

### Added

- Hot-toggle API on `WorldHandle`: `setTerrain`, `setSatellites`, `setSatelliteDemo`, `setWeatherCard`, `setGrid`, `setTime`, `setQuality`, `setStormPreview`, `setFireflies`
- `fireflies` option (default `true`) — summer-evening fireflies in the lower sky band
- Demo controls panel with grouped switches, quality presets, and golden-hour offset slider

### Fixed

- Toggling terrain or ISS no longer remounts the world (no weather flash or cloud reset)
- Terrain off now correctly restores default hills
- Weather card toggle pins the card visible instead of letting it auto-fade
- Dot grid toggle independent of quality preset
- Quality changes no longer reset cloud positions unless canvas size or DPR cap changes
- ISS demo passes visible in daylight; `setDemo()` on `SatelliteWatcher`

### Changed

- Demo panel collapsed by default; Apple-style switches; fixed-height status line

## [0.5.0] - 2026-07-13

### Added

- `capture()` on the world handle — snapshot the canvas as a data URL
- `geolocation: true` — browser location fallback when IP geolocation fails
- `useZaurWorld()` React hook (`@nomideusz/zaur-world/react`)
- Subpath exports: `@nomideusz/zaur-world/weather`, `/solar`, `/react`
- ISS pass prediction via ground-track extrapolation (not just a single snapshot)
- Solstice warmth — subtle golden sky tint near summer solstice afternoons
- `solsticeWarmth()` helper exported from the main entry
- `terrain` / `satellites` work with a fixed `geo` option (no weather client required)

### Changed

- Split `world.ts` internals into `color`, `sky-math`, and `hills` modules
- Dot grid rendered via a tiled canvas pattern (cheaper per frame)
- ISS polls every 90s and can schedule passes up to ~15 minutes ahead

### Tests

- Satellite pass prediction and solstice warmth

## [0.4.0] - 2026-07-13

### Added

- Netlify-ready demo site at [zaur-world.netlify.app](https://zaur-world.netlify.app)
- pnpm workspace for the library and demo
- `onConditionsChange` callback — react to weather without polling
- `geo` option — fixed location, skips IP geolocation
- `cache: false` — opt out of `localStorage` persistence
- `time` option — wall-clock override for demos and screenshots
- `quality` preset (`"auto" | "low" | "high"`) with DPR cap and effect scaling
- `maxDpr` override for canvas resolution
- `pauseWhenHidden` — pauses the render loop when the tab is hidden (default `true`)
- `weatherCard` option with corner `position` placement
- Weather refresh when the tab becomes visible again
- Aurora gated by latitude (strongest above ~60°)
- Unit tests for solar and weather logic (`pnpm test`)
- Exported helpers: `warpHour`, `deriveConditions`, `resolveQuality`, and related types

### Changed

- Switched from npm to pnpm workspace; removed `package-lock.json`
- Demo UI moved to corner chrome so the sky stays unobstructed
- Reduced-motion and mobile visitors get fewer particles and ambient effects under `quality: "auto"`

## [0.3.0] - 2026-07-11

### Added

- Venus as evening/morning star from mean orbital elements (~1° accuracy)
- Summer-dusk bats in an ~80-minute window after sunset
- Warm city-light dome beyond the ridge at night, stronger under overcast

## [0.2.0] - 2026-07-11

### Added

- `terrain: true` — horizon shaped from real nearby elevations (Open-Meteo, cached)
- `satellites: true` — real ISS passes via wheretheiss.at proximity
- Hemisphere-aware seasons from geolocation latitude
- Migrating V-formations in spring and autumn
- Airplanes: contrails by day, blinking nav lights by night
- Stylized satellite train at night, rarely
- Rainbow when sun meets a clearing shower
- Shooting-star rates spike on real meteor-shower peak dates

## [0.1.0] - 2026-07-11

### Added

- Initial release — living ambient sky on a single `<canvas>`
- Real sunrise/sunset via Open-Meteo; live weather (clouds, rain, snow, fog, thunder, wind)
- Phase-accurate moon, golden-hour lit clouds, seasons, fireflies, shooting stars, wet ground
- Zero runtime dependencies; framework-agnostic API

[Unreleased]: https://github.com/nomideusz/zaur-world/compare/v0.12.0...HEAD
[0.12.0]: https://github.com/nomideusz/zaur-world/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/nomideusz/zaur-world/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/nomideusz/zaur-world/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/nomideusz/zaur-world/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/nomideusz/zaur-world/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/nomideusz/zaur-world/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/nomideusz/zaur-world/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/nomideusz/zaur-world/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/nomideusz/zaur-world/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/nomideusz/zaur-world/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/nomideusz/zaur-world/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/nomideusz/zaur-world/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nomideusz/zaur-world/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nomideusz/zaur-world/releases/tag/v0.1.0
