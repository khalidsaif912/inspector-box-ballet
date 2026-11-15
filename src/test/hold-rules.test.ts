import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type HoldState = { held: unknown; lifting: unknown };
type HoldRules = { forget(item: unknown, state: HoldState): HoldState };

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/game-rules.js", "utf8"), context);
const rules = context["WarehouseRules"] as { hold: HoldRules };
const game = readFileSync("public/game/game.js", "utf8");

describe("Hold references when a parcel is destroyed", () => {
  it("drops a held parcel so it can never be stowed as a ghost", () => {
    const spoiled = { id: "spoiled" };
    const state: HoldState = { held: spoiled, lifting: null };
    const next = rules.hold.forget(spoiled, state);
    expect(next.held).toBe(null);
    // act() only stows when held is set; a null hold cannot fill a container slot
    expect(next.held).not.toBe(spoiled);
  });

  it("cancels the lift animation when its target is destroyed mid-lift", () => {
    const lifting = { id: "lifting" };
    const next = rules.hold.forget(lifting, { held: null, lifting });
    expect(next.lifting).toBe(null);
  });

  it("leaves an unrelated hold untouched", () => {
    const other = { id: "other" };
    const spoiled = { id: "spoiled" };
    const next = rules.hold.forget(spoiled, { held: other, lifting: other });
    expect(next.held).toBe(other);
    expect(next.lifting).toBe(other);
  });

  it("keeps an already empty hold empty", () => {
    expect(rules.hold.forget({ id: "x" }, { held: null, lifting: null })).toEqual({
      held: null,
      lifting: null,
    });
  });

  it("routes parcel removal through the shared hold rules", () => {
    expect(game).toMatch(/gameRules\.hold\.forget\(/);
  });
});
