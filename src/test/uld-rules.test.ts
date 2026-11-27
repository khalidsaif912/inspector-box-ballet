import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Piece = { id: string; imp: string; div: string; kind: string; cao: boolean };
type Check = {
  ok: boolean;
  pairs: { a: number; b: number; why: string }[];
  caoLoaded: string[];
  wrongOff: string[];
  missing: string[];
  caoLeft: string[];
};
type Uld = {
  CELLS: number;
  reward: number;
  maxRatio: number;
  minClashes: number;
  neighbors(i: number): number[];
  clash(a: Partial<Piece>, b: Partial<Piece>): string;
  countSolutions(pieces: Partial<Piece>[], cap?: number): number;
  arrangements(k: number): number;
  clashCount(pieces: Partial<Piece>[]): number;
  build(rng?: () => number): { pieces: Piece[]; solutions: number };
  check(pieces: Piece[], board: (string | null)[], offload: string[]): Check;
};

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/game-rules.js", "utf8"), context);
const rules = context["WarehouseRules"] as { uld: Uld; cao: { codes: string[] } };
const u = rules.uld;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// يجد حلاً فعلياً بالبحث الكامل (للتأكد من أن check يقبله)
function solve(load: Piece[]): (string | null)[] | null {
  const board: (Piece | null)[] = new Array(9).fill(null);
  const used = new Array(load.length).fill(false);
  const go = (i: number, blanks: number): boolean => {
    if (i === 9) return true;
    if (blanks > 0 && go(i + 1, blanks - 1)) return true;
    for (let j = 0; j < load.length; j++) {
      if (used[j]) continue;
      const p = load[j];
      if (i % 3 > 0 && board[i - 1] && u.clash(board[i - 1]!, p)) continue;
      if (i >= 3 && board[i - 3] && u.clash(board[i - 3]!, p)) continue;
      used[j] = true;
      board[i] = p;
      if (go(i + 1, blanks)) return true;
      board[i] = null;
      used[j] = false;
    }
    return false;
  };
  return go(0, 9 - load.length) ? board.map((p) => (p ? p.id : null)) : null;
}

describe("ULD load-plan puzzle (200 points)", () => {
  it("is worth 200 points", () => {
    expect(u.reward).toBe(200);
  });

  it("uses side neighbours only (no diagonals)", () => {
    expect(u.neighbors(4).sort()).toEqual([1, 3, 5, 7]);
    expect(u.neighbors(0).sort()).toEqual([1, 3]);
  });

  it("applies IATA, food and live-animal separation", () => {
    expect(u.clash({ imp: "RFL", div: "3" }, { imp: "RCM", div: "8" })).toBe("iata");
    expect(u.clash({ imp: "RGX", div: "1.3G" }, { imp: "RFG", div: "2.1" })).toBe("iata");
    expect(u.clash({ imp: "EAT", div: "" }, { imp: "RPB", div: "6.1" })).toBe("food");
    expect(u.clash({ imp: "AVI", div: "" }, { imp: "RMD", div: "9" })).toBe("avi");
    expect(u.clash({ imp: "AVI", div: "" }, { imp: "EAT", div: "" })).toBe("");
    expect(u.clash({ imp: "RGX", div: "1.3G" }, { imp: "RPB", div: "6.1" })).toBe("");
  });

  it("always builds 9 shipments with 1–2 CAO, solvable but hard", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { pieces, solutions } = u.build(seeded(seed));
      expect(pieces).toHaveLength(9);
      const cao = pieces.filter((p) => p.cao);
      expect(cao.length).toBeGreaterThanOrEqual(1);
      expect(cao.length).toBeLessThanOrEqual(2);
      cao.forEach((p) => expect(rules.cao.codes).toContain(p.imp));
      const load = pieces.filter((p) => !p.cao);
      load.forEach((p) => expect(rules.cao.codes).not.toContain(p.imp));
      expect(solutions).toBeGreaterThan(0);
      expect(solutions / u.arrangements(load.length)).toBeLessThanOrEqual(u.maxRatio);
      expect(u.clashCount(load)).toBeGreaterThanOrEqual(u.minClashes);
    }
  });

  it("accepts a real solution and rejects every kind of mistake", () => {
    const { pieces } = u.build(seeded(7));
    const load = pieces.filter((p) => !p.cao);
    const off = pieces.filter((p) => p.cao).map((p) => p.id);
    const board = solve(load)!;
    expect(board).not.toBeNull();
    expect(u.check(pieces, board, off).ok).toBe(true);

    // CAO لم يُنزَّل
    const notOff = u.check(pieces, board, []);
    expect(notOff.ok).toBe(false);
    expect(notOff.caoLeft).toHaveLength(off.length);

    // تنزيل شحنة مسموحة بدل تحميلها
    const firstLoaded = board.find(Boolean)!;
    const b2 = board.map((id) => (id === firstLoaded ? null : id));
    const wrong = u.check(pieces, b2, off.concat(firstLoaded));
    expect(wrong.wrongOff).toEqual([firstLoaded]);

    // CAO محمّل على المنصة
    const blank = board.indexOf(null);
    if (blank >= 0) {
      const b3 = board.slice();
      b3[blank] = off[0];
      expect(u.check(pieces, b3, off.slice(1)).caoLoaded).toEqual([off[0]]);
    }
  });

  it("reports adjacent forbidden pairs", () => {
    const pieces: Piece[] = [
      { id: "A", imp: "RFL", div: "3", kind: "dg", cao: false },
      { id: "B", imp: "RCM", div: "8", kind: "dg", cao: false },
    ];
    const side = u.check(pieces, ["A", "B", null, null, null, null, null, null, null], []);
    expect(side.pairs).toEqual([{ a: 0, b: 1, why: "iata" }]);
    const diagonal = u.check(pieces, ["A", null, null, null, "B", null, null, null, null], []);
    expect(diagonal.ok).toBe(true);
  });
});
