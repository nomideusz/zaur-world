import { createWorld, type WorldHandle } from "@nomideusz/zaur-world";

const canvas = document.getElementById("sky") as HTMLCanvasElement;
const terrainToggle = document.getElementById("opt-terrain") as HTMLInputElement;
const satellitesToggle = document.getElementById("opt-satellites") as HTMLInputElement;

let sky: WorldHandle | null = null;

function mount(): void {
	sky?.destroy();
	sky = createWorld(canvas, {
		weatherCardParent: document.body,
		terrain: terrainToggle.checked,
		satellites: satellitesToggle.checked,
	});
}

terrainToggle.addEventListener("change", mount);
satellitesToggle.addEventListener("change", mount);

mount();
