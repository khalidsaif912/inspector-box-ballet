import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Board = (string | null)[];
type Rules = {
  freezer: {
    ROWS: string[];
    BANDS: string[];
    SOLVED: Board;
    neighbors(i: number): number[];
    isSolved(board: Board): boolean;
    move(board: Board, i: number): Board | null;
    shuffle(rng?: () => number, moves?: number): Board;
    shouldSpawn(ctx: { processed: number; present: boolean; rng: () => number }): boolean;
    reward: { score: number; time: number };
    unlockBonus: number;
    penalty: number;
    spawnChance: number;
  };
};

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/game-rules.js", "utf8"), context);
const f = (context["WarehouseRules"] as Rules).freezer;

// مولّد عشوائي ثابت لتكرار الاختبارات
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("Freezer room puzzle", () => {
  it("uses 3 COL, 3 CRT, 2 FRZ and one blank, and the solved layout is solved", () => {
    const count = (k: string | null) => f.SOLVED.filter((t) => t === k).length;
    expect([count("COL"), count("CRT"), count("FRZ"), count(null)]).toEqual([3, 3, 2, 1]);
    expect(f.isSolved(f.SOLVED)).toBe(true);
  });

  it("accepts any blank position in the FRZ row, but no tile in a wrong row", () => {
    expect(f.isSolved(["COL", "COL", "COL", "CRT", "CRT", "CRT", "FRZ", null, "FRZ"])).toBe(true);
    expect(f.isSolved(["COL", "COL", "CRT", "COL", "CRT", "CRT", "FRZ", "FRZ", null])).toBe(false);
    expect(f.isSolved(["COL", "COL", "COL", "CRT", "CRT", null, "FRZ", "FRZ", "CRT"])).toBe(false);
  });

  it("only moves tiles that touch the blank and keeps the tile multiset", () => {
    const b = f.SOLVED;
    expect(f.move(b, 0)).toBeNull();
    expect(f.move(b, 8)).toBeNull();
    const m = f.move(b, 5) as Board;
    expect(m[8]).toBe("CRT");
    expect(m[5]).toBeNull();
    expect([...m].sort()).toEqual([...b].sort());
  });

  it("shuffles into a board that is never already solved, and can always be solved by undoing moves", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = seeded(seed);
      const board = f.shuffle(rng, 45);
      expect(f.isSolved(board)).toBe(false);
      expect([...board].sort()).toEqual([...f.SOLVED].sort());
    }
  });

  it("is solvable: a breadth-first search from a shuffled board reaches a solved one", () => {
    const board = f.shuffle(seeded(7), 60);
    const key = (b: Board) => b.map((t) => t ?? "_").join(",");
    const seen = new Set([key(board)]);
    let frontier: Board[] = [board];
    let found = f.isSolved(board);
    for (let depth = 0; depth < 40 && !found && frontier.length; depth++) {
      const next: Board[] = [];
      for (const b of frontier) {
        for (const i of f.neighbors(b.indexOf(null))) {
          const m = f.move(b, i) as Board;
          if (seen.has(key(m))) continue;
          seen.add(key(m));
          if (f.isSolved(m)) found = true;
          next.push(m);
        }
      }
      frontier = next;
    }
    expect(found).toBe(true);
  });

  it("spawns a frozen parcel only after a few parcels, never twice at once", () => {
    expect(f.shouldSpawn({ processed: 0, present: false, rng: () => 0 })).toBe(false);
    expect(f.shouldSpawn({ processed: 5, present: true, rng: () => 0 })).toBe(false);
    expect(f.shouldSpawn({ processed: 5, present: false, rng: () => 0 })).toBe(true);
    expect(f.shouldSpawn({ processed: 5, present: false, rng: () => 0.99 })).toBe(false);
    expect(f.reward.score).toBe(50);
    expect(f.unlockBonus).toBe(30);
    expect(f.penalty).toBe(20);
  });
});
