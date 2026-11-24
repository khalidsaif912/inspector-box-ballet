(function (root) {
  const isExplosive = (division) => division === "1" || division.startsWith("1.");
  const is1_4S = (division) => division === "1.4S";
  const isLithium = (item) => item.imp === "RLI";

  // مصدر واحد: صفوف لوحة الرسم تُشتق من conflict نفسها فلا تختلف عنها أبداً.
  // X pairs حسب جدول الفرز التعليمي المبني على IATA DGR Table 9.3.A / 9.3.2.
  const segregationPairs = new Set([
    "2.1+9",
    "3+5.1",
    "3+8",
    "3+9",
    "4.1+5.1",
    "4.1+9",
    "4.2+5.1",
    "4.3+8",
    "5.1+8",
    "5.1+9",
    "5.2+9",
  ]);
  const classOneSegregatesFrom = new Set([
    "2.1",
    "2.2",
    "2.3",
    "3",
    "4.1",
    "4.2",
    "4.3",
    "5.1",
    "5.2",
    "8",
  ]);

  const rules = {
    startAt: 12,
    // الرافعة المتهورة تعبر ثلاث مرات في الجولة، وفي كل مرة تُسقط جسماً غريباً بشكل مختلف.
    trips: 3,
    startAts: [12, 52, 92],
    speed: 12,
    turnDuration: 1.5,
    turnRadius: 2,
    fodZoneX: 1.7,
    fodReward: 50,
    fearDuration: 4,
    fearSpeed: 0.6,
    reset() {
      return {
        elapsed: 0,
        active: false,
        done: false,
        x: -36,
        lane: 3,
        turn: 0,
        turned: false,
        dropped: false,
        hit: false,
        trip: 0,
        trips: rules.trips,
        dz: 0,
      };
    },
    // تفادي العوائق: الرافعة المتهورة تنحرف جانبياً عن المفتش والرافعة التي يقودها اللاعب
    // obstacles: [{x, z, r}] — r نصف قطر العائق. تعيد إزاحة z الحالية بعد التنعيم.
    dodgeClear: 2.2,
    dodgeAhead: 14,
    dodgeRate: 8,
    laneMin: -4,
    laneMax: 8.5,
    // مسافة التلامس مع اللاعب (touches)، واللاعب عائق تتفاداه بهامش أوسع منها
    touchRadius: 2.3,
    playerR: 0.75,
    playerObstacle(x, z) {
      return { x, z, r: rules.playerR };
    },
    dodge(state, dt, obstacles) {
      if (!state.active) {
        state.dz = 0;
        return 0;
      }
      const p = rules.position(state);
      const z0 = p.z - (state.dz || 0);
      let target = 0;
      for (const o of obstacles || []) {
        const ahead = o.x - p.x;
        if (ahead < -(2.6 + (o.r || 0)) || ahead > rules.dodgeAhead) continue;
        const need = (o.r || 0) + rules.dodgeClear;
        const curZ = z0 + target;
        if (Math.abs(o.z - curZ) >= need) continue;
        // الجهة البعيدة عن العائق، والعكس إن خرجت عن حدود الممر
        // الجهة تُحسب من الموضع الفعلي (مع الإزاحة الحالية) كي لا تتأرجح عند تطابق الممر مع العائق
        let side = (target === 0 ? p.z : curZ) >= o.z ? 1 : -1;
        let goal = o.z + side * need;
        if (goal < rules.laneMin || goal > rules.laneMax) {
          side = -side;
          goal = o.z + side * need;
        }
        target = Math.max(rules.laneMin, Math.min(rules.laneMax, goal)) - z0;
      }
      const cur = state.dz || 0;
      const step = rules.dodgeRate * dt;
      state.dz = cur + Math.max(-step, Math.min(step, target - cur));
      return state.dz;
    },
    advance(state, dt, playerZ) {
      const result = { drop: false, entered: false, trip: state.trip || 0 };
      if (state.done) return result;
      state.elapsed += dt;
      if (!state.active) {
        const at = rules.startAts[state.trip || 0] !== undefined ? rules.startAts[state.trip || 0] : rules.startAt;
        if (state.elapsed < at) return result;
        state.active = true;
        state.lane = Math.max(-2, Math.min(6, playerZ));
        result.entered = true;
      }
      if (state.x < 0) state.x = Math.min(0, state.x + rules.speed * dt);
      else if (!state.turned) {
        state.turn = Math.min(rules.turnDuration, state.turn + dt);
        if (!state.dropped && state.turn >= rules.turnDuration / 2) {
          state.dropped = true;
          result.drop = true;
        }
        if (state.turn >= rules.turnDuration) state.turned = true;
      } else state.x += rules.speed * dt;
      if (state.x > 37) {
        state.active = false;
        if ((state.trip || 0) < (state.trips || 1) - 1) {
          // تجهيز العبور التالي
          state.trip = (state.trip || 0) + 1;
          state.x = -36;
          state.turn = 0;
          state.turned = false;
          state.dropped = false;
          state.hit = false;
          state.dz = 0;
        } else state.done = true;
      }
      return result;
    },
    position(state) {
      const angle = (state.turn / rules.turnDuration) * Math.PI * 2;
      return {
        x: state.x + (state.x === 0 && !state.turned ? Math.sin(angle) * rules.turnRadius : 0),
        z:
          state.lane +
          (state.dz || 0) +
          (state.x === 0 && !state.turned ? (1 - Math.cos(angle)) * rules.turnRadius : 0),
        yaw: Math.PI / 2 + (state.x === 0 && !state.turned ? angle : 0),
      };
    },
    touches(ax, az, bx, bz, px, pz) {
      const dx = bx - ax,
        dz = bz - az,
        length = dx * dx + dz * dz;
      const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length)) : 0;
      return Math.hypot(px - ax - dx * t, pz - az - dz * t) < rules.touchRadius;
    },
    reward(isFod, zone) {
      return isFod && zone === "fod" ? rules.fodReward : 0;
    },
    movementMultiplier(remaining) {
      return remaining > 0 ? rules.fearSpeed : 1;
    },
    conflict(a, b) {
      const da = a && a.div,
        db = b && b.div;
      if (!da || !db || da === db) return false;
      if (is1_4S(da) || is1_4S(db)) {
        const other = is1_4S(da) ? db : da;
        return isExplosive(other);
      }
      if (isExplosive(da) || isExplosive(db)) {
        const other = isExplosive(da) ? db : da;
        if (isExplosive(other)) return true;
        if (other === "9") return isLithium(isExplosive(da) ? b : a);
        return classOneSegregatesFrom.has(other);
      }
      const key = da < db ? da + "+" + db : db + "+" + da;
      if (!segregationPairs.has(key)) return false;
      if (da === "9" && !isLithium(a)) return false;
      if (db === "9" && !isLithium(b)) return false;
      return true;
    },
  };
  const emergency = {
    code: "24352888",
    musterX: 31,
    musterZ: 3.2,
    musterHX: 2.4,
    musterHZ: 2,
    codePoints: 80,
    positionPoints: 20,
    correct(value) {
      return String(value) === emergency.code;
    },
    inMuster(x, z) {
      return (
        Math.abs(x - emergency.musterX) <= emergency.musterHX &&
        Math.abs(z - emergency.musterZ) <= emergency.musterHZ
      );
    },
  };
  rules.emergency = emergency;
  // أسرار اللعبة: الرافعة تحمل الطرود — قواعد مشتركة صرفة بلا واجهة
  const forklift = {
    reach: 4.6,
    forkOffset: 2.85,
    carryY: 0.88,
    driveSpeed: 9.8,
    halfX: 2.06,
    halfZ: 1.04,
    nearest(list, x, z) {
      let best = null,
        bd = forklift.reach;
      for (const it of list) {
        const d = Math.hypot(it.x - x, it.z - z);
        if (d < bd) {
          bd = d;
          best = it;
        }
      }
      return best;
    },
    forkX(x, yaw) {
      return x + Math.sin(yaw) * forklift.forkOffset;
    },
    forkZ(z, yaw) {
      return z + Math.cos(yaw) * forklift.forkOffset;
    },
  };
  rules.forklift = forklift;
  // مراجع الحمل: عند إتلاف طرد يجب ألا يبقى أي مرجع (محمول أو في منتصف الرفع)
  // يشير إليه، وإلا صار طرداً شبحاً يُسقط أو يشغل خانة حاوية وهو غير مرئي.
  const hold = {
    forget(item, state) {
      const held = state && state.held === item ? null : (state ? state.held : null);
      const lifting = state && state.lifting === item ? null : (state ? state.lifting : null);
      return { held, lifting };
    },
  };
  rules.hold = hold;
  // لوحة المتصدرين المحلية: أي شكل غير متوقع في التخزين يُعامل كلوحة فارغة
  // بدل إسقاط شاشة النتائج، مع الإبقاء على كل صفوف سليمة موجودة.
  const board = {
    top(raw, limit = 5) {
      if (!Array.isArray(raw)) return [];
      const clean = [];
      for (const entry of raw) {
        const s = Number(entry && entry.s);
        if (!Number.isFinite(s) || s <= 0) continue;
        clean.push({ s: Math.round(s), d: entry && typeof entry.d === "string" ? entry.d : "" });
      }
      clean.sort((a, b) => b.s - a.s);
      return clean.slice(0, Math.max(1, limit));
    },
  };
  rules.board = board;

  // ===== اقتصاد الوردية (قيم مطابقة تماماً لما في game.js) =====
  const COMBO_MAX = 5, CHAIN_FROM = 4, CHAIN_STEP = 5, CHAIN_CAP = 40;
  const STREAK_WINDOW = 7, STREAK_WINDOW_AFTER = 5.5;
  const SORT_BASE = { hazardous: 25, regular: 10 };
  const PENALTY = { conflict: 35, mismatch: 15 };
  const CRIT = { bonus: 75, penalty: 40, time: 18, chillTimeBonus: 5 };
  const economy = {
    comboMax: COMBO_MAX,
    critBonus: CRIT.bonus,
    critPenalty: CRIT.penalty,
    critTime: CRIT.time,
    streakWindow(stage) {
      return stage === 1 ? STREAK_WINDOW : STREAK_WINDOW_AFTER;
    },
    // الكومبو يتبع السلسلة: كل 3 فرزات متتالية ترفع المضاعف حتى 5
    comboAfter(streak) {
      return Math.min(COMBO_MAX, 1 + Math.floor(streak / 3));
    },
    // نقاط الفرز الصحيح: أساس المادة الخطرة/العادية × الكومبو × مضاعف الحمّى
    sortReward(fields) {
      const base = fields.isHz ? SORT_BASE.hazardous : SORT_BASE.regular;
      return base * fields.combo * (fields.fever ? 2 : 1);
    },
    // مكافأة السلسلة الطويلة تبدأ بعد 4 فرزات متتالية
    chainBonus(streak) {
      return streak > CHAIN_FROM ? Math.min(CHAIN_CAP, (streak - CHAIN_FROM) * CHAIN_STEP) : 0;
    },
    penalty(conflict) {
      return conflict ? PENALTY.conflict : PENALTY.mismatch;
    },
    // نتيجة صندوق المفاجآت حسب رقم عشوائي في [0,1)
    mystery(r) {
      if (r < 0.25) return { kind: "time", amount: 12 };
      if (r < 0.5) return { kind: "score", amount: 60 };
      if (r < 0.7) return { kind: "combo", amount: COMBO_MAX };
      if (r < 0.85) return { kind: "slow", amount: 8 };
      return { kind: "timeLoss", amount: 6 };
    },
  };
  rules.economy = economy;

  // ===== الهندسة المكانية: الحزام والحاويات والمراحل =====
  const BH = 0.675, SLOT_PITCH = 1.37, SLOT_Y = 1.24, SLOT_Z = -8.6;
  const BELT_SPAWN = { x: -22.5, y: 0.74 + BH, z: 12 };
  const STAGE_AT = [0, 0, 150, 350, 650];
  const STAGE_BELT = [0, 1.4, 1.8, 2.3, 2.8];
  const FEVER_BOOST = 1.15;
  const layout = {
    beltSpawn() {
      return { x: BELT_SPAWN.x, y: BELT_SPAWN.y, z: BELT_SPAWN.z };
    },
    // سرعة الحزام بحسب المرحلة، مضروبة في مضاعف الحمّى أثناءها
    beltSpeed(stage, fever) {
      return STAGE_BELT[stage] * (fever ? FEVER_BOOST : 1);
    },
    // موضع الطرد داخل الحاوية رقم i (نفس صفوف/أعمدة الحاوية)
    containerSlot(zone, i) {
      const rows = zone.cap / zone.cols;
      return {
        x: zone.x + ((i % zone.cols) - (zone.cols - 1) / 2) * SLOT_PITCH,
        y: SLOT_Y,
        z: SLOT_Z + (Math.floor(i / zone.cols) - (rows - 1) / 2) * SLOT_PITCH,
      };
    },
    // المرحلة التالية بعد تجاوز عتبة نقاطها
    stageForScore(stage, score) {
      return stage < 4 && score >= STAGE_AT[stage + 1] ? stage + 1 : stage;
    },
    stageThresholds() {
      return STAGE_AT.slice();
    },
    stageProgress(stage, score) {
      if (stage >= 4) return { shown: score, cap: score, percent: 100 };
      const cap = STAGE_AT[stage + 1], base = STAGE_AT[stage];
      const shown = Math.min(score, cap);
      return { shown, cap, percent: Math.max(0, Math.min(100, ((shown - base) / (cap - base)) * 100)) };
    },
  };
  rules.layout = layout;

  // ===== قرار وضع الطرد في حاوية (منطق خالص بلا رسائل ولا مشهد) =====
  const placement = {
    // يعيد: ok (صحيح) أو conflict (مخالفة جسيمة تستحق العقوبة الكبرى)
    // أو reject عند وضع مادة خطرة في منطقة شحن عادي.
    decide(zone, item, placedItems) {
      const list = placedItems || [];
      // طرد CAO لا يُحمّل على أي رحلة في هذه اللعبة (كل الرحلات ركاب)
      if (item && item.cao) return { ok: false, conflict: true, reason: "cao-pax" };
      if (zone && zone.hz) {
        if (!item.isHz) return { ok: false, conflict: true, reason: "hazardous-only" };
        for (const other of list) {
          if (rules.conflict(item, other.data || other)) {
            return { ok: false, conflict: true, reason: "iata-conflict" };
          }
        }
        return { ok: true, conflict: false, reason: "" };
      }
      if (zone && zone.k === item.t) return { ok: true, conflict: false, reason: "" };
      return item.isHz
        ? { ok: false, conflict: true, reason: "hazardous-in-general" }
        : { ok: false, conflict: false, reason: "wrong-zone" };
    },
  };
  rules.placement = placement;

  // ===== شحنة CAO (Cargo Aircraft Only): طائرات الشحن فقط =====
  // جدول الرحلات في اللعبة كله ركاب، لذلك أي طرد يحمل ملصق CAO ممنوع تحميله
  // ويجب رفضه عند الفحص. القرار والسبب يُحسبان هنا فقط، والواجهة تعرضهما.
  const cao = {
    label: "CAO",
    // أكواد IATA التي لا تُشحن على طائرات الركاب
    codes: ["RPG", "ROX", "RRY", "RLI"],
    flights: [
      { id: "WY412", from: "MCT", to: "DXB", pax: true },
      { id: "WY608", from: "MCT", to: "KHI", pax: true },
      { id: "WY231", from: "MCT", to: "BOM", pax: true },
    ],
    answer: "reject",
    reward: 45,
    penalty: 30,
    // المفتش يسأل عن شحنات CAO ثلاث مرات فقط في الوردية الواحدة
    maxAsks: 3,
    isCao(imp) {
      return cao.codes.indexOf(imp) >= 0;
    },
    flightFor(seed) {
      const n = Math.abs(Math.floor(Number(seed) || 0));
      return cao.flights[n % cao.flights.length];
    },
    // قبول/رفض الطرد على رحلة محددة: رحلة ركاب ⇒ رفض إلزامي
    decide(item, flight) {
      if (!item || !item.cao) return { accept: true, code: "ok", reason: "" };
      if (flight && !flight.pax) return { accept: true, code: "cao-cargo", reason: "cargo-aircraft" };
      return { accept: false, code: "cao-pax", reason: "cargo-aircraft-only" };
    },
    correct(option) {
      return option === cao.answer;
    },
    hasCargoFlights() {
      return cao.flights.some((f) => !f.pax);
    },
  };
  rules.cao = cao;

  // ===== جدول الفرز IATA DGR 9.3.A: صفوف اللوحة تُشتق من نفس قاعدة conflict =====
  // فيستحيل أن تختلف اللوحة المعروضة عن منطق الفرز الفعلي.
  const hazardCodes = [
    { imp: "RGX", cls: "1.3G" },
    { imp: "RXS", cls: "1.4S" },
    { imp: "RFG", cls: "2.1" },
    { imp: "RNG", cls: "2.2" },
    { imp: "RPG", cls: "2.3" },
    { imp: "RFL", cls: "3" },
    { imp: "RFS", cls: "4.1" },
    { imp: "RSC", cls: "4.2" },
    { imp: "RFW", cls: "4.3" },
    { imp: "ROX", cls: "5.1" },
    { imp: "ROP", cls: "5.2" },
    { imp: "RPB", cls: "6.1" },
    { imp: "RIS", cls: "6.2" },
    { imp: "RRY", cls: "7" },
    { imp: "RCM", cls: "8" },
    { imp: "RLI", cls: "9" },
    { imp: "RMD", cls: "9" }
  ];
  const segregation = {
    edition: "IATA DGR 67th Edition — 2026",
    table: "Table 9.3.A · 9.3.2",
    codes: hazardCodes,
    rows: hazardCodes.map((c) => ({
      imp: c.imp,
      cls: c.cls,
      x: hazardCodes
        .filter((o) => o.imp !== c.imp && rules.conflict({ div: c.cls, imp: c.imp }, { div: o.cls, imp: o.imp }))
        .map((o) => o.imp)
    }))
  };
  rules.segregation = segregation;

  // ===== تقييم نهاية الوردية =====
  const scoreboard = {
    accuracy(sorted, processed) {
      return processed > 0 ? Math.round((sorted / processed) * 100) : 0;
    },
    grade(score, accuracy) {
      if (score >= 500 && accuracy >= 90) return "s";
      if (score >= 350 && accuracy >= 80) return "a";
      if (score >= 200) return "b";
      return "c";
    },
    stars(grade) {
      return { s: 5, a: 4, b: 3, c: 2 }[grade];
    },
    hubStars(stars) {
      return Math.max(1, Math.min(3, Math.round((stars * 3) / 5)));
    },
  };
  rules.scoreboard = scoreboard;

  // غرفة التجميد: لغز انزلاقي 3×3 يفتح باب الغرفة قبل إدخال الطرد المجمّد.
  // الصفوف (من الأعلى) نطاقات الحرارة: COL 2–8°C · CRT 15–25°C · FRZ 0°C وما دونها.
  // القطع: 3 COL + 3 CRT + 2 FRZ وخانة فارغة. يُحل اللغز حين تقع كل قطعة في صف نطاقها.
  // الخلط يبدأ من الوضع المحلول بحركات قانونية فقط، فكل لوحة قابلة للحل دائماً.
  const freezer = (() => {
    const ROWS = ["COL", "CRT", "FRZ"];
    const BANDS = ["2–8°C", "15–25°C", "0°C"];
    const SOLVED = ["COL", "COL", "COL", "CRT", "CRT", "CRT", "FRZ", "FRZ", null];
    const neighbors = (i) => {
      const r = Math.floor(i / 3);
      const c = i % 3;
      const out = [];
      if (r > 0) out.push(i - 3);
      if (r < 2) out.push(i + 3);
      if (c > 0) out.push(i - 1);
      if (c < 2) out.push(i + 1);
      return out;
    };
    const isSolved = (board) =>
      Array.isArray(board) &&
      board.length === 9 &&
      board.filter((t) => t === null).length === 1 &&
      board.every((t, i) => t === null || ROWS[Math.floor(i / 3)] === t) &&
      ["COL", "CRT", "FRZ"].every((k) => board.filter((t) => t === k).length === SOLVED.filter((t) => t === k).length);
    const move = (board, i) => {
      if (!Array.isArray(board) || i < 0 || i > 8 || board[i] === null) return null;
      const blank = board.indexOf(null);
      if (!neighbors(i).includes(blank)) return null;
      const next = board.slice();
      next[blank] = next[i];
      next[i] = null;
      return next;
    };
    const shuffle = (rng, moves) => {
      const rnd = typeof rng === "function" ? rng : Math.random;
      let board = SOLVED.slice();
      let prev = -1;
      for (let n = 0; n < (moves || 60); n++) {
        const blank = board.indexOf(null);
        const opts = neighbors(blank).filter((i) => i !== prev);
        const pick = opts[Math.floor(rnd() * opts.length) % opts.length];
        prev = blank;
        board = move(board, pick);
      }
      // لوحة محلولة أو قريبة جداً من الحل لا تُعطى للاعب
      return isSolved(board) ? shuffle(rnd, (moves || 60) + 7) : board;
    };
    return {
      ROWS,
      BANDS,
      SOLVED,
      neighbors,
      isSolved,
      move,
      shuffle,
      // ظهور الطرد المجمّد على الحزام: مرة واحدة في كل مرة، بعد أول طرود، وبنسبة محدودة.
      spawnChance: 0.11,
      minProcessed: 2,
      shouldSpawn(ctx) {
        if (!ctx || ctx.present) return false;
        if ((ctx.processed || 0) < freezer.minProcessed) return false;
        const rnd = typeof ctx.rng === "function" ? ctx.rng : Math.random;
        return rnd() < freezer.spawnChance;
      },
      reward: { score: 50, time: 8 },
      // فتح الباب بحل اللغز، وغرامة فوات الطرد المجمّد أو ترك الباب مقفلاً.
      unlockBonus: 30,
      penalty: 20,
      // بعد إدخال الطرد يبقى الباب مفتوحاً ثوانيَ ثم يُقفل من جديد؛ ويبقى أطول إن حُلّ اللغز بلا طرد.
      closeAfterDelivery: 2.6,
      closeIdle: 18,
    };
  })();
  rules.freezer = freezer;

  // ===== انسداد الحزام + الطرد الثقيل + لغز بطاقات تشغيل الرافعة (كلها داخل المستودع) =====
  // الحزام يتوقف (يتجمد الوقت) حين تتراكم الصناديق عليه فوق الحد، ولا يعود حتى تُنقل الزائدة إلى مناطقها.
  const belt = {
    jamAt: 9,
    clearAt: 4,
    clearReward: 20,
    warnAt: 7,
    jammed(count) {
      return count >= belt.jamAt;
    },
    cleared(count) {
      return count <= belt.clearAt;
    },
  };
  rules.belt = belt;

  // طرد واحد ثقيل لا يُرفع باليد؛ تنقله الرافعة إلى منطقته الصحيحة (+50)
  const heavy = {
    kg: 850,
    deliverReward: 50,
    solveReward: 100,
    failPenalty: 50,
    window: [30, 75],
    canLiftByHand(item) {
      return !(item && item.isHeavy);
    },
  };
  rules.heavy = heavy;

  // لغز البطاقات: 9 بطاقات = 4 ملصقات مواد خطرة + 4 أكواد مطابقة + بطاقة شرارة (ألعاب نارية).
  // يُقلب ملصق مع كوده فيتطابقان. المهلة 60 ثانية.
  const cards = {
    seconds: 60,
    pairs: 4,
    size: 9,
    wildTimeBonus: 10,
    build(pool, rng) {
      const rnd = typeof rng === "function" ? rng : Math.random;
      const seen = new Set();
      const uniq = (pool || []).filter((e) => e && !seen.has(e.key) && seen.add(e.key));
      const picked = [];
      const bag = uniq.slice();
      while (picked.length < cards.pairs && bag.length) picked.push(bag.splice(Math.floor(rnd() * bag.length), 1)[0]);
      const deck = [];
      picked.forEach((e, i) => {
        deck.push({ id: "L" + i, key: e.key, kind: "label", data: e });
        deck.push({ id: "C" + i, key: e.key, kind: "code", data: e });
      });
      deck.push({ id: "W", key: "wild", kind: "wild", data: null });
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      return deck;
    },
    isPair(a, b) {
      return !!a && !!b && a.id !== b.id && a.kind !== "wild" && b.kind !== "wild" && a.key === b.key && a.kind !== b.kind;
    },
    won(deck, matched) {
      return deck.filter((c) => c.kind !== "wild").every((c) => matched.has(c.id));
    },
  };
  rules.cards = cards;

  // كومبو الرقصة: فرزات صحيحة متتالية والمفتش يتحرك بلا توقف بينها.
  // الوقوف أكثر من maxIdle ثانية أو مرور maxGap ثانية بلا فرز أو خطأ فرز ⇒ تنكسر الرقصة.
  // عند الفرزة الثالثة وكل فرزة بعدها: "Ballet xN!" ومكافأة تكبر حتى سقف.
  const ballet = {
    minChain: 3,
    maxIdle: 1.2,
    maxGap: 8,
    bonusStep: 20,
    bonusCap: 100,
    spinSeconds: 0.75,
    initial() {
      return { count: 0, idle: 0, gap: 0 };
    },
    bonus(count) {
      return count >= ballet.minChain ? Math.min(ballet.bonusCap, (count - ballet.minChain + 1) * ballet.bonusStep) : 0;
    },
    // يُستدعى كل إطار؛ يعيد حالة جديدة (count=0 إن انكسرت الرقصة)
    tick(state, dt, moving) {
      if (!state.count) return ballet.initial();
      const idle = moving ? 0 : state.idle + dt;
      const gap = state.gap + dt;
      if (idle > ballet.maxIdle || gap > ballet.maxGap) return ballet.initial();
      return { count: state.count, idle, gap };
    },
    // فرزة صحيحة: تزيد العدّاد وتعيد مكافأة الرقصة إن بلغت الحد الأدنى
    onSort(state) {
      const count = state.count + 1;
      const bonus = ballet.bonus(count);
      return { state: { count, idle: 0, gap: 0 }, triggered: bonus > 0, count, bonus };
    },
    onMiss() {
      return ballet.initial();
    },
  };
  rules.ballet = ballet;

  root.WarehouseRules = rules;
})(globalThis);
