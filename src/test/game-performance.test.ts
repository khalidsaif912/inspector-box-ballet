import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const game = readFileSync("public/game/game.js", "utf8");
const ratioSource = game.match(/function renderPixelRatio\(dpr\)\{([\s\S]*?)\n\}/)?.[1];
if (!ratioSource) throw new Error("Missing resolution calculation");
const ratio = new Function("width", "height", "dpr", ratioSource) as (
  w: number,
  h: number,
  d: number,
) => number;

describe("Game rendering resolution", () => {
  it("renders high-density desktops at their native density instead of downscaling", () => {
    expect(ratio(1920, 1080, 2)).toBe(2);
    expect(ratio(2560, 1440, 1.5)).toBe(1.5);
  });
  it("renders 4K panels at full native density", () => {
    expect(ratio(3840, 2160, 1)).toBe(1);
    expect(ratio(3840, 2160, 2)).toBe(2);
  });
  it("never drops a standard-density display below its native resolution", () => {
    expect(ratio(1280, 720, 1)).toBe(1);
  });
  it("keeps high-density phone panels sharp", () => {
    expect(ratio(400, 800, 3)).toBe(3);
  });
  it("falls back to 1 when the device reports no density", () => {
    expect(ratio(1280, 720, undefined as unknown as number)).toBe(1);
    expect(ratio(1280, 720, 0)).toBe(1);
  });
});
