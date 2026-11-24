import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type ForkliftState = {
  done: boolean;
  trip?: number;
  active?: boolean;
  x?: number;
  lane?: number;
  dz?: number;
  turn: number;
  turned: boolean;
};

type Rules = {
  reset(): ForkliftState;
  advance(
    state: ForkliftState,
    dt: number,
    playerZ: number,
  ): { drop: boolean; entered: boolean; trip: number };
  touches(ax: number, az: number, bx: number, bz: number, px: number, pz: number): boolean;
  movementMultiplier(remaining: number): number;
  dodge(state: ForkliftState, dt: number, obstacles: { x: number; z: number; r: number }[]): number;
  position(state: ForkliftState): { x: number; z: number; yaw: number };
  dodgeClear: number;
  touchRadius: number;
  playerObstacle(x: number, z: number): { x: number; z: number; r: number };
  laneMin: number;
  laneMax: number;
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
  it("crosses exactly three times per shift", () => {
    const state = rules.reset();
    let entries = 0;
    for (let i = 0; i < 6000; i++) if (rules.advance(state, 0.05, 3).entered) entries++;
    expect(entries).toBe(3);
    expect(state.done).toBe(true);
    expect(rules.reset().done).toBe(false);
  });
  it("drops one foreign object per crossing, each of a different kind (trip 0, 1, 2)", () => {
    const state = rules.reset();
    const trips: number[] = [];
    for (let i = 0; i < 6000; i++) {
      const r = rules.advance(state, 0.05, 3);
      if (r.drop) trips.push(r.trip);
    }
    expect(trips).toEqual([0, 1, 2]);
    expect(state.turned).toBe(true);
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
    expect(rules.fodZoneX).toBe(1.7);
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

describe("Reckless forklift dodging", () => {
  const cruising = (x: number, lane: number) => {
    const s = rules.reset();
    Object.assign(s, { active: true, x, lane, turned: true });
    return s;
  };
  const run = (s: ForkliftState, obs: { x: number; z: number; r: number }[], secs = 2) => {
    for (let t = 0; t < secs; t += 0.016) rules.dodge(s, 0.016, obs);
    return rules.position(s);
  };

  it("steers sideways around the inspector ahead with a clear gap", () => {
    const s = cruising(5, 2);
    const p = run(s, [{ x: 10, z: 2, r: 0.7 }]);
    expect(Math.abs(p.z - 2)).toBeGreaterThanOrEqual(0.7 + rules.dodgeClear - 1e-6);
  });

  it("steers around the player's forklift and picks the in-bounds side", () => {
    const s = cruising(0, 7);
    const p = run(s, [{ x: 6, z: 7, r: 2.06 }]);
    expect(p.z).toBeLessThan(7);
    expect(p.z).toBeGreaterThanOrEqual(rules.laneMin);
    expect(Math.abs(p.z - 7)).toBeGreaterThanOrEqual(2.06 + rules.dodgeClear - 1e-6);
  });

  it("ignores obstacles already passed and returns to its lane", () => {
    const s = cruising(5, 2);
    run(s, [{ x: 10, z: 2, r: 0.7 }]);
    const p = run(s, [{ x: -10, z: 2, r: 0.7 }], 3);
    expect(p.z).toBeCloseTo(2);
  });

  it("keeps a wider gap from the player than the collision distance", () => {
    const o = rules.playerObstacle(0, 0);
    expect(o.r + rules.dodgeClear).toBeGreaterThan(rules.touchRadius + 0.3);
  });

  it("never runs over a player standing in its lane, wherever they stand", () => {
    for (const playerX of [-20, -6, -1, 0, 1, 3, 10, 25]) {
      const s = rules.reset();
      const playerZ = 3;
      let hits = 0;
      for (let i = 0; i < 2500 && !s.done && (s.trip ?? 0) === 0; i++) {
        rules.dodge(s, 0.016, [rules.playerObstacle(playerX, playerZ)]);
        const a = rules.position(s);
        rules.advance(s, 0.016, playerZ);
        const b = rules.position(s);
        if (s.active && rules.touches(a.x, a.z, b.x, b.z, playerX, playerZ)) hits++;
      }
      expect({ playerX, hits }).toEqual({ playerX, hits: 0 });
    }
  });

  it("does not offset an inactive forklift", () => {
    const s = rules.reset();
    expect(rules.dodge(s, 0.1, [{ x: s.x ?? 0, z: 3, r: 1 }])).toBe(0);
  });
});
