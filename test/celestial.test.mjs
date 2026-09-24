import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { moonDisc } from "../dist/world-celestial.js";

describe("moonDisc", () => {
	it("is absent by day, low and swollen at moonrise, high and small overhead", () => {
		assert.equal(moonDisc(1200, 675, 12), null);
		const [, riseY, riseR] = moonDisc(1200, 675, 18.6);
		const [midX, topY, topR] = moonDisc(1200, 675, 0);
		assert.ok(riseY > topY && riseR > topR);
		assert.ok(Math.abs(midX - 600) < 1, "midnight sits mid-sky");
	});
});
