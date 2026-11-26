/* ===== تقدّم الموظف داخل اللعبة: المهام اليومية، الرتبة واللقب، ما تفتحه الرتب، النجاة، وأحداث الوردية =====
   القواعد الصِّرفة في progress-rules.js (WarehouseProgress). هذا الملف يربطها بمشهد اللعبة وواجهتها،
   ويُحمَّل بعد game.js فيستعمل دواله ومتغيراته العامة (score، px، items، S، snd، toast، …).
   game.js يستدعيه عبر window.Prog في نقاط محددة فقط (progEmit، tick، act، onSpawn، roundStart/End…). */
(function () {
  'use strict';
  const WP = window.WarehouseProgress;
  if (!WP) return;
  const T = (ar, en) => I18N.T(ar, en);
  const en = () => I18N.lang === 'en';
  const nm = o => (en() ? o.en : o.ar);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  /* ================= الحالة المحفوظة لكل لاعب ================= */
  let pid = null, st = null;
  const playerId = () => { try { const p = window.Online && Online.player(); return p ? p.id : 'local'; } catch (e) { return 'local'; } };
  function load(id) {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(WP.storageKey(id)) || 'null'); } catch (e) {}
    return WP.normalize(raw, WP.dayKey());
  }
  function save() { try { localStorage.setItem(WP.storageKey(pid), JSON.stringify(st)); } catch (e) {} }
  function ensure() {
    const id = playerId();
    if (id !== pid) { pid = id; st = load(id); pullRemote(); }
    st = WP.ensureDay(st, WP.dayKey());
    return st;
  }
  /* جهاز جديد: نأخذ الخبرة والشهادة الأعلى من الخادم (لا تنقص أبداً) */
  function pullRemote() {
    const id = pid;
    if (!window.Online || !Online.remoteProgress || id === 'local') return;
    Online.remoteProgress().then(r => {
      if (!r || id !== pid) return;
      let ch = false;
      if (r.xp > st.xp) { st.xp = r.xp; ch = true; }
      if (r.dgr && !st.dgr.cert) { st.dgr.cert = true; ch = true; }
      if (r.dgrBest > (st.dgr.best || 0)) { st.dgr.best = r.dgrBest; ch = true; }
      if (ch) { save(); refreshAll(); }
    }).catch(() => {});
  }
  function pushRemote() {
    try {
      if (!window.Online || !Online.saveProgress) return;
      const r = WP.rankFor(st.xp).rank;
      Online.saveProgress({ xp: st.xp, rank: r.id, dgr: st.dgr.cert, dgrBest: st.dgr.best }).catch(() => {});
    } catch (e) {}
  }
  const xpNow = () => ensure().xp;

  /* ================= الملف الشخصي: الاسم + اللقب (للغلاف عبر postMessage) ================= */
  function profile() {
    const s = ensure(), r = WP.rankFor(s.xp);
    let name = '';
    try { const p = Online.player(); if (p) name = p.guest ? T('ضيف', 'Guest') + ' #' + String(p.id).slice(2) : Online.nameOf(p.id, I18N.lang, p.name); } catch (e) {}
    /* لا أحد مسجَّل بعد: لا لقب يُعرض في الغلاف */
    if (pid === 'local') return { type: 'acg-profile', id: pid, name: '', rank: null };
    return { type: 'acg-profile', id: pid, name, xp: s.xp, rank: r.rank.id, icon: r.rank.icon, title: nm(r.rank), next: r.next ? nm(r.next) : '', toNext: r.toNext, frac: r.frac, dgr: !!s.dgr.cert };
  }
  function broadcast() {
    const p = profile();
    try { if (p.rank) localStorage.setItem('acg_profile', JSON.stringify({ xp: p.xp, rank: p.rank, name: p.name, dgr: p.dgr })); else localStorage.removeItem('acg_profile'); } catch (e) {}
    try { if (parent !== window) parent.postMessage(p, location.origin); } catch (e) {}
  }
  const rankBadge = (xp, withDgr) => {
    const r = WP.rankFor(xp).rank;
    return '<span class="rk-badge rk-' + r.id + '">' + r.icon + ' ' + esc(nm(r)) + '</span>' + (withDgr ? '<span class="rk-dgr" title="' + esc(T('معتمد في نقل المواد الخطرة', 'Certified in dangerous goods handling')) + '">🎓 ' + T('معتمد DGR', 'DGR certified') + '</span>' : '');
  };

  /* ================= واجهة: بطاقة المهام في شاشة البداية + شارة المهام في اللعب ================= */
  function missionRows(s, compact) {
    return s.missions.map(m => {
      const d = WP.missionById(m.id); if (!d) return '';
      const pct = Math.round(m.n / d.goal * 100);
      return '<li class="ms' + (m.done ? ' done' : '') + '"><i class="ms-ck" aria-hidden="true">' + (m.done ? '✓' : '') + '</i>' +
        '<span class="ms-t">' + esc(nm(d)) + '</span>' +
        '<span class="ms-n">' + (m.done ? '+' + d.xp + ' XP' : m.n + '/' + d.goal) + '</span>' +
        (compact ? '' : '<i class="ms-bar"><b style="width:' + pct + '%"></b></i>') + '</li>';
    }).join('');
  }
  function renderCard() {
    const login = document.getElementById('login'); if (!login) return;
    /* اللقب بجانب اسم الموظف المسجَّل */
    const who = document.getElementById('who-name');
    if (who) {
      let wr = document.getElementById('who-rank');
      if (!wr) { wr = el('span', 'who-rank'); wr.id = 'who-rank'; who.parentNode.insertBefore(wr, who.nextSibling); }
      wr.innerHTML = pid === 'local' ? '' : rankBadge(ensure().xp, ensure().dgr.cert);
    }
    let c = document.getElementById('missions');
    if (!c) {
      c = el('section', 'missions-card'); c.id = 'missions'; c.setAttribute('aria-label', T('مهام اليوم', "Today's missions"));
      const slot = document.getElementById('missions-slot');   // لوحة «مهام اليوم» المستقلة في شاشة البداية
      if (slot) slot.appendChild(c); else login.parentNode.insertBefore(c, login.nextSibling);
    }
    const s = ensure(), r = WP.rankFor(s.xp), done = s.missions.filter(m => m.done).length;
    c.innerHTML =
      '<div class="mc-rank">' + rankBadge(s.xp, s.dgr.cert) +
        '<span class="mc-xp">' + s.xp + (r.next ? ' / ' + r.next.xp : '') + ' XP</span></div>' +
      '<i class="mc-bar" title="' + esc(r.next ? T('الرتبة التالية: ', 'Next rank: ') + nm(r.next) : T('أعلى رتبة', 'Top rank')) + '"><b style="width:' + Math.round(r.frac * 100) + '%"></b></i>' +
      '<div class="mc-head"><b>🎯 ' + T('مهام اليوم', "Today's missions") + '</b><span>' + done + '/' + s.missions.length + (s.allDone ? ' · +' + WP.DAILY_BONUS + ' XP ✓' : '') + '</span></div>' +
      '<ul class="ms-list">' + missionRows(s, false) + '</ul>' +
      (s.dgr.cert ? '' : '<div class="mc-dgr">🎓 ' + T('شهادة DGR: ', 'DGR certificate: ') + (s.dgr.streak || 0) + '/' + WP.DGR_GOAL + ' ' + T('قرار خطر صحيح متتالٍ', 'correct dangerous-goods calls in a row') + '</div>');
  }
  function renderHud() {
    const stg = document.getElementById('stg'); if (!stg) return;
    let b = document.getElementById('mhud');
    if (!b) {
      b = el('button', 'chip mhud'); b.id = 'mhud'; b.type = 'button';
      b.setAttribute('aria-expanded', 'false');
      b.onclick = e => { e.stopPropagation(); const open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', open ? 'true' : 'false'); };
      stg.parentNode.insertBefore(b, stg.nextSibling);
    }
    const s = ensure(), r = WP.rankFor(s.xp), done = s.missions.filter(m => m.done).length;
    b.title = nm(r.rank) + ' — ' + T('مهام اليوم', "Today's missions");
    b.innerHTML = '<span class="mh-sum"><i class="mh-ico">' + r.rank.icon + '</i><span class="mh-txt"><span class="mh-l">' + T('مهام اليوم', 'Missions') + '</span><span class="mh-pips">' + s.missions.map(m => '<i' + (m.done ? ' class="on"' : '') + '></i>').join('') + '</span></span><b>' + done + '/' + s.missions.length + '</b></span>' +
      '<span class="mh-pop"><span class="mh-rank">' + rankBadge(s.xp, s.dgr.cert) + '</span><ul class="ms-list">' + missionRows(s, true) + '</ul></span>';
  }
  function refreshAll() { renderCard(); renderHud(); buildPickers(); broadcast(); }

  /* ================= ما تفتحه الرتب: السترة، حلقة زر التسريع، الشخصيات ================= */
  const VEST_KEY = 'acg_vest2', ORIG_PROC = 0xff6d00;
  const OUTFITS = {   // الشخصيات المشتقة من مجسّم العامل
    worker: {},
    timmy: {},
  };
  const CHAR_LIST = [
    { id: 'worker', ico: '👷', ar: 'عامل المستودع', en: 'Warehouse worker', hintAr: 'الأساسية', hintEn: 'Default' },
    { id: 'timmy', ico: '🧢', ar: 'تيمي المرح', en: 'Timmy', hintAr: 'كرتوني', hintEn: 'Cartoon' },
    { id: 'robot', ico: '🤖', ar: 'الروبوت', en: 'Robot', hintAr: 'آلي', hintEn: 'Mechanical' },
    { id: 'mremireh', ico: '👾', ar: 'مريمير الغريب', en: 'Mremireh', hintAr: 'غريب الأطوار', hintEn: 'Weirdo' },
  ];
  const vestOpen = id => WP.isUnlocked('vest', id, xpNow());
  function vestId() {
    let v = 'orig'; try { v = localStorage.getItem(VEST_KEY) || 'orig'; } catch (e) {}
    return WP.unlock('vest', v) && vestOpen(v) ? v : 'orig';
  }
  let procVest = null;
  function procVestMats() {
    if (procVest) return procVest;
    procVest = [];
    try { rig.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === C_VEST) procVest.push(o.material); }); procVest.push(forkVest.material); } catch (e) {}
    return procVest;
  }
  function applyOutfit() {
    const v = WP.unlock('vest', vestId()), hex = v ? v.hex : null;
    procVestMats().forEach(m => m.color.setHex(hex == null ? ORIG_PROC : hex));
    const look = OUTFITS[CHAR.id] || {};
    try { for (const id in MIX) { const inst = MIX[id].inst; if (inst && inst.setOutfit) inst.setOutfit(Object.assign({}, look, { Vest: hex })); } } catch (e) {}
    /* حلقة زر التسريع: أعلى حلقة مفتوحة */
    const b = document.getElementById('dash-btn');
    if (b) { const rim = WP.isUnlocked('rim', 'gold', xpNow()) ? 'gold' : WP.isUnlocked('rim', 'neon', xpNow()) ? 'neon' : ''; if (rim) b.dataset.rim = rim; else delete b.dataset.rim; }
  }
  /* رمز فتح كل الشخصيات (يُدخل في خانة الرقم الوظيفي) يُحفظ على هذا الجهاز */
  const ALL_KEY = 'acg_all_chars';
  const allChars = () => { try { return localStorage.getItem(ALL_KEY) === '1'; } catch (e) { return false; } };
  const charOpen = (id, xp) => allChars() || WP.isUnlocked('char', id, xp);
  function unlockAllChars() {
    try { localStorage.setItem(ALL_KEY, '1'); } catch (e) {}
    buildPickers(); cue('rank');
  }
  const lockText = u => '🔒 ' + T('تُفتح برتبة ', 'Unlocks at ') + nm(WP.rankOf(u.rank));
  /* رسالة الشخصية المقفلة: ما الرتبة المطلوبة، وكم نقطة خبرة بقيت، وكيف تُجمع */
  function charLockMsg(c, u) {
    const r = WP.rankOf(u.rank), left = Math.max(0, r.xp - xpNow());
    return '🔒 ' + T(c.ar + ': تُفتح برتبة ' + r.icon + ' ' + r.ar + ' — بقي ' + left + ' نقطة خبرة. اجمعها بفرز الطرود صحيحاً وإنجاز مهام اليوم.',
      c.en + ': unlocks at ' + r.icon + ' ' + r.en + ' — ' + left + ' XP to go. Earn it by sorting parcels correctly and finishing daily missions.');
  }
  function buildPickers() {
    const xp = xpNow();
    const row = document.getElementById('skins');
    if (row) {
      const cur = vestId();
      row.innerHTML = '';
      WP.unlocksOf('vest').forEach(u => {
        const open = WP.isUnlocked('vest', u.id, xp);
        const b = el('button', 'vest-sw' + (open ? '' : ' lock') + (u.id === cur ? ' on' : ''));
        b.type = 'button'; b.dataset.v = u.id; b.style.background = u.swatch;
        b.title = nm(u) + (open ? '' : ' — ' + lockText(u));
        b.setAttribute('aria-label', b.title);
        b.setAttribute('aria-pressed', u.id === cur ? 'true' : 'false');
        if (!open) b.innerHTML = '<i aria-hidden="true">🔒</i>';
        b.onclick = e => {
          e.stopPropagation();
          if (!open) { toast(lockText(u), '#ffd54a'); return; }
          try { localStorage.setItem(VEST_KEY, u.id); } catch (err) {}
          buildPickers(); applyOutfit();
        };
        row.appendChild(b);
      });
    }
    const chars = document.getElementById('chars');
    if (chars) {
      chars.innerHTML = '';
      CHAR_LIST.forEach(c => {
        const u = WP.unlock('char', c.id), open = charOpen(c.id, xp);
        const b = el('button', open ? '' : 'lock'); b.type = 'button'; b.dataset.char = c.id; b.setAttribute('role', 'radio');
        /* المقفلة تظهر خافتة خلف القفل مع اسمها والرتبة المطلوبة */
        b.innerHTML = '<span class="pk-ph" aria-hidden="true"><span class="pk-ico">' + c.ico + '</span>' + (open ? '' : '<i class="pk-lock">🔒</i>') + '</span><span class="pk-tx"><b>' + esc(en() ? c.en : c.ar) + '</b><small>' + esc(open ? (en() ? c.hintEn : c.hintAr) : WP.rankOf(u.rank).icon + ' ' + nm(WP.rankOf(u.rank))) + '</small></span>';
        if (!open) { b.title = lockText(u); b.setAttribute('aria-disabled', 'true'); b.setAttribute('aria-label', (en() ? c.en : c.ar) + ' — ' + lockText(u)); }
        b.onclick = e => { e.stopPropagation(); if (!open) { const msg = charLockMsg(c, u); try { charStatus(msg); const st = document.getElementById('char-status'); if (st) st.classList.add('char-lock-msg'); } catch (err) {} toast(msg, '#ffd54a', 5000); return; } const st = document.getElementById('char-status'); if (st) st.classList.remove('char-lock-msg'); window.__setCharacter(c.id); };
        chars.appendChild(b);
      });
      /* شبكة 3×2: الخانات الفارغة محجوزة لشخصيات قادمة */
      for (let i = CHAR_LIST.length; i < 6; i++) {
        const q = el('div', 'char-soon'); q.setAttribute('aria-hidden', 'true');
        q.innerHTML = '<span class="pk-ico">?</span>';
        chars.appendChild(q);
      }
      try { syncCharButtons(); } catch (e) {}
    }
    /* الشخصية المحفوظة أُقفلت (لاعب آخر على الجهاز نفسه): نعود للعامل */
    try { if (!charOpen(CHAR.id, xp)) window.__setCharacter('worker'); else applyOutfit(); } catch (e) {}
  }

  /* ================= تنبيهات الإنجاز ================= */
  function cue(kind) {
    if (!soundEnabled || !actx || document.hidden) return;
    const t0 = actx.currentTime + 0.01, nodes = [];
    const tone = (f, at, d, type, v, f2) => {
      const o = actx.createOscillator(), g = actx.createGain(); nodes.push(o, g);
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t0 + at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + at + d);
      g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(v || 0.06, t0 + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + d);
      o.connect(g); g.connect(actx.destination); o.start(t0 + at); o.stop(t0 + at + d + 0.02);
      o.onended = () => { o.disconnect(); g.disconnect(); };
    };
    if (kind === 'mission') [[784, 0], [988, 0.09], [1319, 0.18]].forEach(([f, a]) => tone(f, a, 0.16));
    else if (kind === 'rank') [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [1319, 0.5]].forEach(([f, a], i) => tone(f, a, i === 4 ? 0.5 : 0.18, 'square', 0.07));
    else if (kind === 'whoosh') {   // نجاة: هسيس هواء ينخفض + نغمة صاعدة
      const n = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain();
      const len = (actx.sampleRate * 0.6) | 0, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      n.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(2600, t0); bp.frequency.exponentialRampToValueAtTime(320, t0 + 0.55);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.58);
      n.connect(bp); bp.connect(g); g.connect(actx.destination); n.start(t0); n.stop(t0 + 0.6);
      n.onended = () => { n.disconnect(); bp.disconnect(); g.disconnect(); };
      tone(660, 0.12, 0.22, 'triangle', 0.07, 1320);
    } else if (kind === 'bark') { tone(330, 0, 0.09, 'sawtooth', 0.07, 210); tone(300, 0.16, 0.11, 'sawtooth', 0.07, 190); }
    else if (kind === 'meow') { tone(820, 0, 0.18, 'sine', 0.06, 1180); tone(1180, 0.17, 0.26, 'sine', 0.05, 640); }
    else if (kind === 'powerdown') tone(420, 0, 0.9, 'sawtooth', 0.05, 55);
    else if (kind === 'powerup') tone(80, 0, 0.6, 'sawtooth', 0.04, 520);
    else if (kind === 'vip') [[1047, 0], [1319, 0.08], [1568, 0.16], [2093, 0.26]].forEach(([f, a]) => tone(f, a, 0.14, 'triangle', 0.07));
  }
  /* نجمع نتيجة الوردية لعرضها في شاشة النتائج */
  let round = null;
  function feedback(r) {
    if (round) { round.gain += r.xp; round.done.push(...r.completed); if (r.rankUp) round.rankUp = { from: round.rankUp ? round.rankUp.from : r.rankUp.from, to: r.rankUp.to }; round.unlocked.push(...r.unlocked); if (r.certified) round.cert = true; if (r.allDone) round.allDone = true; }
    if (!run) return;   // نتيجة نهاية الوردية تُعرض في شاشة النتائج
    r.completed.forEach(d => {
      spawnFloatTag('🎯 +' + d.xp + ' XP', '#64ffda', 'big');
      toast('🎯 ' + T('مهمة مكتملة: ', 'Mission complete: ') + nm(d) + ' (+' + d.xp + ' XP)', '#64ffda');
      cue('mission');
    });
    if (r.allDone) { setTimeout(() => { toast('🏅 ' + T('أنجزت كل مهام اليوم! +', 'All of today\'s missions done! +') + WP.DAILY_BONUS + ' XP', '#ffd54a'); fwShow(2); }, 900); }
    if (r.certified) { setTimeout(() => { toast('🎓 ' + T('مبروك! أصبحت معتمداً في المواد الخطرة DGR', 'Congratulations! You are now DGR certified'), '#ffd54a'); cue('rank'); fwShow(3); }, 1400); }
    if (r.rankUp) celebrateRank(r.rankUp.to, r.unlocked);
  }
  function celebrateRank(to, unlocked) {
    cue('rank'); fwShow(3);
    const got = unlocked.length ? '<small>' + T('فُتح: ', 'Unlocked: ') + unlocked.map(u => esc(nm(u))).join(' · ') + '</small>' : '';
    try { showIntro('<b class="t">' + to.icon + ' ' + T('ترقية! أصبحت ', 'Promoted! You are now ') + esc(nm(to)) + '</b>' + got, 3600, false); } catch (e) {}
    refreshAll();
  }

  /* ================= أحداث اللعب ================= */
  function emit(event, payload) {
    ensure();
    const r = WP.apply(st, event, payload);
    st = r.state; save();
    feedback(r);
    if (r.completed.length || r.xp || event === 'fod' || event === 'hit' || event === 'cao' || event === 'sort' || event === 'fever' || event === 'dgr') renderHud();
    return r;
  }

  /* ================= النجاة في اللحظة الأخيرة ================= */
  let slowMoT = 0;
  function truckTick(pos, ts) {
    if (!run || !ts) return;
    if (!ts.active) { ts._nm = null; return; }
    const nmS = ts._nm && ts._nm.trip === ts.trip ? ts._nm : (ts._nm = { trip: ts.trip, min: 99, moving: false, done: false });
    if (nmS.done) return;
    const d = Math.hypot(pos.x - px.x, pos.z - px.z);
    if (d < nmS.min) { nmS.min = d; nmS.moving = !!balletMoving; }
    /* تُحتسب بعد أن تمرّ الرافعة وتبتعد فعلاً (أقرب نقطة خلفها)، لا قبل الاصطدام المحتمل */
    if (d > nmS.min + 0.6 && WP.nearMiss({ active: true, moving: nmS.moving, hit: ts.hit, already: false, driving: FD.on, dist: nmS.min })) {
      nmS.done = true;
      score += WP.NEAR_MISS.reward; hud();
      slowMoT = WP.NEAR_MISS.slowMo;
      const stg = document.getElementById('stage'); if (stg) { stg.classList.remove('slowmo'); void stg.offsetWidth; stg.classList.add('slowmo'); setTimeout(() => stg.classList.remove('slowmo'), 900); }
      spawnFloatTag('😮‍💨 ' + T('نجاة! +', 'Close call! +') + WP.NEAR_MISS.reward, '#64ffda', 'big');
      cue('whoosh'); addShake(0.35);
      emit('nearmiss');
    } else if (d > nmS.min + 0.6 && nmS.min < 99) nmS.done = true;
  }
  function timeScale(dt, rawDt) {
    if (slowMoT <= 0) return dt;
    slowMoT = Math.max(0, slowMoT - Math.max(0, Math.min(rawDt, 0.1)));
    return dt * WP.NEAR_MISS.slowK;
  }

  /* ================= أحداث الوردية ================= */
  let SH = { id: null, at: 0, on: false, done: true, left: 0 };
  let chip = null;
  function chipShow(text, cls) {
    const hud = document.getElementById('hud'); if (!hud) return;
    if (!chip) { chip = el('div', 'shift-chip'); chip.id = 'shift-chip'; chip.setAttribute('role', 'status'); hud.appendChild(chip); }
    chip.className = 'shift-chip on ' + (cls || ''); chip.innerHTML = text;
  }
  function chipHide() { if (chip) chip.className = 'shift-chip'; }
  const evDef = () => WP.eventById(SH.id);
  const sceneBusy = () => fire.active || caoQ.active || jam.active || cardP.active || frzP.active || STUDY.on || introHold;

  /* --- انقطاع الكهرباء --- */
  let dim = null, torch = null;
  function blackoutOn() {
    dim = [];
    S.traverse(o => { if (o.isLight && o !== torch) { dim.push([o, o.intensity]); o.intensity *= 0.1; } });
    dim.exp = R.toneMappingExposure; R.toneMappingExposure = dim.exp * 0.8;
    torch = new THREE.SpotLight(0xfff1d6, 3.4, 30, 0.52, 0.5, 1.1);
    torch.castShadow = false; S.add(torch); S.add(torch.target);
    document.getElementById('stage').classList.add('blackout');
    cue('powerdown');
  }
  function blackoutTick() {
    if (!torch) return;
    const a = typeof curRotY === 'number' ? curRotY : 0;
    torch.position.set(px.x - Math.sin(a) * 0.6, 3.4, px.z - Math.cos(a) * 0.6);
    torch.target.position.set(px.x + Math.sin(a) * 7, 0, px.z + Math.cos(a) * 7);
  }
  function blackoutOff() {
    if (dim) { dim.forEach(([o, v]) => { o.intensity = v; }); R.toneMappingExposure = dim.exp; dim = null; }
    if (torch) { S.remove(torch); S.remove(torch.target); torch.dispose && torch.dispose(); torch = null; }
    const s = document.getElementById('stage'); if (s) s.classList.remove('blackout');
  }

  /* --- شحنة VIP --- */
  let vip = null;
  function vipTag() {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const t = rawTex(cv);
    return { cv, t, draw(left) {
      const g = cv.getContext('2d'), c = 64, f = Math.max(0, left / evDefVip().dur), urgent = left <= 6;
      g.clearRect(0, 0, 128, 128);
      g.beginPath(); g.arc(c, c, 58, 0, Math.PI * 2); g.fillStyle = urgent ? '#3a0d0d' : '#2a1d00'; g.fill();
      g.lineWidth = 8; g.strokeStyle = '#ffc107'; g.stroke();
      g.beginPath(); g.arc(c, c, 50, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.strokeStyle = urgent ? '#ff5252' : '#ffe082'; g.lineWidth = 7; g.stroke();
      g.fillStyle = '#ffd54a'; g.font = '900 34px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VIP', c, c - 12);
      g.fillStyle = '#fff'; g.font = '800 26px system-ui,sans-serif'; g.fillText(Math.ceil(left) + 's', c, c + 22);
      t.needsUpdate = true;
    } };
  }
  const evDefVip = () => WP.eventById('vip');
  function makeVip(it) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: critHaloTex, color: 0xffc400, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.y = 0.05; halo.scale.set(2.6, 2.6, 1); it.m.add(halo);
    const tag = vipTag();
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tag.t, transparent: true, depthTest: false }));
    sp.position.y = 1.5; sp.scale.set(0.95, 0.95, 1); sp.renderOrder = 6; it.m.add(sp);
    vip = { it, left: evDefVip().dur, halo, sp, tag, sec: -1 };
    tag.draw(vip.left);
    it.vip = true;
    showIntro('<b class="t">📦 ' + T('شحنة VIP!', 'VIP shipment!') + '</b>' + T('افرزها في منطقتها الصحيحة خلال ', 'Sort it into its correct zone within ') + evDefVip().dur + T(' ثانية (+', ' seconds (+') + evDefVip().reward + ').', 3200, false);
    cue('vip');
  }
  function vipClear() {
    if (!vip) return;
    const v = vip; vip = null;
    try { v.it.vip = false; v.it.m.remove(v.halo); v.it.m.remove(v.sp); v.halo.material.dispose(); v.sp.material.dispose(); v.tag.t.dispose(); } catch (e) {}
  }
  function vipFail(why) {
    if (!vip) return;
    vipClear();
    const pen = Math.min(score, evDefVip().penalty); score = Math.max(0, score - evDefVip().penalty); hud();
    spawnFloatTag('−' + pen + ' VIP', '#ff5252', 'big');
    toast('📦 ' + why + ' (−' + evDefVip().penalty + ')', '#ff5252');
    snd('error'); endEvent();
  }
  function vipTick(dt) {
    if (!vip) {
      SH.wait = (SH.wait || 0) + dt;
      if (SH.wait > 30) endEvent();   // لم تصل شحنة مناسبة: ينتهي الحدث بهدوء
      return;
    }
    if (items.indexOf(vip.it) < 0) { vipFail(T('فاتت شحنة VIP', 'The VIP shipment was missed')); return; }
    if (vip.it.st === 'held' || vip.it.st === 'lifting' || vip.it.st === 'belt' || vip.it.st === 'floor') vip.left -= dt;
    const s = Math.ceil(vip.left); if (s !== vip.sec) { vip.sec = s; vip.tag.draw(Math.max(0, vip.left)); }
    vip.halo.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 180));
    chipShow('📦 VIP <b>' + Math.max(0, s) + T(' ث', 's') + '</b>', vip.left <= 6 ? 'urgent' : 'gold');
    if (vip.left <= 0) vipFail(T('انتهى وقت شحنة VIP', 'The VIP shipment ran out of time'));
  }
  function onSpawn(it) {
    if (!SH.on || SH.id !== 'vip' || vip) return;
    const d = it.data;
    if (d.isMys || d.isFrz || d.cao || d.isHeavy || it.crit) return;
    makeVip(it);
  }
  function onSorted(it, ok) {
    if (!vip || vip.it !== it) return;
    if (!ok) { vipFail(T('شحنة VIP في المنطقة الخطأ', 'VIP shipment in the wrong zone')); return; }
    vipClear();
    const R_ = evDefVip().reward;
    score += R_; hud();
    spawnFloatTag('📦 VIP +' + R_, '#ffd54a', 'big'); fwShow(2); cue('vip');
    toast('📦 ' + T('سلّمت شحنة VIP في وقتها! +', 'VIP shipment delivered on time! +') + R_, '#ffd54a');
    emit('vip'); endEvent();
  }

  /* --- الحيوان الأليف الهارب --- */
  let pet = null, cage = null, cageBol = null;
  /* قطط vinish.dev (CC BY 4.0): ١٢ سلالة بهيكل عظمي وحركات حقيقية (Idle/Walk/Trot/Run/Sit/Meow).
     لا تُحمَّل عند فتح اللعبة: قطة واحدة فقط تُجلب حين يكون حدث الوردية هو القطة، وتختلف عن القطة السابقة. */
  const CATS = [
    ['orange-tabby', 'القطة البرتقالية', 'The orange tabby'], ['black-cat', 'القطة السوداء', 'The black cat'],
    ['siamese', 'القطة السيامية', 'The Siamese cat'], ['persian', 'القطة الفارسية', 'The Persian cat'],
    ['maine-coon', 'قطة الماين كون', 'The Maine Coon'], ['british-shorthair', 'القطة البريطانية', 'The British Shorthair'],
    ['sphynx', 'قطة السفنكس', 'The Sphynx cat'], ['bengal', 'القطة البنغالية', 'The Bengal cat'],
    ['ragdoll', 'قطة الراغدول', 'The Ragdoll cat'], ['calico', 'قطة الكاليكو', 'The calico cat'],
    ['tuxedo', 'قطة التكسيدو', 'The tuxedo cat'], ['scottish-fold', 'القطة الاسكتلندية', 'The Scottish Fold'],
  ];
  /* كلاب Quaternius (Dog وShiba Inu بترخيص CC0، والراعي الألماني CC BY): أصعب إمساكاً من القطط (WP.petChase).
     [ملف، اسم عربي، اسم إنجليزي، الارتفاع في اللعبة، أسماء المقاطع {مشي، جري}] */
  const DOGS = [
    ['dog', 'الكلب البني', 'The brown dog', 1.25, { Walk: 'Walk', Run: 'Run' }],
    ['shiba', 'كلب الشيبا', 'The Shiba Inu', 1.05, { Walk: 'Walk', Run: 'Gallop' }],
    ['shepherd', 'كلب الراعي الألماني', 'The German Shepherd', 1.4, { Walk: 'Walk', Run: 'Run' }],
  ];
  const DOG_NAT = { Walk: 2.2, Run: 8 };
  const isDog = def => !!def && DOGS.indexOf(def) >= 0;
  const petKind = () => (pet && isDog(pet.def) ? 'dog' : 'cat');
  /* أيقونة الحيوان واسمه الحالي في الرسائل */
  const PI_ = () => petKind() === 'dog' ? '🐕' : '🐈';
  const PN = () => petKind() === 'dog' ? T('الكلب', 'the dog') : T('القطة', 'the cat');
  const PNc = () => petKind() === 'dog' ? T('الكلب', 'The dog') : T('القطة', 'The cat');
  const CAT_SCALE = 3.0;   // المجسّمات بالمتر (≈٣٣سم)؛ ×3 تصير القطة ≈ ٢٨٪ من طول العامل — أوضح قليلاً دون أن تصير عملاقة
  const CAT_NAT = { Walk: 1.4, Trot: 3.2, Run: 6 };   // سرعة اللعبة التي تطابق كل حركة عند سرعة تشغيل 1.0
  const CAT_LAST = 'acg_cat_last';
  /* الإمساك يُقاس من عظمة ظهر القطة نفسها (تختلف بين السلالات): الظهر فوق الكفّين بنصف سُمك الجسم */
  const PET_BACK = 0.075 * CAT_SCALE, PET_HOLD_FWD = 0.1;
  const petHand = new THREE.Vector3(), petBack = new THREE.Vector3();
  let catReq = null;   // { def, p } القطة التالية (قد تكون قيد التنزيل مسبقاً)
  function pickCat() {
    let last = null; try { last = localStorage.getItem(CAT_LAST); } catch (e) {}
    const pool = (Math.random() < 0.5 ? DOGS : CATS).filter(c => c[0] !== last);   // كلب أو قطة بالتساوي
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function prepCat() {
    if (catReq) return catReq;
    const def = pickCat();
    const p = new Promise((res, rej) => {
      if (!THREE.GLTFLoader) { rej(new Error('GLTFLoader missing')); return; }
      new THREE.GLTFLoader().load('game/models/' + (isDog(def) ? 'dogs/' : 'cats/') + def[0] + '.glb', res, undefined, rej);
    });
    p.catch(() => { if (catReq && catReq.p === p) catReq = null; });   // فشل التنزيل: تبقى القطة المرسومة، ويُعاد المحاولة لاحقاً
    catReq = { def, p };
    return catReq;
  }
  function disposeObj(root) {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      (o.material ? [].concat(o.material) : []).forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); });
    });
  }
  /* تستبدل القطة المرسومة بالمجسّم الحقيقي في مكانها دون أن يتغيّر شيء في منطق الهروب والإمساك */
  function useGlbCat(gltf, def) {
    const g = new THREE.Group(), m = gltf.scene, dog = isDog(def);
    if (dog) {   // مجسّمات الكلاب بمقاييس مختلفة: نوحّد ارتفاعها في اللعبة
      m.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(m);
      m.scale.setScalar(def[3] / Math.max(0.01, bb.max.y - bb.min.y));
    } else m.scale.setScalar(CAT_SCALE);
    g.add(m);
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    const mixer = new THREE.AnimationMixer(m), acts = {};
    (gltf.animations || []).forEach(c => { acts[c.name.replace(/^.*\|/, '')] = mixer.clipAction(c); });   // "AnimalArmature|Run" → "Run"
    if (dog) { const cm = def[4]; acts.Walk = acts[cm.Walk] || acts.Walk; acts.Trot = acts[cm.Run]; acts.Run = acts[cm.Run]; }
    const old = pet.g;
    g.position.copy(old.position); g.rotation.copy(old.rotation);
    S.remove(old); disposeObj(old); S.add(g);
    Object.assign(pet, { g, legs: [], tail: new THREE.Object3D(), head: new THREE.Object3D(), mixer, acts, clip: null, def, spine: m.getObjectByName(dog ? 'Torso' : 'Spine') || m.getObjectByName('Body') || null, backDy: 0 });
    try { localStorage.setItem(CAT_LAST, def[0]); } catch (e) {}
  }
  function catClip(name, speed) {
    const a = pet && pet.acts && pet.acts[name];
    if (!a) return;
    if (pet.clip !== name && pet.clip && pet.acts[pet.clip] === a) pet.clip = name;   // اسمان لمقطع واحد (الكلب: Trot و Run)
    if (pet.clip !== name) {
      const prev = pet.clip && pet.acts[pet.clip];
      a.reset().play();
      if (prev) a.crossFadeFrom(prev, 0.25, false);
      pet.clip = name;
    }
    const NAT = petKind() === 'dog' ? DOG_NAT : CAT_NAT, nat = NAT[name] || (name === 'Trot' ? NAT.Run : 0);
    a.setEffectiveTimeScale(nat && speed ? Math.max(0.6, Math.min(1.8, speed / nat)) : 1);
  }
  function buildCat() {
    const g = new THREE.Group(), fur = 0xe08a2e, dark = 0x8a4a12, cream = 0xffe0b8;
    const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 });
    const mk = (geo, c, x, y, z, p) => { const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.castShadow = true; (p || g).add(m); return m; };
    const body = mk(new THREE.SphereGeometry(0.42, 16, 12), fur, 0, 0.62, 0); body.scale.set(0.85, 0.78, 1.45);
    mk(new THREE.SphereGeometry(0.3, 12, 10), cream, 0, 0.5, 0.18).scale.set(0.8, 0.6, 1.1);
    [-0.32, 0, 0.32].forEach(z => mk(new THREE.TorusGeometry(0.3, 0.035, 6, 16, Math.PI), dark, 0, 0.66, z).rotation.set(0, Math.PI / 2, 0));
    const head = new THREE.Group(); head.position.set(0, 0.98, 0.62); g.add(head);
    mk(new THREE.SphereGeometry(0.32, 16, 12), fur, 0, 0, 0, head).scale.set(1.05, 0.95, 0.95);
    mk(new THREE.SphereGeometry(0.16, 12, 8), cream, 0, -0.08, 0.2, head).scale.set(1.2, 0.8, 0.8);
    [-1, 1].forEach(s => {
      const ear = mk(new THREE.ConeGeometry(0.11, 0.24, 4), fur, s * 0.17, 0.3, -0.02, head); ear.rotation.z = -s * 0.25;
      mk(new THREE.SphereGeometry(0.055, 8, 6), 0x1b2a14, s * 0.12, 0.06, 0.27, head);
      mk(new THREE.SphereGeometry(0.02, 6, 4), 0xffffff, s * 0.12 + 0.015, 0.08, 0.32, head);
    });
    mk(new THREE.SphereGeometry(0.04, 8, 6), 0xff8fa0, 0, -0.04, 0.33, head);
    const legs = [];
    [[-0.2, 0.42], [0.2, 0.42], [-0.2, -0.42], [0.2, -0.42]].forEach(([x, z]) => {
      const l = new THREE.Group(); l.position.set(x, 0.5, z); g.add(l);
      mk(new THREE.CylinderGeometry(0.075, 0.065, 0.5, 8), fur, 0, -0.25, 0, l);
      mk(new THREE.SphereGeometry(0.085, 8, 6), cream, 0, -0.5, 0.03, l);
      legs.push(l);
    });
    const tail = new THREE.Group(); tail.position.set(0, 0.78, -0.6); g.add(tail);
    let seg = tail;
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Group(); s.position.set(0, i ? 0.2 : 0, i ? 0 : 0); seg.add(s);
      mk(new THREE.CylinderGeometry(0.06 - i * 0.008, 0.065 - i * 0.008, 0.22, 8), i % 2 ? dark : fur, 0, 0.1, 0, s);
      s.rotation.x = -0.35; seg = s;
    }
    g.scale.setScalar(1.25);
    return { g, legs, tail, head };
  }
  function buildCage(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const bar = 0x9aa5ad, w = 1.5, d = 1.2, h = 1.1;
    B(w + 0.1, 0.08, d + 0.1, 0x37474f, 0, 0.04, 0, g, 0.6, 0.3);
    B(w + 0.1, 0.06, d + 0.1, 0x546e7a, 0, h, 0, g, 0.5, 0.5);
    for (let i = 0; i <= 6; i++) { const xx = -w / 2 + i * w / 6; CY(0.025, 0.025, h, bar, xx, h / 2, d / 2, g, 0.4, 0.7, 6); CY(0.025, 0.025, h, bar, xx, h / 2, -d / 2, g, 0.4, 0.7, 6); }
    for (let i = 1; i < 5; i++) { const zz = -d / 2 + i * d / 5; CY(0.025, 0.025, h, bar, -w / 2, h / 2, zz, g, 0.4, 0.7, 6); CY(0.025, 0.025, h, bar, w / 2, h / 2, zz, g, 0.4, 0.7, 6); }
    B(0.5, 0.06, 0.5, 0xc62828, 0, 0.1, 0, g, 0.8, 0);   // وسادة حمراء
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: rawTex((() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = '#ffc107'; c.fillRect(0, 0, 256, 96); c.strokeStyle = '#1b1b1b'; c.lineWidth = 8; c.strokeRect(4, 4, 248, 88); c.fillStyle = '#1b1b1b'; c.font = '900 46px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🐾 ' + (en() ? 'PET' : 'قفص'), 128, 50); return cv; })()), transparent: true, depthTest: false }));
    sign.position.set(0, h + 0.75, 0); sign.scale.set(1.5, 0.56, 1); sign.renderOrder = 5; g.add(sign);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.62, 40), new THREE.MeshBasicMaterial({ color: 0xffc107, transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    S.add(g);
    return { g, ring, x, z };
  }
  function petOn() {
    const c0 = findFreeSpot(-9, 7.6, 1.1);
    cage = buildCage(c0.x, c0.z);
    cageBol = { x: c0.x, z: c0.z, r: 0.85 }; BOLLARDS.push(cageBol);
    let sx = 0, sz = 2;
    for (let i = 0; i < 40; i++) {
      const x = -20 + Math.random() * 40, z = -1 + Math.random() * 7;
      if (Math.hypot(x - px.x, z - px.z) > 9 && Math.hypot(x - c0.x, z - c0.z) > 6 && !blockedAt(x, z, 0.7)) { sx = x; sz = z; break; }
    }
    const c = buildCat(); c.g.position.set(sx, 0, sz); S.add(c.g);
    pet = Object.assign(c, { x: sx, z: sz, yaw: 0, held: false, caged: false, t: 0, goal: null, speed: 0 });
    const req = prepCat(), mine = pet;
    pet.def = req.def;   // نوع الحيوان معروف قبل تنزيل مجسّمه: الصعوبة والرسائل صحيحة من أول لحظة
    catReq = null;   // الحدث التالي يأخذ قطة أخرى
    req.p.then(gltf => { if (pet === mine) useGlbCat(gltf, req.def); else disposeObj(gltf.scene); }, () => {});
    const dg = isDog(req.def);
    showIntro('<b class="t">' + PI_() + ' ' + T(req.def[1] + (dg ? ' هارب' : ' هاربة') + ' في المستودع!', req.def[2] + ' is loose in the warehouse!') + '</b>' +
      T((dg ? 'أمسكه' : 'أمسكها') + ' (اقترب واضغط ✋) وضعه في القفص الأصفر (+', 'Catch it (get close and press ✋) and put it in the yellow cage (+') + WP.eventById('pet').reward + ').' +
      '<br><small>' + T(dg ? '⚠️ الكلب سريع جداً في البداية — يتعب مع الوقت' : '⚠️ القطة سريعة جداً في أول ٢٥ ثانية — ثم تتعب', dg ? '⚠️ Dogs are very fast at first — they tire over time' : '⚠️ The cat is very fast for the first 25 seconds — then it tires') + '</small>', 3600, false);
    cue(dg ? 'bark' : 'meow');
  }
  function petOff() {
    if (pet) { if (pet.mixer) pet.mixer.stopAllAction(); S.remove(pet.g); disposeObj(pet.g); pet = null; }
    if (cage) { S.remove(cage.g); cage.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); cage = null; }
    if (cageBol) { const i = BOLLARDS.indexOf(cageBol); if (i >= 0) BOLLARDS.splice(i, 1); cageBol = null; }
  }
  const WB = { minX: -31, maxX: 31, minZ: -3.2, maxZ: 8.8 };   // منطقة تجوّل القطة: المساحة المفتوحة فقط (بعيداً عن الحاويات والحزام)
  function petTick(dt) {
    if (!pet) return;
    pet.t += dt;
    if (pet.mixer) pet.mixer.update(dt);
    if (pet.caged) {   // داخل القفص: تجلس وتهز ذيلها
      catClip('Sit');
      pet.g.position.set(cage.x, 0.12, cage.z); pet.g.rotation.y += dt * 0.3;
      pet.tail.rotation.z = Math.sin(pet.t * 3) * 0.4; return;
    }
    if (pet.held) {   // محمولة بين يدي اللاعب
      const a = typeof curRotY === 'number' ? curRotY : 0;
      catClip('Meow');
      /* بين الكفّين فعلاً: بطن القطة فوق اليدين وجسمها ملاصق للصدر، لا معلّقة في الهواء أمام اللاعب */
      const acr = typeof activeCharRig === 'function' ? activeCharRig() : null;
      const hp = (acr && acr.root.visible && acr.holdPoint) ? acr.holdPoint(petHand) : null;
      const bob = Math.sin(pet.t * 6) * 0.02;
      if (hp && pet.mixer) {
        let dy = pet.backDy || 0.3 * CAT_SCALE;   // ارتفاع الظهر عن قدمي المجسّم (يُصحَّح كل إطار من العظمة)
        if (pet.spine) {
          pet.g.updateMatrixWorld(true); pet.spine.getWorldPosition(petBack);
          dy += ((petBack.y - pet.g.position.y) - dy) * (pet.backDy ? Math.min(1, dt * 8) : 1);
          pet.backDy = dy;
        }
        pet.g.position.set(hp.x + Math.sin(a) * PET_HOLD_FWD, hp.y + PET_BACK - dy + bob, hp.z + Math.cos(a) * PET_HOLD_FWD);
      }
      else pet.g.position.set(px.x + Math.sin(a) * 0.9, (pet.mixer ? 1.5 : 1.55) + bob * 2, px.z + Math.cos(a) * 0.9);
      pet.g.rotation.y = a + Math.PI / 2;
      pet.tail.rotation.z = Math.sin(pet.t * 9) * 0.6;
      pet.legs.forEach((l, i) => { l.rotation.x = Math.sin(pet.t * 10 + i) * 0.5; });
      cage.ring.material.opacity = 0.45 + 0.4 * Math.abs(Math.sin(pet.t * 5));
      return;
    }
    /* الهروب من اللاعب حين يقترب، والتجوّل الهادئ غير ذلك */
    const dx = pet.x - px.x, dz = pet.z - px.z, dp = Math.hypot(dx, dz) || 1;
    let vx = 0, vz = 0, want = 0;
    const ch = WP.petChase(petKind(), pet.t);
    if (dp < ch.flee && !FD.on) {
      vx = dx / dp; vz = dz / dp; want = ch.speed; pet.goal = null;
      /* مراوغة جانبية مفاجئة في المراحل الصعبة */
      if (pet.jukeT > 0) { pet.jukeT -= dt; vx += -vz * pet.jukeS * 0.9; vz += (dx / dp) * pet.jukeS * 0.9; const n = Math.hypot(vx, vz) || 1; vx /= n; vz /= n; }
      else if (ch.juke && Math.random() < ch.juke * dt) { pet.jukeT = 0.35 + Math.random() * 0.25; pet.jukeS = Math.random() < 0.5 ? 1 : -1; }
    }
    else {
      if (!pet.goal || Math.hypot(pet.goal.x - pet.x, pet.goal.z - pet.z) < 0.6 || pet.t > (pet.goalT || 0)) {
        pet.goal = { x: WB.minX + Math.random() * (WB.maxX - WB.minX), z: WB.minZ + Math.random() * (WB.maxZ - WB.minZ) };
        pet.goalT = pet.t + 4 + Math.random() * 4;
      }
      const gx = pet.goal.x - pet.x, gz = pet.goal.z - pet.z, gd = Math.hypot(gx, gz) || 1;
      vx = gx / gd; vz = gz / gd; want = 1.8;
    }
    pet.speed += (want - pet.speed) * Math.min(1, dt * 5);
    if (pet.mixer) catClip(pet.speed < 0.3 ? 'Idle' : pet.speed < 2.4 ? 'Walk' : pet.speed < 4.4 ? 'Trot' : 'Run', pet.speed);
    let nx = pet.x + vx * pet.speed * dt, nz = pet.z + vz * pet.speed * dt;
    nx = Math.max(WB.minX, Math.min(WB.maxX, nx)); nz = Math.max(WB.minZ, Math.min(WB.maxZ, nz));
    if (blockedAt(nx, nz, 0.55)) {   // عائق أمامها: تنعطف جانباً
      const side = Math.random() < 0.5 ? 1 : -1, sx = pet.x - vz * side * pet.speed * dt, sz = pet.z + vx * side * pet.speed * dt;
      if (!blockedAt(sx, sz, 0.55)) { nx = sx; nz = sz; } else { nx = pet.x; nz = pet.z; pet.goal = null; }
    }
    const mvx = nx - pet.x, mvz = nz - pet.z;
    pet.x = nx; pet.z = nz;
    if (Math.hypot(mvx, mvz) > 1e-4) { const ty = Math.atan2(mvx, mvz); let d = ty - pet.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); pet.yaw += d * Math.min(1, dt * 10); }
    const gait = pet.t * (4 + pet.speed * 2.2), amp = Math.min(0.75, pet.speed * 0.15);
    pet.legs.forEach((l, i) => { l.rotation.x = Math.sin(gait + (i === 0 || i === 3 ? 0 : Math.PI)) * amp; });
    pet.tail.rotation.z = Math.sin(pet.t * 4) * 0.35;
    pet.head.rotation.y = Math.sin(pet.t * 1.3) * 0.3;
    pet.g.position.set(pet.x, Math.abs(Math.sin(gait)) * 0.05 * (pet.speed > 2 ? 1 : 0), pet.z);
    pet.g.rotation.y = pet.yaw;
  }
  function act() {
    if (!SH.on || SH.id !== 'pet' || !pet || pet.caged) return false;
    if (pet.held) {
      if (Math.hypot(px.x - cage.x, px.z - cage.z) < 2.6) {
        pet.held = false; pet.caged = true;
        const R_ = WP.eventById('pet').reward;
        score += R_; hud();
        spawnFloatTag(PI_() + ' +' + R_, '#ffd54a', 'big'); fwShow(2); cue(petKind() === 'dog' ? 'bark' : 'meow');
        toast(PI_() + ' ' + T('أعدت ' + PN() + ' إلى القفص! +', PNc() + ' is back in the cage! +') + R_, '#ffd54a');
        emit('pet');
        SH.cagedT = 1.8;   // تبقى لحظة في القفص ثم ينتهي الحدث (بزمن اللعبة، فيتوقف مع الإيقاف المؤقت)
      } else tip('pet-cage', PI_() + ' ' + T('ضع ' + PN() + ' في القفص الأصفر', 'Put ' + PN() + ' in the yellow cage'), '#ffd54a');
      return true;
    }
    if (Math.hypot(px.x - pet.x, px.z - pet.z) < WP.petChase(petKind(), pet.t).catch) {
      if (held) { tip('pet-hands', PI_() + ' ' + T('أنزل الطرد أولاً لتمسك ' + PN(), 'Put the parcel down first to catch ' + PN()), '#ffd54a'); return true; }
      pet.held = true; cue(petKind() === 'dog' ? 'bark' : 'meow'); snd('pick');
      toast(PI_() + ' ' + T('أمسكت ' + PN() + '! خذه إلى القفص', 'Got ' + PN() + '! Take it to the cage'), '#ffd54a');
      return true;
    }
    return false;
  }
  const petHeld = () => !!(pet && pet.held);

  /* --- دورة الحدث --- */
  function beginEvent() {
    SH.on = true; SH.left = evDef().dur; SH.wait = 0;
    const d = evDef();
    if (SH.id === 'blackout') { blackoutOn(); showIntro('<b class="t">🌙 ' + T('انقطاع الكهرباء!', 'Power cut!') + '</b>' + T('المستودع مظلم — لا ترى إلا ضوء مصباحك. أكمل الفرز بحذر.', 'The warehouse is dark — only your torch lights the way. Keep sorting carefully.'), 3000, false); }
    else if (SH.id === 'peak') { snd('horn'); cue('powerup'); showIntro('<b class="t">⏩ ' + T('ذروة الشحن!', 'Peak hour!') + '</b>' + T('الحزام أسرع ×' + d.belt + ' ونقاط الفرز مضاعفة ×' + d.mult + ' لمدة ' + d.dur + ' ثانية.', 'Belt ×' + d.belt + ' faster and sort points ×' + d.mult + ' for ' + d.dur + ' seconds.'), 3000, false); document.getElementById('stage').classList.add('peak'); }
    else if (SH.id === 'pet') petOn();
    else if (SH.id === 'vip') { /* تصبح أول شحنة مناسبة قادمة VIP (onSpawn) */ }
  }
  function endEvent() {
    if (!SH.on) return;
    SH.on = false; SH.done = true;
    if (SH.id === 'blackout') { blackoutOff(); cue('powerup'); toast('💡 ' + T('عادت الكهرباء', 'Power is back'), '#fff'); }
    if (SH.id === 'peak') { const s = document.getElementById('stage'); if (s) s.classList.remove('peak'); }
    if (SH.id === 'pet') { if (pet && !pet.caged) toast(PI_() + ' ' + T('هرب ' + PN() + ' من المستودع', PNc() + ' slipped out of the warehouse'), '#ffb020'); petOff(); }
    if (SH.id === 'vip') vipClear();
    chipHide();
  }
  function cleanupEvent() { if (SH.on) { SH.on = false; } blackoutOff(); petOff(); vipClear(); const s = document.getElementById('stage'); if (s) s.classList.remove('peak', 'blackout'); chipHide(); SH.done = true; }
  function tick(dt) {
    if (!run) return;
    if (!SH.on && !SH.done && evt.t >= SH.at && !sceneBusy() && !truckState.active) beginEvent();
    if (!SH.on) return;
    if (SH.id === 'vip') { vipTick(dt); return; }
    SH.left -= dt;
    const d = evDef(), s = Math.max(0, Math.ceil(SH.left));
    if (SH.id === 'blackout') { blackoutTick(); chipShow('🌙 ' + T('انقطاع', 'Power cut') + ' <b>' + s + T(' ث', 's') + '</b>', 'dark'); }
    else if (SH.id === 'peak') chipShow('⏩ ' + T('ذروة', 'Peak') + ' ×' + d.mult + ' <b>' + s + T(' ث', 's') + '</b>', 'peak');
    else if (SH.id === 'pet') {
      petTick(dt);
      if (pet && pet.caged) { chipShow(PI_() + ' ' + T('في القفص', 'Caged') + ' <b>✓</b>', 'gold'); SH.cagedT -= dt; if (SH.cagedT <= 0) { endEvent(); return; } }
      else chipShow(PI_() + ' ' + (pet && pet.held ? T('إلى القفص', 'To the cage') : T('أمسك ', 'Catch ') + PN()) + ' <b>' + s + T(' ث', 's') + '</b>', 'gold');
    }
    if (SH.left <= 0 && !(SH.id === 'pet' && pet && pet.caged)) endEvent();
  }
  const beltK = () => (SH.on && SH.id === 'peak' ? evDef().belt : 1);
  const scoreK = () => (SH.on && SH.id === 'peak' ? evDef().mult : 1);

  /* ================= بداية الوردية ونهايتها ================= */
  function roundStart() {
    ensure();
    cleanupEvent();
    slowMoT = 0;
    round = { xp0: st.xp, gain: 0, done: [], rankUp: null, unlocked: [], cert: false, allDone: false, fined: false };
    SH = { id: WP.pickShiftEvent(Math.random, st), at: WP.eventStartAt(Math.random), on: false, done: false, left: 0 };
    if (SH.id === 'pet') prepCat();   // تنزيل القطة في الخلفية قبل ظهورها (الحدث يبدأ بعد ٢٢ ثانية على الأقل)
    renderHud();
  }
  function roundEnd(finalScore) {
    if (!round) roundStart();
    cleanupEvent();
    emit('round', { score: finalScore, fined: round.fined });
    pushRemote();
    const s = st, r = WP.rankFor(s.xp), R0 = round;
    round = null;
    refreshAll();
    const up = R0.rankUp ? '<div class="cr-up">🎉 ' + T('ترقية! أصبحت ', 'Promoted! You are now ') + '<b>' + R0.rankUp.to.icon + ' ' + esc(nm(R0.rankUp.to)) + '</b>' +
      (R0.unlocked.length ? '<small>' + T('فُتح: ', 'Unlocked: ') + R0.unlocked.map(u => esc(nm(u))).join(' · ') + '</small>' : '') + '</div>' : '';
    if (R0.rankUp) { setTimeout(() => { cue('rank'); fwShow(3); }, 400); }
    return '<section class="career">' +
      '<div class="cr-head"><span class="cr-ico" aria-hidden="true">' + r.rank.icon + '</span><div class="cr-tx"><b>' + esc(nm(r.rank)) + (s.dgr.cert ? ' <span class="rk-dgr">🎓 DGR</span>' : '') + '</b>' +
        '<small>' + (r.next ? s.xp + ' / ' + r.next.xp + ' XP · ' + T('التالية: ', 'Next: ') + esc(nm(r.next)) : s.xp + ' XP · ' + T('أعلى رتبة', 'Top rank')) + '</small></div>' +
        '<em class="cr-gain">+' + R0.gain + ' XP</em></div>' +
      '<i class="cr-bar"><b style="width:' + Math.round(r.frac * 100) + '%"></b></i>' + up +
      '<ul class="ms-list">' + missionRows(s, true) + '</ul>' +
      (R0.cert ? '<div class="cr-up">🎓 ' + T('مبروك! حصلت على شهادة DGR', 'Congratulations! You earned the DGR certificate') + '</div>' : '') +
      '</section>';
  }
  function fined() { if (round) round.fined = true; }

  /* ================= الواجهة العامة لـ game.js ================= */
  window.Prog = {
    emit, tick, act, onSpawn, onSorted, truckTick, timeScale, beltK, scoreK, roundStart, roundEnd, fined, applyOutfit,
    busy: () => SH.on, petHeld,
    charUnlocked: id => charOpen(id, xpNow()),
    isAllCharsCode: v => WP.isAllCharsCode(v), unlockAllChars,
    onPlayer: () => { ensure(); refreshAll(); },
    state: () => ensure(),
    /* للاختبار اليدوي من وحدة التحكم */
    _debug: { get SH() { return SH; }, get pet() { return pet; }, get vip() { return vip; }, startEvent(id) { cleanupEvent(); SH = { id, at: 0, on: false, done: false, left: 0 }; }, CATS, get catReq() { return catReq; }, addXp(n) { ensure(); st.xp += n; save(); refreshAll(); } },
  };
  /* أول تحميل: بناء الواجهة، والتأكد أن الشخصية المحفوظة مفتوحة لهذا اللاعب */
  ensure(); refreshAll();
})();
