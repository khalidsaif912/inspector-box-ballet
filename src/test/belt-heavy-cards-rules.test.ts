import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Card = { id: string; key: string; kind: "label" | "code" | "wild"; data: unknown };
type Rules = {
  belt: {
    jamAt: number;
    clearAt: number;
    clearReward: number;
    warnAt: number;
    jammed(n: number): boolean;
    cleared(n: number): boolean;
  };
  heavy: {
    kg: number;
    deliverReward: number;
    solveReward: number;
    failPenalty: number;
    window: number[];
    canLiftByHand(i: unknown): boolean;
  };
  cards: {
    seconds: number;
    pairs: number;
    size: number;
    wildTimeBonus: number;
    build(pool: { key: string }[], rng?: () => number): Card[];
    isPair(a: Card, b: Card): boolean;
    won(deck: Card[], matched: Set<string>): boolean;
  };
};

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/game-rules.js", "utf8"), context);
const r = context["WarehouseRules"] as Rules;
const pool = ["RXS", "RFG", "RPG", "RFL", "RFS", "ROX"].map((key) => ({ key }));
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

describe("Belt overload", () => {
  it("jams at the limit and clears only after the excess is moved away", () => {
    expect(r.belt.jammed(r.belt.jamAt - 1)).toBe(false);
    expect(r.belt.jammed(r.belt.jamAt)).toBe(true);
    expect(r.belt.cleared(r.belt.clearAt + 1)).toBe(false);
    expect(r.belt.cleared(r.belt.clearAt)).toBe(true);
    expect(r.belt.clearAt).toBeLessThan(r.belt.jamAt);
    expect(r.belt.warnAt).toBeLessThan(r.belt.jamAt);
  });
});

describe("Heavy parcel", () => {
  it("cannot be lifted by hand but ordinary parcels can", () => {
    expect(r.heavy.canLiftByHand({ isHeavy: true })).toBe(false);
    expect(r.heavy.canLiftByHand({ isHeavy: false })).toBe(true);
    expect(r.heavy.deliverReward).toBe(50);
    expect(r.heavy.solveReward).toBe(100);
    expect(r.heavy.failPenalty).toBe(50);
  });
});

describe("Forklift card puzzle", () => {
  it("builds nine cards: four labels, four matching codes and one spark card", () => {
    const deck = r.cards.build(pool, seeded(3));
    expect(deck).toHaveLength(9);
    const count = (k: string) => deck.filter((c) => c.kind === k).length;
    expect([count("label"), count("code"), count("wild")]).toEqual([4, 4, 1]);
    expect(new Set(deck.map((c) => c.id)).size).toBe(9);
    const keys = deck.filter((c) => c.kind === "label").map((c) => c.key);
    expect(new Set(keys).size).toBe(4);
    keys.forEach((k) =>
      expect(deck.filter((c) => c.kind === "code" && c.key === k)).toHaveLength(1),
    );
  });

  it("matches only a label with its own code, never the spark card or two of a kind", () => {
    const deck = r.cards.build(pool, seeded(9));
    const label = deck.find((c) => c.kind === "label") as Card;
    const code = deck.find((c) => c.kind === "code" && c.key === label.key) as Card;
    const otherCode = deck.find((c) => c.kind === "code" && c.key !== label.key) as Card;
    const wild = deck.find((c) => c.kind === "wild") as Card;
    expect(r.cards.isPair(label, code)).toBe(true);
    expect(r.cards.isPair(label, otherCode)).toBe(false);
    expect(r.cards.isPair(label, label)).toBe(false);
    expect(r.cards.isPair(label, wild)).toBe(false);
  });

  it("is won once all eight real cards are matched, with a 60 second limit", () => {
    const deck = r.cards.build(pool, seeded(5));
    const matched = new Set<string>();
    deck
      .filter((c) => c.kind !== "wild")
      .slice(0, 7)
      .forEach((c) => matched.add(c.id));
    expect(r.cards.won(deck, matched)).toBe(false);
    deck.filter((c) => c.kind !== "wild").forEach((c) => matched.add(c.id));
    expect(r.cards.won(deck, matched)).toBe(true);
    expect(r.cards.seconds).toBe(60);
  });

  it("uses distinct classes even if the pool repeats an entry", () => {
    const dup = [
      { key: "A" },
      { key: "A" },
      { key: "B" },
      { key: "C" },
      { key: "D" },
      { key: "E" },
    ];
    const keys = r.cards
      .build(dup, seeded(1))
      .filter((c) => c.kind === "label")
      .map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
