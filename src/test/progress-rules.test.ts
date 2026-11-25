import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Mission = { id: string; n: number; done: boolean };
type State = {
  xp: number;
  day: string;
  missions: Mission[];
  allDone: boolean;
  dgr: { streak: number; best: number; cert: boolean };
  rounds: number;
};
type Def = { id: string; goal: number; xp: number; event?: string };
type Rank = { id: string; xp: number; ar: string; en: string; icon: string };
type Unlock = { kind: string; id: string; rank: string };
type Result = {
  state: State;
  completed: Def[];
  xp: number;
  allDone: boolean;
  rankUp: { from: Rank; to: Rank } | null;
  unlocked: Unlock[];
  certified: boolean;
};
type Progress = {
  RANKS: Rank[];
  MISSIONS: Def[];
  SHIFT_EVENTS: { id: string }[];
  UNLOCKS: Unlock[];
  DAILY_COUNT: number;
  DAILY_BONUS: number;
  DGR_GOAL: number;
  ROUND_XP_CAP: number;
  NEAR_MISS: { dist: number };
  rankFor(xp: number): {
    rank: Rank;
    index: number;
    next: Rank | null;
    toNext: number;
    frac: number;
  };
  rankTitle(xp: number, lang: string): string;
  isUnlocked(kind: string, id: string, xp: number): boolean;
  dailyMissions(day: string): string[];
  normalize(state: unknown, day: string): State;
  ensureDay(state: State, day: string): State;
  apply(state: State, event: string, payload?: unknown): Result;
  roundXp(score: number): number;
  nearMiss(o: Record<string, unknown>): boolean;
  pickShiftEvent(rng: () => number, state?: State): string;
  storageKey(id: string): string;
};

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/progress-rules.js", "utf8"), context);
const P = context["WarehouseProgress"] as Progress;

const DAY = "2026-11-24";
/* حالة اختبار بمهام محددة بدل مهام اليوم العشوائية */
const withMissions = (ids: string[], extra: Partial<State> = {}): State => ({
  ...P.normalize(null, DAY),
  missions: ids.map((id) => ({ id, n: 0, done: false })),
  ...extra,
});
const def = (id: string) => P.MISSIONS.find((m) => m.id === id) as Def;

describe("Ranks", () => {
  it("are ordered by XP and start at zero", () => {
    expect(P.RANKS[0].xp).toBe(0);
    for (let i = 1; i < P.RANKS.length; i++)
      expect(P.RANKS[i].xp).toBeGreaterThan(P.RANKS[i - 1].xp);
  });
  it("maps XP to the right rank at the thresholds", () => {
    expect(P.rankFor(0).rank.id).toBe("trainee");
    expect(P.rankFor(P.RANKS[1].xp - 1).rank.id).toBe("trainee");
    expect(P.rankFor(P.RANKS[1].xp).rank.id).toBe(P.RANKS[1].id);
    expect(P.rankFor(999999).rank.id).toBe("chief");
    expect(P.rankFor(999999).next).toBe(null);
  });
  it("reports the remaining XP and progress to the next rank", () => {
    const r = P.rankFor(200);
    expect(r.toNext).toBe(P.RANKS[1].xp - 200);
    expect(r.frac).toBeCloseTo(200 / P.RANKS[1].xp);
  });
  it("gives an icon and a title in both languages", () => {
    expect(P.rankTitle(0, "ar")).toContain("متدرب");
    expect(P.rankTitle(0, "en")).toContain("Trainee");
  });
});

describe("Unlocks", () => {
  it("keeps the two base characters open for everyone", () => {
    expect(P.isUnlocked("char", "worker", 0)).toBe(true);
    expect(P.isUnlocked("char", "timmy", 0)).toBe(true);
  });
  it("adds at least two new characters, each locked until its rank", () => {
    const chars = P.UNLOCKS.filter((u) => u.kind === "char");
    expect(chars.length).toBeGreaterThanOrEqual(2);
    for (const c of chars) {
      const need = P.RANKS.find((r) => r.id === c.rank) as Rank;
      expect(P.isUnlocked("char", c.id, need.xp - 1)).toBe(false);
      expect(P.isUnlocked("char", c.id, need.xp)).toBe(true);
    }
  });
  it("gates every vest colour except the default by rank", () => {
    const vests = P.UNLOCKS.filter((u) => u.kind === "vest");
    expect(vests.filter((v) => v.rank === "trainee").length).toBe(1);
    expect(P.isUnlocked("vest", "gold", 0)).toBe(false);
    expect(P.isUnlocked("vest", "gold", 999999)).toBe(true);
  });
  it("rejects unknown items", () => {
    expect(P.isUnlocked("vest", "nope", 999999)).toBe(false);
  });
});

describe("Daily missions", () => {
  it("picks three different missions, the same for everyone on a given day", () => {
    const a = P.dailyMissions(DAY);
    expect(a).toHaveLength(P.DAILY_COUNT);
    expect(new Set(a).size).toBe(P.DAILY_COUNT);
    expect(P.dailyMissions(DAY)).toEqual(a);
  });
  it("varies from day to day", () => {
    const days = Array.from({ length: 10 }, (_, i) =>
      P.dailyMissions("2026-12-" + String(i + 1).padStart(2, "0")).join(),
    );
    expect(new Set(days).size).toBeGreaterThan(5);
  });
  it("replaces the missions on a new day but keeps XP and the DGR certificate", () => {
    const s = {
      ...withMissions(["fever2", "sort30", "pet"]),
      xp: 777,
      dgr: { streak: 3, best: 9, cert: true },
    };
    s.missions[0].n = 1;
    const next = P.ensureDay(s, "2026-11-25");
    expect(next.day).toBe("2026-11-25");
    expect(next.missions.every((m) => m.n === 0 && !m.done)).toBe(true);
    expect(next.xp).toBe(777);
    expect(next.dgr.cert).toBe(true);
    expect(P.ensureDay(s, DAY).missions[0].n).toBe(1);
  });
  it("normalizes broken or missing saved data", () => {
    const s = P.normalize({ xp: "abc", dgr: null }, DAY);
    expect(s.xp).toBe(0);
    expect(s.missions).toHaveLength(P.DAILY_COUNT);
    expect(s.dgr.streak).toBe(0);
  });
});

describe("Mission progress", () => {
  it("collects FOD and resets the count when the forklift hits the player", () => {
    let s = withMissions(["fod_safe", "fever2", "sort30"]);
    s = P.apply(s, "fod").state;
    s = P.apply(s, "fod").state;
    s = P.apply(s, "hit").state;
    expect(s.missions[0].n).toBe(0);
    s = P.apply(s, "fod").state;
    s = P.apply(s, "fod").state;
    const r = P.apply(s, "fod");
    expect(r.state.missions[0].done).toBe(true);
    expect(r.completed.map((d) => d.id)).toEqual(["fod_safe"]);
    expect(r.xp).toBe(def("fod_safe").xp);
  });
  it("needs five correct CAO answers in a row; a wrong one restarts it", () => {
    let s = withMissions(["cao_streak", "fever2", "sort30"]);
    for (let i = 0; i < 4; i++) s = P.apply(s, "cao", { ok: true }).state;
    s = P.apply(s, "cao", { ok: false }).state;
    expect(s.missions[0].n).toBe(0);
    for (let i = 0; i < 5; i++) s = P.apply(s, "cao", { ok: true }).state;
    expect(s.missions[0].done).toBe(true);
  });
  it("does not go back once a mission is done", () => {
    let s = withMissions(["fod_safe", "fever2", "sort30"]);
    for (let i = 0; i < 3; i++) s = P.apply(s, "fod").state;
    s = P.apply(s, "hit").state;
    expect(s.missions[0]).toMatchObject({ n: 3, done: true });
  });
  it("counts only correct sorts and stops at the goal", () => {
    let s = withMissions(["sort30", "fever2", "pet"]);
    s = P.apply(s, "sort", { ok: false }).state;
    expect(s.missions[0].n).toBe(0);
    for (let i = 0; i < 40; i++) s = P.apply(s, "sort", { ok: true }).state;
    expect(s.missions[0].n).toBe(30);
  });
  it("uses the round result for score and clean-shift missions", () => {
    let s = withMissions(["score500", "clean", "pet"]);
    s = P.apply(s, "round", { score: 499, fined: true }).state;
    expect(s.missions.map((m) => m.done)).toEqual([false, false, false]);
    s = P.apply(s, "round", { score: 520, fined: false }).state;
    expect(s.missions.map((m) => m.done)).toEqual([true, true, false]);
  });
  it("awards a bonus once when all three daily missions are done", () => {
    let s = withMissions(["fever2", "pet", "vip"]);
    s = P.apply(s, "fever").state;
    s = P.apply(s, "fever").state;
    s = P.apply(s, "pet").state;
    const r = P.apply(s, "vip");
    expect(r.allDone).toBe(true);
    expect(r.xp).toBe(def("vip").xp + P.DAILY_BONUS);
    expect(P.apply(r.state, "vip").allDone).toBe(false);
  });
  it("ignores events no mission listens to", () => {
    const s = withMissions(["fever2", "pet", "vip"]);
    const r = P.apply(s, "unknown");
    expect(r.xp).toBe(0);
    expect(r.state.missions).toEqual(s.missions);
  });
});

describe("XP and rank-ups", () => {
  it("gives round XP from the score, capped", () => {
    expect(P.roundXp(0)).toBe(0);
    expect(P.roundXp(400)).toBe(100);
    expect(P.roundXp(1e6)).toBe(P.ROUND_XP_CAP);
    expect(P.roundXp(-50)).toBe(0);
  });
  it("adds round XP and counts rounds", () => {
    const s = withMissions(["fever2", "pet", "vip"]);
    const r = P.apply(s, "round", { score: 400 });
    expect(r.state.xp).toBe(100);
    expect(r.state.rounds).toBe(1);
  });
  it("reports a rank-up with everything it unlocks", () => {
    const need = P.RANKS.find((r) => r.id === "assistant") as Rank;
    const s = withMissions(["fever2", "pet", "vip"], { xp: need.xp - 10 });
    const r = P.apply(s, "round", { score: 400 });
    expect(r.rankUp?.to.id).toBe("assistant");
    expect(r.unlocked.map((u) => u.id)).toEqual(expect.arrayContaining(["safety", "blue"]));
  });
  it("does not report a rank-up when the rank stays the same", () => {
    const s = withMissions(["fever2", "pet", "vip"]);
    expect(P.apply(s, "round", { score: 40 }).rankUp).toBe(null);
  });
});

describe("DGR certificate", () => {
  it("is earned once after a full streak of correct dangerous-goods decisions", () => {
    let s = withMissions(["fever2", "pet", "vip"]);
    for (let i = 0; i < P.DGR_GOAL - 1; i++) s = P.apply(s, "dgr", { ok: true }).state;
    expect(s.dgr.cert).toBe(false);
    const r = P.apply(s, "dgr", { ok: true });
    expect(r.certified).toBe(true);
    expect(P.apply(r.state, "dgr", { ok: true }).certified).toBe(false);
  });
  it("restarts the streak on a mistake but keeps the best streak and the certificate", () => {
    let s = withMissions(["fever2", "pet", "vip"]);
    for (let i = 0; i < 7; i++) s = P.apply(s, "dgr", { ok: true }).state;
    s = P.apply(s, "dgr", { ok: false }).state;
    expect(s.dgr).toMatchObject({ streak: 0, best: 7, cert: false });
  });
});

describe("Near miss", () => {
  const base = {
    active: true,
    moving: true,
    hit: false,
    already: false,
    driving: false,
    dist: 2.9,
  };
  it("rewards a moving player the forklift passes very close to", () => {
    expect(P.nearMiss(base)).toBe(true);
  });
  it("does not reward a hit, a standing player, a repeat, a driver or a far pass", () => {
    expect(P.nearMiss({ ...base, hit: true })).toBe(false);
    expect(P.nearMiss({ ...base, moving: false })).toBe(false);
    expect(P.nearMiss({ ...base, already: true })).toBe(false);
    expect(P.nearMiss({ ...base, driving: true })).toBe(false);
    expect(P.nearMiss({ ...base, dist: P.NEAR_MISS.dist + 0.1 })).toBe(false);
  });
});

describe("Shift events", () => {
  it("offers the blackout, peak hour, VIP and pet events", () => {
    expect(P.SHIFT_EVENTS.map((e) => e.id)).toEqual(["blackout", "peak", "vip", "pet"]);
  });
  it("favours an event that an unfinished daily mission needs", () => {
    const s = withMissions(["pet", "fever2", "sort30"]);
    let pet = 0;
    let seed = 1;
    const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1000; i++) if (P.pickShiftEvent(rng, s) === "pet") pet++;
    expect(pet).toBeGreaterThan(550);
  });
  it("picks every event sometimes when no mission needs one", () => {
    const s = withMissions(["fever2", "sort30", "fod_safe"]);
    const seen = new Set<string>();
    let seed = 7;
    const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 200; i++) seen.add(P.pickShiftEvent(rng, s));
    expect(seen.size).toBe(4);
  });
});

describe("Online sync", () => {
  it("lets the Firestore rules store the progress fields on a player", () => {
    const rules = readFileSync("firestore.rules", "utf8");
    const players = rules.slice(rules.indexOf("match /players/"), rules.indexOf("match /logins/"));
    for (const k of ["xp", "rank", "dgr", "dgrBest"]) expect(players).toContain(`'${k}'`);
    expect(players).toContain("okProgress(request.resource.data)");
  });
  it("writes player records with an update mask so progress is not wiped on login or score upload", () => {
    const online = readFileSync("public/game/online.js", "utf8");
    expect(online).toContain("updateMask.fieldPaths=");
    expect(online).not.toMatch(/send\('PATCH', u, encDoc/);
  });
});

describe("Storage", () => {
  it("keys progress per player and strips unsafe characters", () => {
    expect(P.storageKey("82645")).toBe("acg_prog_82645");
    expect(P.storageKey("G-123456")).toBe("acg_prog_G-123456");
    expect(P.storageKey("")).toBe("acg_prog_local");
    expect(P.storageKey("a/b")).toBe("acg_prog_ab");
  });
});
