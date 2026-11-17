import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Row = { imp: string; cls: string; x: string[] };

type Rules = {
  conflict(a: { div: string; imp: string }, b: { div: string; imp: string }): boolean;
  segregation: {
    edition: string;
    table: string;
    codes: { imp: string; cls: string }[];
    rows: Row[];
  };
};

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/game-rules.js", "utf8"), context);
const rules = context["WarehouseRules"] as Rules;
const table = rules.segregation;
const byImp = new Map(table.codes.map((c) => [c.imp, c.cls]));

describe("DGR segregation chart", () => {
  it("keeps every IMP code as a chart row", () => {
    expect(table.rows.map((r) => r.imp)).toEqual(table.codes.map((c) => c.imp));
  });

  it("never mixes an IMP code with a class or division", () => {
    table.rows.forEach((r) => {
      expect(r.imp).toMatch(/^R[A-Z]{2}$/);
      expect(r.cls).toMatch(/^[1-9](\.\d[^0-9]?)?$/);
      expect(r.imp).not.toContain(r.cls);
    });
  });

  it("lists only known IMP codes inside a row", () => {
    table.rows.forEach((r) => r.x.forEach((code) => expect(byImp.has(code)).toBe(true)));
  });

  it("never marks a class against itself", () => {
    table.rows.forEach((r) => expect(r.x).not.toContain(r.imp));
  });

  it("is symmetric in every cell", () => {
    table.rows.forEach((r) => {
      r.x.forEach((code) => {
        const back = table.rows.find((o) => o.imp === code);
        expect(back && back.x.includes(r.imp)).toBe(true);
      });
    });
  });

  it("matches the runtime conflict rule cell by cell", () => {
    table.rows.forEach((r) => {
      table.rows.forEach((o) => {
        if (r.imp === o.imp) return;
        const marked = r.x.includes(o.imp);
        const live = rules.conflict({ div: r.cls, imp: r.imp }, { div: o.cls, imp: o.imp });
        expect(marked).toBe(live);
      });
    });
  });

  it("segregates lithium batteries but not every class 9 good", () => {
    const lithium = table.rows.find((r) => r.imp === "RLI");
    const general = table.rows.find((r) => r.imp === "RMD");
    expect(lithium && lithium.x.length).toBeGreaterThan(0);
    expect(general && general.x).toEqual([]);
  });

  it("keeps 1.4S segregated only from other explosives", () => {
    const row = table.rows.find((r) => r.imp === "RXS");
    expect(row).toBeTruthy();
    (row as Row).x.forEach((code) => expect(byImp.get(code)!.startsWith("1.")).toBe(true));
  });

  it("covers all nine classes exactly once as a class number", () => {
    const classes = new Set(table.codes.map((c) => c.cls[0]));
    expect([...classes].sort().join("")).toBe("123456789");
  });

  it("uses the 1.3 compatibility-group code that matches the class", () => {
    const explosive = table.rows.find((r) => r.cls === "1.3G");
    expect(explosive).toBeTruthy();
    expect(explosive!.imp).toBe("RGX");
    expect(table.rows.some((r) => r.imp === "RCX")).toBe(false);
  });

  it("never labels the water-reactive row with a non-IATA code", () => {
    const wet = table.rows.find((r) => r.cls === "4.3");
    expect(wet).toBeTruthy();
    expect(wet!.imp).toBe("RFW");
    expect(table.rows.some((r) => r.imp === "RWR")).toBe(false);
  });

  it("keeps one row per IMP code and only class 9 repeats a class", () => {
    const byImp = new Set<string>();
    const byCls = new Map<string, number>();
    table.codes.forEach((c) => {
      expect(byImp.has(c.imp)).toBe(false);
      byImp.add(c.imp);
      byCls.set(c.cls, (byCls.get(c.cls) || 0) + 1);
    });
    byCls.forEach((count, cls) => {
      if (cls === "9") return;
      expect(count).toBe(1);
    });
  });
});
