import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Entry = { s: number; d: string };
type BoardRules = { top(raw: unknown, limit?: number): Entry[] };

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/game-rules.js", "utf8"), context);
const rules = context["WarehouseRules"] as { board: BoardRules };
const game = readFileSync("public/game/game.js", "utf8");

describe("Local leaderboard storage", () => {
  it("keeps a healthy board untouched", () => {
    const saved = [
      { s: 120, d: "1/1/2026" },
      { s: 90, d: "2/1/2026" },
      { s: 30, d: "3/1/2026" },
    ];
    expect(rules.board.top(saved)).toEqual(saved);
  });

  it("falls back to an empty board when the stored value is not an array", () => {
    expect(rules.board.top({ s: 10 })).toEqual([]);
    expect(rules.board.top("oops")).toEqual([]);
    expect(rules.board.top(42)).toEqual([]);
    expect(rules.board.top(null)).toEqual([]);
    expect(rules.board.top(undefined)).toEqual([]);
  });

  it("sorts high scores first and caps the board length", () => {
    const listed = rules.board.top([
      { s: 10, d: "a" },
      { s: 70, d: "b" },
      { s: 40, d: "c" },
      { s: 90, d: "d" },
      { s: 20, d: "e" },
      { s: 50, d: "f" },
    ]);
    expect(listed.map((e) => e.s)).toEqual([90, 70, 50, 40, 20]);
    expect(rules.board.top([{ s: 7, d: "x" }], 3)).toHaveLength(1);
  });

  it("drops corrupt rows but keeps the readable ones", () => {
    const listed = rules.board.top([
      { s: 55, d: "good" },
      { s: "nope", d: "bad score" },
      null,
      { d: "no score" },
      { s: 15 },
    ]);
    expect(listed.map((e) => e.s)).toEqual([55, 15]);
    expect(listed[1]?.d).toBe("");
  });

  it("is used by the game instead of raw JSON.parse", () => {
    expect(game).toMatch(/gameRules\.board\.top\(JSON\.parse/);
  });
});
