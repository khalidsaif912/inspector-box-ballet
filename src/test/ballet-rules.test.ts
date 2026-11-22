import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type State = { count: number; idle: number; gap: number };
type Ballet = {
  minChain: number;
  maxIdle: number;
  maxGap: number;
  bonusCap: number;
  initial(): State;
  bonus(count: number): number;
  tick(state: State, dt: number, moving: boolean): State;
  onSort(state: State): { state: State; triggered: boolean; count: number; bonus: number };
  onMiss(): State;
};

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/game-rules.js", "utf8"), context);
const b = (context["WarehouseRules"] as { ballet: Ballet }).ballet;

function sortN(n: number, state = b.initial()) {
  let last = b.onSort(state);
  for (let i = 1; i < n; i++) last = b.onSort(last.state);
  return last;
}

describe("ballet combo rules", () => {
  it("triggers only from the third consecutive sort", () => {
    expect(sortN(1).triggered).toBe(false);
    expect(sortN(2).triggered).toBe(false);
    const third = sortN(3);
    expect(third.triggered).toBe(true);
    expect(third.count).toBe(3);
    expect(third.bonus).toBeGreaterThan(0);
  });

  it("grows the bonus with the chain up to a cap", () => {
    expect(sortN(4).bonus).toBeGreaterThan(sortN(3).bonus);
    expect(sortN(50).bonus).toBe(b.bonusCap);
  });

  it("survives smooth movement between sorts", () => {
    let s = sortN(2).state;
    for (let t = 0; t < 3; t += 0.1) s = b.tick(s, 0.1, true);
    expect(s.count).toBe(2);
    expect(b.onSort(s).triggered).toBe(true);
  });

  it("breaks when the inspector stands still too long", () => {
    let s = sortN(2).state;
    s = b.tick(s, b.maxIdle * 0.5, false);
    expect(s.count).toBe(2);
    s = b.tick(s, b.maxIdle, false);
    expect(s.count).toBe(0);
  });

  it("short pauses reset once moving again", () => {
    let s = sortN(2).state;
    for (let i = 0; i < 5; i++) {
      s = b.tick(s, b.maxIdle * 0.8, false);
      s = b.tick(s, 0.1, true);
    }
    expect(s.count).toBe(2);
  });

  it("breaks when too long passes without a sort even while moving", () => {
    let s = sortN(2).state;
    s = b.tick(s, b.maxGap + 0.1, true);
    expect(s.count).toBe(0);
  });

  it("a wrong sort resets the dance", () => {
    expect(b.onMiss().count).toBe(0);
    expect(b.onSort(b.onMiss()).triggered).toBe(false);
  });
});
