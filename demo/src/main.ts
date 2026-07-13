import {
	createWorld,
	type Quality,
	type TerrainProfile,
	type WeatherConditions,
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
const firefliesToggle = document.getElementById("opt-fireflies") as HTMLInputElement;
const wxRadios = document.querySelectorAll(
	'input[name="wx"]'
) as NodeListOf<HTMLInputElement>;
const qualityRadios = document.querySelectorAll(
	'input[name="quality"]'
) as NodeListOf<HTMLInputElement>;
const statusEl = document.getElementById("extras-status") as HTMLParagraphElement;

// Shareable scene URLs — apply query params to the controls before mounting.
const params = new URLSearchParams(location.search);
if (params.get("terrain") === "0") terrainToggle.checked = false;
if (params.get("iss") === "0") satellitesToggle.checked = false;
if (params.get("pass") === "0") satDemoToggle.checked = false;
if (params.get("card") === "0") weatherCardToggle.checked = false;
if (params.get("grid") === "0") gridToggle.checked = false;
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

const sky: WorldHandle = createWorld(canvas, {
	weatherCardParent: document.body,
	weatherCard: { parent: document.body, position: "top-right" },
	gridColor: "rgba(232, 228, 216, 0.32)",
	terrain: terrainToggle.checked,
	satellites: satellitesToggle.checked,
	satelliteDemo: satDemoToggle.checked,
	fireflies: firefliesToggle.checked,
	quality: selectedQuality(),
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

function syncGridRow(): void {
	const low = selectedQuality() === "low";
	gridRow.classList.toggle("control-row--disabled", low);
	gridToggle.disabled = low;
}

function syncSatDemoRow(): void {
	const on = satellitesToggle.checked;
	satDemoRow.classList.toggle("control-row--disabled", !on);
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
	goldenOffsetVal.textContent = `${goldenOffsetSlider.value} min`;
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
// so both start and end are seamless — no clock jump.
const TOUR_SECONDS = 30;
let tourRaf = 0;
let tourHour = 0;

function stopTour(): void {
	if (tourRaf === 0) return;
	cancelAnimationFrame(tourRaf);
	tourRaf = 0;
	tourBtn.textContent = "▶ Play one day";
	applyTime();
	updateStatus();
}

function startTour(): void {
	const start = performance.now();
	const from = effectiveHour();
	tourBtn.textContent = "■ Stop tour";
	tourHour = from;
	sky.setTime(() => dateAtHour(tourHour));
	const step = (now: number): void => {
		const t = (now - start) / 1000 / TOUR_SECONDS;
		if (t >= 1) {
			stopTour();
			return;
		}
		tourHour = (from + t * 24) % 24;
		statusEl.textContent = `Day tour — ${formatHour(tourHour)}`;
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
	const search = p.toString() ? `?${p.toString()}` : "";
	if (location.search !== search) {
		history.replaceState(null, "", search || location.pathname);
	}
}

function updateStatus(): void {
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
		: "Live sky — no overrides active";
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
	const a = document.createElement("a");
	a.href = sky.capture();
	a.download = "zaur-world.png";
	a.click();
});

firefliesToggle.addEventListener("change", () => {
	sky.setFireflies(firefliesToggle.checked);
	updateStatus();
});

for (const radio of wxRadios) {
	radio.addEventListener("change", () => {
		if (!radio.checked) return;
		sky.setWeatherPreview(selectedWx());
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

syncSatDemoRow();
syncGridRow();
syncTimeRows();
updateTimeLabels();
sky.setWeatherCard(weatherCardToggle.checked);
sky.setGrid(gridToggle.checked);
sky.setWeatherPreview(selectedWx());
applyTime();
updateStatus();
window.setInterval(updateStatus, 2000);
