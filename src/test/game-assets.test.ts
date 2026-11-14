import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("public/game.html", "utf8");
const index = readFileSync("public/index.html", "utf8");
const ui = readFileSync("public/game/ui.css", "utf8");
const game = readFileSync("public/game/game.js", "utf8");

describe("Game assets and shared rules", () => {
  it("loads Three.js from the local vendor copy", () => {
    expect(html).toContain('src="vendor/three.min.js"');
    expect(html).not.toMatch(/cdnjs\.cloudflare\.com|unpkg\.com|cdn\.jsdelivr\.net/);
  });

  it("loads the shared rules before the game bundle", () => {
    const rulesIndex = html.indexOf('src="game/game-rules.js"');
    const gameIndex = html.indexOf('src="game/game.js"');
    expect(rulesIndex).toBeGreaterThan(-1);
    expect(gameIndex).toBeGreaterThan(rulesIndex);
  });

  it("shares cumulative stage scores and a gate transition to the next game", () => {
    const hub = readFileSync("public/game/game-hub.js", "utf8");
    expect(html).toContain('src="game/game-hub.js"');
    expect(html.indexOf('src="game/game.js"')).toBeGreaterThan(
      html.indexOf('src="game/game-hub.js"'),
    );
    expect(hub).toContain("dgr_game_hub_data");
    expect(hub).toContain("pairs.html");
    expect(game).toContain("GameHub.saveGameScore");
    expect(game).toContain("function beginExitSequence");
    expect(game).toContain("function updateExitSequence");
    expect(html).toContain('id="portal-warp"');
    expect(readFileSync("public/sw.js", "utf8")).toContain('"./game/game-hub.js"');
  });

  it("ships the picture clues stage with local assets and shared scoring", () => {
    const pairs = readFileSync("public/m1/pairs.html", "utf8");
    expect(pairs).toContain('src="../game/game-hub.js"');
    expect(pairs).toContain('MANIFEST_URL="manifest.json"');
    expect(pairs).toContain("--card-back:url('card-back.png')");
    expect(pairs).toContain("GameHub.saveGameScore");
    expect(pairs).toContain('id="stepper"');
    expect(pairs).toContain('id="fxCanvas"');
    expect(pairs).toContain("dgr_pairs_progressive_data");
    expect(pairs).toContain("function buildStage");
    expect(pairs).toContain("const SoundFX");
    expect(pairs).toContain("function registerMatch");
    expect(pairs).toContain("function triggerFrenzy");
    expect(pairs).toContain("function freezeClock");
    expect(pairs).toContain("function finishMatch");
    expect(pairs).toContain("POWER_META");
    expect(pairs).not.toMatch(/cdn\.jsdelivr\.net/);
    expect(readFileSync("public/m1/manifest.json", "utf8")).toContain("characters");
    expect(JSON.parse(readFileSync("public/games.json", "utf8")).games.length).toBe(2);
    expect(readFileSync("public/game/game-hub.js", "utf8")).not.toContain("dgr-exp.netlify.app");
  });

  it("delegates IATA segregation to the shared browser-safe rules", () => {
    expect(game).not.toContain("function checkIATAConflict");
    expect(game).toContain("gameRules.conflict(");
  });

  it("mutes warehouse ambience and effects with separate controls", () => {
    expect(html).toContain('id="amb"');
    expect(html).toContain('id="snd"');
    expect(game).toContain("function initAmbience");
    expect(game).toContain("setAmb(");
    expect(game).toMatch(/soundEnabled\s*=\s*v/);
  });

  it("offers audio and tip toggles before the game starts", () => {
    expect(html).toMatch(/data-audio="snd"/);
    expect(html).toMatch(/data-audio="amb"/);
    expect(html).toContain("data-tips-toggle");
    expect(html).not.toContain('id="tips"');
    expect(game).toContain("function syncAudioUI");
    expect(game).toContain("function setTips");
  });

  it("shows each instructional message only once", () => {
    expect(game).toContain("function tip(");
    expect(game).toContain("acg_tips_seen");
    expect(game).toMatch(/tip\('stage1'/);
  });

  it("never hides fire alarm messages behind the tips toggle", () => {
    expect(game).not.toMatch(/tip\('fire'/);
    expect(game).not.toMatch(/tip\('codepad'/);
    expect(game).toMatch(/toast\('🚨 إنذار حريق/);
  });

  it("lets players cancel the emergency code pad with a mandatory reminder", () => {
    expect(html).toContain('id="cp-cancel"');
    expect(html).toContain("معرفة رقم الطوارئ إلزامية لكل موظف");
    expect(game).toContain("function cancelCodePad");
    expect(game).toContain("$('cp-cancel').onclick = cancelCodePad");
  });

  it("deducts only 2 points for a missed parcel and 3 for dangerous goods", () => {
    expect(game).toContain("const miss = it.data.isHz ? 3 : 2;");
  });

  it("adds a fourth stage limited to dangerous goods with three class containers", () => {
    expect(game).toMatch(/STAGE_AT=\[0,0,100,200,320\]/);
    expect(game).toContain("stage===4 ? HZ");
    expect(game).toContain("k:'hz3'");
    expect(game.match(/k:'hz\d'/g)?.length).toBe(3);
    expect(game).not.toMatch(/z\.cls/);
    expect(game).not.toContain("كل المواد الخطرة • فئات");
    expect(game).not.toContain("z.sub");
  });

  it("lets the player drive the forklift for sixty seconds per shift", () => {
    expect(html).toContain('id="drv"');
    expect(game).toContain("left:60");
    expect(game).toContain("function mountDrive");
    expect(game).toContain("function stopDrive");
    expect(game).toContain("FD.left = Math.max(0, FD.left - dt)");
  });

  it("seats the employee on the forklift and drives it at the shared speed", () => {
    expect(game).toContain("const dSpd = gameRules.forklift.driveSpeed");
    expect(game).toContain("const forkDriver = new THREE.Group()");
    expect(game).toContain("forkDriver.visible = true");
    expect(game).toContain("forkDriver.visible = false");
  });

  it("draws the hazard board at double resolution with readable parcel rows", () => {
    expect(game).toContain("cv.width = z.hz ? 1280 : 512");
    expect(game).toContain("const k = z.hz ? 2 : 1");
    expect(game).toContain("rr(W-30-divW-6, mid-cardH/2, divW, cardH, 8)");
    expect(game).toContain("minFilter = THREE.LinearMipmapLinearFilter");
  });

  it("lays the start and shift-end screens out for landscape phones", () => {
    expect(ui).toContain("@media (orientation:landscape) and (max-height:560px)");
    expect(ui).toContain("grid-template-columns:minmax(0,1fr) minmax(146px,190px)");
    expect(ui).toMatch(/#ov \.shift-panel\{[\s\S]{0,260}display:grid/);
    expect(ui).toContain("@media (orientation:landscape) and (max-height:360px)");
  });

  it("installs as a PWA and opens the game inside a framed page", () => {
    expect(html).toContain('rel="manifest" href="manifest.webmanifest"');
    expect(index).toContain('src="game.html"');
    expect(index).toContain('rel="manifest" href="manifest.webmanifest"');
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
    expect(readFileSync("public/sw.js", "utf8")).toContain('addEventListener("fetch"');
  });

  it("lets the forklift carry parcels as an undocumented secret", () => {
    expect(game).toContain("function forkCargo");
    expect(game).toContain("function forkLoad");
    expect(game).toContain("function forkUnload");
    expect(game).toMatch(/if\(FD\.on\)\{\s*\n\s*if\(held\) forkUnload\(\)/);
    expect(game).toContain("gameRules.forklift.forkX");
    expect(game).toContain("gameRules.forklift.nearest");
    expect(html).not.toMatch(/الرافعة[^<]*تنقل|نقل الطرود بالرافعة/);
    expect(html).not.toMatch(/حمل الطرود بالرافعة/);
  });

  it("keeps the box-type hint between the two touch controls", () => {
    const controls =
      html.match(/<div id="controls-ui">([\s\S]*?)<\/div>\s*<div class="ov/)?.[1] ?? "";
    const joy = controls.indexOf('id="joy"');
    const hint = controls.indexOf('id="inspect"');
    const act = controls.indexOf('id="act"');
    expect(joy).toBeGreaterThan(-1);
    expect(hint).toBeGreaterThan(joy);
    expect(act).toBeGreaterThan(hint);
  });
});
