/* ===== تقرير ما بعد الوردية: مراجعة الأخطاء + بطاقة مشاركة النتيجة =====
   القواعد الصِّرفة (التجميع والأسباب) في game-rules.js → WarehouseRules.debrief.
   هذا الملف يحوّلها إلى لوحة في شاشة النهاية، ويرسم بطاقة PNG قابلة للمشاركة. */
(function () {
  'use strict';
  const R = window.WarehouseRules;
  if (!R || !R.debrief) return;
  const D = R.debrief;
  const T = (ar, en) => I18N.T(ar, en);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const L = k => { const l = D.LESSON[k] || D.LESSON.table; return T(l.ar, l.en); };
  const code = d => (d ? esc(d.imp || '') + (d.div ? ' ' + esc(d.div) : '') : '');
  const zoneOf = k => (typeof Z !== 'undefined' ? Z.find(z => z.k === k) : null);
  const clip = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  /* عنوان السطر: ما الذي حدث، بأقصر صيغة ممكنة */
  function title(g) {
    const e = g.first, a = e.a;
    switch (g.k) {
      case 'iata': return '<bdi class="rv-c">' + code(a) + '</bdi> ✕ <bdi class="rv-c">' + code(e.b) + '</bdi>';
      case 'hz-general': { const z = zoneOf(e.zone); return '<bdi class="rv-c">' + code(a) + '</bdi> → ' + (z ? z.e + ' ' + esc(z.n) : T('شحن عام', 'General')); }
      case 'hz-only': return (a ? a.emoji + ' ' : '') + T('طرد عادي → ☣️ قفص DGR', 'Regular parcel → ☣️ DGR cage');
      case 'zone': { const z = zoneOf(e.zone); return (a ? a.emoji + ' ' : '') + T('طرد في منطقة خاطئة', 'Parcel in the wrong zone') + (z ? ' → ' + z.e + ' ' + esc(z.n) : ''); }
      case 'cao': return '🚫 ' + T('طرد CAO على رحلة ركاب', 'CAO parcel on a passenger flight');
      case 'quiz': return '🎓 ' + T('سؤال المفتش', 'Inspector question');
      case 'chill': return '❄️ ' + T('طرد مبرّد فسد', 'Chilled parcel spoiled');
      case 'missed': return (a && a.isHz ? '☣️ ' + T('مادة خطرة فاتتك', 'Missed dangerous good') : '📦 ' + T('طرد فاتك', 'Missed parcel'));
      case 'fine': return '🦺 ' + T('مخالفة المفتش', 'Inspector fine');
      default: return esc(g.k);
    }
  }
  function lesson(g) {
    if (g.k === 'quiz') return L('quiz') + '«' + esc(clip(g.first.txt, 70)) + '»';
    if (g.k === 'zone') { const want = zoneOf(g.first.a && g.first.a.t); if (want) return T('مكانه الصحيح: ', 'Correct zone: ') + want.e + ' ' + esc(want.n); }
    return esc(L(g.lesson));
  }

  /* لوحة «مراجعة الأخطاء» — أهم ٣ أخطاء فقط، كل خطأ سطران */
  function panel(log, processed) {
    const s = D.summarize(log);
    const head = '<h2 class="panel-t" id="ep-rv-t"><span aria-hidden="true">📋</span> ' + T('مراجعة الأخطاء', 'Mistake review') +
      (s.total ? '<span class="rv-sum">' + s.total + ' ' + (s.total === 1 ? T('خطأ', 'mistake') : T('أخطاء', 'mistakes')) + '</span><b class="rv-p">−' + s.lost + '</b>' : '') + '</h2>';
    let body;
    if (!s.total) {
      body = '<div class="rv-clean"><b aria-hidden="true">✓</b><span>' +
        (processed ? T('وردية بلا أخطاء — كل قراراتك صحيحة.', 'A clean shift — every call was right.') : T('لم تُفرز طرود هذه الوردية.', 'No parcels sorted this shift.')) + '</span></div>';
    } else {
      body = '<ol class="rv-list">' + s.rows.map(g =>
        '<li class="rv-row k-' + esc(g.k) + '"><div class="rv-h"><span class="rv-t">' + title(g) + '</span>' +
        (g.n > 1 ? '<span class="rv-n">×' + g.n + '</span>' : '') + '<span class="rv-p">−' + g.pts + '</span></div>' +
        '<p class="rv-l">' + lesson(g) + '</p></li>').join('') + '</ol>' +
        (s.more ? '<p class="rv-more">' + (s.more === 1 ? T('+ نوع آخر أقل أثراً', '+1 smaller mistake type') : T('+' + s.more + ' أنواع أخرى أقل أثراً', '+' + s.more + ' smaller mistake types')) + '</p>' : '');
    }
    return '<section class="ep-review" aria-labelledby="ep-rv-t">' + head + body + '</section>';
  }
  /* سطر النصيحة في التقرير الرئيسي: أهم درس من الوردية */
  function tip(log) {
    const s = D.summarize(log, 1);
    if (!s.rows.length) return '';
    return '⚠️ ' + T('أهم درس: ', 'Key lesson: ') + (s.rows[0].k === 'quiz' ? esc(L('quiz')) + '«' + esc(clip(s.rows[0].first.txt, 50)) + '»' : esc(L(s.rows[0].lesson)));
  }

  /* ================= بطاقة المشاركة (PNG) بأسلوب بوليصة الشحن ================= */
  const FONT = "'Cairo', system-ui, 'Segoe UI', Tahoma, sans-serif";
  function card(d) {
    const W = 1080, H = 1080, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d'), rtl = I18N.lang !== 'en';
    const paper = '#f4f1ea', ink = '#1b2530', red = '#d32f2f', mute = '#5b6b77';
    const acc = { s: '#1f8a52', a: '#1c4e8a', b: '#b26a00', c: '#4b5c69' }[d.grade] || ink;
    // حدود خطوط تحذير
    g.fillStyle = paper; g.fillRect(0, 0, W, H);
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.rect(28, 28, W - 56, H - 56); g.clip('evenodd');
    for (let x = -H; x < W + H; x += 56) { g.fillStyle = red; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 28, 0); g.lineTo(x + 28 + H, H); g.lineTo(x + H, H); g.fill(); }
    g.restore();
    g.direction = rtl ? 'rtl' : 'ltr';
    const X0 = 84, X1 = W - 84, sx = rtl ? X1 : X0;
    g.textAlign = 'start'; g.textBaseline = 'alphabetic';
    // الترويسة
    g.fillStyle = ink; g.fillRect(X0, 84, X1 - X0, 74);
    g.fillStyle = '#fff'; g.font = '900 38px ' + FONT;
    g.fillText('✈ ' + T('تقرير الوردية — مستودع الشحن الجوي', 'Shift report — Air Cargo Warehouse'), sx + (rtl ? -22 : 22), 134);
    // ختم الدرجة
    const cx = rtl ? X0 + 120 : X1 - 120, cy = 300;
    g.save(); g.translate(cx, cy); g.rotate(-0.21);
    g.strokeStyle = acc; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 96, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 80, 0, Math.PI * 2); g.stroke();
    g.fillStyle = acc; g.textAlign = 'center'; g.font = '900 96px ' + FONT; g.fillText(String(d.grade || 'c').toUpperCase(), 0, 30);
    g.restore();
    // النقاط
    g.fillStyle = mute; g.font = '800 34px ' + FONT; g.fillText(T('النقاط', 'Score'), sx, 236);
    g.fillStyle = ink; g.font = '900 150px ui-monospace, Consolas, monospace';
    g.save(); g.direction = 'ltr'; g.textAlign = rtl ? 'right' : 'left'; g.fillText(String(d.score), sx, 386); g.restore();
    g.fillStyle = acc; g.font = '900 36px ' + FONT; g.fillText(d.title || '', sx, 446);
    // الإحصاءات
    const stats = [[d.sorted, T('طرود مصنّفة', 'Parcels sorted')], [d.acc + '%', T('دقة IATA', 'IATA accuracy')], [d.streak, T('أطول سلسلة', 'Best streak')]];
    const top = 500, h = 170, w = (X1 - X0) / 3;
    g.strokeStyle = ink; g.lineWidth = 5; g.fillStyle = '#e7ebee'; g.fillRect(X0, top, X1 - X0, h); g.strokeRect(X0, top, X1 - X0, h);
    stats.forEach((s, i) => {
      const col = rtl ? X1 - w * (i + 1) : X0 + w * i, mid = col + w / 2;
      if (i) { g.setLineDash([12, 10]); g.lineWidth = 3; g.strokeStyle = '#9aa8b2'; const lx = rtl ? col + w : col; g.beginPath(); g.moveTo(lx, top + 18); g.lineTo(lx, top + h - 18); g.stroke(); g.setLineDash([]); }
      g.textAlign = 'center'; g.fillStyle = ink; g.font = '900 64px ui-monospace, Consolas, monospace'; g.fillText(String(s[0]), mid, top + 92);
      g.fillStyle = mute; g.font = '800 28px ' + FONT; g.fillText(s[1], mid, top + 140);
    });
    g.textAlign = 'start';
    // شهادة DGR أو الرتبة
    let y = 752;
    if (d.cert) {
      g.fillStyle = '#fff3cd'; g.fillRect(X0, y - 60, X1 - X0, 96); g.strokeStyle = '#e0b300'; g.lineWidth = 5; g.strokeRect(X0, y - 60, X1 - X0, 96);
      g.fillStyle = '#7a5200'; g.font = '900 40px ' + FONT; g.fillText('🎓 ' + T('حاصل على شهادة DGR', 'DGR certified'), sx + (rtl ? -24 : 24), y + 2);
      g.save(); g.direction = 'ltr'; g.textAlign = rtl ? 'left' : 'right'; g.font = '800 24px ui-monospace, Consolas, monospace'; g.fillText(R.segregation.edition, rtl ? X0 + 24 : X1 - 24, y); g.restore();
      y += 90;
    }
    if (d.rank) { g.fillStyle = ink; g.font = '800 36px ' + FONT; g.fillText(T('الرتبة: ', 'Rank: ') + d.rank, sx, y + 8); }
    // خط القطع والباركود
    g.setLineDash([16, 12]); g.strokeStyle = '#9aa8b2'; g.lineWidth = 4; g.beginPath(); g.moveTo(X0, 936); g.lineTo(X1, 936); g.stroke(); g.setLineDash([]);
    g.fillStyle = ink; let bx = X0; const seed = String(d.score * 7919 + d.sorted * 104729 + 31337).repeat(12);
    for (let i = 0; bx < X0 + 520 && i < seed.length; i++) { const bw = 3 + (+seed[i] % 3) * 3; g.fillRect(bx, 958, bw, 46); bx += bw + 4; }
    g.direction = 'ltr'; g.textAlign = 'right'; g.fillStyle = mute; g.font = '800 26px ui-monospace, Consolas, monospace'; g.fillText(d.shiftNo || '', X1, 1000);
    g.textAlign = 'center'; g.direction = rtl ? 'rtl' : 'ltr'; g.font = '900 40px ' + FONT; g.fillStyle = red; g.fillText(T('هل تتغلب على نتيجتي؟', 'Can you beat my score?'), W / 2, 906);
    return c;
  }
  function blobOf(c) { return new Promise(res => { try { c.toBlob(b => res(b), 'image/png'); } catch (e) { res(null); } }); }
  /* المشاركة: ملف صورة عبر Web Share إن أمكن، وإلا نص النتيجة، وإلا تنزيل الصورة */
  async function share(d, btn) {
    if (btn) btn.disabled = true;
    try {
      const c = card(d), blob = await blobOf(c);
      const text = T('حققت ' + d.score + ' نقطة بدقة ' + d.acc + '% في مستودع الشحن الجوي' + (d.cert ? ' 🎓 شهادة DGR' : '') + ' — هل تتغلب عليّ؟',
        'I scored ' + d.score + ' pts at ' + d.acc + '% accuracy in Air Cargo Warehouse' + (d.cert ? ' 🎓 DGR certified' : '') + ' — can you beat me?');
      const file = blob && typeof File === 'function' ? new File([blob], 'shift-' + (d.shiftNo || 'report') + '.png', { type: 'image/png' }) : null;
      const nav = navigator;
      if (file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) { await nav.share({ files: [file], text }); return 'shared'; }
      if (blob) {
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = file ? file.name : 'shift-report.png'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        try { if (typeof toast === 'function') toast('🖼️ ' + T('حُفظت بطاقة النتيجة كصورة', 'Score card saved as an image'), '#69f0ae'); } catch (e) {}
        return 'saved';
      }
      if (nav.share) { await nav.share({ text }); return 'shared'; }
    } catch (e) {
      /* إلغاء المشاركة من المستخدم ليس خطأً */
    } finally { if (btn) btn.disabled = false; }
    return 'none';
  }

  window.ShiftReport = { panel, tip, card, share };
})();
