import {
	createWorld,
	type Quality,
	type TerrainProfile,
	type WeatherConditions,
	type WorldHandle,
} from "@nomideusz/zaur-world";

const canvas = document.getElementById("sky") as HTMLCanvasElement;
const terrainToggle = document.getElementById("opt-terrain") as HTMLInputElement;
const satellitesToggle = document.getElementById("opt-satellites") as HTMLInputElement;
const satDemoToggle = document.getElementById("opt-sat-demo") as HTMLInputElement;
const satDemoRow = document.getElementById("row-sat-demo") as HTMLDivElement;
const weatherCardToggle = document.getElementById("opt-weather-card") as HTMLInputElement;
const gridToggle = document.getElementById("opt-grid") as HTMLInputElement;
const goldenHourToggle = document.getElementById("opt-golden-hour") as HTMLInputElement;
const goldenOffsetSlider = document.getElementById("opt-golden-offset") as HTMLInputElement;
const goldenOffsetRow = document.getElementById("row-golden-offset") as HTMLDivElement;
const goldenOffsetVal = document.getElementById("golden-offset-val") as HTMLOutputElement;
const firefliesToggle = document.getElementById("opt-fireflies") as HTMLInputElement;
const stormToggle = document.getElementById("opt-storm") as HTMLInputElement;
const qualityRadios = document.querySelectorAll(
	'input[name="quality"]'
) as NodeListOf<HTMLInputElement>;
const statusEl = document.getElementById("extras-status") as HTMLParagraphElement;

const sky: WorldHandle = createWorld(canvas, {
	weatherCardParent: document.body,
	weatherCard: { parent: document.body, position: "top-right" },
	gridColor: "rgba(232, 228, 216, 0.1)",
	terrain: terrainToggle.checked,
	satellites: satellitesToggle.checked,
	satelliteDemo: satDemoToggle.checked,
	fireflies: firefliesToggle.checked,
});

function terrainLabel(t: TerrainProfile): string {
	if (t.coastal) return `coast · ${Math.round(t.relief)} m relief`;
	if (t.relief > 550) return `alpine · ${Math.round(t.relief)} m relief`;
	if (t.relief > 250) return `hilly · ${Math.round(t.relief)} m relief`;
	return `plains · ${Math.round(t.relief)} m relief`;
}

function goldenHourTime(wx: WeatherConditions | null): Date {
	const sunset = wx?.sunsetH ?? 19;
	const offsetMin = Number(goldenOffsetSlider.value) / 60;
	const h = Math.max(0, sunset - offsetMin);
	const d = new Date();
	d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
	return d;
}

function selectedQuality(): Quality {
	for (const radio of qualityRadios) {
		if (radio.checked) return radio.value as Quality;
	}
	return "auto";
}

function syncSatDemoRow(): void {
	const on = satellitesToggle.checked;
	satDemoRow.classList.toggle("control-row--disabled", !on);
	satDemoToggle.disabled = !on;
}

function syncGoldenOffsetRow(): void {
	const on = goldenHourToggle.checked;
	goldenOffsetRow.classList.toggle("slider-row--disabled", !on);
	goldenOffsetSlider.disabled = !on;
}

function updateGoldenOffsetLabel(): void {
	goldenOffsetVal.textContent = `${goldenOffsetSlider.value} min`;
}

function applyGoldenHour(): void {
	if (goldenHourToggle.checked) {
		sky.setTime(() => goldenHourTime(sky.conditions()));
		return;
	}
	sky.setTime();
}

function updateStatus(): void {
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

	if (goldenHourToggle.checked) {
		const wx = sky.conditions();
		const offsetMin = Number(goldenOffsetSlider.value);
		const h = (wx?.sunsetH ?? 19) - offsetMin / 60;
		const hh = Math.floor(h);
		const mm = String(Math.round((h % 1) * 60)).padStart(2, "0");
		parts.push(`Time: ${hh}:${mm} (−${offsetMin} min)`);
	}

	if (stormToggle.checked) parts.push("Weather: storm preview");
	if (!firefliesToggle.checked) parts.push("Fireflies: off");

	statusEl.textContent = parts.length
		? parts.join(" · ")
		: "Live sky — no overrides active";
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
});

gridToggle.addEventListener("change", () => {
	sky.setGrid(gridToggle.checked);
});

goldenHourToggle.addEventListener("change", () => {
	syncGoldenOffsetRow();
	applyGoldenHour();
	updateStatus();
});

goldenOffsetSlider.addEventListener("input", () => {
	updateGoldenOffsetLabel();
	if (goldenHourToggle.checked) applyGoldenHour();
	updateStatus();
});

firefliesToggle.addEventListener("change", () => {
	sky.setFireflies(firefliesToggle.checked);
	updateStatus();
});

stormToggle.addEventListener("change", () => {
	sky.setStormPreview(stormToggle.checked);
	updateStatus();
});

for (const radio of qualityRadios) {
	radio.addEventListener("change", () => {
		if (radio.checked) sky.setQuality(selectedQuality());
	});
}

syncSatDemoRow();
syncGoldenOffsetRow();
updateGoldenOffsetLabel();
sky.setWeatherCard(weatherCardToggle.checked);
sky.setGrid(gridToggle.checked);
updateStatus();
window.setInterval(updateStatus, 2000);
