// Self-mounting entry for script-tag / CDN use — no build step, no code:
//
//   <script>window.zaurWorldConfig = { terrain: true };</script>
//   <script type="module" src="https://esm.sh/@nomideusz/zaur-world/auto"></script>
//
// Adopts a `canvas[data-zaur-world]` (or the `canvas` selector from the
// config) if present; otherwise mounts a fixed full-viewport canvas behind
// the page. The handle lands on `window.zaurWorld` for later tweaking.

import { createWorld, type CreateWorldOptions, type WorldHandle } from "./index.js";

declare global {
  interface Window {
    zaurWorldConfig?: CreateWorldOptions & { canvas?: string };
    zaurWorld?: WorldHandle;
  }
}

const { canvas: selector, ...opts } = window.zaurWorldConfig ?? {};

let canvas = document.querySelector<HTMLCanvasElement>(
  selector ?? "canvas[data-zaur-world]"
);
if (!canvas) {
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none";
  document.body.appendChild(canvas);
}

window.zaurWorld = createWorld(canvas, opts);
