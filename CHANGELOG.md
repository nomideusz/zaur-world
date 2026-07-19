# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/nomideusz/zaur-world/compare/v0.10.0...HEAD
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
