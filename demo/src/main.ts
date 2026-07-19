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
	type WeatherConditions,
	type WeatherOverride,
	type WeatherPreview,
	type WorldHandle,
} from "@nomideusz/zaur-world";

const canvas = document.getElementById("sky") as HTMLCanvasElement;
const terrainToggle = document.getElementById("opt-terrain") as HTMLInputElement;
const satellitesToggle = document.getElementById("opt-satellites") as HTMLInputElement;
const satDemoToggle = document.getElementById("opt-sat-demo") as HTMLInputElement;
const satDemoRow = document.getElementById("row-sat-demo") as HTMLDivElement;
const weatherCardToggle = document.getElementById("opt-weather-card") as HTMLInputElement;
const gridToggle = document.getElementById("opt-grid") as HTMLInputElement;
const gridRow = document.getElementById("row-grid") as HTMLDivElement;
const timeModeRadios = document.querySelectorAll(
	'input[name="time-mode"]'
) as NodeListOf<HTMLInputElement>;
const goldenOffsetSlider = document.getElementById("opt-golden-offset") as HTMLInputElement;
const goldenOffsetRow = document.getElementById("row-golden-offset") as HTMLDivElement;
const goldenOffsetVal = document.getElementById("golden-offset-val") as HTMLOutputElement;
const customHourSlider = document.getElementById("opt-custom-hour") as HTMLInputElement;
const customHourRow = document.getElementById("row-custom-hour") as HTMLDivElement;
const customHourVal = document.getElementById("custom-hour-val") as HTMLOutputElement;
const timeHint = document.getElementById("row-time-hint") as HTMLParagraphElement;
const captureBtn = document.getElementById("btn-capture") as HTMLButtonElement;
const tourBtn = document.getElementById("btn-tour") as HTMLButtonElement;
const locateBtn = document.getElementById("btn-locate") as HTMLButtonElement;
const birdsToggle = document.getElementById("opt-birds") as HTMLInputElement;
const batsToggle = document.getElementById("opt-bats") as HTMLInputElement;
const firefliesToggle = document.getElementById("opt-fireflies") as HTMLInputElement;
const wxRadios = document.querySelectorAll(
	'input[name="wx"]'
) as NodeListOf<HTMLInputElement>;
const qualityRadios = document.querySelectorAll(
	'input[name="quality"]'
) as NodeListOf<HTMLInputElement>;
const statusEl = document.getElementById("extras-status") as HTMLParagraphElement;
const clockEl = document.getElementById("sky-clock") as HTMLParagraphElement;
const wxEl = document.getElementById("sky-wx") as HTMLParagraphElement;
const placeEl = document.getElementById("sky-place") as HTMLParagraphElement;
const intensitySlider = document.getElementById("opt-intensity") as HTMLInputElement;
const intensityVal = document.getElementById("intensity-val") as HTMLOutputElement;
const tempSlider = document.getElementById("opt-temp") as HTMLInputElement;
const tempVal = document.getElementById("temp-val") as HTMLOutputElement;
const windSlider = document.getElementById("opt-wind") as HTMLInputElement;
const windVal = document.getElementById("wind-val") as HTMLOutputElement;
const climateResetBtn = document.getElementById("btn-climate-reset") as HTMLButtonElement;
const climateHint = document.getElementById("climate-hint") as HTMLParagraphElement;
const latInput = document.getElementById("opt-lat") as HTMLInputElement;
const lonInput = document.getElementById("opt-lon") as HTMLInputElement;
const cityInput = document.getElementById("opt-city") as HTMLInputElement;
const locApplyBtn = document.getElementById("btn-loc-apply") as HTMLButtonElement;
const locClearBtn = document.getElementById("btn-loc-clear") as HTMLButtonElement;
const locHint = document.getElementById("loc-hint") as HTMLParagraphElement;
const locPresets = document.querySelectorAll(".loc-presets .chip-btn") as NodeListOf<HTMLButtonElement>;
const stripToggle = document.getElementById("opt-strip") as HTMLInputElement;
const stripEl = document.getElementById("daystrip") as HTMLDivElement;
const stripCellsEl = document.getElementById("daystrip-cells") as HTMLDivElement;
const stripLiveBtn = document.getElementById("btn-strip-live") as HTMLButtonElement;

type ClimateKey = "intensity" | "temperatureC" | "windSpeed";
const climateLocks = new Set<ClimateKey>();
/** True while a manual pin (or ?lat=&lon=) is active. */
let manualLocation = false;

function updatePlace(a: AtmosphereSnapshot): void {
	const line = formatAtmosphereCaption(a)
		.split(" · ")
		.filter((part) => !/^\d{1,2}:\d{2}$/.test(part))
		.join(" · ");
	if (placeEl.textContent !== line) placeEl.textContent = line || "Your sky";
}

// Shareable scene URLs — apply query params to the controls before mounting.
const params = new URLSearchParams(location.search);
if (params.get("terrain") === "0") terrainToggle.checked = false;
if (params.get("iss") === "0") satellitesToggle.checked = false;
if (params.get("pass") === "0") satDemoToggle.checked = false;
if (params.get("card") === "0") weatherCardToggle.checked = false;
if (params.get("grid") === "0") gridToggle.checked = false;
if (params.get("birds") === "0") birdsToggle.checked = false;
if (params.get("bats") === "0") batsToggle.checked = false;
if (params.get("fly") === "0") firefliesToggle.checked = false;
if (params.get("strip") === "0") stripToggle.checked = false;
const wxParam = params.get("wx") ?? (params.get("storm") === "1" ? "storm" : null);
if (wxParam && ["storm", "snow", "fog", "overcast"].includes(wxParam)) {
	(document.getElementById(`wx-${wxParam}`) as HTMLInputElement).checked = true;
}
const qParam = params.get("q");
if (qParam === "high" || qParam === "low") {
	(document.getElementById(`qual-${qParam}`) as HTMLInputElement).checked = true;
}
const modeParam = params.get("mode");
if (modeParam === "golden" || modeParam === "custom") {
	(document.getElementById(`time-${modeParam}`) as HTMLInputElement).checked = true;
}
const offParam = params.get("off");
if (offParam) goldenOffsetSlider.value = offParam;
const tParam = params.get("t");
if (tParam) customHourSlider.value = tParam;

if (params.has("int")) {
	intensitySlider.value = params.get("int")!;
	climateLocks.add("intensity");
}
if (params.has("temp")) {
	tempSlider.value = params.get("temp")!;
	climateLocks.add("temperatureC");
}
if (params.has("wind")) {
	windSlider.value = params.get("wind")!;
	climateLocks.add("windSpeed");
}
const latParam = params.get("lat");
const lonParam = params.get("lon");
const cityParam = params.get("city");
if (latParam) latInput.value = latParam;
if (lonParam) lonInput.value = lonParam;
if (cityParam) cityInput.value = cityParam;

const sky: WorldHandle = createWorld(canvas, {
	weatherCard: { parent: document.body, position: "top-right" },
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

function goldenHour(wx: WeatherConditions | null): number {
	const sunset = wx?.sunsetH ?? 19;
	return Math.max(0, sunset - Number(goldenOffsetSlider.value) / 60);
}

function formatHour(h: number): string {
	const m = Math.round(h * 60) % (24 * 60);
	return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

function timeMode(): string {
	for (const radio of timeModeRadios) {
		if (radio.checked) return radio.value;
	}
	return "live";
}

function selectedWx(): WeatherPreview | null {
	for (const radio of wxRadios) {
		if (radio.checked && radio.value !== "live") return radio.value as WeatherPreview;
	}
	return null;
}

function selectedQuality(): Quality {
	for (const radio of qualityRadios) {
		if (radio.checked) return radio.value as Quality;
	}
	return "auto";
}

function precipPreview(): boolean {
	const wx = selectedWx();
	return wx === "storm" || wx === "snow";
}

function buildClimateOverride(): WeatherOverride | null {
	if (climateLocks.size === 0) return null;
	const o: WeatherOverride = {};
	if (climateLocks.has("intensity")) o.intensity = Number(intensitySlider.value);
	if (climateLocks.has("temperatureC")) o.temperatureC = Number(tempSlider.value);
	if (climateLocks.has("windSpeed")) o.windSpeed = Number(windSlider.value);
	return Object.keys(o).length ? o : null;
}

function applyClimate(): void {
	sky.setWeatherOverride(buildClimateOverride());
	syncClimateChrome();
}

function syncClimateChrome(): void {
	climateResetBtn.hidden = climateLocks.size === 0;
	climateHint.hidden = climateLocks.size > 0;
	intensityVal.textContent = `${Math.round(Number(intensitySlider.value) * 100)}%`;
	tempVal.textContent = `${tempSlider.value}°`;
	windVal.textContent = windSlider.value;
}

/** Mirror unlocked controls from the current (previewed) sky so they stay honest. */
function mirrorClimateFromSky(): void {
	const wx = sky.conditions();
	if (!wx) return;
	if (!climateLocks.has("intensity")) {
		intensitySlider.value = String(Math.round(wx.intensity * 20) / 20);
	}
	if (!climateLocks.has("temperatureC")) {
		tempSlider.value = String(Math.round(wx.temperatureC));
	}
	if (!climateLocks.has("windSpeed")) {
		windSlider.value = String(Math.round(Math.min(60, Math.max(0, wx.windSpeed))));
	}
	syncClimateChrome();
}

function resetClimate(): void {
	climateLocks.clear();
	applyClimate();
	mirrorClimateFromSky();
	// Storm/Snow re-bind intensity so the slider keeps working.
	if (precipPreview()) bindPrecipIntensity();
	updateStatus();
}

/** Seed intensity from the weather preset, then lock so the slider drives drops. */
function bindPrecipIntensity(): void {
	climateLocks.delete("intensity");
	applyClimate();
	mirrorClimateFromSky();
	climateLocks.add("intensity");
	applyClimate();
}

function lockClimate(key: ClimateKey): void {
	climateLocks.add(key);
	applyClimate();
	updateStatus();
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

function syncTimeRows(): void {
	const mode = timeMode();
	timeHint.hidden = mode !== "live";
	goldenOffsetRow.hidden = mode !== "golden";
	customHourRow.hidden = mode !== "custom";
}

function effectiveHour(): number {
	if (scrubHour !== null) return scrubHour;
	const mode = timeMode();
	if (mode === "golden") return goldenHour(sky.conditions());
	if (mode === "custom") return Number(customHourSlider.value);
	// Forecast-location hour so the 24h tour matches Open-Meteo under VPN.
	return sky.localHour();
}

function updateTimeLabels(): void {
	goldenOffsetVal.textContent = `−${goldenOffsetSlider.value}m`;
	customHourVal.textContent = formatHour(Number(customHourSlider.value));
}

function applyTime(): void {
	if (scrubHour !== null) return; // the day strip owns the clock while scrubbing
	const mode = timeMode();
	if (mode === "golden") {
		sky.setTime(() => dateAtHour(goldenHour(sky.conditions())));
	} else if (mode === "custom") {
		sky.setTime(() => dateAtHour(Number(customHourSlider.value)));
	} else {
		sky.setTime();
	}
}

// 24-hour cinematic tour: full circle starting from the current sky time,
// so both start and end are seamless — no clock jump. In live weather mode
// each hour of the sweep pulls that hour's real forecast, so you watch the
// coming day's weather actually arrive.
const TOUR_SECONDS = 30;
let tourRaf = 0;
let tourHour = 0;
/** Hour pinned from the day strip, or null when the strip is idle. */
let scrubHour: number | null = null;

function updateClock(): void {
	const h = tourRaf !== 0 ? tourHour : effectiveHour();
	const label = formatHour(h);
	if (clockEl.textContent !== label) clockEl.textContent = label;
}

/** Header weather line while touring or scrubbing — forecast beside the clock. */
function updateTourWx(): void {
	const wx = sky.conditions();
	if (!wx || wx.weatherCode == null) {
		wxEl.hidden = true;
		return;
	}
	let s = `${weatherIcon(wx)} ${describeWeather(wx.weatherCode, wx.isDay)} · ${Math.round(
		wx.temperatureC
	)}°`;
	if (wx.precipProbability != null && wx.precipProbability >= 20) {
		s += ` · ${Math.round(wx.precipProbability)}%`;
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
	tourBtn.textContent = "▶ Play 24 hours";
	wxEl.hidden = true;
	sky.setForecastHour(null);
	applyTime();
	syncStripHighlight();
	updateStatus();
}

function startTour(): void {
	clearScrub(false);
	const start = performance.now();
	const from = effectiveHour();
	tourBtn.textContent = "■ Stop tour";
	tourHour = from;
	sky.setTime(() => dateAtHour(tourHour));
	// Storm/Snow/Fog/Gray presets stay in charge; only live weather follows
	// the hourly forecast around the clock.
	const followForecast = selectedWx() === null;
	const step = (now: number): void => {
		const t = (now - start) / 1000 / TOUR_SECONDS;
		if (t >= 1) {
			stopTour();
			return;
		}
		tourHour = (from + t * 24) % 24;
		if (followForecast) sky.setForecastHour(tourHour);
		highlightStripHour(tourHour);
		updateClock();
		updateTourWx();
		statusEl.textContent = tourStatus();
		tourRaf = requestAnimationFrame(step);
	};
	tourRaf = requestAnimationFrame(step);
}

// —— Day strip: the next 24 hours as a scrubbable forecast dock ——————————————

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

let stripStartISO = "";

/** Rebuild the cells when the forecast window moves; cheap no-op otherwise. */
function renderStrip(): void {
	const wanted = stripToggle.checked && selectedWx() === null;
	const slots = wanted ? stripSlots() : [];
	if (slots.length < 2) {
		if (!stripEl.hidden) {
			stripEl.hidden = true;
			stripStartISO = "";
			if (scrubHour !== null) clearScrub(true);
		}
		return;
	}
	stripEl.hidden = false;
	if (slots[0].timeISO === stripStartISO && stripCellsEl.childElementCount === slots.length) {
		return;
	}
	stripStartISO = slots[0].timeISO;
	stripCellsEl.textContent = "";
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
		stripCellsEl.appendChild(cell);
	}
	(stripCellsEl.firstElementChild as HTMLElement | null)?.classList.add("is-now");
	syncStripHighlight();
}

/** Mark the cell containing `hour` active (tour progress / scrub pin). */
function highlightStripHour(hour: number | null): void {
	const cells = stripCellsEl.children;
	const target =
		hour === null ? null : String(((Math.floor(hour) % 24) + 24) % 24);
	for (const cell of cells) {
		const on = target !== null && (cell as HTMLElement).dataset.hour === target;
		cell.classList.toggle("is-active", on);
		cell.setAttribute("aria-selected", on ? "true" : "false");
	}
}

function syncStripHighlight(): void {
	if (tourRaf !== 0) highlightStripHour(tourHour);
	else highlightStripHour(scrubHour);
	stripLiveBtn.hidden = scrubHour === null;
}

/** Pin the sky to a forecast hour picked on the strip. */
function setScrub(hour: number): void {
	if (tourRaf !== 0) stopTour();
	scrubHour = hour;
	sky.setTime(() => dateAtHour(hour));
	if (selectedWx() === null) sky.setForecastHour(hour);
	syncStripHighlight();
	updateClock();
	updateTourWx();
	updateStatus();
}

/** Return to live time/weather. `reapply` restores the selected time mode. */
function clearScrub(reapply: boolean): void {
	if (scrubHour === null) return;
	scrubHour = null;
	sky.setForecastHour(null);
	if (reapply) applyTime();
	wxEl.hidden = true;
	syncStripHighlight();
	updateClock();
	updateStatus();
}

stripCellsEl.addEventListener("click", (e) => {
	const cell = (e.target as HTMLElement).closest<HTMLElement>(".ds-cell");
	if (!cell) return;
	const h = Number(cell.dataset.hour);
	if (!Number.isFinite(h)) return;
	if (scrubHour !== null && Math.floor(scrubHour) === h) clearScrub(true);
	else setScrub(h);
});

// Drag across the strip to sweep the day — mobile-friendly scrubbing.
let stripDragging = false;
stripCellsEl.addEventListener("pointerdown", (e) => {
	if (e.pointerType === "mouse" && e.buttons !== 1) return;
	stripDragging = true;
});
window.addEventListener("pointerup", () => {
	stripDragging = false;
});
stripCellsEl.addEventListener("pointermove", (e) => {
	if (!stripDragging) return;
	const cell = document
		.elementFromPoint(e.clientX, e.clientY)
		?.closest<HTMLElement>(".ds-cell");
	if (!cell) return;
	const h = Number(cell.dataset.hour);
	if (Number.isFinite(h) && (scrubHour === null || Math.floor(scrubHour) !== h)) {
		setScrub(h);
	}
});

stripLiveBtn.addEventListener("click", () => {
	clearScrub(true);
});

window.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && scrubHour !== null) clearScrub(true);
});

stripToggle.addEventListener("change", () => {
	if (!stripToggle.checked && scrubHour !== null) clearScrub(true);
	renderStrip();
	updateStatus();
});

function syncUrl(): void {
	const p = new URLSearchParams();
	if (!terrainToggle.checked) p.set("terrain", "0");
	if (!satellitesToggle.checked) p.set("iss", "0");
	else if (!satDemoToggle.checked) p.set("pass", "0");
	if (!weatherCardToggle.checked) p.set("card", "0");
	if (!gridToggle.checked) p.set("grid", "0");
	if (!birdsToggle.checked) p.set("birds", "0");
	if (!batsToggle.checked) p.set("bats", "0");
	if (!firefliesToggle.checked) p.set("fly", "0");
	if (!stripToggle.checked) p.set("strip", "0");
	const wx = selectedWx();
	if (wx) p.set("wx", wx);
	const q = selectedQuality();
	if (q !== "auto") p.set("q", q);
	const mode = timeMode();
	if (mode === "golden") {
		p.set("mode", "golden");
		p.set("off", goldenOffsetSlider.value);
	} else if (mode === "custom") {
		p.set("mode", "custom");
		p.set("t", customHourSlider.value);
	}
	if (climateLocks.has("intensity")) p.set("int", intensitySlider.value);
	if (climateLocks.has("temperatureC")) p.set("temp", tempSlider.value);
	if (climateLocks.has("windSpeed")) p.set("wind", windSlider.value);
	if (manualLocation) {
		const geo = readManualGeo();
		if (geo) {
			p.set("lat", String(Math.round(geo.lat * 100) / 100));
			p.set("lon", String(Math.round(geo.lon * 100) / 100));
			if (geo.city) p.set("city", geo.city);
		}
	}
	const search = p.toString() ? `?${p.toString()}` : "";
	if (location.search !== search) {
		history.replaceState(null, "", search || location.pathname);
	}
}

function syncLocateHint(): void {
	const hint = sky.locationHint();
	locateBtn.classList.toggle("btn--locate-hint", !!hint && !manualLocation);
	locateBtn.title = hint
		? hint
		: "Use your device location — accurate sky even on a VPN";
}

function syncLocChrome(): void {
	locClearBtn.hidden = !manualLocation;
	const city = sky.city();
	const src = sky.locationSource();
	if (manualLocation && city) {
		locHint.textContent = `Pinned · ${city}`;
	} else if (src === "gps" && city) {
		locHint.textContent = `GPS · ${city}`;
	} else if (src === "ip" && city) {
		locHint.textContent = `Network · ${city}`;
	} else {
		locHint.textContent = "GPS / network, or pin a place for the 24h tour.";
	}
	for (const btn of locPresets) {
		const active =
			manualLocation &&
			Math.abs(Number(btn.dataset.lat) - Number(latInput.value)) < 0.05 &&
			Math.abs(Number(btn.dataset.lon) - Number(lonInput.value)) < 0.05;
		btn.classList.toggle("is-active", active);
	}
}

function readManualGeo(): { lat: number; lon: number; city?: string } | null {
	const lat = Number(latInput.value);
	const lon = Number(lonInput.value);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
	if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
	const city = cityInput.value.trim();
	return city ? { lat, lon, city } : { lat, lon };
}

async function applyManualLocation(): Promise<void> {
	const geo = readManualGeo();
	if (!geo) {
		statusEl.textContent = "Enter valid latitude (−90…90) and longitude (−180…180)";
		return;
	}
	locApplyBtn.disabled = true;
	statusEl.textContent = "Updating location…";
	try {
		const g = await sky.setGeo(geo);
		manualLocation = !!g;
		if (g) {
			const city = sky.city();
			if (city && !cityInput.value.trim()) cityInput.value = city;
			statusEl.textContent = city ? `Pinned · ${city}` : `Pinned · ${g.lat.toFixed(2)}°, ${g.lon.toFixed(2)}°`;
			updatePlace(sky.atmosphere());
		} else {
			statusEl.textContent = "Could not apply that location";
		}
		syncLocChrome();
		syncLocateHint();
		updateStatus();
	} finally {
		locApplyBtn.disabled = false;
	}
}

async function clearManualLocation(): Promise<void> {
	locClearBtn.hidden = true;
	statusEl.textContent = "Returning to auto location…";
	manualLocation = false;
	await sky.setGeo(null);
	const loc = sky.location();
	if (loc) {
		latInput.value = loc.lat.toFixed(2);
		lonInput.value = loc.lon.toFixed(2);
	}
	const city = sky.city();
	cityInput.value = city && city !== "your area" ? city : "";
	updatePlace(sky.atmosphere());
	syncLocChrome();
	syncLocateHint();
	updateStatus();
}

function fillLocFromSky(): void {
	const loc = sky.location();
	if (!loc || manualLocation) return;
	if (!latInput.value) latInput.value = loc.lat.toFixed(2);
	if (!lonInput.value) lonInput.value = loc.lon.toFixed(2);
	if (!cityInput.value) {
		const city = sky.city();
		if (city && city !== "your area") cityInput.value = city;
	}
	syncLocChrome();
}

function updateStatus(): void {
	updateClock();
	mirrorClimateFromSky();
	syncLocateHint();
	syncLocChrome();
	fillLocFromSky();
	renderStrip();
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
		if (satDemoToggle.checked) {
			parts.push("ISS: sample pass ~12 s, then ~7 min");
		} else {
			parts.push("ISS: real passes only");
		}
	}

	const mode = timeMode();
	if (mode === "golden") {
		const h = goldenHour(sky.conditions());
		parts.push(`Time: ${formatHour(h)} (−${goldenOffsetSlider.value} min)`);
	} else if (mode === "custom") {
		parts.push(`Time: ${formatHour(Number(customHourSlider.value))}`);
	}

	const wxPreview = selectedWx();
	if (wxPreview) parts.push(`Weather: ${wxPreview} preview`);

	if (climateLocks.size) {
		const bits: string[] = [];
		if (climateLocks.has("intensity")) {
			bits.push(`${Math.round(Number(intensitySlider.value) * 100)}% precip`);
		}
		if (climateLocks.has("temperatureC")) bits.push(`${tempSlider.value}°C`);
		if (climateLocks.has("windSpeed")) bits.push(`wind ${windSlider.value}`);
		if (bits.length) parts.push(`Climate: ${bits.join(", ")}`);
	}

	const atm = sky.atmosphere();
	if (atm.moments.length) parts.push(atm.moments.join(", "));
	else if (atm.mood === "golden") parts.push("Golden hour");

	if (!birdsToggle.checked) parts.push("Birds: off");
	if (!batsToggle.checked) parts.push("Bats: off");

	if (!firefliesToggle.checked) {
		parts.push("Fireflies: off");
	} else {
		const h = effectiveHour();
		const inWindow = h >= 19.5 || h < 3;
		if (!inWindow) parts.push("Fireflies: appear after dusk — try Custom 22:00");
	}

	if (selectedQuality() === "low") parts.push("Quality: low (grid off, ½ particles)");

	statusEl.textContent = parts.length
		? parts.join(" · ")
		: "Live sky — no overrides";
	syncUrl();
}

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

weatherCardToggle.addEventListener("change", () => {
	sky.setWeatherCard(weatherCardToggle.checked);
	updateStatus();
});

gridToggle.addEventListener("change", () => {
	sky.setGrid(gridToggle.checked);
	updateStatus();
});

for (const radio of timeModeRadios) {
	radio.addEventListener("change", () => {
		stopTour();
		clearScrub(false);
		syncTimeRows();
		applyTime();
		updateStatus();
	});
}

goldenOffsetSlider.addEventListener("input", () => {
	stopTour();
	clearScrub(false);
	updateTimeLabels();
	applyTime();
	updateStatus();
});

customHourSlider.addEventListener("input", () => {
	stopTour();
	clearScrub(false);
	updateTimeLabels();
	applyTime();
	updateStatus();
});

tourBtn.addEventListener("click", () => {
	if (tourRaf !== 0) {
		stopTour();
	} else {
		startTour();
	}
});

locateBtn.addEventListener("click", async () => {
	locateBtn.disabled = true;
	const prev = locateBtn.textContent;
	locateBtn.textContent = "Locating…";
	statusEl.textContent = "Asking for your location…";
	try {
		const g = await sky.relocate();
		manualLocation = false;
		if (g) {
			latInput.value = g.lat.toFixed(2);
			lonInput.value = g.lon.toFixed(2);
			const city = sky.city();
			cityInput.value = city && city !== "your area" ? city : "";
			statusEl.textContent = city
				? `Located · ${city}`
				: `Location updated · ${g.lat.toFixed(2)}°, ${g.lon.toFixed(2)}°`;
			updatePlace(sky.atmosphere());
		} else {
			statusEl.textContent =
				"Location denied or unavailable — sky still follows IP estimate";
		}
		syncLocChrome();
		syncLocateHint();
		updateStatus();
	} finally {
		locateBtn.disabled = false;
		locateBtn.textContent = prev;
	}
});

locApplyBtn.addEventListener("click", () => {
	void applyManualLocation();
});

locClearBtn.addEventListener("click", () => {
	void clearManualLocation();
});

for (const btn of locPresets) {
	btn.addEventListener("click", () => {
		latInput.value = btn.dataset.lat ?? "";
		lonInput.value = btn.dataset.lon ?? "";
		cityInput.value = btn.dataset.city ?? "";
		void applyManualLocation();
	});
}

for (const input of [latInput, lonInput, cityInput]) {
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			void applyManualLocation();
		}
	});
}

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
		if (precipPreview()) bindPrecipIntensity();
		else {
			applyClimate();
			mirrorClimateFromSky();
		}
		renderStrip();
		updateStatus();
	});
}

intensitySlider.addEventListener("input", () => {
	syncClimateChrome();
	lockClimate("intensity");
});

tempSlider.addEventListener("input", () => {
	syncClimateChrome();
	lockClimate("temperatureC");
});

windSlider.addEventListener("input", () => {
	syncClimateChrome();
	lockClimate("windSpeed");
});

climateResetBtn.addEventListener("click", () => {
	resetClimate();
});

for (const radio of qualityRadios) {
	radio.addEventListener("change", () => {
		if (!radio.checked) return;
		sky.setQuality(selectedQuality());
		syncGridRow();
		updateStatus();
	});
}

syncSatDemoRow();
syncGridRow();
syncTimeRows();
updateTimeLabels();
sky.setWeatherCard(weatherCardToggle.checked);
sky.setGrid(gridToggle.checked);
sky.setWeatherPreview(selectedWx());
if (precipPreview()) bindPrecipIntensity();
else applyClimate();
applyTime();
mirrorClimateFromSky();
updateStatus();

// Shareable ?lat=&lon=&city= — apply after mount so weather + terrain refresh.
if (latParam && lonParam && readManualGeo()) {
	void applyManualLocation();
} else {
	window.setTimeout(fillLocFromSky, 1500);
}

window.setInterval(updateStatus, 2000);
window.setInterval(updateClock, 1000);
