import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Item = { imp: string; div: string; isHz?: boolean; t?: string };
type Entry = { k: string; a?: Item; b?: Item; zone?: string; txt?: string; pts: number };
type Group = { key: string; k: string; n: number; pts: number; lesson: string };

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/game-rules.js", "utf8"), context);
const rules = context["WarehouseRules"] as {
  debrief: {
    LESSON: Record<string, { ar: string; en: string }>;
    maxRows: number;
    why(a: Item, b: Item): string;
    summarize(
      log: Entry[],
      max?: number,
    ): { rows: Group[]; more: number; total: number; lost: number };
  };
  music: {
    level(combo: number, fever: boolean): { bpm: number; layers: number; fever: boolean };
    stepSeconds(bpm: number): number;
  };
};
const D = rules.debrief;
const ROX = { imp: "ROX", div: "5.1", isHz: true };
const RFL = { imp: "RFL", div: "3", isHz: true };
const RCM = { imp: "RCM", div: "8", isHz: true };
const RLI = { imp: "RLI", div: "9", isHz: true };
const RMD = { imp: "RMD", div: "9", isHz: true };
const RGX = { imp: "RGX", div: "1.3G", isHz: true };
const RXS = { imp: "RXS", div: "1.4S", isHz: true };

describe("Shift debrief reasons", () => {
  it("explains each forbidden pair with the right short lesson", () => {
    expect(D.why(ROX, RFL)).toBe("oxidizer");
    expect(D.why(RFL, ROX)).toBe("oxidizer");
    expect(D.why(RCM, RFL)).toBe("corrosive");
    expect(D.why(RLI, RFL)).toBe("lithium");
    expect(D.why(RGX, RFL)).toBe("explosive");
    expect(D.why(RXS, RGX)).toBe("s14");
    expect(D.why(RMD, { imp: "RFG", div: "2.1" })).toBe("table");
  });
  it("has an Arabic and English lesson for every reason, each short", () => {
    for (const [, l] of Object.entries(D.LESSON)) {
      expect(l.ar.length).toBeGreaterThan(5);
      expect(l.en.length).toBeGreaterThan(5);
      expect(l.ar.length).toBeLessThanOrEqual(60);
    }
  });
});

describe("Shift debrief summary", () => {
  it("is empty for a clean shift", () => {
    expect(D.summarize([])).toEqual({ rows: [], more: 0, total: 0, lost: 0 });
  });
  it("groups the same mistake whatever the order of the pair", () => {
    const s = D.summarize([
      { k: "iata", a: ROX, b: RFL, pts: 35 },
      { k: "iata", a: RFL, b: ROX, pts: 35 },
    ]);
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]).toMatchObject({ k: "iata", n: 2, pts: 70, lesson: "oxidizer" });
    expect(s.total).toBe(2);
    expect(s.lost).toBe(70);
  });
  it("lists the costliest mistakes first and keeps only the top rows", () => {
    const s = D.summarize([
      { k: "zone", a: { imp: "COL", div: "", t: "cold" }, zone: "gen", pts: 15 },
      { k: "missed", a: { imp: "GEN", div: "", isHz: false }, pts: 10 },
      { k: "iata", a: ROX, b: RCM, pts: 35 },
      { k: "chill", pts: 40 },
      { k: "fine", pts: 15 },
    ]);
    expect(s.rows.map((r) => r.k)).toEqual(["chill", "iata", "zone"]);
    expect(s.rows).toHaveLength(D.maxRows);
    expect(s.more).toBe(2);
  });
  it("separates a missed dangerous good from a missed regular parcel", () => {
    const s = D.summarize([
      { k: "missed", a: { ...RFL }, pts: 10 },
      { k: "missed", a: { imp: "GEN", div: "", isHz: false }, pts: 10 },
    ]);
    expect(s.rows.map((r) => r.lesson).sort()).toEqual(["missed", "missed-hz"]);
  });
  it("ignores broken entries and negative points", () => {
    const s = D.summarize([null as unknown as Entry, { k: "", pts: 5 }, { k: "fine", pts: -3 }]);
    expect(s.total).toBe(1);
    expect(s.lost).toBe(0);
  });
});

describe("Combo music", () => {
  it("speeds up and adds layers as the combo grows", () => {
    const lv = [1, 2, 3, 5].map((c) => rules.music.level(c, false));
    expect(lv.map((l) => l.layers)).toEqual([0, 1, 2, 3]);
    for (let i = 1; i < lv.length; i++) expect(lv[i].bpm).toBeGreaterThan(lv[i - 1].bpm);
  });
  it("plays fastest with every layer during fever", () => {
    const f = rules.music.level(1, true);
    expect(f.fever).toBe(true);
    expect(f.layers).toBe(3);
    expect(f.bpm).toBeGreaterThan(rules.music.level(5, false).bpm);
  });
  it("clamps odd combo values and computes sixteenth-note steps", () => {
    expect(rules.music.level(0, false).layers).toBe(0);
    expect(rules.music.level(99, false).layers).toBe(3);
    expect(rules.music.stepSeconds(120)).toBeCloseTo(0.125);
  });
});
