import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("public/game.html", "utf8");
const index = readFileSync("public/index.html", "utf8");
const ui = readFileSync("public/game/ui.css", "utf8");
const game = readFileSync("public/game/game.js", "utf8");
const rules = readFileSync("public/game/game-rules.js", "utf8");

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

  it("lowers ambience, effects and music in steps with separate controls", () => {
    expect(html).toContain('id="amb"');
    expect(html).toContain('id="snd"');
    expect(html).toContain('id="mus"');
    expect(game).toContain("function initAmbience");
    expect(game).toContain("const VOL_STEPS = [1, .6, .3, 0];");
    expect(game).toContain("function stepVol(ch)");
    expect(game).toMatch(/soundEnabled = audioLv\.snd > 0/);
    // كل المؤثرات تمر عبر ناقل المستوى، ولا يتجاوزه صوت مباشرة إلى المخرج
    const direct = (game.match(/connect\(actx\.destination\)/g) || []).length;
    expect(direct).toBe(2); // ناقل المستودع وناقل المؤثرات فقط
  });

  it("exposes mute toggles as pressed with Arabic accessible names", () => {
    expect(html).toMatch(/id="amb"[^>]*aria-label="صوت المستودع"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/id="snd"[^>]*aria-label="المؤثرات الصوتية"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/data-audio="amb"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/data-audio="snd"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/data-tips-toggle[^>]*aria-pressed="true"/);
    expect(game).toContain("setAttribute('aria-pressed'");
    expect(html).not.toContain('aria-label="sound"');
    expect(html).not.toContain('aria-label="warehouse sound"');
    expect(html).not.toContain('aria-label="pick/place"');
    expect(html).not.toContain('aria-label="dash"');
    expect(html).not.toContain('aria-label="exit to game shell"');
  });

  it("carries the settings dock and dust loop across the shift-end rebuild", () => {
    expect(game).toMatch(/const dock = \$\('corner-opts'\)/);
    expect(game).toMatch(/if\(dock\) o\.appendChild\(dock\)/);
    expect(game).toMatch(/if \(!cv\.isConnected\) \{ stop\(\); return; \}/);
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

  it("deducts 10 points (20 for a frozen parcel) and 2 seconds for a parcel that falls off the belt", () => {
    expect(game).toContain("const miss = it.data.isFrz ? gameRules.freezer.penalty : 10;");
    expect(game).toContain("time = Math.max(0, time - 2);");
  });

  it("adds a fourth stage limited to dangerous goods with three class containers", () => {
    expect(game).toContain("const STAGE_AT=gameRules.layout.stageThresholds()");
    expect(rules).toMatch(/const STAGE_AT = \[0, 0, 150, 350, 650\];/);
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
    expect(game).toContain("minFilter = THREE.LinearMipmapLinearFilter");
  });

  it("shows only the IMP code and class number on each DGR container", () => {
    // الكود ورقم الفئة فقط، بخط كبير يتقلص تلقائياً حتى يتسع للعرض
    expect(game).toContain("const code = (it.data.imp + ' - ' + it.data.div).toUpperCase();");
    expect(game).toContain("while(fs > 18 && ctx.measureText(code).width > W - 90){");
    expect(game).toContain("ctx.fillText(code, W/2, mid + 3);");
    // المواضع الفارغة تظل ظاهرة كشرطة باهتة
    expect(game).toContain("ctx.fillText('—', W/2, mid + 2);");
    // لا أسماء ولا عدّادات ولا تذييل فئات
    expect(game).not.toContain("ctx.fillText(cnt + '/' + z.cap, W-96, 58)");
    expect(game).not.toContain("const classInk = div =>");
    // كلاهما يعيد الرسم عند التغيير
    expect(game).toContain("z.items[i] = it; it.st = 'placed'; if(z.hz) drawZoneSign(z);");
    expect(game).toContain("z.items = []; z.full = false; if(z.hz) drawZoneSign(z);");
  });

  it("adds a 10-second IATA segregation study board behind the FOD pad", () => {
    // لوحة في العالم بين مجموعتَي الحاويات، وخلف صندوق FOD
    expect(game).toContain("const STUDY = { total: 10, left: 10");
    expect(game).toContain(
      "I18N.t('قف في المنطقة الخضراء أمام اللوحة — المراجعة بـ ١٠ نقاط مجانية'",
    );
    expect(game).toContain("STUDY.left = Math.max(0, STUDY.left - dt);");
    // الوقت يُستهلك فقط أثناء الوقوف أمام اللوحة، وساعة الوردية تتجمد
    expect(game).toContain(
      "const inZone = run && !fire.active && !fire.keypad && !EXIT_GATE.active && !introHold && !FD.on &&",
    );
    // الإنذار لا يجمّد اللعبة: يتوقف الوقت والحزام فقط أثناء إدخال الرقم أو المراجعة
    expect(game).toContain(
      "if(!fire.keypad && !STUDY.on && !jam.active){ time -= dt; evt.t += dt; }",
    );
    expect(game).toContain("const beltK = (fire.keypad || STUDY.on || jam.active) ? 0");
    // المراجعة تُعاد ضبطها مع كل جولة
    expect(game).toContain("STUDY.left = STUDY.total; STUDY.on = false; closeStudy();");
    expect(html).toContain('id="study"');
    expect(html).toContain('id="study-time"');
  });

  it("keeps the last chart row inside the board above the footer", () => {
    expect(game).toContain("const squeeze = total > avail ? avail / total : 1;");
    expect(game).toContain(
      "const lh = (fs + 10) * squeeze, rh = lines.length * lh + 10 * squeeze;",
    );
    expect(game).toContain("const footTop = h - 132, avail = footTop - top - 8, maxW = R - cList;");
  });

  it("does not claim certified compliance with the official chart", () => {
    expect(game).toContain("جدول مبسّط لأغراض التدريب فقط");
    expect(game).not.toContain("مطابقة للنص الرسمي");
  });

  it("wraps the segregation list inside the board width", () => {
    expect(game).toContain("if(!line || g.measureText(next).width <= maxW) line = next;");
    expect(game).toContain("const hasX = r.x.length > 0;");
  });

  it("lays the start and shift-end screens out for landscape phones", () => {
    expect(ui).toContain("@media (orientation:landscape) and (max-height:560px)");
    expect(ui).toContain("grid-template-columns:minmax(0,1fr) minmax(146px,190px)");
    expect(ui).toMatch(/@media \(orientation:landscape\) and \(max-height:560px\)\{\s*#ov \.ep-main\{/);
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

  it("starts from a single play button and persists tutorial completion", () => {
    expect(html).not.toContain('id="stageSelect"');
    expect(html).not.toContain('class="stage-select"');
    expect(game).not.toContain("stageSelectHTML");
    expect(game).not.toContain("maxUnlockedStage");
    expect(game).toContain("dgr_tutorial_completed");
    expect(game).toContain("function skipTutorial()");
    expect(game).toContain("setStage(gameRules.layout.stageForScore(stage, score))");
    expect(game).toContain("function safeSpawnPlayer()");
    expect(game).toContain("function findFreeSpot(x, z");
    // بداية الوردية فقط تعيد اللاعب إلى نقطة البداية؛ الترقّي أثناء اللعب يُبقيه في مكانه
    expect(game).toMatch(/function setStage\(n,silent\)\{[\s\S]{0,700}if\(silent\) safeSpawnPlayer\(\);/);
    expect(game).toMatch(/function setStage\(n,silent\)\{[\s\S]{0,900}blockedAt\(px\.x, px\.z\)[\s\S]{0,80}findFreeSpot\(px\.x, px\.z\)/);
  });

  it("matches the arcade scoring economy", () => {
    expect(game).toContain("gameRules.economy.comboAfter(streak)");
    expect(game).toContain("FEVER_TIME = 6");
    expect(game).toContain(
      "gameRules.economy.sortReward({ isHz: !!d.isHz, combo, fever: feverT > 0 })",
    );
    expect(game).toContain("gameRules.economy.comboAfter(streak)");
    expect(game).toContain("if(streak >= 10 && streak % 10 === 0) startFever();");
    expect(game).toContain("const pen = gameRules.economy.penalty(conflict);");
    expect(rules).toContain("critBonus: CRIT.bonus");
    expect(game).toContain("time += 5;");
    expect(game).toContain("score += 50;");
  });

  it("paces stages as sawtooth waves with breathing room and rush hours", () => {
    expect(game).toContain("const BREATH_SPAWN=[0,5,4.8,4.4,4]");
    expect(game).toContain("RUSH_EVERY=25, RUSH_COUNT=3");
    expect(game).toContain("RUSH_GAP=[0,2,1.9,1.7,1.5]");
    expect(game).toContain("spawnT = BREATH_SPAWN[stage];");
    expect(game).toContain("rushT = RUSH_EVERY; rushN = RUSH_COUNT; rushDelay = 0;");
    expect(game).toContain("spawnT = Math.max(spawnT, BREATH_SPAWN[stage] * 1.4);");
    expect(game).not.toContain("SPAWN_AT");
  });

  it("bundles three feedback tiers with hit-stop, trauma decay and screen flashes", () => {
    expect(html).toContain('id="screen-flash"');
    expect(game).toContain("const TRAUMA_DECAY = 1.2, HITSTOP_LARGE = .05;");
    expect(game).toContain("function hitStopNow(t = HITSTOP_LARGE)");
    expect(game).toContain("function screenFlash(kind)");
    expect(game).toContain("if(hitStop > 0){");
    expect(game).toContain("hitStop = Math.max(0, hitStop - Math.max(rawDt, 0));");
    expect(game).toContain("hitStopNow(.05); addShake(.6); screenFlash('gold');");
    expect(game).toContain("hitStopNow(.05); addShake(.6); screenFlash('red');");
    expect(game).toContain("if(!it.crit && (d.isHz || combo >= 3)){ addShake(.25); snd('crit'); }");
    const css = readFileSync("public/game/game.css", "utf8");
    expect(css).toContain(".float-tag.big");
    expect(css).toContain("#screen-flash.gold");
    expect(css).toContain("#screen-flash.red");
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
