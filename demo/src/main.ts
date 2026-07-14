import {
	createWorld,
	describeWeather,
	formatAtmosphereCaption,
	type AtmosphereSnapshot,
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
const placeEl = document.getElementById("sky-place") as HTMLParagraphElement;
const intensitySlider = document.getElementById("opt-intensity") as HTMLInputElement;
const intensityVal = document.getElementById("intensity-val") as HTMLOutputElement;
const tempSlider = document.getElementById("opt-temp") as HTMLInputElement;
const tempVal = document.getElementById("temp-val") as HTMLOutputElement;
const windSlider = document.getElementById("opt-wind") as HTMLInputElement;
const windVal = document.getElementById("wind-val") as HTMLOutputElement;
const climateResetBtn = document.getElementById("btn-climate-reset") as HTMLButtonElement;
const climateHint = document.getElementById("climate-hint") as HTMLParagraphElement;

type ClimateKey = "intensity" | "temperatureC" | "windSpeed";
const climateLocks = new Set<ClimateKey>();

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

const sky: WorldHandle = createWorld(canvas, {
	weatherCard: { parent: document.body, position: "top-right" },
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
	const mode = timeMode();
	if (mode === "golden") return goldenHour(sky.conditions());
	if (mode === "custom") return Number(customHourSlider.value);
	const d = new Date();
	return d.getHours() + d.getMinutes() / 60;
}

function updateTimeLabels(): void {
	goldenOffsetVal.textContent = `−${goldenOffsetSlider.value}m`;
	customHourVal.textContent = formatHour(Number(customHourSlider.value));
}

function applyTime(): void {
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

function updateClock(): void {
	const h = tourRaf !== 0 ? tourHour : effectiveHour();
	const label = formatHour(h);
	if (clockEl.textContent !== label) clockEl.textContent = label;
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
	sky.setForecastHour(null);
	applyTime();
	updateStatus();
}

function startTour(): void {
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
		updateClock();
		statusEl.textContent = tourStatus();
		tourRaf = requestAnimationFrame(step);
	};
	tourRaf = requestAnimationFrame(step);
}

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
	const search = p.toString() ? `?${p.toString()}` : "";
	if (location.search !== search) {
		history.replaceState(null, "", search || location.pathname);
	}
}

function updateStatus(): void {
	updateClock();
	mirrorClimateFromSky();
	if (tourRaf !== 0) return;

	const parts: string[] = [];

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
		syncTimeRows();
		applyTime();
		updateStatus();
	});
}

goldenOffsetSlider.addEventListener("input", () => {
	stopTour();
	updateTimeLabels();
	applyTime();
	updateStatus();
});

customHourSlider.addEventListener("input", () => {
	stopTour();
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
		sky.setWeatherPreview(selectedWx());
		if (precipPreview()) bindPrecipIntensity();
		else {
			applyClimate();
			mirrorClimateFromSky();
		}
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
window.setInterval(updateStatus, 2000);
window.setInterval(updateClock, 1000);
