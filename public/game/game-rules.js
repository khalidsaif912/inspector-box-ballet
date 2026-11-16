(function (root) {
  const isExplosive = (division) => division === "1" || division.startsWith("1.");
  const is1_4S = (division) => division === "1.4S";
  const isLithium = (item) => item.imp === "RLI";

  // X pairs from IATA DGR Table 9.3.A (2023). Class 1 (except 1.4S) and lithium
  // batteries (UN 3480/3090) are handled separately because their rows have exceptions.
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
    speed: 12,
    turnDuration: 1.5,
    turnRadius: 2,
    fodZoneX: 4.5,
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
      };
    },
    advance(state, dt, playerZ) {
      const result = { drop: false, entered: false };
      if (state.done) return result;
      state.elapsed += dt;
      if (!state.active) {
        if (state.elapsed < rules.startAt) return result;
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
        state.done = true;
        state.active = false;
      }
      return result;
    },
    position(state) {
      const angle = (state.turn / rules.turnDuration) * Math.PI * 2;
      return {
        x: state.x + (state.x === 0 && !state.turned ? Math.sin(angle) * rules.turnRadius : 0),
        z:
          state.lane +
          (state.x === 0 && !state.turned ? (1 - Math.cos(angle)) * rules.turnRadius : 0),
        yaw: Math.PI / 2 + (state.x === 0 && !state.turned ? angle : 0),
      };
    },
    touches(ax, az, bx, bz, px, pz) {
      const dx = bx - ax,
        dz = bz - az,
        length = dx * dx + dz * dz;
      const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length)) : 0;
      return Math.hypot(px - ax - dx * t, pz - az - dz * t) < 1.65;
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
    reach: 3.3,
    forkOffset: 1.95,
    carryY: 0.88,
    driveSpeed: 9.8,
    halfX: 1.15,
    halfZ: 0.78,
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

  root.WarehouseRules = rules;
})(globalThis);
