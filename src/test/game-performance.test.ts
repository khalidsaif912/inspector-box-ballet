import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const game = readFileSync("public/game/game.js", "utf8");
const ratioSource = game.match(
  /function renderPixelRatio\(width, height, dpr\)\{([\s\S]*?)\n\}/,
)?.[1];
if (!ratioSource) throw new Error("Missing resolution calculation");
const ratio = new Function("width", "height", "dpr", ratioSource) as (
  w: number,
  h: number,
  d: number,
) => number;

describe("Game rendering budget", () => {
  it("keeps a high-density desktop within the pixel budget", () => {
    const scale = ratio(1920, 1080, 2);
    expect(1920 * 1080 * scale * scale).toBeLessThanOrEqual(2600001);
  });
  it("never increases a standard-density display above its native resolution", () => {
    expect(ratio(1280, 720, 1)).toBe(1);
  });
  it("caps the pixel ratio at 2 on very dense small screens", () => {
    expect(ratio(400, 800, 3)).toBe(2);
  });
});
