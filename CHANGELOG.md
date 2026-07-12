# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/nomideusz/zaur-world/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/nomideusz/zaur-world/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/nomideusz/zaur-world/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/nomideusz/zaur-world/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nomideusz/zaur-world/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nomideusz/zaur-world/releases/tag/v0.1.0
