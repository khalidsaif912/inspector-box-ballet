import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const game = readFileSync("public/game/game.js", "utf8");
const ratioSource = game.match(/function targetPixelRatio\(dpr\)\{([\s\S]*?)\n\}/)?.[1];
if (!ratioSource) throw new Error("Missing resolution calculation");
const ratio = new Function("dpr", ratioSource) as (d: number) => number;

describe("Game rendering resolution", () => {
  it("renders high-density desktops at full density up to 2x", () => {
    expect(ratio(2)).toBe(2);
    expect(ratio(1.5)).toBe(1.5);
  });
  it("keeps 4K panels at their native density", () => {
    expect(ratio(1)).toBe(1);
  });
  it("caps extreme densities at 2 to protect the frame rate", () => {
    expect(ratio(3)).toBe(2);
    expect(ratio(4)).toBe(2);
  });
  it("never drops below 1 or trusts a missing density", () => {
    expect(ratio(0)).toBe(1);
    expect(ratio(undefined as unknown as number)).toBe(1);
  });
  it("applies anisotropic filtering through one helper", () => {
    expect(game).toMatch(
      /function applyTextureFiltering\(t\)\{[\s\S]*?t\.anisotropy = maxAnisotropy;[\s\S]*?t\.minFilter = THREE\.LinearMipmapLinearFilter;[\s\S]*?t\.magFilter = THREE\.LinearFilter;/,
    );
  });
  it("does not let three.js write canvas CSS sizes", () => {
    expect(game).toMatch(/R\.setSize\(w, h, false\)/);
  });
});
