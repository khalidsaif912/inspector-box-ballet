/* ===== موسيقى الوردية: إيقاع ريترو أصلي بـ Web Audio يتسارع ويكثف مع الكومبو =====
   المستوى (السرعة والطبقات) من WarehouseRules.music.level(combo, fever) — قاعدة مختبرة.
   ×1 إيقاع وباص · ×2 + صنج · ×3 + لحن · ×5/الحمى طبل ثانٍ وصنج سريع ولحن أعلى.
   جدولة استباقية قصيرة (look-ahead)، وكل عقدة تُفصل عند انتهائها فلا تتراكم الموارد.
   يُحمَّل بعد game.js ويقرأ متغيراته العامة: actx، run، combo، feverT. */
(function () {
  'use strict';
  const R = window.WarehouseRules;
  if (!R || !R.music) return;
  const VOL = 0.42;
  let on = true;
  try { on = localStorage.getItem('acg_mus') !== '0'; } catch (e) {}
  let bus = null, noise = null, playing = false, next = 0, step = 0, wasRun = false;

  /* تسلسل أصلي من أربعة مقاطع: Am · F · C · G (ترددات الجذر بالباص) */
  const ROOT = [110, 87.31, 130.81, 98];
  const CHORD = [[0, 3, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12], [0, 4, 7, 11]];
  const BASS = [0, null, 0, 12, null, 0, 7, null, 0, null, 0, 12, null, 7, 5, null];
  const LEAD = [0, 2, 1, 3, 2, 1, 3, 2];
  const semi = n => Math.pow(2, n / 12);

  function ensureBus() {
    if (bus || !actx) return;
    bus = actx.createGain(); bus.gain.value = 0; bus.connect(actx.destination);
    const len = Math.floor(actx.sampleRate * 0.25), buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noise = buf;
  }
  function fade(v) { if (bus) bus.gain.setTargetAtTime(v * VOL, actx.currentTime, v ? 0.25 : 0.12); }
  const done = (...ns) => () => ns.forEach(n => { try { n.disconnect(); } catch (e) {} });

  function tone(type, f, at, dur, vol) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(bus); o.start(at); o.stop(at + dur + 0.02);
    o.onended = done(o, g);
  }
  function kick(at) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(44, at + 0.12);
    g.gain.setValueAtTime(0.32, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
    o.connect(g); g.connect(bus); o.start(at); o.stop(at + 0.22);
    o.onended = done(o, g);
  }
  function hiss(at, kind) {
    const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    const snare = kind === 'snare', dur = snare ? 0.13 : 0.035;
    s.buffer = noise; f.type = snare ? 'bandpass' : 'highpass'; f.frequency.value = snare ? 1900 : 7200; f.Q.value = snare ? 0.8 : 0.5;
    g.gain.setValueAtTime(snare ? 0.09 : 0.04, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(at); s.stop(at + dur + 0.01);
    s.onended = done(s, f, g);
  }
  /* خطوة واحدة (نوتة سادس عشر) من دورة ٦٤ خطوة = ٤ مقاطع */
  function play(i, at, dur, lv) {
    const bar = (i >> 4) & 3, s = i & 15, root = ROOT[bar], ch = CHORD[bar];
    if (s % 4 === 0) kick(at);
    if (lv.layers >= 3 && s % 8 === 4) hiss(at, 'snare');
    if (lv.layers >= 1 && (lv.layers >= 3 ? true : s % 2 === 1)) hiss(at, 'hat');
    const b = BASS[s];
    if (b !== null) tone('triangle', root * semi(b), at, dur * 1.6, 0.12);
    if (lv.layers >= 2 && s % 2 === 0) {
      const n = ch[LEAD[(s >> 1) & 7]];
      tone('square', root * (lv.fever ? 8 : 4) * semi(n), at, dur * 1.5, lv.fever ? 0.026 : 0.022);
    }
  }
  function loop() {
    if (typeof actx === 'undefined' || !actx) return;
    const live = typeof run !== 'undefined' && run;
    const want = on && live && !document.hidden && actx.state === 'running';
    if (live && !wasRun) step = 0;           // كل وردية تبدأ من أول المقطع
    wasRun = live;
    if (!want) { if (playing) { playing = false; fade(0); } return; }
    ensureBus();
    if (!playing) { playing = true; next = actx.currentTime + 0.06; fade(1); }
    if (next < actx.currentTime) next = actx.currentTime + 0.02;   // بعد توقف الإطارات لا نعزف المتأخر دفعة واحدة
    const lv = R.music.level(typeof combo !== 'undefined' ? combo : 1, typeof feverT !== 'undefined' && feverT > 0);
    const peak = window.Prog && Prog.beltK && Prog.beltK() > 1;
    const dur = R.music.stepSeconds(lv.bpm + (peak ? 6 : 0));
    while (next < actx.currentTime + 0.12) { play(step, next, dur, lv); next += dur; step = (step + 1) & 63; }
  }
  setInterval(loop, 25);

  /* زر التشغيل/الإيقاف: في شريط اللعب وفي لوحة الإعدادات */
  function sync() {
    document.querySelectorAll('#mus,[data-audio="mus"]').forEach(b => { b.classList.toggle('off', !on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  function set(v) {
    on = !!v;
    try { localStorage.setItem('acg_mus', on ? '1' : '0'); } catch (e) {}
    if (!on && playing) { playing = false; fade(0); }
    sync();
  }
  document.querySelectorAll('#mus,[data-audio="mus"]').forEach(b => b.addEventListener('click', () => { try { initAudio(); } catch (e) {} set(!on); }));
  sync();
  window.Music = { set, get on() { return on; } };
})();
