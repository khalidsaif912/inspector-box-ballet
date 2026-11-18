import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Flight = { id: string; from: string; to: string; pax: boolean };
type Cao = {
  label: string;
  codes: string[];
  flights: Flight[];
  answer: string;
  reward: number;
  penalty: number;
  maxAsks: number;
  isCao(imp: string): boolean;
  flightFor(seed: number): Flight;
  decide(
    item: { cao?: boolean } | null,
    flight?: Flight,
  ): { accept: boolean; code: string; reason: string };
  correct(option: string): boolean;
  hasCargoFlights(): boolean;
};
type Zone = { k?: string; hz?: 1 };
type Placement = {
  decide(
    zone: Zone,
    item: { cao?: boolean; isHz?: boolean; t?: string },
    placed?: unknown[],
  ): {
    ok: boolean;
    conflict: boolean;
    reason: string;
  };
};
type Rules = { cao: Cao; placement: Placement };

const context: Record<string, unknown> = {};
runInNewContext(readFileSync("public/game/game-rules.js", "utf8"), context);
const rules = context["WarehouseRules"] as Rules;
const cao = rules.cao;

describe("CAO parcels (Cargo Aircraft Only)", () => {
  it("marks only the codes that cannot fly on passenger aircraft", () => {
    expect(cao.label).toBe("CAO");
    expect(cao.codes.slice().sort()).toEqual(["RLI", "ROX", "RPG", "RRY"]);
    expect(cao.isCao("RPG")).toBe(true);
    expect(cao.isCao("RFL")).toBe(false);
    expect(cao.isCao("")).toBe(false);
  });

  it("keeps every scheduled flight a passenger flight", () => {
    expect(cao.flights.length).toBeGreaterThan(0);
    expect(cao.hasCargoFlights()).toBe(false);
    expect(cao.flights.every((f) => f.pax)).toBe(true);
  });

  it("rejects a CAO parcel on every flight in the game", () => {
    for (const flight of cao.flights) {
      const d = cao.decide({ cao: true }, flight);
      expect(d.accept).toBe(false);
      expect(d.code).toBe("cao-pax");
      expect(d.reason).toBe("cargo-aircraft-only");
    }
  });

  it("would accept CAO only on a cargo aircraft", () => {
    const cargo = { id: "WY999", from: "MCT", to: "FRA", pax: false };
    expect(cao.decide({ cao: true }, cargo)).toEqual({
      accept: true,
      code: "cao-cargo",
      reason: "cargo-aircraft",
    });
  });

  it("never blocks a non-CAO parcel", () => {
    expect(cao.decide({ cao: false }, cao.flights[0])).toEqual({
      accept: true,
      code: "ok",
      reason: "",
    });
    expect(cao.decide(null, cao.flights[0]).accept).toBe(true);
  });

  it("has exactly one correct option: refuse", () => {
    expect(cao.correct(cao.answer)).toBe(true);
    expect(cao.correct("accept")).toBe(false);
    expect(cao.correct("stow")).toBe(false);
    expect(cao.correct("")).toBe(false);
    expect(cao.reward).toBeGreaterThan(0);
    expect(cao.penalty).toBeGreaterThan(0);
  });

  it("picks a deterministic flight and always wraps the seed", () => {
    expect(cao.flightFor(0)).toBe(cao.flights[0]);
    expect(cao.flightFor(cao.flights.length)).toBe(cao.flights[0]);
    expect(cao.flightFor(-3)).toBe(cao.flights[3 % cao.flights.length]);
    expect(cao.flightFor(NaN)).toBe(cao.flights[0]);
  });

  it("refuses CAO in every stow zone, hazardous included", () => {
    const parcel = { cao: true, isHz: true, t: "h3" };
    expect(rules.placement.decide({ k: "hz1", hz: 1 }, parcel, []).reason).toBe("cao-pax");
    expect(rules.placement.decide({ k: "gen" }, parcel, []).reason).toBe("cao-pax");
    expect(rules.placement.decide({ k: "cold" }, parcel, []).reason).toBe("cao-pax");
    expect(rules.placement.decide({ k: "gen" }, parcel, []).conflict).toBe(true);
  });

  it("leaves ordinary stowing untouched", () => {
    expect(rules.placement.decide({ k: "gen" }, { t: "gen", isHz: false }, []).ok).toBe(true);
    expect(rules.placement.decide({ k: "hz1", hz: 1 }, { t: "h3", isHz: true }, []).ok).toBe(true);
  });
});

describe("CAO wiring in the game", () => {
  const game = readFileSync("public/game/game.js", "utf8");
  const html = readFileSync("public/game.html", "utf8");

  it("marks spawned hazardous parcels through the shared rule", () => {
    expect(game).toContain("gameRules.cao.isCao(");
    expect(game).toMatch(
      /const caoParcel = raw\[0\]\[0\]==='h' && gameRules\.cao\.isCao\(raw\[3\]\);/,
    );
    expect(game).toMatch(/cao: caoParcel,/);
  });

  it("asks the inspector at most three times per shift", () => {
    expect(cao.maxAsks).toBe(3);
    expect(game).toMatch(/caoRun\.spawned >= gameRules\.cao\.maxAsks/);
    expect(game).toContain("resetCaoRun();");
  });

  it("ships one high-resolution CARGO ONLY placard per shift", () => {
    expect(game).toContain("game/images/cao-placard.png");
    expect(game).toMatch(/_placardCv\.width = _placardCv\.height = 1024/);
    expect(html).toContain('id="cao-q"');
    expect(game).toContain("هل يُسمح بشحن هذه الشحنة على طائرة ركاب؟");
  });

  it("opens the accept/refuse check before any lift", () => {
    expect(game).toContain("function caoOpen(");
    expect(game).toContain("targetItem.data.cao && !targetItem.caoChecked");
    expect(game).toContain("if(it.data.cao && !it.caoChecked)");
  });

  it("freezes the shift while the decision is pending", () => {
    expect(game).toContain("if(caoQ.active){ dt = 0;");
    expect(game).toContain("it.m.position.x > 8) caoOpen(it);");
  });

  it("exposes the decision panel with the refuse option", () => {
    expect(html).toContain('id="cao-panel"');
    expect(html).toContain('data-a="reject"');
    expect(html).toContain('data-a="accept"');
    expect(html).toContain('data-a="stow"');
  });

  it("delegates clicks from the panel container like the emergency pad", () => {
    expect(game).toContain("const b = e.target.closest && e.target.closest('button[data-a]');");
    expect(game).toContain("caoAnswer(b.dataset.a);");
  });

  it("brings the inspector in person and anchors his speech bubble", () => {
    expect(game).toContain("function updateCaoScene(");
    expect(game).toContain("I_.g.visible = true;");
    expect(game).toContain("I_.x = Math.min(32, x0 + 7.4);");
    expect(game).toContain("function caoPlace(");
    expect(game).toContain(".project(C)");
    expect(game).toContain("if(caoQ.active){ dt = 0; updateCaoScene(");
    expect(game).toContain("!caoQ.active && (stage>=2 || demo.insp)) updateInspector(dt)");
  });

  it("renders the question as a bubble from the inspector", () => {
    expect(html).toContain('id="cao-bubble"');
    expect(html).toContain('class="cq-av"');
    expect(html).toContain(">المفتش</b>");
    const css = readFileSync("public/game/game.css", "utf8");
    expect(css).toContain(".cq::after");
    expect(css).toContain("background:#fff");
  });

  it("answers wrong decisions from the inspector in a white, readable bubble", () => {
    expect(html).toContain('id="cao-say"');
    expect(html).toContain('id="cao-say-text"');
    expect(game).toContain("function caoSay(");
    expect(game).toContain("caoHoldT = setTimeout(caoEnd, ok ? 4600 : 5600);");
    expect(game).toContain("caoQ.answered = true;");
    expect(game).toContain("void CAO_SAY.offsetWidth;");
    const css = readFileSync("public/game/game.css", "utf8");
    expect(css).toContain(".cq-say{");
    expect(css).toMatch(/\.cq-say\{font:800[^}]*color:#101318/);
    expect(css).toMatch(/\.cq\{[^}]*background:#fff/);
  });

  it("labels every CAO code inside the parcel texture cache key", () => {
    expect(game).toContain("(isCao ? '_CAO' : '')");
    expect(game).toContain("CAO · CARGO AIRCRAFT ONLY");
  });
});
