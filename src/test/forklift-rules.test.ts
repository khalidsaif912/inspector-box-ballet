import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type ForkliftState = {
  done: boolean;
  turn: number;
  turned: boolean;
};

type Rules = {
  reset(): ForkliftState;
  advance(state: ForkliftState, dt: number, playerZ: number): { drop: boolean; entered: boolean };
  touches(ax: number, az: number, bx: number, bz: number, px: number, pz: number): boolean;
  movementMultiplier(remaining: number): number;
  fearDuration: number;
  turnDuration: number;
  fodZoneX: number;
  speed: number;
  reward(isFod: boolean, zone: string): number;
  forklift: {
    reach: number;
    forkOffset: number;
    carryY: number;
    driveSpeed: number;
    nearest(
      list: { x: number; z: number }[],
      x: number,
      z: number,
    ): { x: number; z: number } | null;
    forkX(x: number, yaw: number): number;
    forkZ(z: number, yaw: number): number;
  };
};

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/game-rules.js", "utf8"), context);
const rules = context["WarehouseRules"] as Rules;

describe("Reckless forklift", () => {
  it("crosses only once per shift", () => {
    const state = rules.reset();
    let entries = 0;
    for (let i = 0; i < 2000; i++) if (rules.advance(state, 0.05, 3).entered) entries++;
    expect(entries).toBe(1);
    expect(state.done).toBe(true);
    expect(rules.reset().done).toBe(false);
  });
  it("makes exactly one full turn and drops one foreign object", () => {
    const state = rules.reset();
    let drops = 0;
    for (let i = 0; i < 1000; i++) if (rules.advance(state, 0.05, 3).drop) drops++;
    expect(state.turn).toBe(rules.turnDuration);
    expect(state.turned).toBe(true);
    expect(drops).toBe(1);
  });
  it("detects collisions along a fast crossing, not just its endpoints", () => {
    expect(rules.touches(-4, 3, 4, 3, 0, 3)).toBe(true);
    expect(rules.touches(-4, 3, 4, 3, 0, 7)).toBe(false);
  });
  it("slows the worker temporarily and restores normal movement", () => {
    expect(rules.movementMultiplier(rules.fearDuration)).toBeLessThan(1);
    expect(rules.movementMultiplier(0)).toBe(1);
  });
  it("places the FOD collection area at its configured position", () => {
    expect(rules.fodZoneX).toBe(4.5);
  });
  it("keeps the reckless crossing slow enough to react", () => {
    expect(rules.speed).toBeLessThanOrEqual(12);
  });
  it("drives the player forklift faster than before", () => {
    expect(rules.forklift.driveSpeed).toBeGreaterThan(9);
    expect(rules.forklift.driveSpeed).toBeLessThan(rules.speed);
  });
  it("awards extra points only for FOD delivered to its own area", () => {
    expect(rules.reward(true, "fod")).toBe(50);
    expect(rules.reward(true, "cold")).toBe(0);
    expect(rules.reward(false, "fod")).toBe(0);
  });
  it("picks the nearest parcel within the fork reach", () => {
    const near = { x: 1, z: 1 };
    const far = { x: 12, z: 12 };
    expect(rules.forklift.nearest([far, near], 0, 0)).toBe(near);
    expect(rules.forklift.nearest([{ x: 20, z: 20 }], 0, 0)).toBe(null);
    expect(rules.forklift.reach).toBeGreaterThan(2);
  });
  it("keeps the carried parcel in front of the forks for any heading", () => {
    expect(rules.forklift.forkX(0, Math.PI / 2)).toBeCloseTo(rules.forklift.forkOffset);
    expect(rules.forklift.forkZ(0, 0)).toBeCloseTo(rules.forklift.forkOffset);
    expect(rules.forklift.forkX(0, Math.PI)).toBeCloseTo(0);
    expect(rules.forklift.carryY).toBeLessThan(1.2);
  });
});
