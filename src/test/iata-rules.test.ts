import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Item = { div: string; imp?: string };
type Rules = {
  conflict(a: Item, b: Item): boolean;
};

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game-rules.js", "utf8"), context);
const rules = context["WarehouseRules"] as Rules;

const dg = (div: string, imp = "") => ({ div, imp });

describe("IATA segregation (Table 9.3.A)", () => {
  it("segregates the pairs marked X in the table", () => {
    expect(rules.conflict(dg("3"), dg("5.1"))).toBe(true);
    expect(rules.conflict(dg("3"), dg("8"))).toBe(true);
    expect(rules.conflict(dg("4.1"), dg("5.1"))).toBe(true);
    expect(rules.conflict(dg("4.2"), dg("5.1"))).toBe(true);
    expect(rules.conflict(dg("4.3"), dg("8"))).toBe(true);
    expect(rules.conflict(dg("5.1"), dg("8"))).toBe(true);
    expect(rules.conflict(dg("2.1"), dg("9", "RLI"))).toBe(true);
    expect(rules.conflict(dg("5.2"), dg("9", "RLI"))).toBe(true);
  });

  it("does not invent pairs that are blank in the table", () => {
    expect(rules.conflict(dg("3"), dg("4.2"))).toBe(false);
    expect(rules.conflict(dg("4.2"), dg("8"))).toBe(false);
    expect(rules.conflict(dg("2.1"), dg("5.1"))).toBe(false);
    expect(rules.conflict(dg("2.3"), dg("8"))).toBe(false);
  });

  it("treats 1.4S as excluded from the class 1 row", () => {
    expect(rules.conflict(dg("1.4S"), dg("3"))).toBe(false);
    expect(rules.conflict(dg("1.4S"), dg("1.3G"))).toBe(true);
    expect(rules.conflict(dg("1.3G"), dg("2.2"))).toBe(true);
    expect(rules.conflict(dg("1.3G"), dg("6.1"))).toBe(false);
  });

  it("applies class 9 segregation only to lithium batteries", () => {
    expect(rules.conflict(dg("3"), dg("9", "RMD"))).toBe(false);
    expect(rules.conflict(dg("9", "RMD"), dg("3"))).toBe(false);
    expect(rules.conflict(dg("9", "RMD"), dg("9", "RLI"))).toBe(false);
    expect(rules.conflict(dg("1.3G"), dg("9", "RMD"))).toBe(false);
    expect(rules.conflict(dg("1.3G"), dg("9", "RLI"))).toBe(true);
  });

  it("does not segregate classes 6 and 7 from other classes", () => {
    expect(rules.conflict(dg("6.1"), dg("8"))).toBe(false);
    expect(rules.conflict(dg("6.2"), dg("5.1"))).toBe(false);
    expect(rules.conflict(dg("7"), dg("3"))).toBe(false);
  });

  it("is symmetric and ignores identical or missing divisions", () => {
    expect(rules.conflict(dg("3"), dg("5.1"))).toBe(rules.conflict(dg("5.1"), dg("3")));
    expect(rules.conflict(dg("8"), dg("4.3"))).toBe(true);
    expect(rules.conflict(dg("8"), dg("8"))).toBe(false);
    expect(rules.conflict(dg(""), dg("3"))).toBe(false);
  });
});
