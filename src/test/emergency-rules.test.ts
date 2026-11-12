import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Emergency = {
  code: string;
  codePoints: number;
  positionPoints: number;
  musterX: number;
  musterZ: number;
  musterHX: number;
  musterHZ: number;
  correct(value: unknown): boolean;
  inMuster(x: number, z: number): boolean;
};

type Rules = { emergency: Emergency };

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game-rules.js", "utf8"), context);
const rules = context["WarehouseRules"] as Rules;
const emergency = rules.emergency;

describe("Emergency evacuation", () => {
  it("accepts only the configured emergency code", () => {
    expect(emergency.correct("24351234")).toBe(true);
    expect(emergency.correct("2435123")).toBe(false);
    expect(emergency.correct("24351235")).toBe(false);
    expect(emergency.correct("")).toBe(false);
  });
  it("detects the muster point bounds", () => {
    expect(emergency.inMuster(emergency.musterX, emergency.musterZ)).toBe(true);
    expect(
      emergency.inMuster(
        emergency.musterX + emergency.musterHX,
        emergency.musterZ - emergency.musterHZ,
      ),
    ).toBe(true);
    expect(
      emergency.inMuster(emergency.musterX + emergency.musterHX + 0.1, emergency.musterZ),
    ).toBe(false);
    expect(
      emergency.inMuster(emergency.musterX, emergency.musterZ + emergency.musterHZ + 0.1),
    ).toBe(false);
  });
  it("sits against the left warehouse wall", () => {
    expect(emergency.musterX).toBeLessThan(-30);
    expect(emergency.musterX - emergency.musterHX).toBeGreaterThan(-34);
  });
  it("awards the configured code and position points", () => {
    expect(emergency.codePoints).toBe(50);
    expect(emergency.positionPoints).toBe(10);
  });
});
