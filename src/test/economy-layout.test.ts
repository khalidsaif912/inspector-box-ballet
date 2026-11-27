import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Zone = { k: string; hz?: number; x: number; cap: number; cols: number };
type Item = { isHz: boolean; t: string; imp: string; div: string };

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/game-rules.js", "utf8"), context);
const rules = context["WarehouseRules"] as {
  economy: {
    sortReward(f: { isHz: boolean; combo: number; fever: boolean }): number;
    comboAfter(streak: number): number;
    chainBonus(streak: number): number;
    penalty(conflict: boolean): number;
    streakWindow(stage: number): number;
    mystery(r: number): { kind: string; amount: number };
  };
  placement: {
    decide(zone: Zone, item: Item, placed: unknown[]): Verdict;
  };
  layout: {
    beltSpawn(): { x: number; y: number; z: number };
    beltSpeed(stage: number, fever: boolean): number;
    containerSlot(
      zone: { x: number; cap: number; cols: number },
      i: number,
    ): { x: number; y: number; z: number };
    stageForScore(stage: number, score: number): number;
    stageProgress(stage: number, score: number): { shown: number; cap: number; percent: number };
  };
  scoreboard: {
    accuracy(sorted: number, processed: number): number;
    grade(score: number, accuracy: number): string;
    stars(grade: string): number;
    hubStars(stars: number): number;
  };
};
type Verdict = { ok: boolean; conflict: boolean; reason: string };

const coldZone: Zone = { k: "cold", x: -12, cap: 9, cols: 3 };
const hzZone: Zone = { k: "hz1", hz: 1, x: 11.5, cap: 6, cols: 3 };

const coldParcel: Item = { isHz: false, t: "cold", imp: "COL", div: "REF" };
const perishableParcel: Item = { isHz: false, t: "perish", imp: "PER", div: "EAT" };
const explosive: Item = { isHz: true, t: "h1", imp: "RXS", div: "1.4S" };
const fireworks: Item = { isHz: true, t: "h1", imp: "RGX", div: "1.3G" };

describe("Scoring economy (values the game loop uses)", () => {
  it("pays 10 for a regular parcel and 25 for a hazardous one", () => {
    expect(rules.economy.sortReward({ isHz: false, combo: 1, fever: false })).toBe(10);
    expect(rules.economy.sortReward({ isHz: true, combo: 1, fever: false })).toBe(25);
  });

  it("multiplies by combo and doubles during fever", () => {
    expect(rules.economy.sortReward({ isHz: false, combo: 3, fever: false })).toBe(30);
    expect(rules.economy.sortReward({ isHz: false, combo: 3, fever: true })).toBe(60);
    expect(rules.economy.sortReward({ isHz: true, combo: 5, fever: true })).toBe(250);
  });

  it("raises the combo every three sorted parcels and caps at five", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9, 12, 30].map((s) => rules.economy.comboAfter(s))).toEqual([
      1, 1, 1, 2, 2, 2, 3, 4, 5, 5,
    ]);
  });

  it("starts the chain bonus after four in a row and caps it at 40", () => {
    expect(rules.economy.chainBonus(4)).toBe(0);
    expect(rules.economy.chainBonus(5)).toBe(5);
    expect(rules.economy.chainBonus(8)).toBe(20);
    expect(rules.economy.chainBonus(12)).toBe(40);
    expect(rules.economy.chainBonus(40)).toBe(40);
  });

  it("charges 35 for an IATA conflict and 15 for a plain mismatch", () => {
    expect(rules.economy.penalty(true)).toBe(35);
    expect(rules.economy.penalty(false)).toBe(15);
  });

  it("keeps the streak window at 7s on stage 1 and 5.5s afterwards", () => {
    expect(rules.economy.streakWindow(1)).toBe(7);
    expect(rules.economy.streakWindow(2)).toBe(5.5);
    expect(rules.economy.streakWindow(4)).toBe(5.5);
  });

  it("maps the mystery box roll to its five outcomes without gaps", () => {
    expect(rules.economy.mystery(0)).toEqual({ kind: "time", amount: 12 });
    expect(rules.economy.mystery(0.24)).toEqual({ kind: "time", amount: 12 });
    expect(rules.economy.mystery(0.25)).toEqual({ kind: "score", amount: 60 });
    expect(rules.economy.mystery(0.69)).toEqual({ kind: "combo", amount: 5 });
    expect(rules.economy.mystery(0.84)).toEqual({ kind: "slow", amount: 8 });
    expect(rules.economy.mystery(0.999)).toEqual({ kind: "timeLoss", amount: 6 });
  });
});

describe("Placement decisions", () => {
  it("accepts a cold parcel in the cold container", () => {
    expect(rules.placement.decide(coldZone, coldParcel, [])).toEqual({
      ok: true,
      conflict: false,
      reason: "",
    });
  });

  it("rejects a cold parcel dropped in the perishable container", () => {
    const verdict = rules.placement.decide(
      { k: "perish", x: -12, cap: 9, cols: 3 },
      coldParcel,
      [],
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.conflict).toBe(false);
    expect(verdict.reason).toBe("wrong-zone");
  });

  it("treats any parcel in a hazardous container as a conflict", () => {
    const verdict = rules.placement.decide(hzZone, coldParcel, []);
    expect(verdict).toMatchObject({ ok: false, conflict: true, reason: "hazardous-only" });
  });

  it("refuses mixing a 1.3G explosive with a 1.4S explosive", () => {
    const verdict = rules.placement.decide(hzZone, fireworks, [{ data: explosive }]);
    expect(verdict).toMatchObject({ ok: false, conflict: true, reason: "iata-conflict" });
  });

  it("accepts same-class hazardous parcels still allowed by the table", () => {
    expect(rules.placement.decide(hzZone, explosive, []).ok).toBe(true);
  });

  it("flags a hazardous parcel in a general area as a conflict, not a mismatch", () => {
    const verdict = rules.placement.decide(coldZone, explosive, []);
    expect(verdict).toMatchObject({ ok: false, conflict: true, reason: "hazardous-in-general" });
  });

  it("penalises the verdict with the matching amount", () => {
    const conflictVerdict = rules.placement.decide(hzZone, coldParcel, []);
    const mismatchVerdict = rules.placement.decide(
      { k: "perish", x: 0, cap: 9, cols: 3 },
      coldParcel,
      [],
    );
    expect(rules.economy.penalty(conflictVerdict.conflict)).toBe(35);
    expect(rules.economy.penalty(mismatchVerdict.conflict)).toBe(15);
  });
});

describe("Warehouse layout maths", () => {
  it("spawns parcels off the start of the belt at the same height as before", () => {
    expect(rules.layout.beltSpawn()).toEqual({ x: -22.5, y: 1.415, z: 12 });
  });

  it("scales the belt speed per stage and during fever", () => {
    expect([1, 2, 3, 4].map((s) => rules.layout.beltSpeed(s, false))).toEqual([1.4, 1.8, 2.3, 2.8]);
    expect(rules.layout.beltSpeed(3, true)).toBeCloseTo(2.645, 3);
  });

  it("lays out container slots in the same rows and columns as the mesh placement", () => {
    const slots = Array.from({ length: 9 }, (_, i) =>
      rules.layout.containerSlot({ x: -12, cap: 9, cols: 3 }, i),
    );
    expect(slots[0]?.x).toBeCloseTo(-13.37, 5);
    expect(slots[0]?.y).toBeCloseTo(1.24, 5);
    expect(slots[0]?.z).toBeCloseTo(-9.97, 5);
    expect(slots[2]?.x).toBeCloseTo(-10.63, 5);
    expect(slots[3]?.x).toBeCloseTo(-13.37, 5);
    expect(slots[3]?.z).toBeCloseTo(-8.6, 5);
    expect(slots[8]?.z).toBeCloseTo(-7.23, 5);
  });

  it("advances the stage only when the score crosses the next threshold", () => {
    expect(rules.layout.stageForScore(1, 149)).toBe(1);
    expect(rules.layout.stageForScore(1, 150)).toBe(2);
    expect(rules.layout.stageForScore(2, 349)).toBe(2);
    expect(rules.layout.stageForScore(2, 350)).toBe(3);
    expect(rules.layout.stageForScore(3, 650)).toBe(4);
    expect(rules.layout.stageForScore(4, 9999)).toBe(4);
  });

  it("reports stage progress as a bounded percentage", () => {
    expect(rules.layout.stageProgress(1, 0).percent).toBe(0);
    expect(rules.layout.stageProgress(1, 75).percent).toBe(50);
    expect(rules.layout.stageProgress(1, 999).percent).toBe(100);
    expect(rules.layout.stageProgress(4, 800)).toEqual({ shown: 800, cap: 800, percent: 100 });
  });
});

describe("Shift scoreboard", () => {
  it("computes accuracy from sorted versus processed parcels", () => {
    expect(rules.scoreboard.accuracy(0, 0)).toBe(0);
    expect(rules.scoreboard.accuracy(3, 4)).toBe(75);
    expect(rules.scoreboard.accuracy(9, 9)).toBe(100);
  });

  it("grades a shift from score and accuracy", () => {
    expect(rules.scoreboard.grade(1000, 90)).toBe("s");
    expect(rules.scoreboard.grade(1200, 88)).toBe("a");
    expect(rules.scoreboard.grade(650, 80)).toBe("a");
    expect(rules.scoreboard.grade(650, 79)).toBe("b");
    expect(rules.scoreboard.grade(520, 95)).toBe("b");
    expect(rules.scoreboard.grade(350, 50)).toBe("b");
    expect(rules.scoreboard.grade(349, 100)).toBe("c");
    expect(rules.scoreboard.grade(210, 10)).toBe("c");
    expect(rules.scoreboard.grade(120, 100)).toBe("c");
  });

  it("ties grades B and A to reaching stages 3 and 4", () => {
    const at = rules.layout.stageThresholds();
    expect(rules.scoreboard.grade(at[3], 0)).toBe("b");
    expect(rules.scoreboard.grade(at[3] - 1, 100)).toBe("c");
    expect(rules.scoreboard.grade(at[4], 80)).toBe("a");
    expect(rules.scoreboard.grade(at[4] - 1, 100)).toBe("b");
  });

  it("maps stars to hub stars within one to three", () => {
    expect(rules.scoreboard.stars("s")).toBe(5);
    expect(rules.scoreboard.stars("c")).toBe(2);
    expect(rules.scoreboard.hubStars(5)).toBe(3);
    expect(rules.scoreboard.hubStars(3)).toBe(2);
    expect(rules.scoreboard.hubStars(2)).toBe(1);
  });
});
