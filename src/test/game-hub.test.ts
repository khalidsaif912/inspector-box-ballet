import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Stage = {
  name: string;
  bestScore: number;
  lastScore: number;
  stars: number;
  completed: boolean;
  lastPlayedAt: string | null;
};

type HubData = {
  version: string;
  activeGameId: string;
  totalScore: number;
  games: Record<string, Stage>;
};

type SaveResult = {
  data: HubData;
  bestScore: number;
  lastScore: number;
  totalScore: number;
  isRecord: boolean;
};

type Hub = {
  STORAGE_KEY: string;
  NEXT_GAME_URL: string;
  getData(): HubData;
  saveGameScore(gameId: string, score: number, stars?: number): SaveResult;
  getTotalScore(): number;
  getStageScore(gameId: string): Stage | null;
  canReplayStage(gameId: string): boolean;
  setActiveGame(gameId: string): HubData;
  nextUrl(fromGameId?: string): string;
};

function loadHub() {
  const store = new Map<string, string>();
  const context: Record<string, unknown> = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
    },
  };
  runInNewContext(readFileSync("public/game/game-hub.js", "utf8"), context);
  return { hub: context["GameHub"] as Hub, store };
}

describe("Game hub scoring", () => {
  it("keeps each stage independent and recomputes the cumulative total", () => {
    const { hub } = loadHub();
    hub.saveGameScore("game1", 120, 3);
    const pairs = hub.saveGameScore("pairs", 90, 2);
    expect(pairs.totalScore).toBe(210);
    expect(hub.getStageScore("game1")?.bestScore).toBe(120);
    expect(hub.getStageScore("pairs")?.bestScore).toBe(90);
  });

  it("replaying a stage only raises its best score and never touches other stages", () => {
    const { hub } = loadHub();
    hub.saveGameScore("game1", 120, 3);
    hub.saveGameScore("pairs", 90, 2);
    const replay = hub.saveGameScore("game1", 60, 1);
    expect(replay.bestScore).toBe(120);
    expect(replay.lastScore).toBe(60);
    expect(replay.data.games["game1"]?.stars).toBe(3);
    expect(replay.totalScore).toBe(210);
    const better = hub.saveGameScore("game1", 150, 2);
    expect(better.isRecord).toBe(true);
    expect(better.bestScore).toBe(150);
    expect(better.totalScore).toBe(240);
    expect(hub.getStageScore("pairs")?.bestScore).toBe(90);
  });

  it("allows every stored stage to be replayed in isolation", () => {
    const { hub } = loadHub();
    hub.saveGameScore("game1", 120, 3);
    expect(hub.canReplayStage("game1")).toBe(true);
    expect(hub.canReplayStage("")).toBe(false);
  });

  it("falls back to empty data when storage is corrupt", () => {
    const { hub, store } = loadHub();
    store.set(hub.STORAGE_KEY, "{not json");
    expect(hub.getTotalScore()).toBe(0);
    expect(hub.getData().games).toEqual({});
  });

  it("clamps stars to one through three and ignores negative scores", () => {
    const { hub } = loadHub();
    expect(hub.saveGameScore("game1", -50, 9).bestScore).toBe(0);
    expect(hub.saveGameScore("game1", 40, 9).data.games["game1"]?.stars).toBe(3);
    expect(hub.saveGameScore("game1", 60, 0).data.games["game1"]?.stars).toBe(1);
  });

  it("links to picture clues with the source stage in the query", () => {
    const { hub } = loadHub();
    hub.saveGameScore("game1", 100, 3);
    expect(hub.nextUrl()).toBe(
      "https://dgr-exp.netlify.app/m1/pairs.html?source=game1&session=active",
    );
    expect(hub.nextUrl("pairs")).toContain("source=pairs");
  });
});
