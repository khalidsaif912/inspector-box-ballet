import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const game = readFileSync("public/game.html", "utf8");

describe("Game assets and shared rules", () => {
  it("loads Three.js from the local vendor copy", () => {
    expect(game).toContain('src="vendor/three.min.js"');
    expect(game).not.toMatch(/cdnjs\.cloudflare\.com|unpkg\.com|cdn\.jsdelivr\.net/);
  });

  it("delegates IATA segregation to the shared browser-safe rules", () => {
    expect(game).not.toContain("function checkIATAConflict");
    expect(game).toContain("gameRules.conflict(");
  });
});
