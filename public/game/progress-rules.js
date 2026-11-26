/* ===== تقدّم الموظف: المهام اليومية، الخبرة والرتب، ما تفتحه كل رتبة، شهادة DGR، النجاة، وأحداث الوردية =====
   منطق صِرف بلا DOM ولا تخزين: يُحمَّل في اللعبة والغلاف وصفحة الإدارة ويُختبر معزولاً (Vitest).
   الحالة كائن JSON عادي يحفظه المستدعي (localStorage / Firestore). */
(function (root) {
  "use strict";

  /* ---------- الرتب: حدّ الخبرة الأدنى لكل رتبة (تصاعدياً) ---------- */
  const RANKS = [
    { id: "trainee", xp: 0, icon: "🔰", ar: "متدرب", en: "Trainee" },
    { id: "handler", xp: 400, icon: "📦", ar: "مناول شحن", en: "Cargo Handler" },
    { id: "senior", xp: 1100, icon: "🧰", ar: "مناول أول", en: "Senior Handler" },
    { id: "assistant", xp: 2200, icon: "🔍", ar: "مفتش مساعد", en: "Assistant Inspector" },
    { id: "supervisor", xp: 3800, icon: "🎖️", ar: "مشرف وردية", en: "Shift Supervisor" },
    { id: "chief", xp: 6000, icon: "👑", ar: "مدير العمليات", en: "Operations Chief" },
  ];
  const rankIndex = (id) => RANKS.findIndex((r) => r.id === id);

  /* ---------- ما تفتحه كل رتبة: ألوان السترة، حلقة زر التسريع، شخصيات ---------- */
  // hex = لون السترة. سترة "orig" هي لون الخامة الأصلية (برتقالي سلامة) بلا إعادة تلوين.
  const UNLOCKS = [
    { kind: "vest", id: "orig", rank: "trainee", hex: null, swatch: "#ff7a1a", ar: "برتقالي سلامة", en: "Safety orange" },
    { kind: "vest", id: "lime", rank: "handler", hex: 0xd4ff00, swatch: "#d4ff00", ar: "أصفر فوسفوري", en: "Hi-vis yellow" },
    { kind: "vest", id: "green", rank: "senior", hex: 0x00e676, swatch: "#00e676", ar: "أخضر نيون", en: "Neon green" },
    { kind: "rim", id: "neon", rank: "senior", ar: "حلقة نيون لزر التسريع", en: "Neon boost ring" },
    { kind: "char", id: "robot", rank: "assistant", ar: "الروبوت", en: "Robot" },
    { kind: "vest", id: "blue", rank: "assistant", hex: 0x1e88e5, swatch: "#1e88e5", ar: "أزرق المفتشين", en: "Inspector blue" },
    { kind: "char", id: "vanguard", rank: "supervisor", ar: "فانغارد المدرّع", en: "Vanguard" },
    { kind: "rim", id: "gold", rank: "supervisor", ar: "حلقة ذهبية لزر التسريع", en: "Gold boost ring" },
    { kind: "vest", id: "gold", rank: "chief", hex: 0xffc107, swatch: "#ffc107", ar: "ذهبي المدير", en: "Chief gold" },
  ];
  const BASE_CHARS = ["worker", "timmy"]; // متاحة للجميع دائماً

  /* ---------- المهام اليومية ----------
     on[event](n, payload) => التقدم الجديد. التقدم لا ينقص بعد الإنجاز. */
  const MISSIONS = [
    {
      id: "fod_safe", goal: 3, xp: 150, ar: "اجمع 3 أجسام FOD دون أن تصدمك الرافعة", en: "Collect 3 FOD without being hit by the forklift",
      on: { fod: (n) => n + 1, hit: () => 0 },
    },
    {
      id: "cao_streak", goal: 5, xp: 200, ar: "أجب على 5 أسئلة CAO صحيحة متتالية", en: "Answer 5 CAO questions correctly in a row",
      on: { cao: (n, p) => (p && p.ok ? n + 1 : 0) },
    },
    { id: "fever2", goal: 2, xp: 120, ar: "فعّل وضع الحمى مرتين", en: "Trigger fever mode twice", on: { fever: (n) => n + 1 } },
    { id: "sort30", goal: 30, xp: 120, ar: "افرز 30 طرداً فرزاً صحيحاً", en: "Sort 30 parcels correctly", on: { sort: (n, p) => (p && p.ok ? n + 1 : n) } },
    { id: "nearmiss2", goal: 2, xp: 140, ar: "انجُ من الرافعة المتهورة مرتين في اللحظة الأخيرة", en: "Make 2 last-second escapes from the reckless forklift", on: { nearmiss: (n) => n + 1 } },
    { id: "pet", goal: 1, xp: 160, event: "pet", ar: "أمسك الحيوان الأليف وضعه في قفصه", en: "Catch the loose pet and put it in its cage", on: { pet: (n) => n + 1 } },
    { id: "vip", goal: 1, xp: 160, event: "vip", ar: "سلّم شحنة VIP قبل انتهاء وقتها", en: "Deliver a VIP shipment before its timer runs out", on: { vip: (n) => n + 1 } },
    { id: "ballet4", goal: 1, xp: 130, ar: "حقّق رقصة باليه ×4", en: "Reach a Ballet ×4 combo", on: { ballet: (n, p) => (p && p.count >= 4 ? 1 : n) } },
    { id: "score500", goal: 1, xp: 150, ar: "اجمع 500 نقطة في وردية واحدة", en: "Score 500 points in one shift", on: { round: (n, p) => (p && p.score >= 500 ? 1 : n) } },
    {
      id: "clean", goal: 1, xp: 130, ar: "أنهِ وردية بلا مخالفة من المفتش (150+ نقطة)", en: "Finish a shift with no inspector fine (150+ pts)",
      on: { round: (n, p) => (p && !p.fined && p.score >= 150 ? 1 : n) },
    },
  ];
  const missionById = (id) => MISSIONS.find((m) => m.id === id);
  const DAILY_COUNT = 3, DAILY_BONUS = 150;

  /* ---------- الخبرة ---------- */
  const ROUND_XP_CAP = 300;
  const roundXp = (score) => Math.max(0, Math.min(ROUND_XP_CAP, Math.round((+score || 0) / 4)));

  /* ---------- شهادة DGR: سلسلة قرارات خطرة صحيحة متتالية (أسئلة CAO + فرز المواد الخطرة) ---------- */
  const DGR_GOAL = 20;

  /* ---------- النجاة في اللحظة الأخيرة ---------- */
  const NEAR_MISS = { dist: 3.6, reward: 25, slowMo: 0.6, slowK: 0.35 };

  /* ---------- أحداث الوردية ---------- */
  const SHIFT_EVENTS = [
    { id: "blackout", icon: "🌙", dur: 22, ar: "انقطاع الكهرباء", en: "Power cut" },
    { id: "peak", icon: "⏩", dur: 25, belt: 1.3, mult: 2, ar: "ذروة الشحن", en: "Peak hour" },
    { id: "vip", icon: "📦", dur: 20, reward: 120, penalty: 30, ar: "شحنة VIP", en: "VIP shipment" },
    { id: "pet", icon: "🐈", dur: 45, reward: 80, ar: "حيوان أليف هارب", en: "Loose pet" },
  ];
  const eventById = (id) => SHIFT_EVENTS.find((e) => e.id === id);
  /* صعوبة مطاردة الحيوان الهارب بحسب الثواني منذ ظهوره (سرعة اللاعب 8.2 مشياً و≈11 مع الجري):
     القطة: أول 15 ث صعبة جداً، ثم 10 ث صعبة، ثم سهلة. الكلب أصعب في كل مرحلة ولا يصير سهلاً تماماً.
     flee: مسافة بدء الهروب · speed: سرعة الهروب · catch: مسافة الإمساك · juke: احتمال المراوغة الجانبية كل ثانية */
  const PET_CHASE = {
    cat: [
      { until: 15, flee: 7, speed: 10.2, catch: 1.35, juke: 0.9 },
      { until: 25, flee: 5.5, speed: 8, catch: 1.6, juke: 0.5 },
      { until: Infinity, flee: 3.5, speed: 4.5, catch: 2, juke: 0 },
    ],
    dog: [
      { until: 18, flee: 8, speed: 11, catch: 1.25, juke: 1.1 },
      { until: 30, flee: 6.5, speed: 9.4, catch: 1.45, juke: 0.7 },
      { until: Infinity, flee: 4.8, speed: 6.6, catch: 1.75, juke: 0.25 },
    ],
  };
  const petChase = (kind, t) => {
    const ph = PET_CHASE[kind] || PET_CHASE.cat, s = Math.max(0, +t || 0);
    return ph.find((p) => s < p.until) || ph[ph.length - 1];
  };
  // رمز يفتح كل الشخصيات على هذا الجهاز عند إدخاله في خانة الرقم الوظيفي
  const ALL_CHARS_CODE = "996785538715";
  const isAllCharsCode = (v) => String(v == null ? "" : v).replace(/\s+/g, "") === ALL_CHARS_CODE;
  const EVENT_WINDOW = [22, 55]; // ثوانٍ من بداية الوردية

  /* ---------- أدوات ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  // مولّد عشوائي حتمي من نص (mulberry32 على بصمة FNV-1a) — نفس مهام اليوم لكل الموظفين
  function seeded(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return function () {
      h = (h + 0x6d2b79f5) >>> 0;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const P = {
    RANKS, UNLOCKS, MISSIONS, SHIFT_EVENTS, BASE_CHARS, DAILY_COUNT, DAILY_BONUS, DGR_GOAL, NEAR_MISS, EVENT_WINDOW, ROUND_XP_CAP,
    dayKey, missionById, eventById, roundXp, PET_CHASE, petChase, isAllCharsCode,

    /* الرتبة الحالية وما بعدها */
    rankFor(xp) {
      xp = Math.max(0, +xp || 0);
      let i = 0;
      while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
      const rank = RANKS[i], next = RANKS[i + 1] || null;
      const span = next ? next.xp - rank.xp : 1;
      return { rank, index: i, next, toNext: next ? next.xp - xp : 0, frac: next ? Math.min(1, (xp - rank.xp) / span) : 1 };
    },
    rankTitle(xp, lang) { const r = P.rankFor(xp).rank; return r.icon + " " + (lang === "en" ? r.en : r.ar); },

    /* هل فُتح عنصر؟ الشخصيتان الأساسيتان مفتوحتان دائماً */
    isUnlocked(kind, id, xp) {
      if (kind === "char" && BASE_CHARS.indexOf(id) >= 0) return true;
      const u = UNLOCKS.find((x) => x.kind === kind && x.id === id);
      if (!u) return false;
      return P.rankFor(xp).index >= rankIndex(u.rank);
    },
    unlock(kind, id) { return UNLOCKS.find((x) => x.kind === kind && x.id === id) || null; },
    unlocksOf(kind) { return UNLOCKS.filter((x) => x.kind === kind); },
    unlocksAt(rankId) { return UNLOCKS.filter((x) => x.rank === rankId); },
    rankOf(rankId) { return RANKS[rankIndex(rankId)] || null; },

    /* مهام اليوم: ثلاث مهام مختلفة، حتمية بحسب التاريخ */
    dailyMissions(day) {
      const rng = seeded("acg-missions|" + day), ids = MISSIONS.map((m) => m.id);
      for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
      return ids.slice(0, DAILY_COUNT);
    },

    /* حالة جديدة / ضمان مهام اليوم الحالي (تُستبدل عند تغيّر اليوم، وتبقى الخبرة والشهادة) */
    fresh(day) {
      return { v: 1, xp: 0, day: "", missions: [], allDone: false, dgr: { streak: 0, best: 0, cert: false }, rounds: 0, ...(day ? P.ensureDay(null, day) : {}) };
    },
    ensureDay(state, day) {
      const s = state ? { ...state } : {};
      if (s.day === day && Array.isArray(s.missions) && s.missions.length === DAILY_COUNT) return s;
      s.day = day;
      s.missions = P.dailyMissions(day).map((id) => ({ id, n: 0, done: false }));
      s.allDone = false;
      return s;
    },
    normalize(state, day) {
      const base = { v: 1, xp: 0, day: "", missions: [], allDone: false, dgr: { streak: 0, best: 0, cert: false }, rounds: 0 };
      const s = { ...base, ...(state && typeof state === "object" ? state : {}) };
      s.xp = Math.max(0, Math.floor(+s.xp || 0));
      s.dgr = { ...base.dgr, ...(s.dgr || {}) };
      return P.ensureDay(s, day || dayKey());
    },

    /* أحداث اللعب الأحادية تمر من هنا. يعيد الحالة الجديدة وما حدث (مهام اكتملت، خبرة، ترقية، شهادة) */
    apply(state, event, payload) {
      const s = { ...state, missions: (state.missions || []).map((m) => ({ ...m })), dgr: { ...(state.dgr || {}) } };
      const out = { state: s, completed: [], xp: 0, allDone: false, rankUp: null, unlocked: [], certified: false };
      const before = P.rankFor(s.xp).index;
      for (const m of s.missions) {
        if (m.done) continue;
        const def = missionById(m.id), fn = def && def.on[event];
        if (!fn) continue;
        m.n = Math.max(0, Math.min(def.goal, fn(m.n, payload)));
        if (m.n >= def.goal) { m.done = true; out.completed.push(def); out.xp += def.xp; }
      }
      if (!s.allDone && s.missions.length && s.missions.every((m) => m.done)) { s.allDone = true; out.allDone = true; out.xp += DAILY_BONUS; }
      /* شهادة DGR */
      if (event === "dgr") {
        if (payload && payload.ok) {
          s.dgr.streak = (s.dgr.streak || 0) + 1;
          s.dgr.best = Math.max(s.dgr.best || 0, s.dgr.streak);
          if (!s.dgr.cert && s.dgr.streak >= DGR_GOAL) { s.dgr.cert = true; out.certified = true; }
        } else s.dgr.streak = 0;
      }
      if (event === "round") { s.rounds = (s.rounds || 0) + 1; out.xp += roundXp(payload && payload.score); }
      s.xp += out.xp;
      const after = P.rankFor(s.xp).index;
      if (after > before) {
        out.rankUp = { from: RANKS[before], to: RANKS[after] };
        for (let i = before + 1; i <= after; i++) out.unlocked.push(...P.unlocksAt(RANKS[i].id));
      }
      return out;
    },

    /* النجاة: الرافعة مرّت قريبة جداً واللاعب يتحرك ولم يُصدم، مرة واحدة لكل عبور */
    nearMiss(o) {
      return !!(o && o.active && o.moving && !o.hit && !o.already && !o.driving && o.dist < NEAR_MISS.dist);
    },

    /* حدث الوردية: عشوائي، مع ترجيح الحدث الذي تحتاجه مهمة يومية غير منجزة (حتى تكون المهام قابلة للإنجاز) */
    pickShiftEvent(rng, state) {
      rng = rng || Math.random;
      const need = (state && state.missions || []).filter((m) => !m.done).map((m) => (missionById(m.id) || {}).event).filter(Boolean);
      if (need.length && rng() < 0.6) return need[Math.floor(rng() * need.length)];
      return SHIFT_EVENTS[Math.floor(rng() * SHIFT_EVENTS.length)].id;
    },
    eventStartAt(rng) { rng = rng || Math.random; return EVENT_WINDOW[0] + rng() * (EVENT_WINDOW[1] - EVENT_WINDOW[0]); },

    /* مفتاح التخزين المحلي لكل لاعب */
    storageKey(playerId) { return "acg_prog_" + String(playerId || "local").replace(/[^\w-]/g, ""); },
  };

  root.WarehouseProgress = P;
})(typeof window !== "undefined" ? window : this);
