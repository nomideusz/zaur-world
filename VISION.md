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
   **~33 KB gzipped** across all dist entry points — hold this line.

## v1.0 checklist

Polish and freeze — mostly not adding.

- [ ] **Screenshot test per state**: a stranger names the weather correctly
      from a still. Passing today: storm, gray/overcast, fog. Still need the
      critical eye: rain, snow, clear day, clear night, golden hour.
- [ ] **Forecast mode first-class**: `conditionsAtHour` / scrub / tour
      documented and stable — the dino.zaur.app contract.
- [ ] **Zaur in the package**: move him from the demo into an opt-in entry
      (`@nomideusz/zaur-world/zaur` or option flag), off by default, weather
      reactions included, within the bundle ceiling.
- [ ] **Perf statement we can print**: no long tasks, no dropped frames on
      mid hardware, quality auto-mode verified on mobile.
- [ ] **Deletion pass**: anything failing the filter goes before 1.0.
- [ ] **API freeze**: `createWorld` options, `WorldHandle`, weather/solar
      entry points documented; CHANGELOG; semver promise.

## Parked for 1.x (deliberately)

- **Terrain by location** — the 1.x flagship: real elevation shaping the
  silhouettes (coast, plains, hills, mountains from actual lat/lon data).
- More creatures and rare delights.
- Anything from the idea list that passes the filter — one small improvement
  at a time, never a big bang.
