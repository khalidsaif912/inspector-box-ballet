/* الدخول بالرقم الوظيفي + لوحة المتصدرين العالمية (Firestore عبر REST — بلا مكتبات خارجية).
   الإعدادات: ضع projectId و apiKey من Firebase Console › Project settings › Your apps. */
(function(root){
'use strict';
const CFG = { projectId: 'game1-21af4', apiKey: 'AIzaSyBa5CcYG3aXHVZ1p6NGjy23MqBDHSjAGdY' };
const KEY = 'acg_emp';
let emp = null, dir = null;

const base = () => `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents`;
const on = () => !!(CFG.projectId && CFG.apiKey);
const enc = v => typeof v === 'number' ? { integerValue: String(Math.round(v)) } : v instanceof Date ? { timestampValue: v.toISOString() } : { stringValue: String(v) };
const encDoc = o => { const f = {}; for(const k in o) f[k] = enc(o[k]); return { fields: f }; };
const dec = d => { const o = {}; for(const k in (d.fields || {})){ const v = d.fields[k]; o[k] = v.integerValue !== undefined ? +v.integerValue : v.timestampValue !== undefined ? new Date(v.timestampValue) : v.stringValue; } o._id = (d.name || '').split('/').pop(); return o; };
const url = (p, q) => `${base()}/${p}${q || ''}${(q || '').indexOf('?') < 0 ? '?' : '&'}key=${CFG.apiKey}`;
const send = (m, u, b) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)));

async function directory(){
  if(dir) return dir;
  try { dir = await (await fetch('game/employees.json')).json(); } catch(e){ dir = {}; }
  return dir;
}
const norm = s => String(s || '').replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '');

const Online = {
  config: CFG, enabled: on,
  directory,
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
  async _touch(now){
    const u = url('players/' + emp.id); let cur = null;
    try { cur = dec(await send('GET', u)); } catch(e){}
    const doc = { id: emp.id, name: emp.name, dept: emp.dept, best: cur ? cur.best : 0, plays: cur ? cur.plays : 0, logins: (cur ? cur.logins : 0) + 1, last: now };
    await send('PATCH', u, encDoc(doc));
  },
  /* يسجل نتيجة اللعبة ويرفع الرقم القياسي إن تجاوزه */
  async submit(score){
    if(!on() || !emp || !(score > 0)) return;
    const now = new Date(), u = url('players/' + emp.id); let cur = null;
    try { cur = dec(await send('GET', u)); } catch(e){}
    send('POST', url('scores'), encDoc({ id: emp.id, name: emp.name, dept: emp.dept, score, at: now })).catch(() => {});
    const best = Math.max(score, cur ? cur.best : 0);
    await send('PATCH', u, encDoc({ id: emp.id, name: emp.name, dept: emp.dept, best, plays: (cur ? cur.plays : 0) + 1, logins: cur ? cur.logins : 1, last: now }));
  },
  async _query(coll, field, limit){
    const r = await send('POST', `${base()}:runQuery?key=${CFG.apiKey}`, { structuredQuery: { from: [{ collectionId: coll }], orderBy: [{ field: { fieldPath: field }, direction: 'DESCENDING' }], limit } });
    return r.filter(x => x.document).map(x => dec(x.document));
  },
  async top(n){ if(!on()) return []; return (await this._query('players', 'best', n || 10)).filter(p => p.best > 0); },
  async logins(n){ if(!on()) return []; return this._query('logins', 'at', n || 200); },
  async scores(n){ if(!on()) return []; return this._query('scores', 'at', n || 200); },
  async players(n){ if(!on()) return []; return this._query('players', 'last', n || 500); }
};
root.Online = Online;
})(typeof window !== 'undefined' ? window : this);
