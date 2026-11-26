import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Phase = { until: number; flee: number; speed: number; catch: number; juke: number };
type Progress = {
  PET_CHASE: Record<"cat" | "dog", Phase[]>;
  petChase(kind: string, t: number): Phase;
  isAllCharsCode(v: unknown): boolean;
};
type Rules = {
  freezer: { seconds: number; timeoutPenalty: number; timeoutLoss(score: number): number };
  cards: { seconds: number; quitPenalty: number };
  heavy: { failPenalty: number };
};

const ctx: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/progress-rules.js", "utf8"), ctx);
runInNewContext(readFileSync("public/game/game-rules.js", "utf8"), ctx);
const P = ctx["WarehouseProgress"] as Progress;
const R = ctx["WarehouseRules"] as Rules;

describe("Loose pet chase difficulty", () => {
  it("makes the cat very hard for 15s, hard for the next 10s, then easy", () => {
    const [vh, h, easy] = [P.petChase("cat", 5), P.petChase("cat", 20), P.petChase("cat", 30)];
    expect(P.petChase("cat", 14.9)).toBe(vh);
    expect(P.petChase("cat", 15)).toBe(h);
    expect(P.petChase("cat", 24.9)).toBe(h);
    expect(P.petChase("cat", 25)).toBe(easy);
    expect(vh.speed).toBeGreaterThan(h.speed);
    expect(h.speed).toBeGreaterThan(easy.speed);
    expect(vh.catch).toBeLessThan(easy.catch);
    expect(easy.speed).toBeLessThan(8.2); // أبطأ من مشي اللاعب
  });

  it("keeps dogs harder than cats at every moment", () => {
    for (const t of [0, 10, 16, 20, 26, 31, 40, 60]) {
      const c = P.petChase("cat", t), d = P.petChase("dog", t);
      expect(d.speed).toBeGreaterThan(c.speed);
      expect(d.flee).toBeGreaterThanOrEqual(c.flee);
      expect(d.catch).toBeLessThanOrEqual(c.catch);
    }
  });

  it("falls back to cat rules and treats bad times as zero", () => {
    expect(P.petChase("hamster", 3)).toBe(P.petChase("cat", 3));
    expect(P.petChase("dog", -5)).toBe(P.petChase("dog", 0));
  });
});

describe("Puzzle timers and penalties", () => {
  it("gives the freezer puzzle a deadline that costs points, never below zero", () => {
    expect(R.freezer.seconds).toBeGreaterThan(0);
    expect(R.freezer.timeoutLoss(100)).toBe(R.freezer.timeoutPenalty);
    expect(R.freezer.timeoutLoss(10)).toBe(10);
    expect(R.freezer.timeoutLoss(0)).toBe(0);
  });

  it("charges less for quitting the forklift puzzle than for running out of time", () => {
    expect(R.cards.seconds).toBe(60);
    expect(R.cards.quitPenalty).toBeGreaterThan(0);
    expect(R.cards.quitPenalty).toBeLessThan(R.heavy.failPenalty);
  });
});

describe("All-characters code", () => {
  it("matches only the exact code (spaces ignored)", () => {
    expect(P.isAllCharsCode("996785538715")).toBe(true);
    expect(P.isAllCharsCode(" 9967 8553 8715 ")).toBe(true);
    expect(P.isAllCharsCode("99678553871")).toBe(false);
    expect(P.isAllCharsCode("82645")).toBe(false);
    expect(P.isAllCharsCode(null)).toBe(false);
  });
});
