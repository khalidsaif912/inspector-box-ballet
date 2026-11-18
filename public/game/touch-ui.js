/* =====================================================================
   Touch UI — طبقة تحكم للموبايل فوق كانفاس Three.js
   لا تعيد بناء اللعبة: تُعيد ترتيب عناصر HUD الموجودة وتربط الجويستيك
   بمتجه الحركة الحالي في game.js عبر window.__gameJoy (x, y).
   كل القيم القابلة للتعديل في CONFIG أدناه.
   ===================================================================== */
const CONFIG = {
  /* الجويستيك: قطر 120–140px، المقبض 45%، منطقة ميتة 12% */
  joy:    { min: 120, vmin: 21,    max: 140, knob: 0.45, dead: 0.12, idleOpacity: 0.62, startZone: 0.5 },
  /* الإجراءات: الالتقاط 64–80px (الأكبر والأقرب للإبهام) والسرعة 52–64px */
  act:    { min: 68,  vmin: 12.5,  max: 80,  idleOpacity: 0.9 },
  dash:   { min: 52,  vmin: 9,     max: 64,  idleOpacity: 0.72 },
  gap: 16,          /* أقل مسافة بين أي زرين (px) */
  margin: 16,       /* هامش الحواف + safe-area */
  hud:    { pillMin: 26, pillVmin: 6.2, pillMax: 34, menu: 48 },
  press: 0.92,      /* scale عند الضغط */
  haptics: { enabled: true, pick: 14, drop: 22, ui: 8 },
  sizes: [0.9, 1, 1.12],   /* أحجام الواجهة القابلة للتبديل (تُحفظ محلياً) */
  hand: 'right'            /* 'right' | 'left' */
};

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const body = document.body;
  const stage = $('stage');
  const controls = $('controls-ui');
  if (!stage || !controls) return;

  const STORE = { hand: 'tui.hand', size: 'tui.size', opacity: 'tui.opacity' };

  /* ---------- 1) تطبيق CONFIG على متغيّرات CSS ---------- */
  const clampPx = (o, k = 1) =>
    `clamp(${Math.round(o.min * k)}px, ${(o.vmin * k).toFixed(2)}vmin, ${Math.round(o.max * k)}px)`;

  function applyConfig(scale) {
    root.style.setProperty('--tui-joy', clampPx(CONFIG.joy, scale));
    root.style.setProperty('--tui-act', clampPx(CONFIG.act, scale));
    root.style.setProperty('--tui-dash', clampPx(CONFIG.dash, scale));
    root.style.setProperty('--tui-knob', (CONFIG.joy.knob * 100).toFixed(1) + '%');
    root.style.setProperty('--tui-gap', Math.round(CONFIG.gap * scale) + 'px');
    root.style.setProperty('--tui-margin', Math.round(CONFIG.margin * scale) + 'px');
    root.style.setProperty('--tui-menu', CONFIG.hud.menu + 'px');
    root.style.setProperty('--tui-press', CONFIG.press);
    root.style.setProperty('--tui-idle', CONFIG.joy.idleOpacity);
    root.style.setProperty('--hh',
      `clamp(${CONFIG.hud.pillMin}px, ${CONFIG.hud.pillVmin}vmin, ${CONFIG.hud.pillMax}px)`);
  }

  function buzz(ms) {
    if (!CONFIG.haptics.enabled) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  /* ---------- 2) إعادة بناء تخطيط عناصر التحكم ---------- */
  const actBtn = $('act'), dashBtn = $('dash-btn'), joyEl = $('joy'), knobEl = $('knob');

  let actions = $('tui-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.id = 'tui-actions';
    controls.appendChild(actions);
  }
  if (actBtn && actBtn.parentElement !== actions) actions.appendChild(actBtn);
  if (dashBtn && dashBtn.parentElement !== actions) actions.appendChild(dashBtn);

  /* زر قائمة واحد يجمع الأزرار الثانوية */
  const hudEnd = document.querySelector('#hud .hud-end');
  const panel = document.querySelector('#hud .top-btns');
  let menuBtn = $('tui-menu');
  if (hudEnd && panel) {
    panel.id = 'tui-menu-panel';
    if (!menuBtn) {
      menuBtn = document.createElement('button');
      menuBtn.id = 'tui-menu';
      menuBtn.type = 'button';
      menuBtn.setAttribute('aria-label', 'القائمة');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.setAttribute('aria-controls', 'tui-menu-panel');
      menuBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
      hudEnd.appendChild(menuBtn);
    }
    /* دليل الخريطة + اليد اليسرى + حجم الواجهة داخل اللوحة */
    if (!$('tui-guide')) {
      const g = document.createElement('button');
      g.id = 'tui-guide'; g.type = 'button'; g.className = 'rbtn';
      g.title = 'خريطة / دليل الفرز'; g.setAttribute('aria-label', 'خريطة / دليل الفرز');
      g.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>';
      panel.appendChild(g);
    }
    if (!$('tui-hand')) {
      const h = document.createElement('button');
      h.id = 'tui-hand'; h.type = 'button'; h.className = 'rbtn';
      h.title = 'وضع اليد اليسرى'; h.setAttribute('aria-label', 'وضع اليد اليسرى');
      h.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V6a2 2 0 1 1 4 0v5M11 11V4.5a2 2 0 1 1 4 0V11M15 11V6a2 2 0 1 1 4 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4 13a2 2 0 0 1 3.2-2.4L9 13"/></svg>';
      panel.appendChild(h);
    }
    if (!$('tui-size')) {
      const s = document.createElement('button');
      s.id = 'tui-size'; s.type = 'button'; s.className = 'rbtn';
      s.title = 'حجم أزرار التحكم'; s.setAttribute('aria-label', 'حجم أزرار التحكم');
      s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10" cy="10" r="5"/><path d="M15 15l5 5M13 20h7v-7"/></svg>';
      panel.appendChild(s);
    }
  }

  /* ---------- 3) الجويستيك العائم (Pointer Events + pointerId) ---------- */
  let stickId = null;             /* معرّف المؤشر الماسك للجويستيك */
  let joyCenter = { x: 0, y: 0 };
  let maxR = 50;

  const pointerSupported = 'PointerEvent' in window;

  /* مركز الجويستيك في وضع الراحة — من offsetLeft/Top حتى لا يتأثر بتحويل العوم */
  function idleCenter() {
    const r = stage.getBoundingClientRect();
    const w = joyEl.offsetWidth || 120;
    return {
      x: r.left + joyEl.offsetLeft + w / 2,
      y: r.top + joyEl.offsetTop + (joyEl.offsetHeight || w) / 2,
      r: w / 2
    };
  }

  function moveKnob(dx, dy) {
    if (knobEl) knobEl.style.transform = `translate(${dx}px,${dy}px)`;
  }

  function update(cx, cy) {
    let dx = cx - joyCenter.x, dy = cy - joyCenter.y;
    const d = Math.hypot(dx, dy);
    if (d > maxR) { dx = (dx / d) * maxR; dy = (dy / d) * maxR; }
    let nx = dx / maxR, ny = dy / maxR;

    /* منطقة ميتة 12%: لا انزلاق ولا حركة قبل تجاوزها */
    const mag = Math.hypot(nx, ny), dead = CONFIG.joy.dead;
    if (mag <= dead) { nx = 0; ny = 0; }
    else {
      const s = (mag - dead) / (1 - dead) / mag;
      nx = Math.max(-1, Math.min(1, nx * s));
      ny = Math.max(-1, Math.min(1, ny * s));
    }
    moveKnob(dx, dy);

    /* ربط بمتجه الحركة الموجود في game.js */
    const sink = window.__gameJoy;
    if (sink) { sink.x = nx; sink.y = ny; }
  }

  function stickStart(cx, cy, id) {
    if (stickId !== null) return false;
    const c = idleCenter();
    const sr = stage.getBoundingClientRect();
    joyCenter = { x: c.x, y: c.y };
    maxR = Math.max(24, c.r * (1 - CONFIG.joy.knob));

    /* نقل الجويستيك إلى نقطة اللمس مع إبقائه داخل حدود الملعب */
    const tx = Math.max(sr.left + c.r + 4, Math.min(sr.right - c.r - 4, cx));
    const ty = Math.max(sr.top + c.r + 4, Math.min(sr.bottom - c.r - 4, cy));
    joyEl.style.transform = `translate(${tx - c.x}px,${ty - c.y}px)`;
    joyEl.classList.add('floating', 'active');
    joyCenter = { x: tx, y: ty };

    stickId = id;
    update(cx, cy);
    return true;
  }

  function stickEnd(id) {
    if (stickId === null || (id != null && id !== stickId)) return;
    stickId = null;
    joyEl.classList.remove('floating', 'active');
    joyEl.style.transform = '';
    moveKnob(0, 0);
    if (knobEl) knobEl.style.transform = '';
    const sink = window.__gameJoy;
    if (sink) { sink.x = 0; sink.y = 0; }
  }

  function leftHalf(clientX) {
    const leftHand = body.classList.contains('tui-left');
    const zone = CONFIG.joy.startZone;
    return leftHand ? clientX > innerWidth * (1 - zone) : clientX < innerWidth * zone;
  }

  if (pointerSupported && joyEl) {
    joyEl.addEventListener('pointerdown', (e) => {
      if (stickId !== null) return;
      e.preventDefault();
      if (window.__initAudio) { try { window.__initAudio(); } catch (err) {} }
      stickStart(e.clientX, e.clientY, e.pointerId);
    });
    /* بدء السحب من أي مكان في نصف الشاشة المخصص للإبهام */
    stage.addEventListener('pointerdown', (e) => {
      if (stickId !== null || e.pointerType === 'mouse') return;
      if (!body.classList.contains('ingame')) return;
      const t = e.target;
      if (t.closest && t.closest('button, a, .top-btns, #tui-menu, #tui-menu-panel, .ov, #code-pad, #rules, #intro, #study, #cao-panel, #joy')) return;
      if (!leftHalf(e.clientX)) return;
      const pad = $('code-pad');
      if (pad && getComputedStyle(pad).display !== 'none') return;
      if (stickStart(e.clientX, e.clientY, e.pointerId)) e.preventDefault();
    }, { passive: false });

    addEventListener('pointermove', (e) => {
      if (e.pointerId !== stickId) return;
      if (e.cancelable) e.preventDefault();
      update(e.clientX, e.clientY);
    }, { passive: false });

    addEventListener('pointerup', (e) => stickEnd(e.pointerId), { passive: true });
    addEventListener('pointercancel', (e) => stickEnd(e.pointerId), { passive: true });
    addEventListener('blur', () => stickEnd(null));
  }

  /* ---------- 4) تأثير الضغط + الاهتزاز ---------- */
  function pressFx(el, ms) {
    if (!el) return;
    const down = () => {
      el.classList.add('pressed');
      if (ms) buzz(ms);
    };
    const up = () => el.classList.remove('pressed');
    el.addEventListener('pointerdown', down, { passive: true });
    el.addEventListener('pointerup', up, { passive: true });
    el.addEventListener('pointercancel', up, { passive: true });
    el.addEventListener('pointerleave', up, { passive: true });
  }

  /* act() في game.js يبدّل الصنف held قبل هذا المستمع (مسجّل بعده) */
  pressFx(actBtn);
  actBtn && actBtn.addEventListener('pointerdown', () => {
    if (window.__initAudio) { try { window.__initAudio(); } catch (e) {} }
    buzz(actBtn.classList.contains('held') ? CONFIG.haptics.pick : CONFIG.haptics.drop);
  }, { passive: true });
  pressFx(dashBtn, CONFIG.haptics.ui);

  /* ---------- 5) قائمة الإعدادات ---------- */
  function setMenu(open) {
    body.classList.toggle('tui-menu-open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  menuBtn && menuBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu(!body.classList.contains('tui-menu-open'));
    buzz(CONFIG.haptics.ui);
  });

  document.addEventListener('pointerdown', (e) => {
    if (!body.classList.contains('tui-menu-open')) return;
    if (e.target.closest && e.target.closest('#tui-menu, #tui-menu-panel')) return;
    setMenu(false);
  }, true);

  $('tui-guide') && $('tui-guide').addEventListener('click', () => {
    setMenu(false);
    const how = $('how');
    if (how) how.click();
  });

  /* وضع اليد اليسرى */
  function setHand(hand) {
    CONFIG.hand = hand === 'left' ? 'left' : 'right';
    body.classList.toggle('tui-left', CONFIG.hand === 'left');
    try { localStorage.setItem(STORE.hand, CONFIG.hand); } catch (e) {}
  }
  $('tui-hand') && $('tui-hand').addEventListener('click', () => {
    setHand(CONFIG.hand === 'left' ? 'right' : 'left');
    buzz(CONFIG.haptics.ui);
    if (stickId !== null) stickEnd(null);
  });

  /* حجم أزرار التحكم */
  let sizeIdx = 1;
  function setSize(i) {
    sizeIdx = ((i % CONFIG.sizes.length) + CONFIG.sizes.length) % CONFIG.sizes.length;
    applyConfig(CONFIG.sizes[sizeIdx]);
    try { localStorage.setItem(STORE.size, String(sizeIdx)); } catch (e) {}
    if (stickId !== null) stickEnd(null);
  }
  $('tui-size') && $('tui-size').addEventListener('click', () => {
    setSize(sizeIdx + 1);
    buzz(CONFIG.haptics.ui);
  });

  /* ---------- 6) منع التمرير/التكبير/قائمة اللمس المطوّل ---------- */
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest && e.target.closest('#stage')) e.preventDefault();
  });
  document.addEventListener('gesturestart', (e) => { if (e.target.closest('#stage')) e.preventDefault(); }, { passive: false });
  stage.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  /* لمسة ثانية أثناء السحب لا تسبب zoom */
  stage.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  /* ---------- 7) تغيّر الاتجاه/الحجم ---------- */
  let rz = 0;
  function onViewportChange() {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(() => {
      /* game.js يضبط renderer.setSize + الكاميرا في rs() عبر حدث resize؛
         هنا نعيد الجويستيك لوضعه وأبعاده بعد التدوير فقط */
      stickEnd(null);
      maxR = Math.max(24, (joyEl.offsetWidth || 120) / 2 * (1 - CONFIG.joy.knob));
      if (body.classList.contains('tui-menu-open')) setMenu(false);
    });
  }
  addEventListener('orientationchange', () => setTimeout(onViewportChange, 250), { passive: true });
  addEventListener('resize', onViewportChange, { passive: true });
  if (window.visualViewport) visualViewport.addEventListener('resize', onViewportChange, { passive: true });
  if (screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener('change', onViewportChange);
  }

  /* ---------- 8) التهيئة ---------- */
  let savedHand = CONFIG.hand, savedSize = 1;
  try {
    savedHand = localStorage.getItem(STORE.hand) || CONFIG.hand;
    const s = parseInt(localStorage.getItem(STORE.size), 10);
    if (!isNaN(s)) savedSize = s;
  } catch (e) {}
  applyConfig(CONFIG.sizes[savedSize] || 1);
  setHand(savedHand);
  sizeIdx = savedSize;
  setMenu(false);

  /* واجهة برمجية للاختبار/التخصيص */
  window.__joyReset = () => stickEnd(null);
  window.TouchUI = {
    CONFIG,
    setHand,
    setSize,
    setMenu,
    /* خطاف اختبار: نفس مسار اللمس الحقيقي */
    _stick: { start: stickStart, move: update, end: stickEnd },
    get stickActive() { return stickId !== null; }
  };
})();
