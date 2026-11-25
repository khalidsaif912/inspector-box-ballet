/* الدخول بالرقم الوظيفي + لوحة المتصدرين العالمية (Firestore عبر REST — بلا مكتبات خارجية).
   الإعدادات: ضع projectId و apiKey من Firebase Console › Project settings › Your apps. */
(function(root){
'use strict';
const CFG = { projectId: 'game1-21af4', apiKey: 'AIzaSyBa5CcYG3aXHVZ1p6NGjy23MqBDHSjAGdY' };
const KEY = 'acg_emp', GKEY = 'acg_guest';
const ADMIN_EMAIL = 'admin@game1.app';
let emp = null, dir = null, tok = null, guestLogged = false;
/* الضيف (بلا رقم وظيفي): رقم ثابت لكل جهاز G-xxxxxx يُحفظ محلياً، فتظهر جلساته ونتائجه في صفحة الإدارة */
const isGuest = id => /^G-/.test(String(id || ''));
function guestMe(){
  let id = null; try { id = localStorage.getItem(GKEY); } catch(e){}
  if(!isGuest(id)){ id = 'G-' + String(Math.floor(100000 + Math.random() * 900000)); try { localStorage.setItem(GKEY, id); } catch(e){} }
  const mobile = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return { id, name: 'Guest ' + id.slice(2), dept: mobile ? 'guest/mobile' : 'guest/desktop', guest: true };
}

const base = () => `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents`;
const on = () => !!(CFG.projectId && CFG.apiKey);
const enc = v => typeof v === 'number' ? { integerValue: String(Math.round(v)) } : v instanceof Date ? { timestampValue: v.toISOString() } : { stringValue: String(v) };
const encDoc = o => { const f = {}; for(const k in o) f[k] = enc(o[k]); return { fields: f }; };
const dec = d => { const o = {}; for(const k in (d.fields || {})){ const v = d.fields[k]; o[k] = v.integerValue !== undefined ? +v.integerValue : v.timestampValue !== undefined ? new Date(v.timestampValue) : v.stringValue; } o._id = (d.name || '').split('/').pop(); return o; };
const url = (p, q) => `${base()}/${p}${q || ''}${(q || '').indexOf('?') < 0 ? '?' : '&'}key=${CFG.apiKey}`;
/* تحديث جزئي: يكتب الحقول المرسلة فقط ويُبقي غيرها (الخبرة والرتبة لا تُمسح عند تسجيل الدخول أو رفع النتيجة) */
const mask = o => '?' + Object.keys(o).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
const send = (m, u, b) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)));

async function directory(){
  if(dir) return dir;
  try { dir = await (await fetch('game/employees.json')).json(); } catch(e){ dir = {}; }
  return dir;
}
const norm = s => String(s || '').replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '');

const Online = {
  config: CFG, enabled: on,
  directory, isGuest,
  /* من يلعب الآن: الموظف المسجَّل، أو هوية الضيف إن اختار اللعب كضيف */
  player(){ return this.user() || (this.guest ? guestMe() : null); },
  /* يُستدعى عند بدء كل وردية: يسجّل دخول الضيف مرة واحدة في الجلسة (الموظف يُسجَّل عند إدخال رقمه) */
  async playStart(){
    if(!on() || this.user() || !this.guest || guestLogged) return;
    guestLogged = true;
    const g = guestMe(), now = new Date();
    send('POST', url('logins'), encDoc({ id: g.id, name: g.name, dept: g.dept, at: now })).catch(() => {});
    await this._touch(now, g);
  },
  user(){ if(emp) return emp; try { emp = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e){} return emp; },
  /* الاسم/القسم بحسب اللغة (ar افتراضياً) من الدليل المحمّل */
  nameOf(id, lang, fallback){ const r = dir && dir[id]; return r ? (lang === 'en' ? r[0] : r[2] || r[0]) : (fallback || id); },
  deptOf(id, lang, fallback){ const r = dir && dir[id]; return r ? (lang === 'en' ? r[1] : r[3] || r[1]) : (fallback || ''); },
  logout(){ emp = null; try { localStorage.removeItem(KEY); } catch(e){} },
  /* يتحقق من الرقم الوظيفي ويعيد {id,name,dept} أو null */
  async login(raw){
    const id = norm(raw), d = await directory(), r = d[id];
    if(!r) return null;
    emp = { id, name: r[0], dept: r[1] };
    try { localStorage.setItem(KEY, JSON.stringify(emp)); } catch(e){}
    if(on()){
      const now = new Date();
      send('POST', url('logins'), encDoc({ id, name: emp.name, dept: emp.dept, at: now })).catch(() => {});
      this._touch(now).catch(() => {});
    }
    return emp;
  },
  async _touch(now, who){
    const p = who || emp, u = url('players/' + p.id); let cur = null;
    try { cur = dec(await send('GET', u)); } catch(e){}
    const doc = { id: p.id, name: p.name, dept: p.dept, best: cur ? cur.best || 0 : 0, plays: cur ? cur.plays || 0 : 0, logins: (cur ? cur.logins || 0 : 0) + 1, last: now };
    await send('PATCH', url('players/' + p.id, mask(doc)), encDoc(doc));
  },
  /* يسجل نتيجة اللعبة ويرفع الرقم القياسي إن تجاوزه */
  async submit(score){
    const p = this.player();
    if(!on() || !p || !(score >= 0)) return;
    if(!p.guest && !(score > 0)) return;   // الضيف تُسجَّل نتيجته حتى لو صفراً ليظهر أنه لعب
    const now = new Date(), u = url('players/' + p.id); let cur = null;
    try { cur = dec(await send('GET', u)); } catch(e){}
    send('POST', url('scores'), encDoc({ id: p.id, name: p.name, dept: p.dept, score, at: now })).catch(() => {});
    const best = Math.max(score, cur ? cur.best || 0 : 0);
    const doc = { id: p.id, name: p.name, dept: p.dept, best, plays: (cur ? cur.plays || 0 : 0) + 1, logins: cur ? cur.logins || 1 : 1, last: now };
    await send('PATCH', url('players/' + p.id, mask(doc)), encDoc(doc));
  },
  /* تقدّم الموظف (الخبرة، الرتبة، شهادة DGR) لعرض اللقب في صفحة الإدارة والغلاف. الخبرة لا تنقص أبداً عن المحفوظ. */
  async saveProgress(prog){
    const p = this.player();
    if(!on() || !p || !prog) return;
    const u = url('players/' + p.id); let cur = null;
    try { cur = dec(await send('GET', u)); } catch(e){}
    if(!cur) return;   // لا سجل بعد (يُنشأ عند الدخول أو رفع النتيجة مع best): لا ننشئ سجلاً ناقصاً
    const xp = Math.max(Math.floor(+prog.xp || 0), cur && cur.xp ? cur.xp : 0);
    const doc = { id: p.id, name: p.name, dept: p.dept, xp, rank: String(prog.rank || ''), dgr: prog.dgr ? 1 : 0, dgrBest: Math.floor(+prog.dgrBest || 0) };
    await send('PATCH', url('players/' + p.id, mask(doc)), encDoc(doc));
  },
  /* الخبرة المحفوظة على الخادم (لاستعادة التقدّم على جهاز آخر) */
  async remoteProgress(){
    const p = this.player();
    if(!on() || !p) return null;
    try { const d = dec(await send('GET', url('players/' + p.id))); return { xp: d.xp || 0, dgr: !!d.dgr, dgrBest: d.dgrBest || 0 }; } catch(e){ return null; }
  },
  async _query(coll, field, limit){
    const r = await send('POST', `${base()}:runQuery?key=${CFG.apiKey}`, { structuredQuery: { from: [{ collectionId: coll }], orderBy: [{ field: { fieldPath: field }, direction: 'DESCENDING' }], limit } });
    return r.filter(x => x.document).map(x => dec(x.document));
  },

  /* ===== مسح الأرقام القياسية (للإدارة فقط: يتطلب حساب مدير في Firebase Auth) ===== */
  async adminLogin(code){
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CFG.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ADMIN_EMAIL, password: String(code), returnSecureToken: true }) });
    if(!r.ok) throw new Error('auth');
    tok = (await r.json()).idToken; return true;
  },
  /* mode: 'all' | 'id' (+id) | 'date' (+date بصيغة YYYY-MM-DD). يعيد خطة المسح دون تنفيذها */
  async planWipe(o){
    const scores = await this._query('scores', 'at', 1000), players = await this._query('players', 'best', 1000);
    const day = d => d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : '';
    const del = scores.filter(x => o.mode === 'all' || (o.mode === 'id' && x.id === o.id) || (o.mode === 'date' && day(x.at) === o.date));
    const gone = new Set(del.map(x => x._id)), aff = new Set(del.map(x => x.id));
    if(o.mode === 'all') players.forEach(p => { if(p.best > 0) aff.add(p.id); });
    if(o.mode === 'id') aff.add(o.id);
    const upd = [...aff].map(id => { const keep = scores.filter(x => x.id === id && !gone.has(x._id)).map(x => x.score); const cur = players.find(p => p.id === id); return { id, best: keep.length ? Math.max(...keep) : 0, was: cur ? cur.best : 0 }; }).filter(u => players.some(p => p.id === u.id) && u.best !== u.was);
    return { del: del.map(x => x._id), upd, truncated: scores.length >= 1000 };
  },
  async runWipe(plan){
    if(!tok) throw new Error('auth');
    const root = `projects/${CFG.projectId}/databases/(default)/documents`;
    const writes = [...plan.del.map(id => ({ delete: `${root}/scores/${id}` })), ...plan.upd.map(u => ({ update: { name: `${root}/players/${u.id}`, fields: { best: { integerValue: String(u.best) } } }, updateMask: { fieldPaths: ['best'] }, currentDocument: { exists: true } }))];
    for(let i = 0; i < writes.length; i += 400){
      const r = await fetch(`${base()}:commit?key=${CFG.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
      if(!r.ok) throw new Error('HTTP ' + r.status);
    }
    return writes.length;
  },
  /* لوحة المتصدرين العامة للموظفين فقط؛ الضيوف يظهرون في صفحة الإدارة */
  async top(n){ if(!on()) return []; return (await this._query('players', 'best', (n || 10) + 20)).filter(p => p.best > 0 && !isGuest(p.id)).slice(0, n || 10); },
  async logins(n){ if(!on()) return []; return this._query('logins', 'at', n || 200); },
  async scores(n){ if(!on()) return []; return this._query('scores', 'at', n || 200); },
  async players(n){ if(!on()) return []; return this._query('players', 'last', n || 500); }
};
root.Online = Online;
})(typeof window !== 'undefined' ? window : this);
