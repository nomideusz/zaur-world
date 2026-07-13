import { useEffect, useRef, type RefObject } from "react";
import { createWorld, type CreateWorldOptions, type WorldHandle } from "./index.js";

export interface UseZaurWorldResult {
	canvasRef: RefObject<HTMLCanvasElement | null>;
	/** Imperative handle — null until mount, cleared on unmount. */
	worldRef: RefObject<WorldHandle | null>;
}

/**
 * React hook — mounts the living sky on a canvas ref and cleans up on unmount.
 * Pass the same options you would to `createWorld`.
 *
 * Options are applied once at mount. To change them later, use the setters on
 * `worldRef.current` (`setTerrain`, `setQuality`, `preview`, …) or remount
 * with a new `key`.
 */
export function useZaurWorld(opts: CreateWorldOptions = {}): UseZaurWorldResult {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const worldRef = useRef<WorldHandle | null>(null);
	const optsRef = useRef(opts);
	optsRef.current = opts;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const sky = createWorld(canvas, optsRef.current);
		worldRef.current = sky;
		return () => {
			sky.destroy();
			worldRef.current = null;
		};
	}, []);

	return { canvasRef, worldRef };
}

export type { CreateWorldOptions, WorldHandle };
