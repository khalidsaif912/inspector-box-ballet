// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, beforeEach } from "vitest";

/**
 * اختبار وردية كاملة بدون مشهد Three.js:
 * Three.js r128 يحتاج WebGL ولا يعمل في jsdom، لذلك تُنفَّذ game-rules.js
 * داخل سياق jsdom الحقيقي (localStorage/DOM من jsdom) وتُستدعى نفس الدوال
 * التي يستدعيها game.js: قرار الوضع، النقاط، الكومبو، التقييم، لوحة المتصدرين.
 * ما لا يغطيه هذا الاختبار: إنشاء المشهد، الحركة، الحزام، واللمس.
 */

const source = readFileSync("public/game/game-rules.js", "utf8");
const zone = (k: string, hz = false) => ({
  k,
  hz: hz ? 1 : 0,
  x: 0,
  cap: 9,
  cols: 3,
  items: [] as { data: unknown }[],
});

type Rules = {
  placement: { decide(zone: unknown, item: unknown, placed: unknown[]): Verdict };
  economy: {
    sortReward(fields: { isHz: boolean; combo: number; fever: boolean }): number;
    comboAfter(streak: number): number;
    chainBonus(streak: number): number;
    penalty(conflict: boolean): number;
  };
  hold: { forget(item: unknown, state: { held: unknown; lifting: unknown }): { held: unknown } };
  board: { top(raw: unknown): { s: number; d: string }[] };
  scoreboard: {
    accuracy(sorted: number, processed: number): number;
    grade(score: number, accuracy: number): string;
    stars(grade: string): number;
    hubStars(stars: number): number;
  };
};
type Verdict = { ok: boolean; conflict: boolean; reason: string };
type Parcel = { isHz: boolean; t: string; imp: string; div: string };

function loadRules(): Rules {
  // سياق jsdom حقيقي: يستخدم window/localStorage الخاصة بـ jsdom
  const context: Record<string, unknown> = { localStorage: window.localStorage };
  context["window"] = context;
  context["self"] = context;
  runInNewContext(source, context);
  return context["WarehouseRules"] as Rules;
}

type Shift = {
  score: number;
  combo: number;
  streak: number;
  sorted: number;
  processed: number;
  held: unknown;
  time: number;
};

const freshShift = (): Shift => ({
  score: 0,
  combo: 1,
  streak: 0,
  sorted: 0,
  processed: 0,
  held: null,
  time: 100,
});

describe("A full shift, driven only by the shared rules", () => {
  let rules: Rules;
  let shift: Shift;

  beforeEach(() => {
    localStorage.clear();
    rules = loadRules();
    shift = freshShift();
  });

  const pickUp = (parcel: unknown) => {
    shift.held = parcel;
    return shift.held;
  };

  const dropInto = (target: ReturnType<typeof zone>, parcel: Parcel) => {
    shift.processed++;
    const verdict = rules.placement.decide(target, parcel, target.items);
    if (verdict.ok) {
      shift.sorted++;
      shift.score += rules.economy.sortReward({
        isHz: parcel.isHz,
        combo: shift.combo,
        fever: false,
      });
      shift.streak++;
      shift.combo = rules.economy.comboAfter(shift.streak);
      shift.time += 3;
      target.items.push({ data: parcel });
    } else {
      shift.score = Math.max(0, shift.score - rules.economy.penalty(verdict.conflict));
      shift.combo = 1;
      shift.streak = 0;
    }
    shift.held = rules.hold.forget(parcel, { held: shift.held, lifting: null }).held;
    return verdict;
  };

  const endShift = () => {
    const accuracy = rules.scoreboard.accuracy(shift.sorted, shift.processed);
    const grade = rules.scoreboard.grade(shift.score, accuracy);
    const stars = rules.scoreboard.stars(grade);
    const hubStars = rules.scoreboard.hubStars(stars);
    const board = rules.board.top(JSON.parse(localStorage.getItem("acg_top") || "[]"));
    return { accuracy, grade, stars, hubStars, board };
  };

  it("scores a correct cold drop, keeps the parcel in the container and ends the shift", () => {
    const cold = zone("cold");
    const parcel = { isHz: false, t: "cold", imp: "COL", div: "REF" };

    expect(pickUp(parcel)).toBe(parcel);
    const verdict = dropInto(cold, parcel);

    expect(verdict.ok).toBe(true);
    expect(shift.held).toBe(null);
    expect(shift.score).toBe(10);
    expect(shift.time).toBe(103);
    expect(cold.items).toHaveLength(1);

    const result = endShift();
    expect(result.accuracy).toBe(100);
    expect(result.grade).toBe("c");
    expect(result.stars).toBe(2);
    expect(result.hubStars).toBe(1);
  });

  it("builds combo and chain rewards across consecutive correct drops", () => {
    const cold = zone("cold");
    for (let i = 1; i <= 6; i++) {
      const parcel = { isHz: false, t: "cold", imp: "COL", div: "REF" };
      dropInto(cold, parcel);
      expect(shift.combo).toBe(rules.economy.comboAfter(i));
      if (i > 4) expect(rules.economy.chainBonus(i)).toBeGreaterThan(0);
    }
    expect(shift.combo).toBe(3);
    expect(shift.score).toBeGreaterThan(60);
    expect(shift.sorted).toBe(6);
  });

  it("punishes an IATA conflict and resets the streak", () => {
    const hz = zone("hz1", true);
    hz.items.push({ data: { isHz: true, imp: "RXS", div: "1.4S" } });
    shift.score = 100;
    shift.streak = 5;
    shift.combo = 2;

    const verdict = dropInto(hz, { isHz: true, t: "h1", imp: "RGX", div: "1.3G" });

    expect(verdict.conflict).toBe(true);
    expect(shift.score).toBe(65);
    expect(shift.combo).toBe(1);
    expect(shift.streak).toBe(0);
    expect(hz.items).toHaveLength(1);
  });

  it("counts a mismatch in accuracy without treating it as a conflict", () => {
    const perish = zone("perish");
    dropInto(perish, { isHz: false, t: "cold", imp: "COL", div: "REF" });

    const result = endShift();
    expect(result.accuracy).toBe(0);
    expect(result.grade).toBe("c");
  });

  it("grades an expert shift with five stars and three hub stars", () => {
    shift.score = 520;
    shift.sorted = 92;
    shift.processed = 100;

    const result = endShift();
    expect(result.accuracy).toBe(92);
    expect(result.grade).toBe("s");
    expect(result.stars).toBe(5);
    expect(result.hubStars).toBe(3);
  });

  it("drops the held reference if the parcel is destroyed before landing", () => {
    const parcel = { isHz: false, t: "cold", imp: "COL", div: "REF" };
    pickUp(parcel);
    shift.held = rules.hold.forget(parcel, { held: shift.held, lifting: null }).held;
    expect(shift.held).toBe(null);
  });

  it("reads a saved leaderboard from the real DOM storage", () => {
    localStorage.setItem(
      "acg_top",
      JSON.stringify([
        { s: 40, d: "1/1/2026" },
        { s: 90, d: "2/1/2026" },
      ]),
    );
    const result = endShift();
    expect(result.board.map((e: { s: number }) => e.s)).toEqual([90, 40]);
  });
});
