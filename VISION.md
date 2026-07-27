# Vision — zaur-world 1.0

A living ambient sky that **looks simple and is secretly accurate**. Someone
glances at a flat pastel background, then realizes: the sun is where the real
sun is, the moon has tonight's actual phase, that dot is Venus, the rain
started because it's raining outside their window — and it costs their page
almost nothing.

The wow is **truth wearing simple clothes**, not spectacle. WebGL always wins
the spectacle fight; nothing else in this weight class wins the truth fight.

Two first-class uses, one package:

- **Ambient background** with live weather (zaur.app).
- **24-hour forecast scrubbing** — the sky *is* the forecast UI (dino.zaur.app).

Zaur the dinosaur is part of the package — it is zaur-world — but **off by
default**: the sky ships alone unless the host opts him in.

## The filter

An idea gets in only if it passes **all four**. When in doubt, it's out —
deletion is a feature.

1. **Anchored in truth.** Real data drives it: time, location, astronomy,
   weather. No decoration for decoration's sake.
2. **Glanceable.** Reads at background opacity in one second. If you must
   zoom in or wait to notice it, it fails. (Lens droplets failed here.)
3. **Idle-free.** Costs ~zero when its condition isn't happening, bounded
   when it is. No per-frame allocation; bake to sprites/patterns and stamp.
   (Canvas self-sampling refraction failed here.)
4. **No new tech.** One 2d canvas. Zero dependencies. Bundle ceiling:
   **~33 KB gzipped** for the sky (all entry points except `/zaur`); Zaur's
   opt-in entry adds ~5 KB that only hosts who import him ever download.
   Hold both lines.

## v1.0 checklist

Polish and freeze — mostly not adding.

- [x] **Screenshot test per state**: a stranger names the weather correctly
      from a still. All states pass: clear day, clear night, golden hour,
      rain, storm, snow, gray/overcast, fog (`?wx=` + `?h=` demo params
      make each reproducible).
- [x] **Forecast mode first-class**: `setForecastHour` / `forecast()` /
      scrub / tour documented in README — the dino.zaur.app contract.
- [x] **Zaur in the package**: `@nomideusz/zaur-world/zaur`, off by
      default, weather reactions included, ~5 KB opt-in entry.
- [x] **Perf statement we can print**: bounded per-frame work by design
      (cached cloud sprites, one stroked path for precipitation, zero
      allocation in the steady state), quality auto-mode for mobile /
      reduced-motion; verified in daily use on the maintainer's desktop
      and phone through the 0.14 cycle.
- [x] **Deletion pass** (2026-07-27 audit): deprecated API removed
      (`setStormPreview`, `weatherCardParent`/`cardParent`), Zaur's
      unreachable jump/gravity system and three dead sprite frames cut,
      pass-through re-exports dropped, internal helpers unexported.
- [x] **API freeze**: options/handle documented in README; frozen at
      1.0.0 (2026-07-27) — breaking changes need a major from here.

## Parked for 1.x (deliberately)

- **Terrain by location** — the 1.x flagship: real elevation shaping the
  silhouettes (coast, plains, hills, mountains from actual lat/lon data).
- **Panorama mode (real azimuths)** — 2.0-scale: the viewport becomes a
  compass-facing window and drag means turning your head — the sunrise is
  where the real sunrise is (`equatorialToHorizontal` already does this
  projection for stars). The simple "drag to pan" version is declined
  permanently: nothing truthful exists off-screen, and a background canvas
  must never fight the page's touch scrolling.
- More creatures and rare delights.
- Anything from the idea list that passes the filter — one small improvement
  at a time, never a big bang.
