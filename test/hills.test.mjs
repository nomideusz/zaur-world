import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hillPath, generateBolt } from "../dist/hills.js";

describe("hillPath", () => {
	it("is deterministic and spans the width", () => {
		const a = hillPath(7331, 500, 40, 22, 1200);
		assert.deepEqual(a, hillPath(7331, 500, 40, 22, 1200));
		assert.equal(a[0][0], 0);
		assert.ok(a[a.length - 1][0] >= 1200);
	});

	it("ridged saddles stay shallow instead of cutting canyons", () => {
		const pts = hillPath(2718, 500, 40, 34, 1200, true);
		const ys = pts.map(([, y]) => y);
		const rise = 500 - Math.min(...ys);
		const drop = Math.max(...ys) - 500;
		// Uncompressed, the fold's valleys run ~3× deeper than its crests rise.
		assert.ok(rise > 0 && drop < rise * 1.5, `rise ${rise} drop ${drop}`);
	});
});

describe("generateBolt", () => {
	it("strikes down from the cloud top and forks into branches", () => {
		const bolt = generateBolt(1000, 800);
		assert.equal(bolt[0][1], 0);
		assert.ok(bolt.some(([x]) => Number.isNaN(x)), "has a branch separator");
		const trunkEnd = bolt[bolt.findIndex(([x]) => Number.isNaN(x)) - 1];
		assert.ok(trunkEnd[1] >= 800 * 0.3);
	});
});
