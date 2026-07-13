import { prefersReducedMotion } from "./motion.js";

export type Quality = "auto" | "low" | "high";

export interface ResolvedQuality {
	/** Cap for devicePixelRatio when sizing the canvas backing store. */
	maxDpr: number;
	/** Draw the foreground dot grid. */
	showGrid: boolean;
	/** Scales rain/snow particle counts. */
	particleScale: number;
	/** Scales rare ambient effects (lightning flash, shooting stars, etc.). */
	ambientEffects: number;
}

const HIGH: ResolvedQuality = {
	maxDpr: 2,
	showGrid: true,
	particleScale: 1,
	ambientEffects: 1,
};

const LOW: ResolvedQuality = {
	maxDpr: 1.5,
	showGrid: false,
	particleScale: 0.5,
	ambientEffects: 0.25,
};

export function resolveQuality(quality: Quality = "auto"): ResolvedQuality {
	if (quality === "high") return { ...HIGH };
	if (quality === "low") return { ...LOW };
	const mobile = typeof window !== "undefined" && window.innerWidth < 768;
	if (prefersReducedMotion() || mobile) return { ...LOW };
	return { ...HIGH };
}
