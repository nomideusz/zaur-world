import {
	createWorld,
	describeWeather,
	formatAtmosphereCaption,
	isoInUtcOffset,
	weatherIcon,
	type AtmosphereSnapshot,
	type ForecastHour,
	type Quality,
	type TerrainProfile,
	type WeatherPreview,
	type WorldHandle,
} from "@nomideusz/zaur-world";
import { mountZaur, type ZaurHandle } from "@nomideusz/zaur-world/zaur";

const canvas = document.getElementById("sky") as HTMLCanvasElement;
const zaurToggle = document.getElementById("opt-zaur") as HTMLInputElement;
const terrainToggle = document.getElementById("opt-terrain") as HTMLInputElement;
const satellitesToggle = document.getElementById("opt-satellites") as HTMLInputElement;
const satDemoToggle = document.getElementById("opt-sat-demo") as HTMLInputElement;
const satDemoRow = document.getElementById("row-sat-demo") as HTMLDivElement;
const gridToggle = document.getElementById("opt-grid") as HTMLInputElement;
const gridRow = document.getElementById("row-grid") as HTMLDivElement;
const captureBtn = document.getElementById("btn-capture") as HTMLButtonElement;
const shareBtn = document.getElementById("btn-share") as HTMLButtonElement;
const tourBtn = document.getElementById("btn-tour") as HTMLButtonElement;
const liveBtn = document.getElementById("btn-live") as HTMLButtonElement;
const locateBtn = document.getElementById("btn-locate") as HTMLButtonElement;
const birdsToggle = document.getElementById("opt-birds") as HTMLInputElement;
const batsToggle = document.getElementById("opt-bats") as HTMLInputElement;
const firefliesToggle = document.getElementById("opt-fireflies") as HTMLInputElement;
const wxRadios = document.querySelectorAll('input[name="wx"]') as NodeListOf<HTMLInputElement>;
const eclipseRadios = document.querySelectorAll(
	'input[name="eclipse-mode"]'
) as NodeListOf<HTMLInputElement>;
const qualityRadios = document.querySelectorAll(
	'input[name="quality"]'
) as NodeListOf<HTMLInputElement>;
const statusEl = document.getElementById("extras-status") as HTMLParagraphElement;
const clockEl = document.getElementById("sky-clock") as HTMLParagraphElement;
const wxEl = document.getElementById("sky-wx") as HTMLParagraphElement;
const placeBtn = document.getElementById("sky-place") as HTMLButtonElement;
const locPop = document.getElementById("loc-pop") as HTMLDivElement;
const cityInput = document.getElementById("opt-city") as HTMLInputElement;
const locApplyBtn = document.getElementById("btn-loc-apply") as HTMLButtonElement;
const locClearBtn = document.getElementById("btn-loc-clear") as HTMLButtonElement;
const locHint = document.getElementById("loc-hint") as HTMLParagraphElement;
const locPresets = document.querySelectorAll(
	".loc-presets .chip-btn"
) as NodeListOf<HTMLButtonElement>;
const stripToggle = document.getElementById("opt-strip") as HTMLInputElement;
const stripEl = document.getElementById("daystrip") as HTMLDivElement;
const stripCellsEl = document.getElementById("daystrip-cells") as HTMLDivElement;
const momentGoldenBtn = document.getElementById("btn-moment-golden") as HTMLButtonElement;
const momentNightBtn = document.getElementById("btn-moment-night") as HTMLButtonElement;
const uiToggle = document.getElementById("ui-toggle") as HTMLButtonElement;

const mainActionsEl = document.getElementById("main-actions") as HTMLDivElement;
const tourActionsEl = document.getElementById("tour-actions") as HTMLDivElement;
const tourToggleBtn = document.getElementById("btn-tour-toggle") as HTMLButtonElement;
const tourStopBtn = document.getElementById("btn-tour-stop") as HTMLButtonElement;
const tourSpeedBtns = document.querySelectorAll(".tour-speed") as NodeListOf<HTMLButtonElement>;

/** True while a manual pin (or ?lat=&lon=) is active. */
let manualLocation = false;
/** The pinned coordinates, for shareable URLs. */
let manualGeo: { lat: number; lon: number; city?: string } | null = null;

function updatePlace(a: AtmosphereSnapshot): void {
	const line = formatAtmosphereCaption(a)
		.split(" · ")
		.filter((part) => !/^\d{1,2}:\d{2}$/.test(part))
		.join(" · ");
	if (placeBtn.textContent !== line) placeBtn.textContent = line || "Your sky";
}

// Shareable scene URLs — apply query params to the controls before mounting.
const params = new URLSearchParams(location.search);
if (params.get("terrain") === "0") terrainToggle.checked = false;
// Grid + ISS default off — the URL turns them ON ("=0" from old links is a no-op).
if (params.get("iss") === "1") satellitesToggle.checked = true;
if (params.get("pass") === "0") satDemoToggle.checked = false;
if (params.get("grid") === "1") gridToggle.checked = true;
if (params.get("birds") === "0") birdsToggle.checked = false;
if (params.get("bats") === "0") batsToggle.checked = false;
if (params.get("fly") === "0") firefliesToggle.checked = false;
if (params.get("strip") === "0") stripToggle.checked = false;
// Zaur: URL wins, then the visitor's saved choice, default on.
if (params.get("zaur") === "0") zaurToggle.checked = false;
else if (params.get("zaur") === "1") zaurToggle.checked = true;
else if (localStorage.getItem("zw-zaur") === "0") zaurToggle.checked = false;
const wxParam = params.get("wx") ?? (params.get("storm") === "1" ? "storm" : null);
if (wxParam && ["clear", "rain", "storm", "snow", "fog", "overcast"].includes(wxParam)) {
	(document.getElementById(`wx-${wxParam}`) as HTMLInputElement).checked = true;
}
// ?h=13.5 pins the sky to an hour — reproducible scenes for sharing/tests.
// Number(null) is 0, so a missing param must stay NaN or every plain load
// would pin to midnight.
const hParam = params.has("h") ? Number(params.get("h")) : NaN;
const qParam = params.get("q");
if (qParam === "high" || qParam === "low") {
	(document.getElementById(`qual-${qParam}`) as HTMLInputElement).checked = true;
}
const eclipseParam = params.get("eclipse");
if (eclipseParam && ["solar", "lunar"].includes(eclipseParam)) {
	(document.getElementById(`eclipse-${eclipseParam}`) as HTMLInputElement).checked = true;
}
// UI: URL wins, then the visitor's saved choice; default is the minimal view.
if (params.get("ui") === "1") document.body.dataset.ui = "full";
else if (params.get("ui") === "0") document.body.dataset.ui = "min";
else if (localStorage.getItem("zw-ui") === "full") document.body.dataset.ui = "full";
const latParam = Number(params.get("lat"));
const lonParam = Number(params.get("lon"));
const cityParam = params.get("city");

const sky: WorldHandle = createWorld(canvas, {
	// Prefer GPS so the 24h tour matches the visitor's real sky under VPN.
	geolocation: "prefer",
	gridColor: "rgba(232, 228, 216, 0.32)",
	terrain: terrainToggle.checked,
	satellites: satellitesToggle.checked,
	satelliteDemo: satDemoToggle.checked,
	birds: birdsToggle.checked,
	bats: batsToggle.checked,
	fireflies: firefliesToggle.checked,
	quality: selectedQuality(),
	onAtmosphereChange: updatePlace,
});

// ── Zaur ───────────────────────────────────────────────────────────────

let zaur: ZaurHandle | null = null;

/** Ground line: on top of the day strip when it's open, else near the bottom. */
function zaurFloorY(): number {
	if (!stripEl.hidden) {
		const top = stripEl.getBoundingClientRect().top;
		if (top > 120) return top - 2;
	}
	return window.innerHeight - 8;
}

function syncZaur(): void {
	if (zaurToggle.checked && !zaur) {
		zaur = mountZaur({
			floorY: zaurFloorY,
			skyHour: () => (tourRaf !== 0 ? tourHour : effectiveHour()),
			weather: () => sky.conditions(),
		});
	} else if (!zaurToggle.checked && zaur) {
		zaur.destroy();
		zaur = null;
	}
	localStorage.setItem("zw-zaur", zaurToggle.checked ? "1" : "0");
}

// ── Helpers ────────────────────────────────────────────────────────────

function terrainLabel(t: TerrainProfile): string {
	if (t.coastal) return `coast · ${Math.round(t.relief)} m relief`;
	if (t.relief > 550) return `alpine · ${Math.round(t.relief)} m relief`;
	if (t.relief > 250) return `hilly · ${Math.round(t.relief)} m relief`;
	return `plains · ${Math.round(t.relief)} m relief`;
}

function dateAtHour(h: number): Date {
	const d = new Date();
	d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
	return d;
}

function formatHour(h: number): string {
	const m = Math.round(h * 60) % (24 * 60);
	return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

function selectedWx(): WeatherPreview | null {
	for (const radio of wxRadios) {
		if (radio.checked && radio.value !== "live") return radio.value as WeatherPreview;
	}
	return null;
}

function selectedEclipse(): "solar" | "lunar" | "none" {
	for (const radio of eclipseRadios) {
		if (radio.checked) return radio.value as "solar" | "lunar" | "none";
	}
	return "none";
}

function selectedQuality(): Quality {
	for (const radio of qualityRadios) {
		if (radio.checked) return radio.value as Quality;
	}
	return "auto";
}

function applyEclipse(): void {
	const mode = selectedEclipse();
	sky.setWeatherOverride(mode === "none" ? null : { forceEclipse: mode });
}

function syncGridRow(): void {
	const low = selectedQuality() === "low";
	gridRow.classList.toggle("chip--disabled", low);
	gridToggle.disabled = low;
}

function syncSatDemoRow(): void {
	const on = satellitesToggle.checked;
	satDemoRow.classList.toggle("chip--disabled", !on);
	satDemoToggle.disabled = !on;
}

function effectiveHour(): number {
	if (scrubHour !== null) return scrubHour;
	// Forecast-location hour so the 24h tour matches Open-Meteo under VPN.
	return sky.localHour();
}

// ── Back to live: the one reset ────────────────────────────────────────

function hasOverrides(): boolean {
	return (
		tourRaf !== 0 || scrubHour !== null || selectedWx() !== null || selectedEclipse() !== "none"
	);
}

function syncLiveBtn(): void {
	liveBtn.hidden = !hasOverrides() || tourRaf !== 0;
}

/** Clear every preview and pin: tour, scrub, weather preset, eclipse. */
function backToLive(): void {
	if (tourRaf !== 0) stopTour();
	clearScrub(false);
	(document.getElementById("wx-live") as HTMLInputElement).checked = true;
	(document.getElementById("eclipse-none") as HTMLInputElement).checked = true;
	sky.setWeatherPreview(null);
	sky.setWeatherOverride(null);
	sky.setTime();
	renderStrip();
	updateStatus();
}

liveBtn.addEventListener("click", backToLive);

const tweaksEl = document.querySelector(".tweaks") as HTMLDetailsElement;

// Esc peels one layer at a time: an open popover or panel closes before the
// scene resets, so closing Tweaks never throws away the preview just picked.
window.addEventListener("keydown", (e) => {
	if (e.key !== "Escape") return;
	if (locPopOpen()) {
		closeLocPop();
		placeBtn.focus();
	} else if (tweaksEl.open) {
		tweaksEl.open = false;
		tweaksEl.querySelector("summary")!.focus();
	} else if (hasOverrides()) backToLive();
});

// ── 24-hour tour ───────────────────────────────────────────────────────
// Full circle starting from the current sky time, so both start and end
// are seamless. In live weather mode each hour of the sweep pulls that
// hour's real forecast, so you watch the coming day's weather arrive.

let tourRaf = 0;
let tourHour = 0;
let tourPaused = false;
let tourProgress = 0;
let tourStartHour = 0;
let tourSpeed = 1;
/** Hour pinned from the day strip or a moment button; null = live. */
let scrubHour: number | null = null;

function updateClock(): void {
	const h = tourRaf !== 0 ? tourHour : effectiveHour();
	const label = formatHour(h);
	if (clockEl.textContent !== label) clockEl.textContent = label;
}

/** The single conditions readout, beside the clock. */
function updateWx(): void {
	const wx = sky.conditions();
	if (!wx || wx.weatherCode == null) {
		wxEl.hidden = true;
		return;
	}
	let s = `${weatherIcon(wx)} ${describeWeather(wx.weatherCode, wx.isDay)} · ${Math.round(
		wx.temperatureC
	)}°`;
	if (wx.windSpeed >= 20) s += ` · wind ${Math.round(wx.windSpeed)}`;
	if (wx.precipProbability != null && wx.precipProbability >= 20) {
		s += ` · ${Math.round(wx.precipProbability)}% precip`;
	}
	wxEl.hidden = false;
	if (wxEl.textContent !== s) wxEl.textContent = s;
}

function tourStatus(): string {
	let s = `Day tour — ${formatHour(tourHour)}`;
	const wx = sky.conditions();
	if (wx && wx.weatherCode != null) {
		s += ` · ${describeWeather(wx.weatherCode, wx.isDay)}, ${Math.round(wx.temperatureC)}°`;
		if (wx.precipProbability != null && wx.precipProbability >= 20) {
			s += ` · ${Math.round(wx.precipProbability)}% precip`;
		}
	}
	return s;
}

function stopTour(): void {
	if (tourRaf === 0) return;
	cancelAnimationFrame(tourRaf);
	tourRaf = 0;
	sky.setForecastHour(null);
	if (scrubHour === null) sky.setTime();
	syncStripHighlight();
	updateStatus();
	mainActionsEl.hidden = false;
	tourActionsEl.hidden = true;
}

function startTour(): void {
	clearScrub(false);
	tourStartHour = effectiveHour();
	tourHour = tourStartHour;
	tourProgress = 0;
	tourPaused = false;
	tourToggleBtn.textContent = "Pause";
	sky.setTime(() => dateAtHour(tourHour));
	// Storm/Snow/Fog/Gray presets stay in charge; only live weather follows
	// the hourly forecast around the clock.
	const followForecast = selectedWx() === null;

	mainActionsEl.hidden = true;
	tourActionsEl.hidden = false;

	let lastTime = performance.now();
	const step = (now: number): void => {
		const dt = (now - lastTime) / 1000;
		lastTime = now;

		if (!tourPaused) {
			const speedSec = 30 / tourSpeed;
			tourProgress += dt / speedSec;
			if (tourProgress >= 1) {
				stopTour();
				return;
			}
			tourHour = (tourStartHour + tourProgress * 24) % 24;

			if (followForecast) sky.setForecastHour(tourHour);
			highlightStripHour(tourHour);
			updateClock();
			updateWx();
			statusEl.textContent = tourStatus();
		}
		tourRaf = requestAnimationFrame(step);
	};
	tourRaf = requestAnimationFrame(step);
}

tourToggleBtn.addEventListener("click", () => {
	tourPaused = !tourPaused;
	tourToggleBtn.textContent = tourPaused ? "Play" : "Pause";
});

tourStopBtn.addEventListener("click", stopTour);

for (const btn of tourSpeedBtns) {
	btn.addEventListener("click", () => {
		tourSpeed = Number(btn.dataset.speed) || 1;
		for (const b of tourSpeedBtns) b.classList.toggle("is-active", b === btn);
	});
}

tourBtn.addEventListener("click", () => {
	if (tourRaf !== 0) stopTour();
	else startTour();
});

// ── Day strip: the next 24 hours as a scrubbable forecast dock ─────────

/** WMO code → glyph, matching the library's weatherIcon buckets. */
function iconForCode(code: number, isDay: boolean): string {
	if (code >= 95) return "⚡";
	if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "❄";
	if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "☂";
	if (code === 45 || code === 48) return "≋";
	if (code === 3) return "☁";
	if (code === 1 || code === 2) return "⛅";
	return isDay ? "☀" : "☾";
}

/** The forecast slots the strip shows: from the current hour, up to 24. */
function stripSlots(): ForecastHour[] {
	const forecast = sky.forecast();
	if (forecast.length === 0) return [];
	const off = sky.utcOffsetSeconds() ?? -new Date().getTimezoneOffset() * 60;
	const nowSlotISO = `${isoInUtcOffset(new Date(), off).slice(0, 13)}:00`;
	const start = forecast.findIndex((slot) => slot.timeISO >= nowSlotISO);
	if (start === -1) return [];
	return forecast.slice(start, start + 24);
}

/** Memo of what the strip currently shows: window start + slot count +
 *  location, so a pin to a same-timezone city still re-renders. */
let stripMemo = "";

/** Temperature curve + sunrise/sunset marks overlaid on the cell track. */
function buildStripOverlays(track: HTMLDivElement, slots: ForecastHour[]): void {
	const temps = slots.map((s) => s.temperatureC);
	const lo = Math.min(...temps);
	const hi = Math.max(...temps);
	const span = Math.max(2, hi - lo);
	const w = slots.length * 10;
	// y: 16 (warmest) .. 46 (coldest) inside a 0..56 box — clears the labels.
	const pts = slots
		.map((s, i) => `${i * 10 + 5},${(16 + ((hi - s.temperatureC) / span) * 30).toFixed(1)}`)
		.join(" ");
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("class", "ds-curve");
	svg.setAttribute("viewBox", `0 0 ${w} 56`);
	svg.setAttribute("preserveAspectRatio", "none");
	svg.setAttribute("aria-hidden", "true");
	const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
	area.setAttribute("d", `M5,46 L${pts.split(" ").join(" L")} L${w - 5},46 Z`);
	const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
	line.setAttribute("points", pts);
	svg.append(area, line);
	track.appendChild(svg);

	const wx = sky.conditions();
	const startH = slots[0].hour;
	const hoursShown = slots.length;
	for (const [hourVal, glyph, cls, label] of [
		[wx?.sunriseH, "☀", "", "Sunrise"],
		[wx?.sunsetH, "☽", "ds-sunmark--set", "Sunset"],
	] as const) {
		if (hourVal == null) continue;
		const offset = (hourVal - startH + 24) % 24;
		if (offset >= hoursShown) continue;
		const mark = document.createElement("div");
		mark.className = `ds-sunmark ${cls}`.trim();
		mark.dataset.glyph = glyph;
		mark.style.left = `${((offset / hoursShown) * 100).toFixed(2)}%`;
		mark.title = `${label} ${formatHour(hourVal)}`;
		track.appendChild(mark);
	}
}

/** Rebuild the cells when the forecast window moves; cheap no-op otherwise. */
function renderStrip(): void {
	const wanted = stripToggle.checked && selectedWx() === null;
	const slots = wanted ? stripSlots() : [];
	if (slots.length < 2) {
		if (!stripEl.hidden) {
			stripEl.hidden = true;
			stripMemo = "";
			if (scrubHour !== null) clearScrub(true);
		}
		return;
	}
	stripEl.hidden = false;
	const loc = sky.location();
	const memo = `${slots[0].timeISO}|${slots.length}|${
		loc ? `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}` : ""
	}`;
	if (memo === stripMemo) return;
	stripMemo = memo;
	stripCellsEl.textContent = "";
	const track = document.createElement("div");
	track.className = "daystrip-track";
	buildStripOverlays(track, slots);
	for (const slot of slots) {
		const h = Math.floor(slot.hour);
		const cell = document.createElement("button");
		cell.type = "button";
		cell.className = "ds-cell";
		cell.dataset.hour = String(h);
		if (
			(slot.weatherCode >= 71 && slot.weatherCode <= 77) ||
			slot.weatherCode === 85 ||
			slot.weatherCode === 86
		) {
			cell.dataset.snow = "1";
		}
		cell.setAttribute("role", "option");
		cell.setAttribute("aria-selected", "false");
		const desc = describeWeather(slot.weatherCode, slot.isDay);
		const pop = slot.precipProbability;
		cell.title = `${h}:00 — ${desc}, ${Math.round(slot.temperatureC)}°${
			pop != null && pop >= 10 ? ` · ${Math.round(pop)}% precip` : ""
		}`;
		cell.innerHTML = `
			<span class="ds-time">${h}:00</span>
			<span class="ds-icon" aria-hidden="true">${iconForCode(slot.weatherCode, slot.isDay)}</span>
			<span class="ds-temp">${Math.round(slot.temperatureC)}°</span>
			<span class="ds-pop" style="--pop:${pop != null ? Math.round(pop) / 100 : 0}" aria-hidden="true"></span>`;
		if (!slot.isDay) cell.classList.add("is-night");
		track.appendChild(cell);
	}
	track.querySelector(".ds-cell")?.classList.add("is-now");
	stripCellsEl.appendChild(track);
	syncStripHighlight();
}

/** Mark the cell containing `hour` active (tour progress / scrub pin). */
function highlightStripHour(hour: number | null): void {
	const cells = stripCellsEl.querySelectorAll<HTMLElement>(".ds-cell");
	const target = hour === null ? null : String(((Math.floor(hour) % 24) + 24) % 24);
	for (const cell of cells) {
		const on = target !== null && cell.dataset.hour === target;
		// Keep the tour / pinned hour in view on a narrow strip.
		if (on && !cell.classList.contains("is-active")) {
			cell.scrollIntoView({ block: "nearest", inline: "nearest" });
		}
		cell.classList.toggle("is-active", on);
		cell.setAttribute("aria-selected", on ? "true" : "false");
	}
}

function syncStripHighlight(): void {
	if (tourRaf !== 0) highlightStripHour(tourHour);
	else highlightStripHour(scrubHour);
}

/** Pin the sky to a forecast hour picked on the strip or a moment button. */
function setScrub(hour: number): void {
	if (tourRaf !== 0) stopTour();
	scrubHour = hour;
	sky.setTime(() => dateAtHour(hour));
	if (selectedWx() === null) sky.setForecastHour(hour);
	syncStripHighlight();
	updateClock();
	updateWx();
	updateStatus();
}

/** Return to live time/weather. */
function clearScrub(_reapply: boolean): void {
	if (scrubHour === null) return;
	scrubHour = null;
	sky.setForecastHour(null);
	sky.setTime();
	syncStripHighlight();
	updateClock();
	updateStatus();
}

stripCellsEl.addEventListener("click", (e) => {
	const cell = (e.target as HTMLElement).closest<HTMLElement>(".ds-cell");
	if (!cell) return;
	const h = Number(cell.dataset.hour);
	if (!Number.isFinite(h)) return;
	// A drag that just ended already pinned the hour under the finger; its
	// trailing click is part of the scrub, not a second tap that would unpin it.
	if (stripScrubbed) {
		stripScrubbed = false;
		return;
	}
	if (scrubHour !== null && Math.floor(scrubHour) === h) clearScrub(true);
	else setScrub(h);
});

// ←/→ step through the hours, as a horizontal listbox should.
stripCellsEl.addEventListener("keydown", (e) => {
	if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
	const cell = (e.target as HTMLElement).closest<HTMLElement>(".ds-cell");
	const next = (
		e.key === "ArrowLeft" ? cell?.previousElementSibling : cell?.nextElementSibling
	) as HTMLElement | null;
	if (!next?.classList.contains("ds-cell")) return;
	e.preventDefault();
	next.focus();
	setScrub(Number(next.dataset.hour));
});

// Drag across the strip to sweep the day — mobile-friendly scrubbing. A tap and
// a drag both start with a pointerdown, so only scrub once the finger actually
// travels a few pixels; otherwise a tap's natural jitter (Android fires tiny
// pointermoves even for a still finger) would select the hour and the trailing
// click would immediately unpin it.
const SCRUB_THRESHOLD_PX = 6;
let stripDragging = false;
let stripScrubbed = false;
let stripDragStart: { x: number; y: number } | null = null;
stripCellsEl.addEventListener("pointerdown", (e) => {
	if (e.pointerType === "mouse" && e.buttons !== 1) return;
	stripDragging = true;
	stripScrubbed = false;
	stripDragStart = { x: e.clientX, y: e.clientY };
});
window.addEventListener("pointerup", () => {
	stripDragging = false;
	stripDragStart = null;
});
window.addEventListener("pointercancel", () => {
	stripDragging = false;
	stripDragStart = null;
});
stripCellsEl.addEventListener("pointermove", (e) => {
	if (!stripDragging) return;
	if (!stripScrubbed && stripDragStart) {
		const dx = e.clientX - stripDragStart.x;
		const dy = e.clientY - stripDragStart.y;
		if (Math.hypot(dx, dy) < SCRUB_THRESHOLD_PX) return;
		stripScrubbed = true;
	}
	const cell = document
		.elementFromPoint(e.clientX, e.clientY)
		?.closest<HTMLElement>(".ds-cell");
	if (!cell) return;
	const h = Number(cell.dataset.hour);
	if (Number.isFinite(h) && (scrubHour === null || Math.floor(scrubHour) !== h)) {
		setScrub(h);
	}
});

stripToggle.addEventListener("change", () => {
	if (!stripToggle.checked && scrubHour !== null) clearScrub(true);
	renderStrip();
	updateStatus();
});

// ── Moments: one click to the sky worth seeing ─────────────────────────

momentGoldenBtn.addEventListener("click", () => {
	const sunset = sky.conditions()?.sunsetH ?? 19;
	setScrub(Math.max(0, sunset - 0.5));
});

momentNightBtn.addEventListener("click", () => {
	// 1:00 local — reliably dark, and the forecast pin keeps it honest.
	setScrub(1);
});

for (const radio of eclipseRadios) {
	radio.addEventListener("change", () => {
		applyEclipse();
		updateStatus();
	});
}

// ── Shareable URLs ─────────────────────────────────────────────────────

function syncUrl(): void {
	const p = new URLSearchParams();
	if (!zaurToggle.checked) p.set("zaur", "0");
	if (!terrainToggle.checked) p.set("terrain", "0");
	if (satellitesToggle.checked) {
		p.set("iss", "1");
		if (!satDemoToggle.checked) p.set("pass", "0");
	}
	if (gridToggle.checked) p.set("grid", "1");
	if (!birdsToggle.checked) p.set("birds", "0");
	if (!batsToggle.checked) p.set("bats", "0");
	if (!firefliesToggle.checked) p.set("fly", "0");
	if (!stripToggle.checked) p.set("strip", "0");
	const wx = selectedWx();
	if (wx) p.set("wx", wx);
	const q = selectedQuality();
	if (q !== "auto") p.set("q", q);
	const eclipseMode = selectedEclipse();
	if (eclipseMode !== "none") p.set("eclipse", eclipseMode);
	if (scrubHour !== null) p.set("h", String(Math.round(scrubHour * 100) / 100));
	if (document.body.dataset.ui === "full") p.set("ui", "1");
	if (manualLocation && manualGeo) {
		p.set("lat", String(Math.round(manualGeo.lat * 100) / 100));
		p.set("lon", String(Math.round(manualGeo.lon * 100) / 100));
		if (manualGeo.city) p.set("city", manualGeo.city);
	}
	const search = p.toString() ? `?${p.toString()}` : "";
	if (location.search !== search) {
		history.replaceState(null, "", search || location.pathname);
	}
}

// ── Location popover: the place name is the single entry point ─────────

function locPopOpen(): boolean {
	return !locPop.hidden;
}

function openLocPop(): void {
	locPop.hidden = false;
	placeBtn.setAttribute("aria-expanded", "true");
	syncLocChrome();
	// On touch, focusing the input would throw the keyboard over the sky before
	// the visitor has chosen between search, a preset and GPS.
	(matchMedia("(pointer: coarse)").matches ? locateBtn : cityInput).focus();
}

function closeLocPop(): void {
	locPop.hidden = true;
	placeBtn.setAttribute("aria-expanded", "false");
}

placeBtn.addEventListener("click", () => {
	if (locPopOpen()) closeLocPop();
	else openLocPop();
});

document.addEventListener("pointerdown", (e) => {
	if (!locPopOpen()) return;
	const t = e.target as Element;
	if (!locPop.contains(t) && t !== placeBtn && !placeBtn.contains(t)) closeLocPop();
});

function syncLocateHint(): void {
	const hint = sky.locationHint();
	placeBtn.classList.toggle("place--hint", !!hint && !manualLocation);
	placeBtn.title = hint ?? "Change location";
}

function syncLocChrome(): void {
	locClearBtn.hidden = !manualLocation;
	const city = sky.city();
	const src = sky.locationSource();
	if (manualLocation && city) locHint.textContent = `Pinned · ${city}`;
	else if (src === "gps" && city) locHint.textContent = `GPS · ${city}`;
	else if (src === "ip" && city) locHint.textContent = `Network · ${city}`;
	else locHint.textContent = "GPS / network location.";
	for (const btn of locPresets) {
		const active =
			manualLocation &&
			manualGeo !== null &&
			Math.abs(Number(btn.dataset.lat) - manualGeo.lat) < 0.05 &&
			Math.abs(Number(btn.dataset.lon) - manualGeo.lon) < 0.05;
		btn.classList.toggle("is-active", active);
	}
}

/** Forward-geocode a place name via Open-Meteo (keyless, same provider). */
async function geocodeCity(
	name: string
): Promise<{ lat: number; lon: number; city: string } | null> {
	try {
		const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
		url.searchParams.set("name", name);
		url.searchParams.set("count", "1");
		url.searchParams.set("language", "en");
		url.searchParams.set("format", "json");
		const res = await fetch(url);
		if (!res.ok) return null;
		const data = (await res.json()) as {
			results?: Array<{ latitude?: number; longitude?: number; name?: string }>;
		};
		const hit = data.results?.[0];
		if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) {
			return null;
		}
		return { lat: hit.latitude!, lon: hit.longitude!, city: hit.name || name };
	} catch {
		return null;
	}
}

async function pinLocation(geo: { lat: number; lon: number; city?: string }): Promise<void> {
	locApplyBtn.disabled = true;
	locHint.textContent = "Updating location…";
	try {
		const g = await sky.setGeo(geo);
		manualLocation = !!g;
		manualGeo = g ? { lat: g.lat, lon: g.lon, city: geo.city ?? sky.city() ?? undefined } : null;
		if (!g) locHint.textContent = "Could not apply that location";
		updatePlace(sky.atmosphere());
		syncLocChrome();
		syncLocateHint();
		updateStatus();
	} finally {
		locApplyBtn.disabled = false;
	}
}

async function searchCity(): Promise<void> {
	const name = cityInput.value.trim();
	if (!name) return;
	locApplyBtn.disabled = true;
	locHint.textContent = `Finding ${name}…`;
	const found = await geocodeCity(name);
	locApplyBtn.disabled = false;
	if (!found) {
		locHint.textContent = `Couldn't find “${name}”`;
		return;
	}
	cityInput.value = found.city;
	await pinLocation(found);
}

async function clearManualLocation(): Promise<void> {
	locClearBtn.hidden = true;
	locHint.textContent = "Returning to auto location…";
	manualLocation = false;
	manualGeo = null;
	await sky.setGeo(null);
	cityInput.value = "";
	updatePlace(sky.atmosphere());
	syncLocChrome();
	syncLocateHint();
	updateStatus();
}

locateBtn.addEventListener("click", async () => {
	locateBtn.disabled = true;
	const prev = locateBtn.textContent;
	locateBtn.textContent = "Locating…";
	try {
		const g = await sky.relocate();
		manualLocation = false;
		manualGeo = null;
		if (g) {
			const city = sky.city();
			locHint.textContent = city ? `Located · ${city}` : "Location updated";
			updatePlace(sky.atmosphere());
		} else {
			locHint.textContent = "Location denied — sky follows the network estimate";
		}
		syncLocChrome();
		syncLocateHint();
		updateStatus();
	} finally {
		locateBtn.disabled = false;
		locateBtn.textContent = prev;
	}
});

locApplyBtn.addEventListener("click", () => void searchCity());
locClearBtn.addEventListener("click", () => void clearManualLocation());
cityInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		e.preventDefault();
		void searchCity();
	}
});

for (const btn of locPresets) {
	btn.addEventListener("click", () => {
		cityInput.value = btn.dataset.city ?? "";
		void pinLocation({
			lat: Number(btn.dataset.lat),
			lon: Number(btn.dataset.lon),
			city: btn.dataset.city,
		});
	});
}

// ── Status line + control wiring ───────────────────────────────────────

function updateStatus(): void {
	updateClock();
	updateWx();
	syncLocateHint();
	renderStrip();
	syncLiveBtn();
	if (tourRaf !== 0) return;

	const parts: string[] = [];
	if (scrubHour !== null) {
		parts.push(`Pinned to ${formatHour(scrubHour)} forecast — Esc for live`);
	}
	const locHintText = sky.locationHint();
	if (locHintText && !manualLocation) parts.push(locHintText);

	const city = sky.city();
	const src = sky.locationSource();
	if (city && (src === "gps" || src === "fixed" || src === "ip")) {
		const tag = src === "fixed" ? "pinned" : src === "gps" ? "GPS" : "network";
		parts.push(`${city} · ${tag}`);
	}

	if (terrainToggle.checked) {
		const t = sky.terrainProfile();
		parts.push(t ? `Terrain: ${terrainLabel(t)}` : "Terrain: loading…");
	}

	if (satellitesToggle.checked) {
		if (satDemoToggle.checked) parts.push("ISS: sample pass ~12 s, then ~7 min");
		else parts.push("ISS: real passes only");
	}

	const wxPreview = selectedWx();
	if (wxPreview) parts.push(`Weather: ${wxPreview} preview`);

	const eclipse = selectedEclipse();
	if (eclipse !== "none") parts.push(`Eclipse: ${eclipse}`);

	const atm = sky.atmosphere();
	if (atm.moments.length) parts.push(atm.moments.join(", "));
	else if (atm.mood === "golden") parts.push("Golden hour");

	if (!zaurToggle.checked) parts.push("Zaur: away");
	if (!birdsToggle.checked) parts.push("Birds: off");
	if (!batsToggle.checked) parts.push("Bats: off");

	if (!firefliesToggle.checked) {
		parts.push("Fireflies: off");
	} else {
		const h = effectiveHour();
		const inWindow = h >= 19.5 || h < 3;
		const wx = sky.conditions();
		if (wx && wx.temperatureC < 12) parts.push("Fireflies: too cold to fly tonight");
		else if (!inWindow) parts.push("Fireflies: appear after dusk — try Night on the strip");
	}

	if (selectedQuality() === "low") parts.push("Quality: low (grid off, ½ particles)");

	statusEl.textContent = parts.length ? parts.join(" · ") : "Live sky — no overrides";
	syncUrl();
}

zaurToggle.addEventListener("change", () => {
	syncZaur();
	updateStatus();
});

terrainToggle.addEventListener("change", () => {
	sky.setTerrain(terrainToggle.checked);
	updateStatus();
});

satellitesToggle.addEventListener("change", () => {
	sky.setSatellites(satellitesToggle.checked);
	syncSatDemoRow();
	sky.setSatelliteDemo(satDemoToggle.checked);
	updateStatus();
});

satDemoToggle.addEventListener("change", () => {
	sky.setSatelliteDemo(satDemoToggle.checked);
	updateStatus();
});

gridToggle.addEventListener("change", () => {
	sky.setGrid(gridToggle.checked);
	updateStatus();
});

captureBtn.addEventListener("click", () => {
	const moment = sky.captureMoment();
	const a = document.createElement("a");
	a.href = moment.dataUrl;
	const safe = moment.caption
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 48);
	a.download = `zaur-world-${safe || "moment"}.png`;
	a.click();
	statusEl.textContent = moment.caption;
});

// ── Minimal UI toggle ──────────────────────────────────────────────────

function syncUiToggle(): void {
	const full = document.body.dataset.ui === "full";
	uiToggle.setAttribute("aria-expanded", String(full));
	uiToggle.setAttribute("aria-label", full ? "Hide controls" : "Show controls");
	uiToggle.title = full ? "Hide controls" : "Show controls";
}

uiToggle.addEventListener("click", () => {
	const full = document.body.dataset.ui !== "full";
	document.body.dataset.ui = full ? "full" : "min";
	localStorage.setItem("zw-ui", full ? "full" : "min");
	syncUiToggle();
	syncUrl();
});

shareBtn.addEventListener("click", async () => {
	syncUrl(); // make sure the address bar reflects the current scene
	const url = location.href;
	if (navigator.share) {
		try {
			await navigator.share({ title: document.title, url });
			return;
		} catch {
			// cancelled or unsupported target — fall through to clipboard
		}
	}
	try {
		await navigator.clipboard.writeText(url);
		statusEl.textContent = "Link copied — this exact scene, shareable";
	} catch {
		statusEl.textContent = url;
	}
});

birdsToggle.addEventListener("change", () => {
	sky.setBirds(birdsToggle.checked);
	updateStatus();
});

batsToggle.addEventListener("change", () => {
	sky.setBats(batsToggle.checked);
	updateStatus();
});

firefliesToggle.addEventListener("change", () => {
	sky.setFireflies(firefliesToggle.checked);
	updateStatus();
});

for (const radio of wxRadios) {
	radio.addEventListener("change", () => {
		if (!radio.checked) return;
		clearScrub(true);
		sky.setWeatherPreview(selectedWx());
		renderStrip();
		updateStatus();
	});
}

for (const radio of qualityRadios) {
	radio.addEventListener("change", () => {
		if (!radio.checked) return;
		sky.setQuality(selectedQuality());
		syncGridRow();
		updateStatus();
	});
}

// ── Boot ───────────────────────────────────────────────────────────────

syncSatDemoRow();
syncGridRow();
sky.setGrid(gridToggle.checked);
sky.setWeatherPreview(selectedWx());
applyEclipse();
syncZaur();
syncUiToggle();
if (Number.isFinite(hParam) && hParam >= 0 && hParam < 24) setScrub(hParam);
updateStatus();

// A pinned location persists across visits — restore the popover state once
// the client settles on a source (URL params above override via pinLocation).
const restorePin = window.setInterval(() => {
	const src = sky.locationSource();
	if (!src) return;
	window.clearInterval(restorePin);
	if (src === "fixed" && !manualLocation) {
		manualLocation = true;
		const loc = sky.location();
		if (loc) manualGeo = { lat: loc.lat, lon: loc.lon, city: sky.city() ?? undefined };
		syncLocChrome();
		syncLocateHint();
	}
}, 300);

// Shareable ?lat=&lon=&city= — apply after mount so weather + terrain refresh.
if (Number.isFinite(latParam) && Number.isFinite(lonParam) && params.has("lat")) {
	if (cityParam) cityInput.value = cityParam;
	void pinLocation({ lat: latParam, lon: lonParam, city: cityParam ?? undefined });
}

window.setInterval(updateStatus, 2000);
window.setInterval(updateClock, 1000);

// Offline shell. Dev is left alone so Vite's HMR is never served from cache.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		void navigator.serviceWorker.register("/sw.js").catch(() => {
			/* unsupported or blocked (private mode, no HTTPS) — the sky still works */
		});
	});
}
