import { useEffect, useRef, type RefObject } from "react";
import { createWorld, type CreateWorldOptions, type WorldHandle } from "./index.js";

export interface UseZaurWorldResult {
	canvasRef: RefObject<HTMLCanvasElement | null>;
}

/**
 * React hook — mounts the living sky on a canvas ref and cleans up on unmount.
 * Pass the same options you would to `createWorld`.
 */
export function useZaurWorld(opts: CreateWorldOptions = {}): UseZaurWorldResult {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const handleRef = useRef<WorldHandle | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const sky = createWorld(canvas, opts);
		handleRef.current = sky;
		return () => {
			sky.destroy();
			handleRef.current = null;
		};
		// Mount once; option changes require a remounted component or key.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return { canvasRef };
}

export type { CreateWorldOptions, WorldHandle };
