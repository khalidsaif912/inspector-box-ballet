import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Question = {
  id: string;
  q: string;
  qEn: string;
  a: string[];
  aEn: string[];
  img: string;
  on: boolean;
  ord: number;
};
type Quiz = {
  MAX_ANSWERS: number;
  MAX_IMG: number;
  reward: number;
  penalty: number;
  asksPerShift: number;
  normalize(raw: unknown): Question;
  validate(raw: unknown): string | null;
  shuffle(q: unknown, rng?: () => number): { order: number[]; correct: number };
  pick(list: unknown[], recent?: string[], rng?: () => number): Question | null;
  localize(q: unknown, lang: string): { q: string; a: string[] };
  schedule(rng: () => number, avoid: number[], opts?: unknown): number[];
  defaults(): Question[];
};

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/quiz-rules.js", "utf8"), context);
const quiz = context["InspectorQuiz"] as Quiz;

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe("Inspector quiz rules", () => {
  it("ships valid default questions with the correct answer first", () => {
    const list = quiz.defaults();
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(new Set(list.map((q) => q.id)).size).toBe(list.length);
    for (const q of list) {
      expect(quiz.validate(q)).toBeNull();
      expect(q.a.length).toBeGreaterThanOrEqual(2);
      expect(q.a.length).toBeLessThanOrEqual(quiz.MAX_ANSWERS);
      expect(q.on).toBe(true);
    }
  });

  it("returns copies so editing defaults never changes the built-in list", () => {
    const first = quiz.defaults();
    first[0]!.a[0] = "changed";
    expect(quiz.defaults()[0]!.a[0]).not.toBe("changed");
  });

  it("reads the Firestore field layout (a1..a3, on as 0/1)", () => {
    const q = quiz.normalize({ _id: "x1", q: " سؤال ", a1: "صح", a2: "خطأ", a3: "", on: 0, ord: 4 });
    expect(q).toMatchObject({ id: "x1", q: "سؤال", a: ["صح", "خطأ"], on: false, ord: 4 });
  });

  it("rejects missing question, missing correct answer, too few, gaps and duplicates", () => {
    expect(quiz.validate({ q: "", a: ["a", "b"] })).toBe("noQuestion");
    expect(quiz.validate({ q: "?", a: ["", "b"] })).toBe("noCorrect");
    expect(quiz.validate({ q: "?", a: ["a"] })).toBe("fewAnswers");
    expect(quiz.validate({ q: "?", a: ["a", "", "c"] })).toBe("gapAnswer");
    expect(quiz.validate({ q: "?", a: ["Yes", "yes"] })).toBe("dupAnswer");
    expect(quiz.validate({ q: "?", a: ["a", "b", "c"] })).toBeNull();
  });

  it("keeps at most three answers and drops non-image data", () => {
    const q = quiz.normalize({ q: "?", a: ["1", "2", "3", "4"], img: "javascript:alert(1)" });
    expect(q.a).toEqual(["1", "2", "3"]);
    expect(q.img).toBe("");
    const big = "data:image/jpeg;base64," + "A".repeat(quiz.MAX_IMG);
    expect(quiz.normalize({ q: "?", a: ["1", "2"], img: big }).img).toBe("");
    expect(quiz.normalize({ q: "?", a: ["1", "2"], img: "data:image/png;base64,AAAA" }).img).toContain("data:image/png");
  });

  it("shuffles every answer exactly once and tracks where the correct one lands", () => {
    const q = { q: "?", a: ["right", "w1", "w2"] };
    for (const r of [0, 0.34, 0.67, 0.99]) {
      const { order, correct } = quiz.shuffle(q, seq(r, 1 - r));
      expect([...order].sort()).toEqual([0, 1, 2]);
      expect(order[correct]).toBe(0);
    }
  });

  it("puts the correct answer in every position over many shuffles", () => {
    const q = { q: "?", a: ["right", "w1", "w2"] };
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(quiz.shuffle(q).correct);
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("picks only active valid questions and avoids recent ones", () => {
    const list = [
      { id: "a", q: "A", a: ["1", "2"] },
      { id: "b", q: "B", a: ["1", "2"], on: false },
      { id: "c", q: "", a: ["1", "2"] },
      { id: "d", q: "D", a: ["1", "2"] },
    ];
    for (let i = 0; i < 20; i++) expect(quiz.pick(list, ["a"])!.id).toBe("d");
    expect(quiz.pick(list, ["a", "d"])!.id).toMatch(/^[ad]$/);
    expect(quiz.pick([{ id: "b", q: "B", a: ["1", "2"], on: false }])).toBeNull();
    expect(quiz.pick([])).toBeNull();
  });

  it("uses English text when present and falls back to Arabic per field", () => {
    const q = { q: "س", qEn: "Q", a: ["أ", "ب"], aEn: ["A", ""] };
    expect(quiz.localize(q, "en")).toEqual({ q: "Q", a: ["A", "ب"] });
    expect(quiz.localize(q, "ar")).toEqual({ q: "س", a: ["أ", "ب"] });
  });

  it("schedules the shift's questions away from CAO checks and the fire drill", () => {
    for (let k = 0; k < 50; k++) {
      const avoid = [20, 80, 130, 60];
      const times = quiz.schedule(Math.random, avoid);
      expect(times.length).toBe(quiz.asksPerShift);
      for (const t of times) for (const c of avoid) expect(Math.abs(t - c)).toBeGreaterThanOrEqual(16);
      expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(16);
    }
  });

  it("still schedules inside its window when the shift is crowded", () => {
    const times = quiz.schedule(Math.random, [30, 45, 75, 90, 100]);
    expect(times[0]).toBeGreaterThanOrEqual(22);
    expect(times[0]).toBeLessThanOrEqual(52);
    expect(times[1]).toBeGreaterThanOrEqual(68);
    expect(times[1]).toBeLessThanOrEqual(104);
  });

  it("rewards a right answer more than it fines a wrong one", () => {
    expect(quiz.reward).toBeGreaterThan(quiz.penalty);
    expect(quiz.penalty).toBeGreaterThan(0);
  });
});
