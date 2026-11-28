const gameRules = WarehouseRules;
/* استيفاء خطي عام (تستخدمه حركة المفتش ودورانه) */
function lrp(cur, target, k){ return cur + (target - cur) * k; }
/* ===== شاشة التحميل: تقدّم فعلي = متوسط موزون لمهام حقيقية =====
   المشهد (بناء الخامات والشيدرات) + ملفات المجسّمات التي تُنزَّل فعلاً (بايتات حقيقية) + الخلفية.
   لا يُخفى الشاشة إلا بعد رسم أول إطار واكتمال كل المهام (أو فشلها بوضوح). */
const afterLoad = (() => { const q = []; let ok = false; const f = fn => { if(ok) setTimeout(fn, 0); else q.push(fn); }; f.run = () => { ok = true; q.splice(0).forEach(fn => setTimeout(fn, 0)); }; return f; })();
const loading = (() => {
const screen = document.getElementById('loading-screen');
const fill = document.getElementById('loading-bar-fill');
const bar = document.getElementById('loading-bar');
const pct = document.getElementById('loading-percent');
const tip = document.getElementById('loading-tip');
const list = document.getElementById('loading-list');
const TIPS = [
'تلميح: حافظ على فصل المواد الخطرة لتجنب الغرامات!',
'تلميح: المسافة أو E أو F للالتقاط والتفاعل.',
'تلميح: Shift للجري، و Q أو X لإسقاط الطرد فوراً.',
'تلميح: الطرود المبرّدة لها مؤقت — أسرع قبل أن تفسد!'
];
const tasks = {};
let value = 0, done = false, tipIdx = 0, tipTimer = 0, safety = 0, sceneFirstFrame = false;
function paint(v){
value = Math.max(value, Math.min(100, Math.round(v)));
if(fill) fill.style.width = value + '%';
if(pct) pct.textContent = value + '%';
if(bar) bar.setAttribute('aria-valuenow', value);
}
function recompute(){
let w = 0, a = 0;
for(const k in tasks){ w += tasks[k].w; a += tasks[k].w * tasks[k].f; }
if(w) paint(a / w * 100 * 0.99);          // آخر 1% يُملأ عند الإخفاء فعلاً
}
function row(t){
if(!list) return;
if(!t.li){
t.li = document.createElement('li');
t.li.innerHTML = '<span class="ld-nm"></span><span class="ld-st"></span>';
list.appendChild(t.li);
}
t.li.className = t.state;
t.li.firstChild.textContent = t.label;
t.li.lastChild.textContent = t.state === 'ok' ? '✔' : t.state === 'bad' ? I18N.t('تعذّر') : (t.f > 0 ? Math.round(t.f * 100) + '%' : '…');
}
/* مهمة تحميل: set(0..1) أثناء التقدّم، done() عند النجاح، fail() عند الفشل (لا يعلّق الشاشة) */
function track(key, label, weight){
if(done) return { set(){}, done(){}, fail(){} };
const t = tasks[key] = { w: weight, f: 0, label: I18N.t(label), state: 'run' };
row(t); recompute();
return {
set(f){ if(t.state !== 'run') return; t.f = Math.max(t.f, Math.min(.99, f || 0)); row(t); recompute(); },
done(){ t.f = 1; t.state = 'ok'; row(t); recompute(); settle(); },
fail(){ t.f = 1; t.state = 'bad'; row(t); recompute(); settle(); }
};
}
function pending(){ for(const k in tasks) if(tasks[k].state === 'run') return true; return false; }
function settle(){ if(sceneFirstFrame && !pending()) finish(); }
/* تقدّم بناء المشهد القديم: phase(amount) → مهمة "scene" */
function phase(amount, label){
if(done) return;
if(label && tip) tip.textContent = label;
if(!tasks.scene) track('scene', 'بناء المستودع', 50);
const t = tasks.scene; t.f = Math.max(t.f, Math.min(.97, amount / 100)); row(t); recompute();
}
/* إخفاء الشاشة بعد أول إطار مرسوم فعلياً واكتمال كل المهام */
function finish(){
if(done) return;
done = true;
clearTimeout(safety); clearInterval(tipTimer);
if(tasks.scene){ tasks.scene.f = 1; tasks.scene.state = 'ok'; row(tasks.scene); }
paint(100);
if(screen) screen.setAttribute('aria-busy', 'false');
setTimeout(() => { if(screen) screen.classList.add('hidden'); }, 250);
afterLoad.run();
}
/* يُستدعى بعد رسم أول إطار: ننتظر باقي المهام إن كانت قيد التنزيل */
function frameReady(){ sceneFirstFrame = true; if(tasks.scene){ tasks.scene.f = 1; tasks.scene.state = 'ok'; row(tasks.scene); } recompute(); settle(); }
paint(3);
if(tip) tipTimer = setInterval(() => { tip.textContent = I18N.t(TIPS[(++tipIdx) % TIPS.length]); }, 2600);
/* صمام أمان: لا نحجب اللعب أكثر من 20 ثانية على شبكة بطيئة جداً — المهام المتأخرة تكمل في الخلفية */
safety = setTimeout(finish, 20000);
return { phase, finish, frameReady, track, get value(){ return value; } };
})();
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx = null, soundEnabled = true, ambEnabled = true, ambNode = null;
/* مستوى صوت المستودع المحيط: خلفية هادئة تحت المؤثرات والموسيقى */
const AMB_VOL = .1;
/* ===== مستويات الصوت: كل ضغطة على زر الصوت تخفضه درجة — ١٠٠٪ ← ٦٠٪ ← ٣٠٪ ← صامت ← ١٠٠٪ =====
   ثلاث قنوات مستقلة: amb صوت المستودع · snd المؤثرات · mus الموسيقى (music.js يقرأ مستواها) */
const VOL_STEPS = [1, .6, .3, 0];
const audioLv = { amb: 1, snd: 1, mus: 1 };
(() => {
  const old = { amb: 'acg_amb', snd: 'acg_snd', mus: 'acg_mus' };
  for(const ch in audioLv){
    try {
      const v = localStorage.getItem('acg_lv_' + ch);
      if(v !== null && VOL_STEPS.indexOf(+v) >= 0) audioLv[ch] = +v;
      else if(localStorage.getItem(old[ch]) === '0') audioLv[ch] = 0;   // الإعداد القديم (تشغيل/إيقاف)
    } catch(e){}
  }
  soundEnabled = audioLv.snd > 0; ambEnabled = audioLv.amb > 0;
})();
const audioLevel = ch => audioLv[ch] || 0;
/* كل المؤثرات تمر عبر ناقل واحد فيضبط مستواها زر المؤثرات */
let sfxBus = null;
function sfxOut(){
  if(!sfxBus){ sfxBus = actx.createGain(); sfxBus.gain.value = audioLv.snd; sfxBus.connect(actx.destination); }
  return sfxBus;
}
function initAudio(){
if(!actx && AudioCtx) actx = new AudioCtx();
if(actx && actx.state === 'suspended' && !document.hidden) actx.resume().catch(() => {});
initAmbience();
}
// ===== صوت المستودع المحيط: هدير تهوية + طنين مصابيح + ارتطامات بعيدة =====
function initAmbience(){
if(!actx || ambNode) return;
const master = actx.createGain(); master.gain.value = 0; master.connect(actx.destination);
const nodes = [];
// هدير منخفض من الماكينات
const humF = actx.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 150;
const humG = actx.createGain(); humG.gain.value = .028;
humF.connect(humG); humG.connect(master);
[46, 69].forEach((f, i) => {
const osc = actx.createOscillator(); osc.type = i ? 'triangle' : 'sawtooth'; osc.frequency.value = f;
const g = actx.createGain(); g.gain.value = i ? .4 : 1;
osc.connect(g); g.connect(humF); osc.start(); nodes.push(osc);
});
// تذبذب بطيء يوحي بتغيّر الحمل
const lfo = actx.createOscillator(); lfo.frequency.value = .17;
const lfoG = actx.createGain(); lfoG.gain.value = .01;
lfo.connect(lfoG); lfoG.connect(humG.gain); lfo.start(); nodes.push(lfo);
// تدفق هواء عبر مجاري التهوية (ضجيج مُرشّح)
const len = Math.floor(actx.sampleRate * 2);
const buf = actx.createBuffer(1, len, actx.sampleRate);
const data = buf.getChannelData(0);
let lp = 0;
for(let i = 0; i < len; i++){ lp = (lp + (Math.random() * 2 - 1) * .06) / 1.06; data[i] = lp * 4; }
const air = actx.createBufferSource(); air.buffer = buf; air.loop = true;
const airF = actx.createBiquadFilter(); airF.type = 'bandpass'; airF.frequency.value = 480; airF.Q.value = .7;
const airG = actx.createGain(); airG.gain.value = .26;
air.connect(airF); airF.connect(airG); airG.connect(master); air.start(); nodes.push(air);
ambNode = { master, nodes };
master.gain.setTargetAtTime(AMB_VOL * audioLv.amb, actx.currentTime, .4);
scheduleClank();
}
function scheduleClank(){
setTimeout(() => {
if(actx && ambNode && ambEnabled && actx.state === 'running' && !document.hidden){
const at = actx.currentTime;
const osc = actx.createOscillator(), g = actx.createGain();
osc.type = 'triangle'; osc.frequency.setValueAtTime(210 + Math.random() * 260, at);
osc.frequency.exponentialRampToValueAtTime(90, at + .22);
g.gain.setValueAtTime(0, at);
g.gain.linearRampToValueAtTime(.08, at + .01);
g.gain.exponentialRampToValueAtTime(.0001, at + .35);
osc.connect(g); g.connect(ambNode.master); osc.start(at); osc.stop(at + .4);
osc.onended = () => { osc.disconnect(); g.disconnect(); };
}
scheduleClank();
}, 6000 + Math.random() * 9000);
}
const VOL_NAME = { amb: ['صوت المستودع', 'Ambience'], snd: ['المؤثرات', 'Effects'], mus: ['الموسيقى', 'Music'] };
function setVol(ch, v, announce){
audioLv[ch] = v;
soundEnabled = audioLv.snd > 0; ambEnabled = audioLv.amb > 0;
try { localStorage.setItem('acg_lv_' + ch, String(v)); } catch(e){}
if(actx){
  if(ch === 'amb' && ambNode) ambNode.master.gain.setTargetAtTime(AMB_VOL * v, actx.currentTime, .15);
  if(ch === 'snd' && sfxBus) sfxBus.gain.setTargetAtTime(v, actx.currentTime, .05);
}
syncAudioUI();
if(announce){
  const n = VOL_NAME[ch], ico = v === 0 ? '🔇' : v < .5 ? '🔈' : v < 1 ? '🔉' : '🔊';
  try { toast(ico + ' ' + I18N.T(n[0], n[1]) + ': ' + (v ? Math.round(v * 100) + '%' : I18N.T('صامت', 'muted')), '#8fd0ff'); } catch(e){}
  if(ch === 'snd' && v) snd('pick');   // عيّنة قصيرة بالمستوى الجديد
}
}
/* ضغطة واحدة = درجة أخفض، وبعد الصامت يعود إلى ١٠٠٪ */
function stepVol(ch){
const i = VOL_STEPS.indexOf(audioLv[ch]);
setVol(ch, VOL_STEPS[(i + 1) % VOL_STEPS.length], true);
}
// ===== الرسائل التعليمة: تظهر مرة واحدة فقط، ويمكن إظهارها/إخفاؤها =====
let tipsEnabled = true;
try { tipsEnabled = localStorage.getItem('acg_tips') !== '0'; } catch(e){}
function setTips(v){
tipsEnabled = v;
try { localStorage.setItem('acg_tips', v ? '1' : '0'); } catch(e){}
if(v){ try { localStorage.removeItem('acg_tips_seen'); } catch(e){} }
syncAudioUI();
}
function tip(k, t, col){
if(!tipsEnabled) return;
let seen = {};
try { seen = JSON.parse(localStorage.getItem('acg_tips_seen') || '{}') || {}; } catch(e){ seen = {}; }
if(seen[k]) return;
seen[k] = 1;
try { localStorage.setItem('acg_tips_seen', JSON.stringify(seen)); } catch(e){}
toast(t, col);
}

// Original short chiptune cues: square-wave melody and triangle-wave bass.
const retroCues = {
jam:[[196,.12],[147,.12],[196,.12],[147,.2]],
cardflip:[[740,.04],[1047,.05]],
cardmatch:[[880,.05],[1175,.05],[1568,.1]],
cardfail:[[220,.09],[165,.13]],
cardwin:[[523,.08],[659,.08],[784,.08],[1047,.22]],
boom:[[140,.05],[98,.09],[65,.12]],
pick:[[659,.055],[988,.09],[1319,.07]],
place:[[392,.055],[196,.09]],
ok:[[784,.06],[988,.06],[1175,.06],[1568,.15]],
error:[[330,.1],[311,.1],[294,.18]],
ship:[[523,.07],[659,.07],[784,.07],[1047,.12],[784,.06],[1047,.2]],
bump:[[110,.045],[55,.07]],
whistle:[[1047,.08],[1397,.08],[1047,.1]],
horn:[[196,.12],[247,.16],[196,.12]],
fire:[[988,.16],[622,.16],[988,.16],[622,.16],[988,.22],[622,.22]],
warn:[[880,.06],[660,.045]],
dash:[[740,.04],[1040,.04],[1320,.05]],
fever:[[784,.09],[1047,.09],[1319,.09],[1568,.14],[2093,.18]],
crit:[[1200,.05],[900,.05],[1200,.05]],
gate:[[392,.1],[523,.1],[659,.1],[784,.18],[1047,.24]],
warp:[[1047,.05],[784,.05],[1047,.05],[1319,.06],[1568,.08],[2093,.26]]
};
function snd(type, pitch=1){
if(!soundEnabled || !actx || !retroCues[type] || document.hidden) return;
let at = actx.currentTime;
for(const [frequency,duration] of retroCues[type]){
const osc = actx.createOscillator(), gain = actx.createGain();
osc.type = type === 'bump' || type === 'place' ? 'triangle' : 'square';
osc.frequency.setValueAtTime(frequency * pitch, at);
osc.connect(gain); gain.connect(sfxOut());
gain.gain.setValueAtTime(0, at);
gain.gain.linearRampToValueAtTime(type === 'warn' ? .035 : .065, at + .003);
gain.gain.setValueAtTime(type === 'warn' ? .035 : .065, at + duration * .65);
gain.gain.linearRampToValueAtTime(0, at + duration);
osc.start(at); osc.stop(at + duration + .005);
osc.onended = () => { osc.disconnect(); gain.disconnect(); };
at += duration;
}
}
document.querySelectorAll('#snd,#amb,#mus,[data-audio]').forEach(b => {
  const ch = b.dataset.audio || b.id;
  b.onclick = () => { initAudio(); stepVol(ch); };
});
const tipsBtn = document.getElementById('tips'); if(tipsBtn) tipsBtn.onclick = () => { setTips(!tipsEnabled); };
function syncAudioUI(){
const pressed = (el, on) => el.setAttribute('aria-pressed', on ? 'true' : 'false');
/* المستوى ظاهر على الزر: أشرطة 3/2/1 ونسبة مئوية، والصامت بعلامة X الحمراء */
document.querySelectorAll('#snd,#amb,#mus,[data-audio]').forEach(b => {
  const ch = b.dataset.audio || b.id, v = audioLv[ch];
  if(v === undefined) return;
  const n = VOL_NAME[ch], pct = v ? Math.round(v * 100) + '%' : I18N.T('صامت', 'muted');
  b.classList.toggle('off', !v); pressed(b, v > 0);
  b.dataset.lv = String(VOL_STEPS.length - 1 - VOL_STEPS.indexOf(v));
  b.dataset.pct = v && v < 1 ? Math.round(v * 100) + '' : '';
  const bars = b.querySelector('.vol-bars'); if(bars) bars.dataset.t = pct;
  const lbl = I18N.T(n[0], n[1]) + ' — ' + pct;
  b.setAttribute('aria-label', lbl); b.title = lbl + I18N.T(' (اضغط للخفض)', ' (press to lower)');
});
document.querySelectorAll('[data-tips-toggle]').forEach(b => { b.classList.toggle('off', !tipsEnabled); pressed(b, tipsEnabled); });
const t = document.getElementById('tips'); if(t) { t.classList.toggle('off', !tipsEnabled); pressed(t, tipsEnabled); }
}
document.querySelectorAll('[data-tips-toggle]').forEach(b => b.onclick = () => setTips(!tipsEnabled));
(() => {
syncAudioUI();
})();
const Z = [
{n:'FOD',e:'🔩',c:0xd32f2f,k:'fod',x:gameRules.fodZoneX,w:2.6,cap:1,cols:1},
{n:'تبريد',e:'❄️',c:0x5291b5,k:'cold',x:-20,w:5.8,cap:9,cols:3},
{n:'قابلة للتلف',e:'🍓',c:0x62985c,k:'perish',x:-12,w:5.8,cap:9,cols:3},
{n:'شحن عام',e:'📦',c:0x84929a,k:'gen',x:-4,w:5.8,cap:9,cols:3},
{n:'حاوية خطرة ١',e:'☣️',c:0xb85550,k:'hz1',x:11.5,w:5.0,cap:6,cols:3,hz:1},
{n:'حاوية خطرة ٢',e:'☣️',c:0x8e6098,k:'hz2',x:18,w:5.0,cap:6,cols:3,hz:1},
{n:'حاوية خطرة ٣',e:'☣️',c:0x3f7f8c,k:'hz3',x:24.5,w:5.0,cap:6,cols:3,hz:1}
];
Z.forEach(z => { z.items = []; z.n_ = 0; z.full = false; z.hw = z.w / 2; z.n = I18N.t(z.n); });
const I = [
['cold','💉','لقاحات مبردة','COL','REF'],['cold','🐟','أسماك طازجة','PES','COL'],['cold','💊','أنسولين وأدوية','MED','COL'],
['perish','🍓','فراولة طازجة','PER','EAT'],['perish','🌹','زهور مقطوفة','PEF','EAT'],['perish','🍞','مخبوزات طازجة','PEM','EAT'],
['gen','👕','ملابس قطنية','GEN','GEN'],['gen','📚','كتب ومطبوعات','GEN','GEN'],['gen','🧸','ألعاب أطفال','GEN','GEN']
];
/* الطرد المجمّد: يظهر عشوائياً على الحزام، ولا يُقبل إلا في غرفة التجميد بعد حل لغز الباب */
const FRZ_RAW = ['frz', '🧊', 'طرد مجمّد', 'FRZ', '−18°C'];
FRZ_RAW[2] = I18N.t(FRZ_RAW[2]);
const HZ = [
['h1','🧨','ذخائر خفيفة','RXS','1.4S'],
['h1','🎆','ألعاب نارية','RGX','1.3G'],
['h2','⛽','غاز البترول المسال','RFG','2.1'],
['h2','🧯','غاز الهيليوم المضغوط','RNG','2.2'],
['h2','☣️','غاز الكلور السام','RPG','2.3'],
['h3','🛢️','وقود طائرات كيروسين','RFL','3'],
['h3','🎨','دهانات ومذيبات نفطية','RFL','3'],
['h4','🔥','أعواد فسفور وكبريت','RFS','4.1'],
['h4','✨','فحم نباتي منشط','RSC','4.2'],
['h4','⚡','كاربيد الكالسيوم','RFW','4.3'],
['h5','🌱','نترات الأمونيوم المؤكسدة','ROX','5.1'],
['h5','🧴','بيروكسيد عضوي مثبت','ROP','5.2'],
['h6','☠️','مبيدات زرنيخية سامة','RPB','6.1'],
['h6','🦠','عينات فيروسية معدية','RIS','6.2'],
['h7','☢️','نظائر يود طبية مشعة','RRY','7'],
['h8','🧪','حمض الكبريتيك المركز','RCM','8'],
['h8','🚗','بطاريات أحماض سائلة','RCM','8'],
['h9','🔋','بطاريات ليثيوم أيون','RLI','9'],
['h9','🧊','ثلج جاف كربوني','RMD','9']
];
I.forEach(r => { r[2] = I18N.t(r[2]); });
HZ.forEach(r => { r[2] = I18N.t(r[2]); });
const R = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance', alpha:false});
/* نسبة البكسل الهدف: كثافة الشاشة الفعلية بحد أقصى 2.
   غطاء 2 يعطي حدة كاملة على Retina و4K ويمنع انهيار الأداء على شاشات 3x/4x. */
function targetPixelRatio(dpr){
const d = Number(dpr) || 1;
return Math.max(1, Math.min(d, 2));
}
const maxAnisotropy = R.capabilities.getMaxAnisotropy();
/* ترشيح موحّد لكل الخامات: أعلى ترشيح مائل + mipmaps يمنع ضبابية الأرضية واللافتات في الزوايا البعيدة */
function applyTextureFiltering(t){
if(!t) return t;
t.anisotropy = maxAnisotropy;
t.minFilter = THREE.LinearMipmapLinearFilter;
t.magFilter = THREE.LinearFilter;
t.generateMipmaps = true;
t.needsUpdate = true;
return t;
}
let renderScale = 1, scaleCeil = 1, renderReady = false;
let perfWarm = 0, perfWin = 0, perfFrames = 0, slowStreak = 0, fastStreak = 0;
const lastSize = { w: 0, h: 0, dpr: 0 };
/* كشف العرض البرمجي (بلا GPU): هذه البيئات لا تتحمل مخزن دقة أصلية 4K وتُسقط الصفحة */
const softwareGL = (() => {
try{
const gl = R.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
return /swiftshader|llvmpipe|software|basic render/i.test(name);
}catch(e){ return false; }
})();
const stageEl = document.getElementById('stage');
R.setPixelRatio(targetPixelRatio(devicePixelRatio));
loading.phase(28, I18N.t('تهيئة محرّك الرسم ثلاثي الأبعاد...'));
R.shadowMap.enabled = true;
R.shadowMap.type = THREE.PCFSoftShadowMap;
R.outputEncoding = THREE.sRGBEncoding;
R.toneMapping = THREE.ACESFilmicToneMapping;
R.toneMappingExposure = 1.15;
R.physicallyCorrectLights = false;
stageEl.prepend(R.domElement);
const S = new THREE.Scene();
S.background = new THREE.Color(0x1a2430);
S.fog = new THREE.Fog(0x1a2430, 34, 85);
const C = new THREE.PerspectiveCamera(48, 1, 0.1, 140);
let camMaxX = 14;
function rs(){
const w = stageEl.clientWidth || innerWidth, h = stageEl.clientHeight || innerHeight;
const dpr = targetPixelRatio(devicePixelRatio);
// أي تغيّر في مساحة العرض أو كثافة البكسل يعيد ضبط الجودة من جديد
if(!renderReady || w !== lastSize.w || h !== lastSize.h || dpr !== lastSize.dpr){
renderReady = true; lastSize.w = w; lastSize.h = h; lastSize.dpr = dpr;
const nativePx = w * h * dpr * dpr;
const budget = softwareGL ? 2.0e6 : (((navigator.hardwareConcurrency || 4) >= 8) ? 9.0e6 : 6.0e6);
renderScale = nativePx > budget ? Math.max(.5, Math.sqrt(budget / nativePx)) : 1;
if(softwareGL) scaleCeil = renderScale;
perfWarm = 0; perfWin = 0; perfFrames = 0; slowStreak = 0; fastStreak = 0;
}
R.setPixelRatio(dpr * renderScale);
// false: لا نترك Three.js يكتب أبعاد CSS على الكانفاس — التنسيق من CSS وحده فلا تمطيط ثنائي الخطية
R.setSize(w, h, false);
C.aspect = w / h;
// تكييف زاوية الرؤية مع اتجاه الشاشة (أفقي/عمودي) ليبقى الملعب مرئياً
const land = w > h;
C.fov = land ? 46 + Math.max(0, Math.min(10, (1.75 - C.aspect) * 8)) : 62;
C.updateProjectionMatrix();
// أقصى إزاحة أفقية للكاميرا: نُبقي المشهد داخل جدران المستودع (السعة 70 وحدة)
const camDist = Math.hypot(14.6, 12.3);
const camHalfW = camDist * Math.tan((C.fov * Math.PI) / 360) * C.aspect;
camMaxX = Math.max(0, 33.5 - camHalfW);
}
/* التكيّف مع تدوير الهاتف: resize + orientationchange + visualViewport */
let rsRaf = 0;
function rsSoon(){
if(rsRaf) cancelAnimationFrame(rsRaf);
rsRaf = requestAnimationFrame(() => { rsRaf = 0; rs(); requestAnimationFrame(rs); placeToastBelowIntro(); });
}
/* بعد التدوير أو الرجوع من الخلفية/ملء الشاشة تُبلغ المتصفحات أحياناً أبعاداً قديمة لبضع مئات من الملّي ثانية:
   نعيد الضبط عدة مرات حتى يستقر القياس، وResizeObserver يلتقط أي تغيّر فعلي في حاوية اللعبة. */
let rsSettleT = [];
function rsSettle(){
rsSoon(); rsSettleT.forEach(clearTimeout);
rsSettleT = [120, 350, 800, 1500].map(ms => setTimeout(rsSoon, ms));
}
addEventListener('resize', rsSoon, { passive:true });
addEventListener('orientationchange', rsSettle, { passive:true });
addEventListener('pageshow', rsSettle, { passive:true });
document.addEventListener('visibilitychange', () => { if(!document.hidden) rsSettle(); });
document.addEventListener('fullscreenchange', rsSettle);
if(window.ResizeObserver) new ResizeObserver(rsSoon).observe(stageEl);
if(window.visualViewport) visualViewport.addEventListener('resize', rsSoon, { passive:true });
if(window.screen && screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', rsSettle);
rs();
// ===== الإضاءة: ضوء سماوي بارد من النوافذ العلوية + مصابيح صناعية دافئة + إضاءة مركّزة على مناطق الفرز
const hemiLight = new THREE.HemisphereLight(0xcfe2ff, 0x3a3226, 0.55);
S.add(hemiLight);
const amb = new THREE.AmbientLight(0x404a58, 0.25); S.add(amb);
const sun = new THREE.DirectionalLight(0xdfeaff, 0.95);
sun.position.set(-14, 34, 18);
sun.castShadow = true;
// 2048: أسرع بنحو 14% من 3072 بنفس الكادر (انظر docs/perf/shadow-steps.md).
// 1536 جُرّب ورُفض: كسبه على GPU داخل الضجيج مقابل تنعيم ظاهر لنصف الظل على أرضية المستودع.
const shadowRes = 2048;
sun.shadow.mapSize.set(shadowRes, shadowRes);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, {left:-38, right:38, top:26, bottom:-26, near:5, far:90});
S.add(sun);
Z.forEach(z=>{ if(z.k==='fod') return; const sp=new THREE.SpotLight(z.hz?0xffe0b0:0xfff4e0,0.9,22,0.85,0.7,1.2); sp.position.set(z.x,9,-4); sp.target.position.set(z.x,0,-8.6); S.add(sp); S.add(sp.target); });
const fill = new THREE.DirectionalLight(0xffd7a8, 0.35);
fill.position.set(20, 14, 30); S.add(fill);
const M = (g, c, r=0.55, m=0.15) => {
const o = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color:c, roughness:r, metalness:m}));
o.castShadow = true; o.receiveShadow = true;
return o;
};
const B = (w, h, d, c, x, y, z, p=S, r=0.55, m=0.15) => {
const o = M(new THREE.BoxGeometry(w, h, d), c, r, m);
o.position.set(x, y, z); p.add(o); return o;
};
const CY = (rt, rb, h, c, x, y, z, p=S, r=0.5, m=0.2, seg=16) => {
const o = M(new THREE.CylinderGeometry(rt, rb, h, seg), c, r, m);
o.position.set(x, y, z); p.add(o); return o;
};
let texBuilt = 0;
function canvasTex(w, h, draw, rx=1, ry=1){
const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
draw(cv.getContext('2d'), w, h);
const t = new THREE.CanvasTexture(cv);
t.encoding = THREE.sRGBEncoding;
t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
texBuilt++;
loading.phase(30 + Math.min(50, texBuilt * 3), I18N.T('تجهيز خامات المستودع (', 'Building warehouse textures (') + texBuilt + ')...');
return applyTextureFiltering(t);
}
function rawTex(cv){
const t = new THREE.CanvasTexture(cv);
t.encoding = THREE.sRGBEncoding;
return applyTextureFiltering(t);
}
// ===== أرضية خرسانية مصقولة: ألواح 5×5 بدرجات متفاوتة + فواصل غائرة + طبقة تآكل وبقع وآثار عجلات + بقع ضوء المصابيح
const TONES=[[92,97,104],[84,89,96],[97,102,108],[88,93,100]];
const floorTex = canvasTex(1024, 1024, (g, w, h) => {
const s=w/2;
for(let i=0;i<4;i++){
const x0=(i%2)*s, y0=(i>>1)*s, t=TONES[i];
g.fillStyle=`rgb(${t[0]},${t[1]},${t[2]})`; g.fillRect(x0,y0,s,s);
const gr=g.createRadialGradient(x0+s*(.3+Math.random()*.4),y0+s*(.3+Math.random()*.4),10,x0+s/2,y0+s/2,s*.75);
gr.addColorStop(0,'rgba(255,255,255,.07)'); gr.addColorStop(1,'rgba(0,0,0,.09)');
g.fillStyle=gr; g.fillRect(x0,y0,s,s);
}
for(let i=0;i<22000;i++){ const v=Math.random()>.5?255:0; g.fillStyle=`rgba(${v},${v},${v},${Math.random()*.06})`; g.fillRect(Math.random()*w,Math.random()*h,Math.random()*2+1,Math.random()*2+1); }
for(let i=0;i<60;i++){ g.strokeStyle=Math.random()>.5?'rgba(255,255,255,.05)':'rgba(0,0,0,.06)'; g.lineWidth=1; const x=Math.random()*w,y=Math.random()*h,a=Math.random()*6.28,l=20+Math.random()*60; g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l); g.stroke(); }
g.fillStyle='rgba(255,255,255,.07)'; g.fillRect(s+2,0,2,h); g.fillRect(0,s+2,w,2);
g.fillStyle='rgba(12,14,17,.85)';
g.fillRect(s-1.5,0,3,h); g.fillRect(0,s-1.5,w,3);
g.fillRect(0,0,1.5,h); g.fillRect(w-1.5,0,1.5,h); g.fillRect(0,0,w,1.5); g.fillRect(0,h-1.5,w,1.5);
}, 7, 4.4);
const floorBump = canvasTex(512, 512, (g, w, h) => {
g.fillStyle='#bbb'; g.fillRect(0,0,w,h);
for(let i=0;i<9000;i++){ const v=150+Math.random()*80|0; g.fillStyle=`rgb(${v},${v},${v})`; g.fillRect(Math.random()*w,Math.random()*h,2,2); }
g.fillStyle='#222'; g.fillRect(w/2-2,0,4,h); g.fillRect(0,h/2-2,w,4);
g.fillRect(0,0,2,h); g.fillRect(w-2,0,2,h); g.fillRect(0,0,w,2); g.fillRect(0,h-2,w,2);
}, 7, 4.4);
const floorMat = new THREE.MeshStandardMaterial({map:floorTex, bumpMap:floorBump, bumpScale:1, roughness:0.5, metalness:0.12});
const floor = new THREE.Mesh(new THREE.BoxGeometry(70, 0.2, 44), floorMat);
floor.position.set(0, -0.1, 2); floor.receiveShadow = true; S.add(floor);
// طبقة تآكل: ممر مصقول، آثار عجلات، بقع زيت، اتساخ عند الجدران (مرسومة مرة واحدة لكامل الأرضية)
const wearTex = canvasTex(1024, 640, (g, w, h) => {
const X = v => (v+35)/70*w, Zc = v => (v+20)/44*h;
g.clearRect(0,0,w,h);
const edge = g.createLinearGradient(0,0,0,h); edge.addColorStop(0,'rgba(0,0,0,.35)'); edge.addColorStop(.12,'rgba(0,0,0,0)'); edge.addColorStop(.9,'rgba(0,0,0,0)'); edge.addColorStop(1,'rgba(0,0,0,.2)');
g.fillStyle=edge; g.fillRect(0,0,w,h);
const sideL = g.createLinearGradient(0,0,w*.07,0); sideL.addColorStop(0,'rgba(0,0,0,.25)'); sideL.addColorStop(1,'rgba(0,0,0,0)');
g.fillStyle=sideL; g.fillRect(0,0,w*.07,h);
g.save(); g.translate(w,0); g.scale(-1,1); g.fillStyle=sideL; g.fillRect(0,0,w*.07,h); g.restore();
g.fillStyle='rgba(255,255,255,.045)'; g.fillRect(0,Zc(-4.2),w,Zc(9.2)-Zc(-4.2));
for(const zz of [0.3,1.4,3.6,5.2,7.1]){
for(let k=0;k<3;k++){ g.strokeStyle=`rgba(0,0,0,${.05+Math.random()*.04})`; g.lineWidth=7+Math.random()*5; g.beginPath(); const y0=Zc(zz+(Math.random()-.5)*.3); g.moveTo(0,y0); g.bezierCurveTo(w*.3,y0+(Math.random()-.5)*30,w*.65,y0+(Math.random()-.5)*30,w,y0+(Math.random()-.5)*20); g.stroke(); }
}
for(let i=0;i<9;i++){ const x=Math.random()*w, y=Zc(-3+Math.random()*13), r=16+Math.random()*34; const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(15,15,18,.32)'); gr.addColorStop(.6,'rgba(15,15,18,.14)'); gr.addColorStop(1,'rgba(15,15,18,0)'); g.fillStyle=gr; g.beginPath(); g.ellipse(x,y,r,r*(.6+Math.random()*.4),Math.random()*3,0,6.3); g.fill(); }
for(const sx of [-1,1]) for(const zz of [-6,6]){ g.strokeStyle='rgba(0,0,0,.09)'; g.lineWidth=9; g.beginPath(); const x=X(sx*33.5), y=Zc(zz+2); g.moveTo(x,y-45); g.quadraticCurveTo(x-sx*70,y,x-sx*20,y+60); g.stroke(); }
}, 1, 1);
wearTex.wrapS = wearTex.wrapT = THREE.ClampToEdgeWrapping;
const wear = new THREE.Mesh(new THREE.PlaneGeometry(70, 44), new THREE.MeshBasicMaterial({map:wearTex, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2}));
wear.rotation.x = -Math.PI/2; wear.position.set(0, 0.004, 2); S.add(wear);
const poolTex = canvasTex(128, 128, (g, w, h) => { const gr=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2); gr.addColorStop(0,'rgba(255,226,170,.55)'); gr.addColorStop(.5,'rgba(255,226,170,.16)'); gr.addColorStop(1,'rgba(255,226,170,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
poolTex.wrapS = poolTex.wrapT = THREE.ClampToEdgeWrapping;
const poolMat = new THREE.MeshBasicMaterial({map:poolTex, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.55, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3});
[[-16,-8.6],[0,-8.6],[17.7,-8.6],[-12,11],[12,11]].forEach(([x,z]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), poolMat); p.rotation.x = -Math.PI/2; p.position.set(x, 0.006, z); S.add(p); });
// ===== جدران معدنية مموجة مع شريط سفلي
const wallTex = canvasTex(512, 512, (g, w, h) => {
g.fillStyle = '#56687a'; g.fillRect(0,0,w,h);
for(let x=0;x<w;x+=32){ const gr = g.createLinearGradient(x,0,x+32,0); gr.addColorStop(0,'#4a5b6c'); gr.addColorStop(.5,'#71859a'); gr.addColorStop(1,'#4a5b6c'); g.fillStyle = gr; g.fillRect(x,0,32,h); }
g.fillStyle = 'rgba(0,0,0,.18)'; for(let y=0;y<h;y+=128) g.fillRect(0,y,w,3);
}, 14, 2);
const wallMat = new THREE.MeshStandardMaterial({map:wallTex, roughness:0.6, metalness:0.35});
const mkWall = (w,h,d,x,y,z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat); m.position.set(x,y,z); m.receiveShadow = true; S.add(m); return m; };
mkWall(70, 11, 0.6, 0, 5.5, -17.5);
mkWall(0.6, 11, 44, -35, 5.5, 2);
mkWall(0.6, 11, 44, 35, 5.5, 2);
B(70, 1.2, 0.7, 0x3a4048, 0, 0.6, -17.3, S, 0.8, 0.1);
B(0.7, 1.2, 44, 0x3a4048, -34.8, 0.6, 2, S, 0.8, 0.1);
B(0.7, 1.2, 44, 0x3a4048, 34.8, 0.6, 2, S, 0.8, 0.1);
// شريط تحذير أصفر/أسود على قاعدة الجدار
const hazTex = canvasTex(256, 32, (g,w,h)=>{ g.fillStyle='#f5c400'; g.fillRect(0,0,w,h); g.fillStyle='#151515'; for(let x=-32;x<w;x+=32){ g.beginPath(); g.moveTo(x,h); g.lineTo(x+16,h); g.lineTo(x+32,0); g.lineTo(x+16,0); g.fill(); } }, 30, 1);
const hazMat = new THREE.MeshStandardMaterial({map:hazTex, roughness:0.5});
const hz1 = new THREE.Mesh(new THREE.BoxGeometry(70, 0.3, 0.72), hazMat); hz1.position.set(0, 1.25, -17.3); S.add(hz1);
// أبواب رصيف التحميل
[-1,1].forEach(s => {
[-6, 6].forEach(z => {
B(0.3, 6.2, 5.4, 0x2b3138, s*34.6, 3.1, z, S, 0.6, 0.4);
const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.6, 4.8), new THREE.MeshStandardMaterial({map:canvasTex(64,256,(g,w,h)=>{ g.fillStyle='#8c99a6'; g.fillRect(0,0,w,h); g.fillStyle='rgba(0,0,0,.25)'; for(let y=0;y<h;y+=12) g.fillRect(0,y,w,2); },1,1), roughness:0.5, metalness:0.5}));
door.position.set(s*34.45, 2.8, z); door.receiveShadow = true; S.add(door);
const dl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.3), new THREE.MeshStandardMaterial({color:0x111, emissive:z<0?0x22ff55:0xff3322, emissiveIntensity:1.6}));
dl.position.set(s*34.3, 6.5, z + 2.0); S.add(dl);
});
});
// ===== بوابة الخروج إلى اللعبة التالية على الجدار الأيسر (رصيف الطيران B) =====
const EXIT_GATE = { x:-34.1, z:-6, targetX:-32.95, targetZ:-6, active:false, phase:'idle', t:0, open:0, warped:false, trail:[], route:[], wp:0, stuckT:0, lastX:0, lastZ:0, limit:20 };
const gateGroup = new THREE.Group();
gateGroup.position.set(EXIT_GATE.x, 0, EXIT_GATE.z);
S.add(gateGroup);
const gateSteel = new THREE.MeshStandardMaterial({color:0x1b2f3d, metalness:.82, roughness:.28, emissive:0x08222e, emissiveIntensity:.4});
const gateNeon = new THREE.MeshStandardMaterial({color:0xcff8ff, emissive:0x35d8ff, emissiveIntensity:1.9, metalness:.1, roughness:.25});
const gateBox = (w,h,d,mat,x,y,z,parent=gateGroup) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
gateBox(0.5, 6.7, 0.5, gateSteel, 0, 3.35, -3.0);
gateBox(0.5, 6.7, 0.5, gateSteel, 0, 3.35, 3.0);
gateBox(0.62, 0.62, 6.5, gateSteel, 0, 6.75, 0);
const gateDoorL = gateBox(0.18, 5.7, 2.72, gateSteel, 0.02, 2.85, -1.36);
const gateDoorR = gateBox(0.18, 5.7, 2.72, gateSteel, 0.02, 2.85, 1.36);
[gateDoorL, gateDoorR].forEach((door, i) => {
const seam = new THREE.Mesh(new THREE.BoxGeometry(0.07, 5.3, 0.1), gateNeon);
seam.position.set(0.1, 0, i === 0 ? 1.3 : -1.3); door.add(seam);
});
const portalTex = canvasTex(256, 256, (g, w, h) => {
const gr = g.createRadialGradient(w/2, h/2, 8, w/2, h/2, w/2);
gr.addColorStop(0, 'rgba(226,252,255,1)'); gr.addColorStop(.42, 'rgba(64,214,255,.9)');
gr.addColorStop(.78, 'rgba(18,86,146,.45)'); gr.addColorStop(1, 'rgba(4,12,24,0)');
g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, 1, 1);
const portalMat = new THREE.MeshBasicMaterial({map:portalTex, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false});
const portalPlane = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 6.1), portalMat);
portalPlane.rotation.y = Math.PI/2; portalPlane.position.set(-0.14, 3.25, 0); gateGroup.add(portalPlane);
const gatePadMat = new THREE.MeshBasicMaterial({map:portalTex, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false});
const gatePad = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 5.4), gatePadMat);
gatePad.rotation.x = -Math.PI/2; gatePad.position.set(1.7, 0.035, 0); gateGroup.add(gatePad);
const gateLight = new THREE.PointLight(0x3fd9ff, 0, 15, 2);
gateLight.position.set(0.9, 3.6, 0); gateGroup.add(gateLight);
const gateMarkerTex = canvasTex(640, 160, (g, w, h) => {
g.clearRect(0, 0, w, h);
g.fillStyle = 'rgba(6,20,32,.84)';
g.beginPath();
if(g.roundRect) g.roundRect(8, 12, w - 16, h - 24, 34); else g.rect(8, 12, w - 16, h - 24);
g.fill();
g.strokeStyle = 'rgba(120,236,255,.85)'; g.lineWidth = 4; g.stroke();
g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
g.fillStyle = '#d9fbff'; g.font = 'bold 52px Cairo, system-ui, sans-serif';
g.fillText(I18N.T('المخرج إلى اللعبة التالية', 'Exit to the next game'), w/2, h/2 + 2);
}, 1, 1);
const gateMarkerMat = new THREE.SpriteMaterial({map:gateMarkerTex, transparent:true, depthWrite:false, opacity:0});
const gateMarker = new THREE.Sprite(gateMarkerMat);
gateMarker.scale.set(6.9, 1.62, 1); gateMarker.position.set(0, 6.6, 0); gateGroup.add(gateMarker);
const gateTrailGroup = new THREE.Group(); gateTrailGroup.visible = false; S.add(gateTrailGroup);
const chevronTex = canvasTex(128, 128, (g, w, h) => {
g.clearRect(0, 0, w, h);
g.strokeStyle = '#a9f5ff'; g.lineWidth = 15; g.lineCap = 'round'; g.lineJoin = 'round';
g.shadowColor = '#36d8ff'; g.shadowBlur = 20;
g.beginPath(); g.moveTo(30, 98); g.lineTo(64, 34); g.lineTo(98, 98); g.stroke();
}, 1, 1);
const chevronGeo = new THREE.PlaneGeometry(1.7, 1.7); chevronGeo.rotateX(-Math.PI/2);
for(let i = 0; i < 18; i++){
const mm = new THREE.MeshBasicMaterial({map:chevronTex, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending});
const arrow = new THREE.Mesh(chevronGeo, mm); arrow.visible = false; arrow.userData.delay = i * 0.09;
gateTrailGroup.add(arrow); EXIT_GATE.trail.push(arrow);
}
// ===== هيكل السقف: جمالونات + نوافذ ضوئية مضيئة
// أعمدة + مصابيح صناعية معلقة
const lampMat = new THREE.MeshStandardMaterial({color:0xfff3d6, emissive:0xffe2a8, emissiveIntensity:2.2});
[-24, -8, 8, 24].forEach(x => {
[-12.6, 15].forEach(z => {
if(x === 8 && z === -12.6) return; // العمود الذي كان يخترق لوحة جدول الفرز
B(0.9, 4.6, 0.9, 0x3d4652, x, 2.3, z, S, 0.4, 0.5);
B(1.05, 1.0, 1.05, 0xf5c400, x, 0.5, z, S, 0.5, 0.1);
});
});
const spotTargets = [];
[[-16,-8.6],[0,-8.6],[17.7,-8.6],[-12,11],[12,11]].forEach(([x,z],i) => {
const sp = new THREE.SpotLight(i<3 ? 0xffe4b8 : 0xfff0d8, i<3 ? 1.25 : 0.9, 22, Math.PI*0.27, 0.55, 1.4);
sp.position.set(x, 7.9, z); sp.target.position.set(x, 0, z); S.add(sp); S.add(sp.target);
});
// ===== رفوف تخزين عالية محمّلة بمنصات وطرود مغلفة
const boxTex = canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#a37a4f'; g.fillRect(0,0,w,h); g.fillStyle='#c9a676'; g.fillRect(56,0,16,h); g.strokeStyle='rgba(60,35,15,.5)'; g.lineWidth=4; g.strokeRect(2,2,w-4,h-4); g.fillStyle='#f2efe6'; g.fillRect(14,80,34,26); });
const boxMat = new THREE.MeshStandardMaterial({map:boxTex, roughness:0.85});
const wrapMat = new THREE.MeshStandardMaterial({color:0xcfe0ea, roughness:0.2, metalness:0.1, transparent:true, opacity:0.35});
const palletMat = new THREE.MeshStandardMaterial({color:0x9a7a52, roughness:0.9});
function pallet(x, y, z, par=S, n=3){
const pg = new THREE.Group(); pg.position.set(x, y, z); par.add(pg);
[-0.5,0,0.5].forEach(o => { const s = new THREE.Mesh(new THREE.BoxGeometry(1.5,0.12,0.18), palletMat); s.position.set(0,0.06,o*0.95); s.castShadow = s.receiveShadow = true; pg.add(s); });
const top = new THREE.Mesh(new THREE.BoxGeometry(1.5,0.05,1.2), palletMat); top.position.y = 0.15; top.castShadow = top.receiveShadow = true; pg.add(top);
for(let i=0;i<n;i++){ const b = new THREE.Mesh(new THREE.BoxGeometry(0.66,0.5,0.55), boxMat); b.position.set((i%2-.5)*0.7, 0.43 + Math.floor(i/2)*0.5, (i%3===2?0.28:-0.28)); b.rotation.y = (Math.random()-.5)*0.1; b.castShadow = b.receiveShadow = true; pg.add(b); }
if(n>2){ const w = new THREE.Mesh(new THREE.BoxGeometry(1.48, 1.05, 1.18), wrapMat); w.position.y = 0.7; pg.add(w); }
return pg;
}
/* فراغ مقصود عند x≈٧ خلف FOD: يفسح مجال لوحة جدول الفرز بلا رفوف تحجبها */
[-28, -14, -3, 17].forEach(x => {
[-5, 5].forEach(o => B(0.16, 8.0, 0.16, 0x1f5fa8, x+o, 4.0, -15.0, S, 0.4, 0.6));
[-5, 5].forEach(o => B(0.16, 8.0, 0.16, 0x1f5fa8, x+o, 4.0, -16.7, S, 0.4, 0.6));
for(let dy=0.2; dy<=7.4; dy+=2.4){
B(10.2, 0.14, 0.12, 0xf08a00, x, dy, -15.0, S, 0.4, 0.5);
B(10.2, 0.14, 0.12, 0xf08a00, x, dy, -16.7, S, 0.4, 0.5);
B(10.0, 0.05, 1.6, 0x6d7a87, x, dy+0.07, -15.85, S, 0.5, 0.6);
for(let bx=-3.4; bx<=3.4; bx+=2.25) pallet(x+bx, dy+0.1, -15.85, S, 2 + (Math.random()*3|0));
}
});
// منصات وطرود متفرقة + حواجز أمان + رافعة شوكية متوقفة
[[-32,-3],[-32,-1.2],[32,-3],[32,-1.2],[-32,4.5]].forEach(([x,z]) => pallet(x, 0, z, S, 4));
const BOLLARDS = [];
[[-27.4,9.2],[27.4,9.2],[-27.4,14.6],[27.4,14.6],[-11,-4.6],[9.3,-4.6]].forEach(([x,z]) => {
CY(0.18, 0.18, 1.1, 0xf5c400, x, 0.55, z, S, 0.45, 0.2);
CY(0.185, 0.185, 0.16, 0x151515, x, 0.75, z, S, 0.6, 0.1);
BOLLARDS.push({x, z, r:0.2});
});
// زر إبطاء الحزام عمود ثابت: لا يمكن للاعب المرور من خلاله
BOLLARDS.push({x:22.8, z:9.95, r:0.22});
const fk = new THREE.Group(); fk.position.set(30.8, 0, 8.4); fk.rotation.y = -Math.PI/2; S.add(fk);
B(1.5, 0.9, 2.2, 0xf2a900, 0, 0.75, 0, fk, 0.45, 0.3);
B(1.3, 0.5, 0.9, 0x222, 0, 1.4, -0.6, fk, 0.7, 0.2);
[-0.6,0.6].forEach(s => B(0.08, 2.2, 0.08, 0x333, s, 1.8, 0.2, fk, 0.5, 0.6));
B(1.3, 0.08, 0.08, 0x333, 0, 2.85, 0.2, fk, 0.5, 0.6); B(1.3, 0.08, 0.08, 0x333, 0, 2.85, -0.9, fk, 0.5, 0.6);
[-0.6,0.6].forEach(s => B(0.08, 2.2, 0.08, 0x333, s, 1.8, -0.9, fk, 0.5, 0.6));
B(0.12, 2.6, 0.2, 0x2a2a2a, 0, 1.3, 1.2, fk, 0.5, 0.6);
[-0.45,0.45].forEach(s => B(0.15, 0.06, 1.3, 0x555, s, 0.15, 1.8, fk, 0.4, 0.8));
[[-0.78,0.7],[0.78,0.7],[-0.78,-0.7],[0.78,-0.7]].forEach(([x,z]) => { const w = CY(0.32,0.32,0.3,0x161616,x,0.32,z,fk,0.9,0.1); w.rotation.z = Math.PI/2; });
// Moving forklift reuses the parked vehicle, with a visible seated driver.
const fkBoxParts = fk.children.slice();
const recklessTruck = fk.clone(); S.add(recklessTruck); recklessTruck.visible = false;
const truckBoxParts = recklessTruck.children.slice();
/* رافعة شوكية بمجسّم Low Poly (Kolos Studios، CC BY 4.0 — Sketchfab): تحلّ محل الصناديق عند نجاح التحميل،
   وتبقى الصناديق احتياطاً عند الفشل. المحور المحلي: +z للأمام (الشوكتان)، الوحدات سم → متر بمقياس واحد. */
(function loadForkliftModel(){
  if(!THREE.GLTFLoader) return;
  const lt = loading.track('forklift', 'الرافعة الشوكية', 12);
  new THREE.GLTFLoader().load('game/models/forklift-kolos.glb', g => {
    try {
      const src = g.scene, SC = 0.0228, SHIFT_Z = 0.77;   // الطول ≈ 5.2، العرض ≈ 1.95، السقف ≈ 3.3 (الشخصية 3.1 والطرد 1.35)
      src.updateMatrixWorld(true);
      const bx = new THREE.Box3().setFromObject(src);   // مركز النموذج الأصلي بعيد عن الأصل: نُعيد توسيطه وننزله على الأرض
      src.traverse(o => { if(o.isMesh){
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        [].concat(o.material).forEach(m => { if(m.map) m.map.encoding = THREE.sRGBEncoding; if('metalness' in m) m.metalness = .1; if('roughness' in m) m.roughness = .8; m.needsUpdate = true; });
      }});
      const put = (parent, boxes) => {
        const holder = new THREE.Group(), m = parent === fk ? src : src.clone();
        m.scale.setScalar(SC); m.position.set(-(bx.min.x + bx.max.x) / 2 * SC, -bx.min.y * SC, -(bx.min.z + bx.max.z) / 2 * SC + SHIFT_Z);
        holder.add(m); parent.add(holder); boxes.forEach(b => { b.visible = false; });
      };
      put(fk, fkBoxParts); put(recklessTruck, truckBoxParts);
      console.log('[forklift] glb model ready'); lt.done();
    } catch(e){ console.warn('[forklift] glb failed, keeping box model', e); lt.fail(); }
  }, e => { if(e && e.total) lt.set(e.loaded / e.total); }, err => { console.warn('[forklift] glb load failed, keeping box model', err); lt.fail(); });
})();
const truckDriver = new THREE.Group(); recklessTruck.add(truckDriver);
B(.65,.65,.4,0xf45d39,0,1.75,-.35,truckDriver);
B(.55,.25,.65,0x243240,0,1.4,-.2,truckDriver);
const driverHead = M(new THREE.SphereGeometry(.25,12,10),0xe2b492);
driverHead.position.set(0,2.3,-.3); truckDriver.add(driverHead);
CY(.28,.28,.16,0xffd54a,0,2.53,-.3,truckDriver);
for(const side of [-1,1]){
const arm = B(.16,.48,.16,0xe2b492,side*.34,1.87,-.02,truckDriver); arm.rotation.x=-.9;
const boot = B(.22,.4,.24,0x243240,side*.2,1.23,.2,truckDriver); boot.rotation.x=-.5;
}
const steering = M(new THREE.TorusGeometry(.23,.035,6,16),0x181c20);
steering.position.set(0,1.85,.2); steering.rotation.x=-.65; truckDriver.add(steering);
let truckState = gameRules.reset(), fearT = 0;
const FD = { unlocked:false, on:false, left:60, near:false, seated:null, home:{x:30.8, z:8.4} };
// لافتات حائطية
function wallSign(txt, sub, bg, x, y, z, ry=0, w=4){
const t = canvasTex(512, 256, (g)=>{ g.fillStyle=bg; g.fillRect(0,0,512,256); g.strokeStyle='#fff'; g.lineWidth=10; g.strokeRect(12,12,488,232); g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle'; g.font='bold 74px sans-serif'; g.fillText(txt,256,100); g.font='bold 38px sans-serif'; g.fillText(sub,256,185); });
const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w/2), new THREE.MeshStandardMaterial({map:t, roughness:0.6})); m.position.set(x,y,z); m.rotation.y = ry; S.add(m);
}
wallSign(I18N.t('🚭 ممنوع التدخين'),'NO SMOKING • DGR AREA','#b3261e', 16, 8.6, -17.15);
wallSign(I18N.t('⚠️ منطقة مواد خطرة'),'IATA DGR CLASS 1–9','#c77800', 26, 8.6, -17.15);
wallSign(I18N.t('✈️ مخرج الطيران'),'AIRSIDE GATE B','#1b6b3a', -34.65, 7.5, -12.3, Math.PI/2, 3.4);
wallSign(I18N.t('🚚 رصيف التحميل'),'LOADING DOCK 4','#204f8c', 34.65, 7.5, -6, -Math.PI/2, 3.4);
/* ===== لوحة جدول الفرز IATA: بين حاويات المواد الخطرة والحاويات الأخرى، خلف صندوق FOD =====
   الوقوف أمامها يفتح مراجعة مجانية مجموعها ١٠ ثوانٍ تُقسَّم على أي عدد من الزيارات. */
const STUDY = { total: 10, left: 10, on: false, inZone: false, box: { x: 5.9, z: -10.2, hx: 2.5, hz: 1.2 } };
/* صفوف اللوحة مشتقة من gameRules.segregation: نفس مصدر منطق الفرز تماماً */
const STUDY_ROWS = (gameRules.segregation && gameRules.segregation.rows) || [];
(function buildStudyBoard(){
/* لوحة IATA قائمة على الأرض في الفراغ بين مجموعتَي الحاويات، خلف FOD مباشرة.
   تُقرأ من مخطط المستودع، والقراءة التفصيلية تحصل في نافذة الجدول على الشاشة. */
const BW = 5.2, BH = BW * 1240 / 1400, BX = 5.9, BY = 0.95 + BH / 2, BZ = -13.0;
STUDY.bx = BX; STUDY.by = BY; STUDY.bz = BZ; STUDY.bw = BW; STUDY.bh = BH;
const tex = canvasTex(1400, 1240, (g, w, h) => {
/* ورقة بيضاء كجدول IATA الرسمي: أعلى تباين وأسهل قراءة من خلفية داكنة */
const MONO = 'ui-monospace,Menlo,Consolas,monospace', SANS = 'system-ui,Tahoma,sans-serif';
const R = w - 26;
g.fillStyle = '#f6faf7'; g.fillRect(0, 0, w, h);
g.strokeStyle = '#0f3f2a'; g.lineWidth = 18; g.strokeRect(9, 9, w - 18, h - 18);
g.textBaseline = 'middle';
/* ===== ترويسة مدمجة: عنوان عربي + عنوان إنجليزي + المرجع في ثلاثة أسطر ===== */
const HEAD = 158;
g.fillStyle = '#0f3f2a'; g.fillRect(18, 18, w - 36, HEAD);
g.textAlign = 'center';
g.direction = I18N.lang === 'en' ? 'ltr' : 'rtl';
g.fillStyle = '#ffffff'; g.font = '900 46px ' + SANS;
g.fillText(I18N.t('جدول فرز المواد الخطرة', 'DANGEROUS GOODS SEGREGATION CHART'), w / 2, 60);
g.direction = 'ltr'; g.fillStyle = '#eaffef'; g.font = '900 27px ' + MONO;
g.fillText('DANGEROUS GOODS SEGREGATION CHART', w / 2, 105);
g.fillStyle = '#8ff0b8'; g.font = '900 23px ' + MONO;
g.fillText('IATA DGR 67th Edition — 2026  ·  Table 9.3.A  ·  Section 9.3.2', w / 2, 143);
/* ===== رؤوس الأعمدة ===== */
const CH = 34, hTop = 18 + HEAD, top = hTop + CH;
g.fillStyle = '#0f3f2a'; g.fillRect(18, hTop, w - 36, CH);
const cImp = 48, cCls = 170, cX = 282, cList = 330;
g.textAlign = 'left'; g.fillStyle = '#bfe8cd'; g.font = '900 20px ' + MONO;
g.fillText('IMP', cImp, hTop + CH / 2 + 1);
g.fillText('CLASS', cCls, hTop + CH / 2 + 1);
g.fillStyle = '#ff9b8f'; g.fillText('✕', cX + 8, hTop + CH / 2 + 1);
g.fillStyle = '#bfe8cd'; g.fillText('MUST NOT BE STOWED WITH', cList, hTop + CH / 2 + 1);
/* ===== الصفوف: قياس النص أولاً ثم توزيع الارتفاع المتبقي (بلا اقتطاع) ===== */
const footTop = h - 132, avail = footTop - top - 8, maxW = R - cList;
const SEP = '  ·  ', listOf = r => r.x.join(SEP) || '—';
let fs = 48, rows = [];
const buildRows = () => {
rows = STUDY_ROWS.map(r => {
g.font = '900 ' + fs + 'px ' + MONO;
const words = listOf(r).split(SEP), lines = [];
let line = '';
for(const t of words){
const next = line ? line + SEP + t : t;
if(!line || g.measureText(next).width <= maxW) line = next;
else { lines.push(line); line = t; }
}
if(line) lines.push(line);
return { r, lines };
});
return rows.reduce((s, o) => s + o.lines.length * (fs + 10) + 10, 0);
};
let total = buildRows();
while(total > avail && fs > 16){ fs -= 1; total = buildRows(); }
/* سياج أخير: لو بقي تجاوز عند أصغر خط نضغط التباعد بنسبة رياضية، فلا يمكن أن يخرج صف تحت التذييل */
const squeeze = total > avail ? avail / total : 1;
let y = top + 3;
rows.forEach(({ r, lines }, i) => {
const lh = (fs + 10) * squeeze, rh = lines.length * lh + 10 * squeeze;
g.fillStyle = i % 2 === 0 ? '#ffffff' : '#e9f2ec'; g.fillRect(18, y, w - 36, rh);
g.direction = 'ltr'; g.textAlign = 'left';
const mid = y + rh / 2;
/* كود IMP في خانة مستقلة تماماً عن رقم الفئة */
g.fillStyle = '#0b2c1d'; g.font = '900 ' + Math.round(fs * 1.04) + 'px ' + MONO;
g.fillText(r.imp, cImp, mid + 1);
/* رقم الفئة/القسم في خانة مستقلة بلون مختلف */
g.fillStyle = r.cls.startsWith('1.') ? '#8a2f2f' : '#1d5c3d';
g.font = '900 ' + Math.round(fs * .92) + 'px ' + MONO;
g.fillText(r.cls, cCls, mid + 1);
/* علامة الفصل الحمراء: فارغة إن لم يكن هناك اشتراط فصل */
const hasX = r.x.length > 0;
g.fillStyle = '#c62828'; g.font = '900 ' + Math.round(fs * 1.1) + 'px ' + SANS;
g.fillText(hasX ? '✕' : '', cX + 8, mid + 1);
/* قائمة الأكواد مع الالتفاف بدل الاقتطاع */
g.fillStyle = hasX ? '#1b3f2c' : '#7d8f85'; g.font = '900 ' + fs + 'px ' + MONO;
const startY = mid - (lines.length - 1) * lh / 2;
lines.forEach((ln, k) => g.fillText(ln, cList, startY + k * lh + 1));
g.strokeStyle = 'rgba(15,63,42,.20)'; g.lineWidth = 2;
g.beginPath(); g.moveTo(18, y); g.lineTo(R, y); g.stroke();
y += rh;
});
/* فواصل الأعمدة */
g.strokeStyle = 'rgba(15,63,42,.35)'; g.lineWidth = 2;
[cCls - 10, cX + 2, cList - 10].forEach(x => { g.beginPath(); g.moveTo(x, top); g.lineTo(x, footTop - 6); g.stroke(); });
/* ===== تذييل السلامة: أداة مساعدة لا تحل محل النسخة الرسمية ===== */
g.fillStyle = '#eef6f0'; g.fillRect(18, footTop, w - 36, h - 18 - footTop);
g.strokeStyle = '#0f3f2a'; g.lineWidth = 4;
g.beginPath(); g.moveTo(18, footTop); g.lineTo(w - 18, footTop); g.stroke();
g.textAlign = 'center'; g.direction = I18N.lang === 'en' ? 'ltr' : 'rtl';
g.fillStyle = '#0f3f2a'; g.font = '900 23px ' + SANS;
g.fillText(I18N.t('أداة مرجعية مساعدة — لا تغني عن نسخة IATA DGR الرسمية ولا عن إجراءات المشغل المعتمدة', 'Reference aid only — does not replace the official IATA DGR or approved operator procedures'), w / 2, footTop + 22);
g.direction = 'ltr'; g.fillStyle = '#1d5c3d'; g.font = '700 19px ' + MONO;
g.fillText('✕ = must not be stowed together   ·   blank = no segregation requirement', w / 2, footTop + 50);
g.direction = I18N.lang === 'en' ? 'ltr' : 'rtl'; g.fillStyle = '#7a3b2a'; g.font = '800 20px ' + SANS;
g.fillText(I18N.t('قف في المنطقة الخضراء أمام اللوحة — المراجعة بـ ١٠ نقاط مجانية', 'Stand on the green pad — 10 free review points'), w / 2, footTop + 80);
/* حالة التحقق: لا ندّعي مطابقة خلية‑بخلية؛ اللوحة مبسّطة للتدريب */
g.direction = I18N.lang === 'en' ? 'ltr' : 'rtl'; g.fillStyle = '#8a2f2f'; g.font = '800 18px ' + SANS;
g.fillText(I18N.t('حالة التحقق: الرموز مراجَعة — جدول مبسّط لأغراض التدريب فقط، دون مطابقة خلية بخلية للنص الرسمي', 'Verification: codes reviewed — simplified training chart, not cell-by-cell matched to the official text'), w / 2, footTop + 108);
});
/* اللوحة مضيئة بذاتها: تُقرأ من أي مسافة بلا اعتماد على إضاءة المستودع */
const mat = new THREE.MeshBasicMaterial({map:tex, toneMapped:false});
const board = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), mat);
board.position.set(BX, BY, BZ); S.add(board);
/* ظهر اللوحة وساقان وقاعدة: كلها خلف الوجه تماماً فلا تحجب أي صف */
B(BW + .26, BH + .26, .12, 0x0f3f2a, BX, BY, BZ - .12, S, .8, .2);
[-1, 1].forEach(s => B(.16, 1.0, .16, 0x1d2b24, BX + s * (BW / 2 - .4), .5, BZ - .12, S, .5, .3));
B(BW + .5, .16, .9, 0x1d2b24, BX, .08, BZ, S, .5, .3);
/* كشاف يبرز اللوحة في الممر */
const spill = new THREE.PointLight(0xa8ffd4, 1.2, 16, 2); spill.position.set(BX, BY + 2.4, BZ + 3.0); S.add(spill);
/* بساط أرضي يحدد منطقة القراءة */
const padTex = canvasTex(512, 192, (g, w, h) => {
g.fillStyle = 'rgba(8,30,20,.92)'; g.fillRect(0, 0, w, h);
g.setLineDash([26, 16]); g.strokeStyle = '#3ce08a'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
g.fillStyle = '#baffd6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 52px system-ui,Tahoma,sans-serif';
g.fillText(I18N.t('منطقة المراجعة', 'REVIEW AREA'), w / 2, h / 2 + 2);
});
const pad = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.0), new THREE.MeshBasicMaterial({map:padTex, transparent:true, opacity:.92, depthWrite:false}));
pad.rotation.x = -Math.PI / 2; pad.position.set(BX, .03, STUDY.box.z); pad.renderOrder = 3; S.add(pad);
})();
// خطوط الأرضية: ممرات المشاة + حدود الحزام
B(64, 0.02, 0.3, 0xffc107, 0, 0.012, -4.4, S, 0.4, 0.05).castShadow = false;
B(64, 0.02, 0.3, 0xffc107, 0, 0.012, 9.4, S, 0.4, 0.05).castShadow = false;
for(let x=-30; x<=30; x+=1.4){ const s = B(0.6, 0.02, 1.4, 0xeeeeee, x, 0.011, 2.5, S, 0.5, 0.05); s.castShadow = false; s.visible = Math.abs(x) > 3 && (Math.round(x/1.4) % 6 === 0 || Math.round(x/1.4) % 6 === 1); }
// ===== حزام النقل: إطار معدني، بكرات، أرجل، أضواء تحذير
B(50, 0.12, 2.7, 0x404b57, 0, 0.62, 12, S, 0.35, 0.8);
[-1,1].forEach(s => B(50, 0.32, 0.12, 0xe0a100, 0, 0.88, 12+s*1.32, S, 0.4, 0.5));
B(50, 0.06, 2.3, 0x14181d, 0, 0.69, 12, S, 0.95, 0.05);
for(let x=-24; x<=24; x+=3){ [-1,1].forEach(s => B(0.14, 0.62, 0.14, 0x30383f, x, 0.31, 12+s*1.15, S, 0.4, 0.7)); }
const stripes = [];
for(let i=0; i<50; i++){
const st = B(0.08, 0.02, 2.3, 0x2a323a, -24.5+i, 0.73, 12, S, 0.6, 0.3); st.castShadow = false;
stripes.push(st);
}
B(2.6, 3.8, 3.6, 0x324454, -25.8, 1.9, 12, S, 0.4, 0.4);
B(2.6, 3.8, 3.6, 0x324454, 25.8, 1.9, 12, S, 0.4, 0.4);
// زر إبطاء الحزام: سر مخفي — عمود قصير أمام حافة الحزام، خارج مسار العمل (بلا أي نص)
const beltBtnGroup = new THREE.Group();
beltBtnGroup.position.set(22.8, 0, 9.95);
S.add(beltBtnGroup);
const beltBtnBase = new THREE.Mesh(
  new THREE.CylinderGeometry(0.15, 0.19, 0.1, 18),
  new THREE.MeshStandardMaterial({color:0x232c34, roughness:.78, metalness:.4})
);
beltBtnBase.position.y = 0.05; beltBtnGroup.add(beltBtnBase);
const beltBtnPost = new THREE.Mesh(
  new THREE.CylinderGeometry(0.1, 0.13, 1.16, 16),
  new THREE.MeshStandardMaterial({color:0x2c3742, roughness:.55, metalness:.7})
);
beltBtnPost.position.y = 0.62; beltBtnGroup.add(beltBtnPost);
const beltBtnPlate = new THREE.Mesh(
  new THREE.CylinderGeometry(0.24, 0.245, 0.12, 22),
  new THREE.MeshStandardMaterial({color:0x39454f, roughness:.5, metalness:.6})
);
beltBtnPlate.position.y = 1.22; beltBtnGroup.add(beltBtnPlate);
const beltBtnBezel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.195, 0.2, 0.06, 24),
  new THREE.MeshStandardMaterial({color:0x0d1318, roughness:.6, metalness:.65})
);
beltBtnBezel.position.y = 1.3; beltBtnGroup.add(beltBtnBezel);
const beltBtnMat = new THREE.MeshStandardMaterial({color:0x0a8a66, emissive:0x0a8a66, emissiveIntensity:0.25, roughness:.35, metalness:.1});
const beltBtnCap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.1, 26), beltBtnMat);
beltBtnCap.position.y = 1.36; beltBtnGroup.add(beltBtnCap);
const beltBtnRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.2, 0.022, 10, 30),
  new THREE.MeshStandardMaterial({color:0xb6fff0, emissive:0x2bffd0, emissiveIntensity:0.9, roughness:.32})
);
beltBtnRing.rotation.x = Math.PI / 2;
beltBtnRing.position.y = 1.4; beltBtnGroup.add(beltBtnRing);
// توهج أمامي يجعل الزر مقروءًا من زاوية اللعب
const beltBtnHalo = new THREE.Mesh(
  new THREE.RingGeometry(0.24, 0.4, 30),
  new THREE.MeshBasicMaterial({color:0x54ffd8, transparent:true, opacity:.3, side:THREE.DoubleSide, depthWrite:false})
);
beltBtnHalo.rotation.x = -Math.PI / 2;
beltBtnHalo.position.y = 1.41; beltBtnGroup.add(beltBtnHalo);
// هدف لمس أكبر من الحجم المرئي لسهولة الضغط على الهاتف
const beltBtnHit = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 8, 6),
  new THREE.MeshBasicMaterial({transparent:true, opacity:0, depthWrite:false})
);
beltBtnHit.position.y = 1.3; beltBtnGroup.add(beltBtnHit);
beltBtnGroup.traverse(o => { if(o.isMesh) o.castShadow = false; });
[-1,1].forEach(s => {
const flap = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), new THREE.MeshStandardMaterial({color:0x222a30, roughness:0.4, transparent:true, opacity:0.85, side:THREE.DoubleSide}));
flap.rotation.y = Math.PI/2; flap.position.set(s*24.48, 1.6, 12); S.add(flap);
});
const beacons = [];
[-25.8, 25.8].forEach(x => {
const b = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.2,0.35,14), new THREE.MeshStandardMaterial({color:0xff8f00, emissive:0xff7a00, emissiveIntensity:1.5}));
b.position.set(x, 4.0, 12); S.add(b); beacons.push(b);
});
function drawZoneSign(z){
const cv = z.signCv, ctx = cv.getContext('2d');
// لوحة المواد الخطرة تُرسم بدقة مضاعفة لأنها تُقرأ من بعيد: خط أوضح بلا ضبابية
const k = z.hz ? 2 : 1, W = cv.width / k, H = cv.height / k;
const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.clearRect(0, 0, cv.width, cv.height);
ctx.setTransform(k, 0, 0, k, 0, 0);
ctx.fillStyle = '#' + z.c.toString(16).padStart(6,'0');
rr(8,8,W-16,H-16,32); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 12; ctx.stroke();
ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
if(z.hz){
/* لوحة الحاوية الخطرة: الكود ورقم الفئة فقط، بخط كبير وواضح — بلا أسماء أو تفاصيل */
ctx.direction = 'ltr';
ctx.fillStyle = 'rgba(6,11,16,.96)';
rr(6, 6, W-12, H-12, 26); ctx.fill();
ctx.strokeStyle = '#' + z.c.toString(16).padStart(6,'0'); ctx.lineWidth = 9;
rr(6, 6, W-12, H-12, 26); ctx.stroke();
const rows = Math.max(1, Math.min(6, z.cap));
const top = 26, bot = H - 26, rowH = (bot - top) / rows;
for(let i = 0; i < rows; i++){
const y = top + i * rowH, mid = y + rowH / 2;
if(i){
ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 2;
ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(W - 30, y); ctx.stroke();
}
const it = z.items[i];
if(!it){
ctx.fillStyle = 'rgba(255,255,255,.16)';
ctx.font = '900 ' + Math.round(rowH * .5) + 'px monospace';
ctx.fillText('—', W/2, mid + 2);
continue;
}
const code = (it.data.imp + ' - ' + it.data.div).toUpperCase();
let fs = Math.round(rowH * .72);
ctx.font = '900 ' + fs + 'px ui-monospace,Menlo,Consolas,monospace';
while(fs > 18 && ctx.measureText(code).width > W - 90){
fs -= 2; ctx.font = '900 ' + fs + 'px ui-monospace,Menlo,Consolas,monospace';
}
ctx.fillStyle = '#ffffff';
ctx.fillText(code, W/2, mid + 3);
}
} else {
ctx.fillStyle = '#111'; ctx.font = '96px sans-serif'; ctx.fillText(z.e, 256, 80);
fit(ctx, z.n, 440, 75); ctx.fillText(z.n, 256, 185);
}
z.signTex.needsUpdate = true;
}
function makeZoneSign(z){
const cv = document.createElement('canvas'); cv.width = z.hz ? 1280 : 512; cv.height = z.hz ? 960 : 256;
z.signCv = cv; z.signTex = rawTex(cv);
drawZoneSign(z);
const spr = new THREE.Sprite(new THREE.SpriteMaterial({map:z.signTex, fog:false, toneMapped:false}));
// لوحات الحاويات الخطرة أكبر قليلاً لأنها تحمل قائمة محتويات تُقرأ من مسافة اللعب
const sw = z.w * (z.hz ? 1.03 : 0.95);
spr.scale.set(sw, sw*(cv.height/cv.width), 1);
return spr;
}
/* أضواء صناديق FOD تنبض داخل الحلقة الرئيسية بدل حلقة rAF مستقلة لكل صندوق */
const FOD_PULSE = [];
function buildFodBox(z){
const x=z.x, zz=-8.6;
const pad=B(2.8,0.06,2.8,0x7a1010,x,0.03,zz,S,0.55,0.05); pad.material.emissive=new THREE.Color(0xd32f2f).multiplyScalar(0.25); pad.castShadow=false;
for(let i=0;i<6;i++){const st=B(0.34,0.035,2.8,i%2?0xffd54a:0x1a1a1a,x-1.15+i*0.46,0.075,zz,S,0.6,0.05);st.castShadow=false;}
B(1.8,1.15,1.6,0xd32f2f,x,0.64,zz,S,0.42,0.25);
B(1.92,0.14,1.72,0x8e1b1b,x,1.28,zz,S,0.4,0.3);
B(1.1,0.05,0.28,0x180000,x,1.36,zz,S,0.8,0.1);
[-1,1].forEach(q=>[-1,1].forEach(r=>B(0.12,1.15,0.12,0xffd54a,x+q*0.9,0.64,zz+r*0.8,S,0.4,0.5)));
const tx=canvasTex(256,128,(g,w,h)=>{g.fillStyle='#d32f2f';g.fillRect(0,0,w,h);g.strokeStyle='#fff';g.lineWidth=8;g.strokeRect(6,6,w-12,h-12);g.fillStyle='#fff';g.font='900 74px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('FOD',w/2,h/2+4);});
const mat=new THREE.MeshStandardMaterial({map:tx,roughness:0.5,emissive:0xffffff,emissiveMap:tx,emissiveIntensity:0.35});
const f=new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.75),mat); f.position.set(x,0.66,zz+0.81); S.add(f);
const t=new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.75),mat); t.rotation.x=-Math.PI/2; t.position.set(x,1.355,zz+0.5); S.add(t);
const L=new THREE.PointLight(0xff3b30,1,8); L.position.set(x,2.4,zz+1.2); S.add(L);
FOD_PULSE.push(L);
}
Z.forEach(z => {
if(z.k==='fod'){ buildFodBox(z); return; }
const pad = B(z.w+0.1, 0.06, 6.2, z.c, z.x, 0.03, -8.6, S, 0.55, 0.05);
pad.material.emissive = new THREE.Color(z.c).multiplyScalar(0.12); pad.castShadow = false;
// حدود المنطقة المرسومة على الأرض
[-1,1].forEach(q => { const e = B(0.14, 0.03, 6.2, 0xffffff, z.x + q*(z.w/2), 0.07, -8.6, S, 0.5, 0.05); e.castShadow = false; });
const fr = B(z.w, 0.03, 0.14, 0xffffff, z.x, 0.07, -5.5, S, 0.5, 0.05); fr.castShadow = false;
B(z.w+0.1, 0.6, 0.25, z.c, z.x, 0.3, -11.8, S, 0.5, 0.1);
// قائم اللافتة
[-1,1].forEach(q => B(0.1, 4.4, 0.1, 0x2b333c, z.x + q*z.w*0.43, 2.2, -11.75, S, 0.4, 0.7));
const sign = makeZoneSign(z); sign.position.set(z.x, z.hz ? 5.7 : 5.0, -11.7); S.add(sign);
if(z.hz){
// قفص شبكي معدني لحاويات المواد الخطرة
const meshTex = canvasTex(128,128,(g,w,h)=>{ g.clearRect(0,0,w,h); g.strokeStyle='#b8c7d6'; g.lineWidth=5; for(let i=-w;i<w*2;i+=24){ g.beginPath(); g.moveTo(i,0); g.lineTo(i+h,h); g.stroke(); g.beginPath(); g.moveTo(i,h); g.lineTo(i+h,0); g.stroke(); } }, 6, 2);
const meshMat = new THREE.MeshStandardMaterial({map:meshTex, transparent:true, alphaTest:0.4, side:THREE.DoubleSide, metalness:0.6, roughness:0.4});
[-1, 1].forEach(q => {
const p = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.8), meshMat); p.rotation.y = Math.PI/2; p.position.set(z.x + q*z.w/2, 1.0, -8.6); p.castShadow = true; S.add(p);
[-11.6, -8.6, -5.6].forEach(zz => B(0.12, 2.0, 0.12, 0x5d7189, z.x + q*z.w/2, 1.0, zz, S, 0.4, 0.7));
B(0.1, 0.1, 6.2, 0x5d7189, z.x + q*z.w/2, 1.95, -8.6, S, 0.4, 0.7);
});
const back = new THREE.Mesh(new THREE.PlaneGeometry(z.w, 1.8), meshMat); back.position.set(z.x, 1.0, -11.6); S.add(back);
// علامة الخطر على الأرض
const dz = new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.4), new THREE.MeshStandardMaterial({color:0xf5c400, roughness:0.6})); dz.rotation.x = -Math.PI/2; dz.rotation.z = Math.PI/4; dz.position.set(z.x, 0.075, -4.9); S.add(dz);
}
});
// ===== غرفة التجميد: غرفة معزولة على يسار المستودع بباب منزلق مقفل (يُفتح بحل اللغز) =====
const frzP = { active: false, cells: [], moves: 0, solved: false, timer: 0, t: 0, raf: 0, last: 0 };
const uldP = { active: false, done: false, pieces: [], loc: {}, sel: null, t: 0, raf: 0, last: 0, closing: 0, tries: 0 };
const cardP = { active: false, deck: [], open: [], matched: new Set(), t: 0, lock: false, mistakes: 0, wild: false, raf: 0, last: 0, closing: 0 };
const jam = { active: false, siren: 0 };
const hv = { done: false, failed: false, item: null };
const FRZ = { x: -28.2, w: 5.8, hw: 2.9, zBack: -11.9, zFront: -6.2, doorW: 2.5, doorH: 3.7, open: false, openAmt: 0, closeT: 0, pending: null, items: [], door: null, lamp: null, lampMat: null, glow: null, solved: 0 };
(() => {
const g = new THREE.Group(); S.add(g);
const wallC = 0xdde9ef, trimC = 0x3b8fb5, depth = FRZ.zFront - FRZ.zBack, cz = (FRZ.zFront + FRZ.zBack) / 2, H = 5.3;
// أرضية داخلية جليدية + سقف وجدران جانبية وخلفية
B(FRZ.w, 0.08, depth, 0xbfe3f2, FRZ.x, 0.04, cz, g, 0.3, 0.1).castShadow = false;
B(FRZ.w + 0.4, 0.3, depth + 0.2, wallC, FRZ.x, H + 0.15, cz, g, 0.6, 0.1);
[-1, 1].forEach(q => B(0.3, H, depth, wallC, FRZ.x + q * (FRZ.w / 2 - 0.15), H / 2, cz, g, 0.6, 0.1));
B(FRZ.w, H, 0.3, wallC, FRZ.x, H / 2, FRZ.zBack + 0.15, g, 0.6, 0.1);
// الواجهة: جداران جانبيان للباب + عتبة علوية
const sideW = (FRZ.w - FRZ.doorW) / 2;
[-1, 1].forEach(q => B(sideW, H, 0.3, wallC, FRZ.x + q * (FRZ.doorW / 2 + sideW / 2), H / 2, FRZ.zFront - 0.15, g, 0.6, 0.1));
B(FRZ.doorW, H - FRZ.doorH, 0.3, wallC, FRZ.x, FRZ.doorH + (H - FRZ.doorH) / 2, FRZ.zFront - 0.15, g, 0.6, 0.1);
// إطار الباب وخطوط التبريد الزرقاء
[-1, 1].forEach(q => B(0.12, FRZ.doorH, 0.36, trimC, FRZ.x + q * (FRZ.doorW / 2 + 0.06), FRZ.doorH / 2, FRZ.zFront - 0.15, g, 0.4, 0.3));
B(FRZ.w + 0.5, 0.14, 0.4, trimC, FRZ.x, 0.7, FRZ.zFront - 0.12, g, 0.5, 0.2).castShadow = false;
B(FRZ.doorW + 0.24, 0.12, 0.36, trimC, FRZ.x, FRZ.doorH + 0.06, FRZ.zFront - 0.15, g, 0.4, 0.3);
// ورقة الباب المنزلقة (تتحرك نحو الجدار الأيمن عند الفتح)
const door = new THREE.Group(); door.position.set(FRZ.x, 0, FRZ.zFront + 0.12); g.add(door);
B(FRZ.doorW - 0.04, FRZ.doorH - 0.04, 0.22, 0xaec3cf, 0, FRZ.doorH / 2, 0, door, 0.35, 0.55);
B(FRZ.doorW - 0.5, 0.9, 0.24, 0x1c3a4c, 0, FRZ.doorH * 0.64, 0, door, 0.2, 0.2);
B(0.14, 1.3, 0.3, 0x2a3640, FRZ.doorW / 2 - 0.45, FRZ.doorH * 0.44, 0.1, door, 0.4, 0.6);
for(let i = 0; i < 4; i++) B(FRZ.doorW - 0.3, 0.07, 0.25, 0xe8f3f8, 0, 0.35 + i * 0.4, 0, door, 0.5, 0.1);
FRZ.door = door;
// لوحة القفل بجانب الباب: مصباح أحمر (مقفل) / أخضر (مفتوح)
const lampMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0.9, roughness: 0.4 });
B(0.62, 1.1, 0.2, 0x1d2a33, FRZ.x - FRZ.doorW / 2 - 0.55, 2.0, FRZ.zFront + 0.02, g, 0.5, 0.4);
const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), lampMat); lamp.position.set(FRZ.x - FRZ.doorW / 2 - 0.55, 2.3, FRZ.zFront + 0.18); g.add(lamp);
const padTx = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#0e1a22'; c.fillRect(0, 0, w, h); for(let r = 0; r < 3; r++) for(let q = 0; q < 3; q++){ c.fillStyle = '#4fc3e8'; c.fillRect(14 + q * 38, 14 + r * 30, 26, 20); } });
const padFace = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.5), new THREE.MeshBasicMaterial({ map: padTx })); padFace.position.set(FRZ.x - FRZ.doorW / 2 - 0.55, 1.75, FRZ.zFront + 0.13); g.add(padFace);
FRZ.lampMat = lampMat; FRZ.lamp = lamp;
// لافتة فوق الغرفة
const sg = canvasTex(1024, 256, (c, w, h) => {
c.fillStyle = '#0f3347'; c.fillRect(0, 0, w, h);
c.strokeStyle = '#8fe3ff'; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16);
c.fillStyle = '#e9f9ff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 92px Cairo, Tahoma, sans-serif';
c.fillText('❄ ' + I18N.T('غرفة التجميد', 'FREEZER ROOM'), w / 2, h / 2 - 20);
c.font = '700 54px monospace'; c.fillStyle = '#8fe3ff'; c.fillText('FRZ  •  0°C', w / 2, h / 2 + 64);
});
const sign = new THREE.Mesh(new THREE.PlaneGeometry(FRZ.w - 0.4, (FRZ.w - 0.4) / 4), new THREE.MeshBasicMaterial({ map: sg, toneMapped: false }));
sign.position.set(FRZ.x, H + 1.0, FRZ.zFront + 0.2); g.add(sign);
[-1, 1].forEach(q => B(0.1, 1.2, 0.1, 0x2b333c, FRZ.x + q * (FRZ.w / 2 - 0.5), H + 0.6, FRZ.zFront + 0.1, g, 0.4, 0.7));
// إنارة باردة داخل الغرفة تظهر عند فتح الباب
const glow = new THREE.PointLight(0x7fd8ff, 0.0, 9); glow.position.set(FRZ.x, 3.2, cz); g.add(glow); FRZ.glow = glow;
// منصة الإسقاط أمام الباب على الأرض
const pad = B(FRZ.w, 0.06, 1.7, 0x3b8fb5, FRZ.x, 0.03, FRZ.zFront + 0.85, g, 0.55, 0.05); pad.material.emissive = new THREE.Color(0x3b8fb5).multiplyScalar(0.18); pad.castShadow = false;
for(let i = 0; i < 7; i++){ const st = B(0.3, 0.03, 1.7, i % 2 ? 0xffffff : 0x1d5873, FRZ.x - 2.4 + i * 0.8, 0.075, FRZ.zFront + 0.85, g, 0.6, 0.05); st.castShadow = false; }
})();

// ===== منطقة التجمع: رقعة خضراء واضحة على يمين المستودع =====
const EM = gameRules.emergency;
const muster = (() => {
const g = new THREE.Group(); S.add(g);
const pad = B(EM.musterHX*2, 0.05, EM.musterHZ*2, 0x1f8f4d, EM.musterX, 0.035, EM.musterZ, g, 0.7, 0.05);
pad.material.emissive = new THREE.Color(0x2fbf6a).multiplyScalar(0.28); pad.castShadow = false;
[-1,1].forEach(s => {
const a = B(0.16, 0.04, EM.musterHZ*2, 0xeafff2, EM.musterX + s*(EM.musterHX-0.08), 0.06, EM.musterZ, g, 0.5, 0.05); a.castShadow = false;
const b = B(EM.musterHX*2, 0.04, 0.16, 0xeafff2, EM.musterX, 0.06, EM.musterZ + s*(EM.musterHZ-0.08), g, 0.5, 0.05); b.castShadow = false;
});
const ringM = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.2, 40), new THREE.MeshBasicMaterial({color:0xeafff2, transparent:true, opacity:.92, depthWrite:false}));
ringM.rotation.x = -Math.PI/2; ringM.position.set(EM.musterX, 0.075, EM.musterZ); g.add(ringM);
// لوحة إرشادية ثابتة على مستوى النظر، على عمودين قصيرين بقاعدة
const boardZ = EM.musterZ - EM.musterHZ - 0.55;
const signCv = document.createElement('canvas'); signCv.width = 2048; signCv.height = 1024;
const sg = signCv.getContext('2d');
sg.fillStyle = '#063d22'; sg.fillRect(0,0,2048,1024);
const sgr = sg.createLinearGradient(0,0,0,1024); sgr.addColorStop(0,'rgba(255,255,255,.1)'); sgr.addColorStop(1,'rgba(0,0,0,.22)');
sg.fillStyle = sgr; sg.fillRect(0,0,2048,1024);
sg.strokeStyle = '#eafff2'; sg.lineWidth = 40; sg.strokeRect(40,40,1968,944);
// شريط سفلي أصفر عالي التباين يحمل رقم الطوارئ الداخلي
sg.fillStyle = '#ffd54a'; sg.fillRect(80,690,1888,254);
sg.fillStyle = '#0a2a18'; sg.textAlign = 'center'; sg.textBaseline = 'middle';
// العنوان العربي
sg.fillStyle = '#ffffff';
sg.font = '900 250px "Segoe UI",Tahoma,sans-serif';
sg.fillText(I18N.t('منطقة التجمع'), 1024, 262);
sg.direction = 'ltr'; sg.font = 'bold 104px "Segoe UI",Tahoma,sans-serif'; sg.fillStyle = '#baffd6';
sg.fillText(I18N.T('MUSTER POINT','ASSEMBLY POINT'), 1024, 442);
// سطر رقم الطوارئ فوق الشريط الأصفر
sg.direction = 'rtl'; sg.font = '900 82px "Segoe UI",Tahoma,sans-serif'; sg.fillStyle = '#ffd54a';
sg.fillText(I18N.t('رقم الطوارئ الداخلي • EMERGENCY NUMBER'), 1024, 588);
// الرقم نفسه كبير وواضح من مسافة (مأخوذ من قواعد اللعبة لا مُكرَّر يدوياً)
sg.direction = 'ltr'; sg.font = '900 190px "Segoe UI",Tahoma,sans-serif'; sg.fillStyle = '#0a2a18';
sg.fillText(String((gameRules.emergency && gameRules.emergency.code) || '24352888'), 1024, 818);
const signTex = rawTex(signCv);
const boardMat = new THREE.MeshBasicMaterial({map:signTex, toneMapped:false, fog:false});
B(5.8, 3.0, 0.14, 0x14301f, EM.musterX, 3.4, boardZ - 0.1, g, 0.7, 0.1).castShadow = true;
const board = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), boardMat);
board.position.set(EM.musterX, 3.4, boardZ + 0.01); g.add(board);
[-1,1].forEach(s => {
B(0.2, 3.4, 0.2, 0x2b333c, EM.musterX + s*2.35, 1.7, boardZ - 0.28, g, 0.45, 0.55);
B(0.6, 0.09, 0.6, 0x1c242c, EM.musterX + s*2.35, 0.045, boardZ - 0.28, g, 0.6, 0.4).castShadow = false;
});
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.44, 14), new THREE.MeshStandardMaterial({color:0x2fbf6a, emissive:0x2fbf6a, emissiveIntensity:1.4}));
beacon.position.set(EM.musterX, 5.0, boardZ); g.add(beacon);
const light = new THREE.PointLight(0x2fbf6a, 0.55, 14); light.position.set(EM.musterX, 3.4, boardZ + 1.6); g.add(light);
return { g, beacon, light };
})();
// ===== ألواح إنذار الحريق: وميض أحمر وأبيض في السقف =====
const alarmFlash = (() => {
const g = new THREE.Group(); g.visible = false; S.add(g);
const redMats = [], whiteMats = [];
[-20, 0, 20].forEach((x, i) => {
[4.2, -4.2].forEach(z => {
const isRed = (i + (z > 0 ? 0 : 1)) % 2 === 0;
const m = B(3.2, 0.26, 1.1, isRed ? 0xff2b2b : 0xffffff, x, 8.35, z, g, 0.45, 0.1);
m.material.emissive = new THREE.Color(isRed ? 0xff1e1e : 0xffffff);
m.material.emissiveIntensity = 0.05;
(isRed ? redMats : whiteMats).push(m.material);
});
});
const redLight = new THREE.PointLight(0xff2222, 0, 40, 1.2); redLight.position.set(-8, 7.2, 2); g.add(redLight);
const whiteLight = new THREE.PointLight(0xffffff, 0, 40, 1.2); whiteLight.position.set(8, 7.2, 0); g.add(whiteLight);
return { group: g, redMats, whiteMats, redLight, whiteLight };
})();
const arrowTex = canvasTex(128, 64, (ctx, w, h) => {
ctx.clearRect(0,0,w,h);
ctx.fillStyle = '#2fbf6a';
ctx.beginPath(); ctx.moveTo(8,22); ctx.lineTo(72,22); ctx.lineTo(72,8); ctx.lineTo(118,32); ctx.lineTo(72,56); ctx.lineTo(72,42); ctx.lineTo(8,42); ctx.closePath(); ctx.fill();
});
[16, 20, 24].forEach(x => {
const a = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({map:arrowTex, transparent:true, depthWrite:false}));
a.rotation.set(-Math.PI/2, 0, 0); a.position.set(x, 0.03, EM.musterZ); S.add(a);
});
const pl = new THREE.Group(); S.add(pl);
const rig = new THREE.Group(); pl.add(rig);
/* ===== شخصية GLB اختيارية: game/models/airport-crew.glb =====
   القالب ثابت (بلا هيكل عظمي أو حركات)، فيُحرَّك ككتلة واحدة: لف الاتجاه،
   ميل الجري، وتردد خطوات عمودي. عند فشل التحميل نعود تلقائياً للـrig الإجرائي.
   للمقارنة: game.html?crew=rig */
const CREW = { mode: 'glb', obj: null, inst: null, ready: false, tried: false };
/* الشخصية الأساسية: مجسّم مجهّز بهيكل عظمي (11MB) — تُحمّل عند اختيارها فقط. */
const HERO = { obj: null, inst: null, ready: false, loading: false, err: null };
window.__hero = HERO;
/* شخصيات Mixamo: مجسّم + حركات مسجّلة حقيقية، يحمّلها مُحمّل واحد مشترك (mixamo-rig.js) */
const MIX = {
  worker: { grow: 1.15, seat: { z: 0, hips: 2.1, arm: 1.0, fore: -0.5 }, url: 'game/models/mixamo-worker.glb', obj: null, inst: null, ready: false, loading: false, err: null },
  timmy:  { grow: 1.15, seat: { z: 0.5, hips: 1.8, arm: 1.45, fore: -0.4 }, url: 'game/models/mixamo-timmy.glb',  obj: null, inst: null, ready: false, loading: false, err: null },
  vanguard: { grow: 1.15, seat: { z: 0.5, hips: 1.8, arm: 1.45, fore: -0.4 }, url: 'game/models/mixamo-vanguard.glb', obj: null, inst: null, ready: false, loading: false, err: null },
  /* الروبوت (Quaternius، CC0): هيكل غير Mixamo، فنربط مقاطعه بأسماء اللعبة ونرفع ذراعيه عند الحمل */
  robot: { grow: 1.15, seat: { z: 0.3, hips: 1.8, arm: 0, fore: 0 }, url: 'game/models/robot.glb', obj: null, inst: null, ready: false, loading: false, err: null,
    rig: { clips: { idle: 'Robot_Idle', jog: 'Robot_Walking', run: 'Robot_Running', carry_idle: 'Robot_Idle', carry_jog: 'Robot_Walking', sit: 'Robot_Sitting' },
      natural: { jog: 5, run: 9, carry_jog: 5 }, hands: ['Palm2L', 'Palm2R'], carryArm: { bones: ['UpperArmL', 'UpperArmR'], axis: [1, 0, 0], ang: 0.8 } } }
};
/* الشخصيات: worker و timmy (Mixamo) · hero (3D) · crew (المجسّم الثابت) · rig (الإجرائي) */
/* robot و vanguard تفتحهما الرتبة (progress-rules.js) */
const CHAR_IDS = ['worker', 'timmy', 'robot', 'vanguard'];
const CHAR_BASE = {};   // شخصيات مشتقة من مجسّم آخر بزيّ مختلف (لا يوجد حالياً)
const mixId = id => CHAR_BASE[id] || id;
const charUnlocked = id => !window.Prog || Prog.charUnlocked(id);
const CHAR = { id: 'worker' };
/* ترحيل لمرة واحدة: من بقي على الافتراضي القديم (hero) ينتقل إلى عامل المستودع الافتراضي الجديد */
try { if(localStorage.getItem('acg_char_v') !== '2'){ const o = localStorage.getItem('acg_char'); if(!o || o === 'hero') localStorage.setItem('acg_char', 'worker'); localStorage.setItem('acg_char_v', '2'); } } catch(e){}
/* فانغارد حلّ محلّ مريمير: من اختار مريمير ينتقل إليه */
try { if(localStorage.getItem('acg_char') === 'mremireh') localStorage.setItem('acg_char', 'vanguard'); } catch(e){}
try { const saved = localStorage.getItem('acg_char'); if(CHAR_IDS.indexOf(saved) >= 0) CHAR.id = saved; } catch(e){}
try { if(new URLSearchParams(location.search).get('crew') === 'rig') CREW.mode = 'rig'; } catch(e){}
/* أثناء تنزيل الشخصية المختارة يبقى ظاهراً مجسّم الشخصية السابقة الجاهز بدل أن يختفي اللاعب */
function shownMixId(){
  const want = mixId(CHAR.id);
  if(MIX[want] && MIX[want].ready) return want;
  for(const id in MIX) if(MIX[id].ready) return id;
  return null;
}
function activeCharRig(){
  if(MIX[mixId(CHAR.id)]){ const id = shownMixId(); return id ? MIX[id].inst : null; }
  if(CHAR.id === 'hero') return HERO.ready ? HERO.inst : null;
  if(CHAR.id === 'crew') return (CREW.ready && CREW.mode === 'glb') ? CREW.inst : null;
  return null; // الإجرائي: يحل محلّه rig المجسّم
}
function crewShow(v){
  const act = activeCharRig();
  if(CREW.obj) CREW.obj.visible = v && CHAR.id === 'crew' && !!act;
  if(HERO.obj) HERO.obj.visible = v && CHAR.id === 'hero' && !!act;
  const mid = mixId(CHAR.id), shown = MIX[mid] ? shownMixId() : null;
  for(const id in MIX) if(MIX[id].obj) MIX[id].obj.visible = v && shown === id && !!act;
  rig.visible = v && !act && !(MIX[mid] && !MIX[mid].err);   // الإجرائي احتياطاً فقط إن فشل تنزيل الشخصية
}
function applyCrewMode(){
  const mid = mixId(CHAR.id);
  if(MIX[mid]) loadMixamo(mid);
  else if(CHAR.id === 'hero') loadHero(); else if(CHAR.id === 'crew') loadCrewGLB();
  crewShow(true);
  if(window.Prog) Prog.applyOutfit();   // زيّ الشخصية المشتقة + لون سترة الرتبة
}
/* حالة تحميل الشخصية: تظهر تحت أزرار الاختيار (وكإشعار داخل اللعب) بدل أن يظهر
   الموظف الكلاسيكي بصمت أثناء تنزيل المجسّم الكبير أو عند فشله. */
function charStatus(text){
  const row = document.getElementById('chars');
  let el = document.getElementById('char-status');
  if(!el && row && row.parentNode){
    el = document.createElement('div'); el.id = 'char-status'; el.setAttribute('role', 'status');
    el.style.cssText = 'font-size:12px;opacity:.85;margin-top:6px;min-height:1em;text-align:center';
    row.parentNode.insertBefore(el, row.nextSibling);
  }
  if(el) el.textContent = text || '';
}
const CHAR_NAMES = { worker: ['عامل المستودع', 'warehouse worker'], timmy: ['تيمي المرح', 'Timmy'], robot: ['الروبوت', 'Robot'], vanguard: ['فانغارد المدرّع', 'Vanguard'], hero: ['شخصية 3D', '3D character'], crew: ['طاقم أرضي', 'ground crew'] };
function loadMixamo(id, attempt){
  const M = MIX[id];
  if(!M || M.loading || M.ready || !window.MixamoWorker) return;
  M.loading = true; M.err = null;
  const n = CHAR_NAMES[id];
  const lt = loading.track('char-' + id, n[0], 22);
  charStatus(I18N.T('⏳ جاري تحميل ' + n[0] + '…', '⏳ Loading ' + n[1] + '…'));
  MixamoWorker.load(M.url, (e) => {
    if(!e || !e.total) return;
    lt.set(e.loaded / e.total);
    if(mixId(CHAR.id) !== id) return;
    const p = Math.min(99, Math.round(e.loaded / e.total * 100));
    charStatus(I18N.T('⏳ جاري تحميل ' + n[0] + '… ' + p + '%', '⏳ Loading ' + n[1] + '… ' + p + '%'));
  }, M.rig).then(o => {
    lt.done();
    M.obj = o.root; M.inst = o; M.ready = true; M.loading = false;
    if(M.grow && o.setGrow) o.setGrow(M.grow);   // كل الشخصيات بقامة عامل المستودع وهي تمشي
    o.seatZ = M.seat.z; o.seatY = M.seat.hips; Object.assign(o.sitCfg, { arm: M.seat.arm, fore: M.seat.fore });   // وضع الجلوس مضبوط لكل شخصية على مقعد الرافعة ومقودها
    pl.add(o.root); if(mixId(CHAR.id) === id) charStatus(''); applyCrewMode();
    loadSeatCrew();
    console.log('[' + id + '] mixamo glb ready');
  }).catch(err => {
    M.loading = false; M.err = String(err && err.message || err);
    const tries = attempt || 0;
    if(tries < 2){ console.warn('[' + id + '] glb failed, retrying', M.err); setTimeout(() => loadMixamo(id, tries + 1), tries ? 4000 : 1500); return; }   // ثلاث محاولات قبل الاستسلام (شبكة الجوال تنقطع أحياناً)
    lt.fail();
    crewShow(true);
    if(mixId(CHAR.id) === id) charLoadFailed(id, err);
  });
}
function charLoadFailed(id, err){
  const n = CHAR_NAMES[id] || ['الشخصية', 'character'];
  console.warn('[' + id + '] glb failed', err);
  /* لا نغيّر اختيار اللاعب المحفوظ: الكلاسيكي بديل مؤقت فقط، وتُعاد المحاولة عند الاختيار التالي */
  const why = String(err && err.message || err || '').slice(0, 70);
  const msg = I18N.T('⚠️ تعذّر تحميل ' + n[0] + ' — يظهر الموظف الكلاسيكي مؤقتاً. اختره مرة أخرى للمحاولة. (' + why + ')',
    '⚠️ Could not load the ' + n[1] + ' — showing the classic worker for now. Pick it again to retry. (' + why + ')');
  charStatus(msg);
  try { toast(msg, '#ffd54a'); } catch(e){}
}
function loadCrewGLB(){
  if(CREW.tried || CREW.mode !== 'glb' || !window.CrewRig) return;
  CREW.tried = true;
  charStatus(I18N.T('⏳ جاري تحميل الطاقم الأرضي…', '⏳ Loading ground crew…'));
  CrewRig.load('game/models/airport-crew.glb').then(o => {
    CREW.obj = o.root; CREW.inst = o; CREW.ready = true; pl.add(o.root); charStatus(''); applyCrewMode();
    loadSeatCrew();
    console.log('[crew] skinned glb ready, parts:', CrewRig.state.parts);
  }).catch(err => {
    CREW.ready = false; CREW.tried = false;            // يسمح بإعادة المحاولة بدل قفل الكلاسيكي طوال الجلسة
    crewShow(true);
    if(CHAR.id === 'crew') charLoadFailed('crew', err);
  });
}
function loadHero(attempt){
  if(HERO.loading || HERO.ready || !window.Character3D) return;
  HERO.loading = true; HERO.err = null;
  charStatus(I18N.T('⏳ جاري تحميل الشخصية 3D…', '⏳ Loading 3D character…'));
  Character3D.load('game/models/character-3d.glb', (e) => {
    if(!e || !e.total || CHAR.id !== 'hero') return;
    const p = Math.min(99, Math.round(e.loaded / e.total * 100));
    charStatus(I18N.T('⏳ جاري تحميل الشخصية 3D… ' + p + '%', '⏳ Loading 3D character… ' + p + '%'));
  }).then(o => {
    HERO.obj = o.root; HERO.inst = o; HERO.ready = true; HERO.loading = false;
    pl.add(o.root); charStatus(''); applyCrewMode();
    loadSeatCrew();
    console.log('[hero] rigged glb ready');
  }).catch(err => {
    HERO.loading = false; HERO.err = String(err && err.message || err);
    /* شبكة الجوال قد تنقطع أثناء تنزيل 12MB: محاولة ثانية تلقائية قبل إظهار التنبيه */
    if(!attempt && CHAR.id === 'hero'){ setTimeout(() => { if(CHAR.id === 'hero') loadHero(1); }, 1500); return; }
    crewShow(true);
    if(CHAR.id === 'hero') charLoadFailed('hero', err);
  });
}
function setCharacter(id){
  CHAR.id = CHAR_IDS.indexOf(id) >= 0 && charUnlocked(id) ? id : 'worker';
  try { localStorage.setItem('acg_char', CHAR.id); } catch(e){}
  try { if(parent !== window) parent.postMessage({ type: 'acg-character-changed', id: CHAR.id }, location.origin); } catch(e){}
  charStatus('');                                   // دوال التحميل تعيد كتابة الحالة إن كان المجسّم قيد التنزيل
  applyCrewMode();
  syncCharButtons();
  return CHAR.id;
}
/* داخل غلاف الصفحة يوجد اختيار الشخصية الأساسي: نُخفي النسخة المكررة من إعدادات اللعبة (تبقى في game.html وحده) */
function syncCharButtons(){
  document.querySelectorAll('#chars button').forEach(b => { const on = b.dataset.char === CHAR.id; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
}
window.__crew = CREW;
window.__setCrew = m => { CREW.mode = m === 'rig' ? 'rig' : 'glb'; if(m !== 'rig') loadCrewGLB(); applyCrewMode(); return CREW.ready; };
window.__setCharacter = setCharacter;
/* الغلاف يتحكم بالشخصية فوراً دون إعادة تحميل اللعبة */
addEventListener('message', e => {
  const d = e.data;
  if(d && d.type === 'acg-character' && d.id) setCharacter(d.id);
});
window.__setCharacter(CHAR.id);
const sh = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), new THREE.MeshBasicMaterial({color:0x000, transparent:true, opacity:0.28, depthWrite:false}));
sh.rotation.x = -Math.PI/2; sh.position.y = 0.02; pl.add(sh);
const G = (par,x,y,z) => { const g = new THREE.Group(); g.position.set(x,y,z); par.add(g); return g; };
const C_SKIN = 0xe2b492, C_VEST = 0xd4ff00, C_REFL = 0xb8c1c7, C_PANTS = 0x22325a, C_BOOTS = 0x1b1614, C_CAP = 0x2f5fa8, C_SHIRT = 0xf4f6f8, C_TIE = 0x141a21, C_GLOVE = 0x37474f;
// ===== موظف بأشكال ناعمة مستديرة بدل المكعبات =====
const cap = (r, len, c, x, y, z, p, seg=18) => {
const g = new THREE.Group(); g.position.set(x,y,z); p.add(g);
g.add(M(new THREE.CylinderGeometry(r, r, len, seg, 1, true), c));
const top = M(new THREE.SphereGeometry(r, seg, 12), c); top.position.y = len/2; g.add(top);
const bot = M(new THREE.SphereGeometry(r, seg, 12), c); bot.position.y = -len/2; g.add(bot);
return g;
};
const band = (radius, tube, c, y, p, squash=0.66) => {
const m = M(new THREE.TorusGeometry(radius, tube, 10, 36), c);
m.rotation.x = Math.PI/2; m.position.y = y; m.scale.y = squash; p.add(m); return m;
};
const pelvis = G(rig, 0, 0.92, 0);
const pelvisMesh = M(new THREE.SphereGeometry(0.27, 24, 16), C_PANTS, 0.65, 0.05);
pelvisMesh.scale.set(1.22, 0.6, 0.8); pelvisMesh.position.y = -0.02; pelvis.add(pelvisMesh);
band(0.275, 0.028, 0x121820, 0.075, pelvis, 0.82);
const buckle = M(new THREE.SphereGeometry(0.052, 14, 10), 0xcfd8dc, 0.35, 0.6);
buckle.scale.set(1.15, 1, 0.45); buckle.position.set(0, 0.075, 0.218); pelvis.add(buckle);
const tor = G(pelvis, 0, 0.15, 0);
const vest = M(new THREE.LatheGeometry([
new THREE.Vector2(0.001, -0.07), new THREE.Vector2(0.23, -0.05), new THREE.Vector2(0.275, 0.06),
new THREE.Vector2(0.28, 0.22), new THREE.Vector2(0.295, 0.4), new THREE.Vector2(0.325, 0.58),
new THREE.Vector2(0.315, 0.69), new THREE.Vector2(0.23, 0.79), new THREE.Vector2(0.115, 0.845),
new THREE.Vector2(0.001, 0.85)
], 28), C_VEST, 0.6, 0.06);
vest.scale.z = 0.64; tor.add(vest);
/* قميص أبيض وكرافة سوداء يظهران من فتحة السترة (مرجع الشخصية) */
const shirtV = M(new THREE.SphereGeometry(0.1, 18, 14), C_SHIRT, 0.6, 0.05);
shirtV.scale.set(1.45, 1.5, 0.42); shirtV.position.set(0, 0.66, 0.178); tor.add(shirtV);
const tie = M(new THREE.BoxGeometry(0.055, 0.34, 0.028), C_TIE, 0.5, 0.1);
tie.position.set(0, 0.47, 0.222); tor.add(tie);
const tieKnot = M(new THREE.SphereGeometry(0.046, 12, 10), C_TIE, 0.5, 0.1);
tieKnot.scale.set(1.1, 1, 0.75); tieKnot.position.set(0, 0.655, 0.232); tor.add(tieKnot);
band(0.285, 0.03, C_REFL, 0.055, tor);
band(0.291, 0.011, 0xe9eef2, 0.3, tor);
band(0.303, 0.011, 0xe9eef2, 0.475, tor);
const strip = (pts, c, rad, p) => {
const m = M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v => new THREE.Vector3(...v))), 16, rad, 6, false), c, 0.45, 0.2);
p.add(m); return m;
};
strip([[0, 0.1, 0.196], [0, 0.3, 0.201], [0, 0.48, 0.213], [0, 0.66, 0.212]], 0x2b333c, 0.011, tor);
[-0.13, 0.13].forEach(x => strip([[x, 0.12, 0.197], [x, 0.32, 0.203], [x, 0.5, 0.215], [x, 0.64, 0.212]], 0xe9eef2, 0.013, tor));
[-1, 1].forEach(s => {
const pouch = M(new THREE.SphereGeometry(0.075, 14, 10), 0x2c3440, 0.7, 0.05);
pouch.scale.set(1, 0.9, 0.7); pouch.position.set(s*0.255, 0.0, 0.08); pelvis.add(pouch);
});
const hd = G(tor, 0, 0.84, 0);
const neck = M(new THREE.CylinderGeometry(0.105, 0.12, 0.22, 18), C_SKIN, 0.62, 0.02); neck.position.y = 0.03; hd.add(neck);
const headBall = M(new THREE.SphereGeometry(0.25, 26, 20), C_SKIN, 0.62, 0.02);
headBall.scale.set(0.94, 1.06, 0.96); headBall.position.y = 0.28; hd.add(headBall);
[-1, 1].forEach(s => {
const ear = M(new THREE.SphereGeometry(0.045, 12, 10), C_SKIN, 0.62, 0.02); ear.position.set(s*0.235, 0.28, 0); hd.add(ear);
const white = M(new THREE.SphereGeometry(0.045, 14, 10), 0xf7f4ee, 0.4, 0); white.scale.set(1, 1, 0.55); white.position.set(s*0.095, 0.31, 0.216); hd.add(white);
const pupil = M(new THREE.SphereGeometry(0.022, 10, 8), 0x16181c, 0.35, 0); pupil.position.set(s*0.095, 0.31, 0.246); hd.add(pupil);
});
const nose = M(new THREE.SphereGeometry(0.04, 12, 10), C_SKIN, 0.6, 0.02);
nose.scale.set(0.9, 1.1, 0.9); nose.position.set(0, 0.265, 0.235); hd.add(nose);
const beard = M(new THREE.SphereGeometry(0.252, 24, 14, 0, Math.PI*2, Math.PI*0.52, Math.PI*0.42), 0x2a1d15, 0.8, 0);
beard.position.set(0, 0.275, 0.012); beard.scale.set(0.95, 1.05, 0.97); hd.add(beard);
const helmet = G(hd, 0, 0.35, 0);
const helmetCap = M(new THREE.SphereGeometry(0.265, 26, 16, 0, Math.PI*2, 0, Math.PI*0.56), C_CAP, 0.45, 0.1);
helmetCap.position.y = 0.05; helmet.add(helmetCap);
/* كاب بقبعة زرقاء: حافة أمامية بيضاوية بدل طوق الخوذة الدائري */
const hRim = M(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 30, 1, false), C_CAP, 0.45, 0.1);
hRim.scale.z = 1.45; hRim.position.set(0, 0.045, 0.1); helmet.add(hRim);
const legs = [-1, 1].map(s => {
const hip = G(pelvis, s*0.19, 0, 0);
const hipBall = M(new THREE.SphereGeometry(0.115, 16, 12), C_PANTS, 0.65, 0.05); hip.add(hipBall);
const thigh = G(hip, 0, 0, 0);
cap(0.11, 0.4, C_PANTS, 0, -0.2, 0, thigh);
const knee = G(thigh, 0, -0.42, 0);
knee.add(M(new THREE.SphereGeometry(0.1, 16, 12), C_PANTS, 0.65, 0.05));
cap(0.095, 0.38, C_PANTS, 0, -0.2, 0, knee);
const ankle = G(knee, 0, -0.4, 0);
band(0.1, 0.02, 0x111820, 0.03, ankle, 1);
const boot = M(new THREE.SphereGeometry(0.12, 18, 14), C_BOOTS, 0.7, 0.05);
boot.scale.set(1.05, 0.85, 1.7); boot.position.set(0, 0.02, 0.06); ankle.add(boot);
const toe = M(new THREE.SphereGeometry(0.085, 14, 10), C_BOOTS, 0.7, 0.05);
toe.scale.set(1, 0.8, 1.1); toe.position.set(0, 0.015, 0.2); ankle.add(toe);
const sole = M(new THREE.SphereGeometry(0.105, 16, 10), 0x0c0a09, 0.85, 0);
sole.scale.set(1.15, 0.35, 1.75); sole.position.set(0, -0.055, 0.06); ankle.add(sole);
return {hip, thigh, knee, ankle};
});
const arms = [-1, 1].map(s => {
const shld = G(tor, s*0.4, 0.71, 0);
shld.add(M(new THREE.SphereGeometry(0.115, 18, 14), C_VEST, 0.62, 0.05));
const uArm = G(shld, 0, 0, 0);
cap(0.09, 0.32, C_SHIRT, 0, -0.15, 0, uArm);
const cuff = M(new THREE.CylinderGeometry(0.076, 0.076, 0.055, 16, 1, true), C_SHIRT, 0.6, 0.05);
cuff.position.y = -0.3; uArm.add(cuff);
const elbow = G(uArm, 0, -0.32, 0);
elbow.add(M(new THREE.SphereGeometry(0.08, 14, 12), C_SKIN, 0.62, 0.02));
cap(0.075, 0.3, C_SKIN, 0, -0.15, 0, elbow);
/* ساعة يد سوداء كما في المرجع */
const watch = M(new THREE.CylinderGeometry(0.082, 0.082, 0.045, 16, 1, true), 0x1b1f24, 0.55, 0.1);
watch.position.y = -0.29; elbow.add(watch);
const hand = G(elbow, 0, -0.32, 0);
const glove = M(new THREE.SphereGeometry(0.088, 16, 12), C_SKIN, 0.72, 0.05);
glove.scale.set(1, 1.15, 0.9); glove.position.y = -0.03; hand.add(glove);
return {shld, uArm, elbow, hand};
});
// ===== الموظف يظهر جالساً على الرافعة الشوكية أثناء القيادة =====
const forkDriver = new THREE.Group(); fk.add(forkDriver); forkDriver.visible = false;
B(0.56, 0.26, 0.74, C_PANTS, 0, 1.2, -0.02, forkDriver, 0.7, 0.1);
[-1, 1].forEach(s => {
B(0.19, 0.52, 0.22, C_PANTS, s * 0.21, 0.86, 0.38, forkDriver, 0.7, 0.1).rotation.x = -0.12;
B(0.22, 0.16, 0.4, C_BOOTS, s * 0.21, 0.55, 0.58, forkDriver, 0.85, 0.05);
B(0.16, 0.46, 0.17, C_SKIN, s * 0.35, 1.55, 0.2, forkDriver, 0.6, 0.1).rotation.x = -1.05;
B(0.15, 0.15, 0.15, C_GLOVE, s * 0.24, 1.32, 0.44, forkDriver, 0.8, 0.05);
});
const forkVest = B(0.62, 0.7, 0.44, C_VEST, 0, 1.62, -0.2, forkDriver, 0.55, 0.15);
B(0.5, 0.16, 0.46, C_REFL, 0, 1.46, -0.2, forkDriver, 0.55, 0.15);
const forkHead = M(new THREE.SphereGeometry(0.25, 16, 12), C_SKIN);
forkHead.position.set(0, 2.14, -0.18); forkHead.scale.set(0.94, 1.06, 0.96); forkDriver.add(forkHead);
CY(0.28, 0.28, 0.16, C_CAP, 0, 2.37, -0.18, forkDriver);
const forkWheel = M(new THREE.TorusGeometry(0.24, 0.035, 8, 20), 0x181c20);
forkWheel.position.set(0, 1.36, 0.46); forkWheel.rotation.x = -1.15; forkDriver.add(forkWheel);
B(0.08, 0.5, 0.08, 0x2a2a2a, 0, 1.12, 0.58, forkDriver, 0.5, 0.4);
const PLAYER_RADIUS = 0.45;
/* ===== سائق الرافعة: نفس شخصية اللاعب المجسّمة بدل المجسّمات الإجرائية =====
   نسخة مستقلة (هيكل عظمي ومواد خاصة بها) جالسة على المقعد: ساقان للأمام
   وذراعان إلى المقود. تُركّب داخل forkDriver حتى تبقى ظهورها/إخفاءها كما هي. */
const HIP_REF = 1.824;             // ارتفاع الحوض في قالب الشخصية (3.6م)
/* مقعد الرافعة الجديدة (النموذج الكبير): السائق بحجم اللاعب كاملاً (s=1) والحوض فوق وسادة المقعد */
const SEAT = { s: 1, hips: 2.1, z: 0 };
const FK_SCALE = 0.86, DRV_SCALE = 0.92;   // تصغير الرافعة نسبةً للنموذج الأول، وحجم السائق داخلها
const SEAT_CREW = { fork: null, truck: null, tried: false };
/* سائق الرافعة المتهورة: قالب الطاقم أطول (3.6م) من شخصية اللاعب (3.1م)، فيُصغَّر بنسبتهما × DRV_SCALE
   ويُنزَّل المقعد بـ FK_SCALE كما يُفعل باللاعب الجالس، فيبقى الرأس تحت سقف الرافعة (≈3.3م) */
const TRUCK_SEAT_S = 3.1 / 3.6 * DRV_SCALE;
function seatCrewInto(parent, at, s = SEAT.s) {
  const g = new THREE.Group();
  // نرفع/نخفض المجموعة بحيث يستقر الحوض على وسادة المقعد بعد التكبير
  g.position.set(at[0], at[1] - HIP_REF * s, at[2]);
  g.rotation.y = at[3] || 0;
  parent.add(g);
  return CrewRig.load('game/models/airport-crew.glb').then(o => {
    g.scale.setScalar(s);
    g.add(o.root);
    o.pose({ dt: 0.016, sit: true });
    return o;
  });
}
function loadSeatCrew() {
  if (SEAT_CREW.tried || !window.CrewRig) return;
  SEAT_CREW.tried = true;
  seatCrewInto(forkDriver, [0, SEAT.hips, SEAT.z]).then(o => {
    SEAT_CREW.fork = o;
    forkDriver.children.forEach(c => { if (c !== o.root.parent && !c.userData.keep) c.visible = false; });
  });
  seatCrewInto(truckDriver, [0, SEAT.hips * FK_SCALE, SEAT.z * FK_SCALE], TRUCK_SEAT_S).then(o => {
    SEAT_CREW.truck = o;
    styleRecklessDriver(o.root, o.state.bones[CrewRig.bones.head]);
    truckDriver.children.forEach(c => { if (c !== o.root.parent && !c.userData.keep) c.visible = false; });
  });
}
/* سائق الرافعة المتهورة: بلا قبعة، شعر أسود، وبشرة حنطية فاتحة (أغمق قليلاً من القالب).
   القالب يُحمَّل لكل سائق بمواد مستقلة، فلا يتأثر سائق الرافعة المتوقفة. */
const RECKLESS_LOOK = { Skin: 0xc8956b, SkinShadow: 0xa5714c, Hair: 0x0d0b0a, Lip: 0xa8604c };
function styleRecklessDriver(root, head){
  let band = null;
  root.traverse(o => {
    if(!o.isMesh || !o.material) return;
    const n = o.material.name || '';
    if(/^Cap/.test(n)){ o.visible = false; if(n === 'CapBand') band = o; return; }
    if(RECKLESS_LOOK[n] !== undefined){ o.material.color.setHex(RECKLESS_LOOK[n]).convertSRGBToLinear(); o.material.needsUpdate = true; }
  });
  /* القالب بلا شعر فوق الرأس (كانت القبعة تغطيه): قبة شعر سوداء على محيط شريط القبعة، تتبع عظمة الرأس */
  if(band && head){
    band.geometry.computeBoundingBox();
    const bb = band.geometry.boundingBox, c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    const r = Math.max(sz.x, sz.z) / 2;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(RECKLESS_LOOK.Hair).convertSRGBToLinear(), roughness: 0.85 }));
    hair.scale.set(sz.x / 2 * 1.02, r * 0.62, sz.z / 2 * 1.02);
    hair.position.set(c.x, bb.min.y + sz.y * 0.2, c.z - sz.z * 0.03);
    hair.castShadow = true;
    root.add(hair); root.updateMatrixWorld(true);
    head.attach(hair);
  }
}
/* حدود الأرضية القابلة للمشي: تُستخدم في دفع التصادم أيضاً حتى لا يُقذف اللاعب خارج المستودع */
const WALK = { minX: -33.6, maxX: 33.6, minZ: -11.5, maxZ: 10.1 };
/* صندوق تصادم الرافعة المتوقفة: نصف الأبعاد من قواعد اللعبة (نفس الشكل المرئي بعد الدوران) */
const FK_HX = gameRules.forklift.halfX, FK_HZ = gameRules.forklift.halfZ;
/* صندوق الرافعة يدور معها: المحور الطويل (halfX) على اتجاه مقدمتها sin/cos(yaw) */
function fkHalf(){ const s = Math.abs(Math.sin(fk.rotation.y)), c = Math.abs(Math.cos(fk.rotation.y)); return { hx: s*FK_HX + c*FK_HZ, hz: c*FK_HX + s*FK_HZ }; }
const STATIC_OBSTACLES = [
{ minX: -26.0, maxX: 26.0, minZ: 10.6, maxZ: 13.6 },
{ minX: -27.1, maxX: -24.5, minZ: 10.2, maxZ: 13.8 },
{ minX: 24.5, maxX: 27.1, minZ: 10.2, maxZ: 13.8 },
{ minX: -34.0, maxX: 34.0, minZ: -18.2, maxZ: -11.65 },
{ minX: -32.9, maxX: -31.1, minZ: -3.8, maxZ: 1.4 }, { minX: 31.1, maxX: 32.9, minZ: -3.8, maxZ: -0.4 },
{ minX: -32.9, maxX: -31.1, minZ: 5.2, maxZ: 6.8 }, { minX: 31.1, maxX: 32.9, minZ: 3.7, maxZ: 5.3 }
];
[-24, -8, 8, 24].forEach(x => STATIC_OBSTACLES.push({minX:x-0.55, maxX:x+0.55, minZ:-13.15, maxZ:-12.05}));
// جدران أقفاص المواد الخطرة (مفتوحة من الأمام)
Z.filter(z => z.hz).forEach(z => [-1,1].forEach(q => STATIC_OBSTACLES.push({minX:z.x+q*z.w/2-0.1, maxX:z.x+q*z.w/2+0.1, minZ:-11.7, maxZ:-5.5})));
Z.filter(z=>z.k!=='fod').forEach(z => STATIC_OBSTACLES.push({minX:z.x-(z.w+0.1)/2, maxX:z.x+(z.w+0.1)/2, minZ:-11.925, maxZ:-11.675}));
STATIC_OBSTACLES.push({minX:gameRules.fodZoneX-1.0,maxX:gameRules.fodZoneX+1.0,minZ:-9.6,maxZ:-7.6});
/* جسم غرفة التجميد صلب (التسليم من الواجهة فقط) */
STATIC_OBSTACLES.push({minX:FRZ.x-FRZ.w/2,maxX:FRZ.x+FRZ.w/2,minZ:FRZ.zBack-0.2,maxZ:FRZ.zFront+0.05});
/* قاعدة منضدة القراءة المائلة: صلبة كي لا يمرّ اللاعب من خلالها */
STATIC_OBSTACLES.push({minX:3.3,maxX:9.5,minZ:-14.6,maxZ:-11.35});
let bumpCD = 0, lastBump = 0;
// دفع دائرة اللاعب خارج مستطيل مع انزلاق ناعم على الحواف بدل القفز للمحور الأقرب
// دفع اللاعب خارج مستطيل مع الانزلاق على السطح: نُصحّح المحور الأقل اختراقاً فقط
// فيبقى المحور الآخر حراً تماماً (Wall Sliding) بدل الارتجاج عند الزوايا
function pushOutAABB(p, minX, maxX, minZ, maxZ, r){
if(p.x + r <= minX || p.x - r >= maxX || p.z + r <= minZ || p.z - r >= maxZ) return false;
const penL = (p.x + r) - minX, penR = maxX - (p.x - r);
const penT = (p.z + r) - minZ, penB = maxZ - (p.z - r);
/* نجرّب الاتجاهات الأقل اختراقاً أولاً، ونتجاهل أي اتجاه يُخرج اللاعب من الأرضية.
   سابقاً كان أصغر اختراق هو المختار دائماً؛ فإذا كان صوب الجدار بقي اللاعب محصوراً
   بين الجدار والصندوق (تعليق تام عند الرافعة المتوقفة). */
const cands = [
{c:'x', v:minX - r, d:penL}, {c:'x', v:maxX + r, d:penR},
{c:'z', v:minZ - r, d:penT}, {c:'z', v:maxZ + r, d:penB}
].sort((a, b) => a.d - b.d);
for(const o of cands){
const nx = o.c === 'x' ? o.v : p.x, nz = o.c === 'z' ? o.v : p.z;
if(nx < WALK.minX || nx > WALK.maxX || nz < WALK.minZ || nz > WALK.maxZ) continue;
p.x = nx; p.z = nz; return true;
}
const best = cands[0];
if(best.c === 'x') p.x = Math.max(WALK.minX, Math.min(WALK.maxX, best.v));
else p.z = Math.max(WALK.minZ, Math.min(WALK.maxZ, best.v));
return true;
}
/* opt: rad نصف قطر الجسم، yaw/reach موضع الطرد المحمول، probe=true فحص بلا آثار (لا دفع طرود ولا صوت) */
function resolvePlayerCollisions(targetX, targetZ, mvx=0, mvz=0, dt=0.016, opt) {
const rad = (opt && opt.rad) || PLAYER_RADIUS, probe = !!(opt && opt.probe);
const hYaw = opt && opt.yaw !== undefined ? opt.yaw : curRotY, hReach = opt && opt.reach !== undefined ? opt.reach : 0.78;
const p = { x: Math.max(WALK.minX, Math.min(WALK.maxX, targetX)), z: Math.max(WALK.minZ, Math.min(WALK.maxZ, targetZ)) };
let hit = false;
for(let iter=0; iter<3; iter++){
for (const o of STATIC_OBSTACLES) if(pushOutAABB(p, o.minX, o.maxX, o.minZ, o.maxZ, rad)) hit = true;
for (const b of BOLLARDS){
const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz), m = rad + b.r;
if(d < m && d > 1e-6){ p.x += dx/d*(m-d); p.z += dz/d*(m-d); hit = true; }
}
// المفتش جسم صلب بهامش أوسع أمام الرافعة الشوكية كي تبقى على مسافة مناسبة منه
if(inspector.active && inspector.g.visible){
const ix = inspector.g.position.x, iz = inspector.g.position.z, dx = p.x - ix, dz = p.z - iz, d = Math.hypot(dx, dz), m = rad + (FD.on ? INSP_FK_GAP : INSP_BODY_GAP);
if(d < m){ const nx = d > 1e-6 ? dx/d : -mvx, nz = d > 1e-6 ? dz/d : -mvz; p.x = ix + nx*m; p.z = iz + nz*m; hit = true; }
}
// الرافعة المتوقفة جسم صلب ما دام اللاعب لا يقودها
if(!FD.on){ const fh = fkHalf(); if(pushOutAABB(p, fk.position.x-fh.hx, fk.position.x+fh.hx, fk.position.z-fh.hz, fk.position.z+fh.hz, rad)) hit = true; }
p.x = Math.max(WALK.minX, Math.min(WALK.maxX, p.x));
p.z = Math.max(WALK.minZ, Math.min(WALK.maxZ, p.z));
for (const it of items) {
if (it.st === 'held' || it.st === 'lifting' || it.st === 'belt') continue;
const h = it.data.isHeavy ? 0.78 * HVS : 0.68, bx = it.m.position.x, bz = it.m.position.z;
if(it.st === 'floor' && !it.data.isHeavy){   // الطرد الثقيل جسم صلب لا يُدفع (يُنقل بالرافعة فقط)
// الطرود على الأرض تُدفع بلطف عند ملامستها
const cx = Math.max(bx-h, Math.min(p.x, bx+h)), cz = Math.max(bz-h, Math.min(p.z, bz+h));
const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
if(d < rad){
const pen = rad - d, nx = d > 1e-6 ? dx/d : -mvx, nz = d > 1e-6 ? dz/d : -mvz;
if(probe){ p.x += nx * pen; p.z += nz * pen; hit = true; continue; }
it.m.position.x -= nx * pen * 0.7; it.m.position.z -= nz * pen * 0.7;
it.m.position.x = Math.max(-33, Math.min(33, it.m.position.x));
it.m.position.z = Math.max(-11.9, Math.min(9.6, it.m.position.z));
it.m.rotation.y += (nx*mvz - nz*mvx) * pen * 0.6;
it.wob = 1;
p.x += nx * pen * 0.3; p.z += nz * pen * 0.3;
hit = true;
}
} else if(pushOutAABB(p, bx-h, bx+h, bz-h, bz+h, rad)) hit = true;
}
}
if(held && !liftAnim.active){
const hh = boxHalf({m:{rotation:{y:hYaw}}}), fx = Math.sin(hYaw)*hReach, fz = Math.cos(hYaw)*hReach;
for(let k=0;k<2;k++){
const bp = {x:p.x+fx, z:p.z+fz};
for(const o of STATIC_OBSTACLES){
const v = overlapVec(bp, hh, (o.minX+o.maxX)/2, (o.minZ+o.maxZ)/2, (o.maxX-o.minX)/2, (o.maxZ-o.minZ)/2);
if(v){ const m = Math.hypot(v[0], v[1]), f = m < 0.3 ? 1 : 0.3/m; p.x += v[0]*f; p.z += v[1]*f; hit = true; break; }
}
}
}
if(!probe && hit && (Math.abs(mvx)+Math.abs(mvz)) > 0.3 && performance.now() - lastBump > 380){ lastBump = performance.now(); snd('bump'); addShake(.45); }
return p;
}
let bob=0, walk=0, turnLean=0, curRotY=0, inX=0, inZ=0, animSpd=0;
/* كومبو الرقصة: الحالة من WarehouseRules.ballet، والدوران الاحتفالي مدته spinSeconds */
let ballet = { count: 0, idle: 0, gap: 0 }, balletMoving = false, balletSpinT = 0, balletPrev = null;
function balletReset(){ ballet = gameRules.ballet.onMiss(); balletSpinT = 0; }
function balletOnSort(){
const r = gameRules.ballet.onSort(ballet);
ballet = r.state;
if(!r.triggered) return;
progEmit('ballet', { count: r.count });
score += r.bonus;
balletSpinT = gameRules.ballet.spinSeconds;
const el = $('ballet-banner');
if(el){
el.innerHTML = '💃 Ballet ×' + r.count + '!<small>+' + r.bonus + '</small>';
el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
snd('cardwin', 1 + Math.min(r.count - 3, 6) * .05);
}
let liftAnim = {active:false, t:0, dur:0.32, fromPos:new THREE.Vector3(), toHold:null};
const cargoSmoothPos = new THREE.Vector3();
const cargoHold = new THREE.Vector3();
let cargoInertiaY = 0;
const pose = {
lHip:0, rHip:0, lKnee:0, rKnee:0,
lShldX:0, rShldX:0, lShldZ:0, rShldZ:0,
lElb:0, rElb:0,
torsoTwist:0, torsoLean:0, torsoRoll:0, pelvisDrop:0
};
/* سرعة المشي الفعلية: من إزاحة اللاعب الحقيقية لا من الإدخال، فتتوقف الخطوات عند الاصطدام بجدار */
let animPrevX = null, animPrevZ = null, animVel = 0;
function anim(dt, spd, vx, vz){
/* حمل القطة يأخذ وضعية الحمل نفسها (الذراعان أمام الصدر) كي تستقر بين اليدين */
const isHeld = !!held || !!(window.Prog && Prog.petHeld && Prog.petHeld());
const sprinting = !isHeld && !!(key.ShiftLeft || key.ShiftRight);
let moved = 0;
if(animPrevX !== null) moved = Math.hypot(px.x - animPrevX, px.z - animPrevZ);
animPrevX = px.x; animPrevZ = px.z;
if(moved > 1.5) moved = 0;                                  // انتقال فوري (إعادة تموضع) لا يُحسب خطوات
if(dt > 0) animVel += (moved / dt - animVel) * Math.min(1, dt * 14);
const isMoving = spd > 0.08 && animVel > 0.6;
const ac0 = activeCharRig();
if(isMoving){
/* الطور يتقدم بالمسافة: دورة خطوتين لكل cycleLength وحدة ⇒ لا انزلاق للقدمين وإيقاع طبيعي */
if(ac0 && window.Character3D && Character3D.cycleLength) walk += moved / Character3D.cycleLength(animVel, isHeld, sprinting) * Math.PI * 2;
else walk += dt * (isHeld ? 13 : 15.5) * (sprinting ? 1.35 : 1) * gameRules.movementMultiplier(fearT);
const targetRot = Math.atan2(vx, vz);
const diff = Math.atan2(Math.sin(targetRot - curRotY), Math.cos(targetRot - curRotY));
const turnK = Math.min(1, dt * (18 + Math.abs(diff) * 12));
const turn = diff * turnK;
curRotY += turn;
rig.rotation.y = curRotY;
const leanTarget = Math.max(-.14, Math.min(.14, -turn / Math.max(dt, 1e-3) * .05));
turnLean += (leanTarget * (isHeld ? .6 : 1) - turnLean) * Math.min(1, dt * 10);
} else {
turnLean += (0 - turnLean) * Math.min(1, dt * 8);
}
rig.rotation.z = turnLean;
/* الشخصية المجسّمة تُقلّد اتجاه الـrig، وحركة الجسد تأتي من الهيكل العظمي */
const ac = activeCharRig();
/* دوران الباليه الاحتفالي: لفّة كاملة فوق اتجاه الحركة الحالي (تخفيف ease-out) */
let spinOff = 0;
if(balletSpinT > 0){
balletSpinT = Math.max(0, balletSpinT - dt);
const k = 1 - balletSpinT / gameRules.ballet.spinSeconds;
spinOff = (1 - Math.pow(1 - k, 3)) * Math.PI * 2;
rig.rotation.y = curRotY + spinOff;
}
if(ac && ac.root.visible){
ac.root.rotation.y = curRotY + spinOff;
ac.root.rotation.z = turnLean * .55;
ac.pose({ dt, phase: walk, moving: isMoving, speed: animVel, sprint: sprinting, held: isHeld, lift: liftAnim.active ? Math.sin(liftAnim.t * Math.PI) : 0 });
}
if(SEAT_CREW.fork) SEAT_CREW.fork.pose({ dt, sit: true });
if(SEAT_CREW.truck) SEAT_CREW.truck.pose({ dt, sit: true });
const sw = Math.sin(walk);
const cw = Math.cos(walk);
let target = {};
if(liftAnim.active){
const p = Math.sin(liftAnim.t * Math.PI);
target = {
lHip:0.75*p, rHip:0.75*p, lKnee:1.2*p, rKnee:1.2*p,
lShldX:-1.38*p - (1-p)*0.9, rShldX:-1.38*p - (1-p)*0.9,
lShldZ:0.15, rShldZ:-0.15,
lElb:-0.6*p - (1-p)*1.35, rElb:-0.6*p - (1-p)*1.35,
torsoTwist:0, torsoLean:0.58*p - (1-p)*0.12, torsoRoll:0, pelvisDrop:0.4*p
};
} else if(isHeld && isMoving){
const lStep = sw > 0;
target = {
lHip: sw * 0.58, rHip: -sw * 0.58,
lKnee: lStep ? Math.max(0, -cw * 0.88) : 0.12,
rKnee: !lStep ? Math.max(0, cw * 0.88) : 0.12,
lShldX: -0.92 + cw * 0.05, rShldX: -0.92 - cw * 0.05,
lShldZ: -0.2, rShldZ: 0.2,
lElb: -0.62 + sw * 0.04, rElb: -0.62 - sw * 0.04,
torsoTwist: -sw * 0.1, torsoLean: -0.16, torsoRoll: sw * 0.08, pelvisDrop: Math.abs(cw) * 0.09
};
} else if(isMoving){
const lForward = sw > 0;
target = {
lHip: sw * 0.74, rHip: -sw * 0.74,
lKnee: lForward ? Math.max(0, -cw * 1.05) : 0.08,
rKnee: !lForward ? Math.max(0, cw * 1.05) : 0.08,
lShldX: -sw * 0.68, rShldX: sw * 0.68,
lShldZ: 0.1, rShldZ: -0.1,
lElb: -0.35 - Math.max(0, sw * 0.45), rElb: -0.35 - Math.max(0, -sw * 0.45),
torsoTwist: -sw * 0.18, torsoLean: 0.18, torsoRoll: 0, pelvisDrop: Math.abs(cw) * 0.08
};
} else {
const t = performance.now() * 0.0025;
const breathe = Math.sin(t) * 0.035;
target = {
lHip:0.04, rHip:-0.04, lKnee:0.05, rKnee:0.05,
lShldX:isHeld ? -0.92 + breathe*0.3 : -0.08 + breathe, rShldX:isHeld ? -0.92 + breathe*0.3 : -0.08 + breathe,
lShldZ:isHeld ? -0.2 : 0.08, rShldZ:isHeld ? 0.2 : -0.08,
lElb:isHeld ? -0.62 : -0.25, rElb:isHeld ? -0.62 : -0.25,
torsoTwist:0, torsoLean:isHeld ? -0.12 : breathe * 0.5, torsoRoll:0, pelvisDrop:breathe * 0.02
};
}
const q = Math.min(1, dt * 18);
for(let k in target){ pose[k] += (target[k] - pose[k]) * q; }
legs[0].thigh.rotation.x = pose.lHip; legs[1].thigh.rotation.x = pose.rHip;
legs[0].knee.rotation.x = pose.lKnee; legs[1].knee.rotation.x = pose.rKnee;
arms[0].shld.rotation.x = pose.lShldX; arms[1].shld.rotation.x = pose.rShldX;
arms[0].shld.rotation.z = pose.lShldZ; arms[1].shld.rotation.z = pose.rShldZ;
arms[0].elbow.rotation.x = pose.lElb; arms[1].elbow.rotation.x = pose.rElb;
tor.rotation.y = pose.torsoTwist; tor.rotation.x = pose.torsoLean; tor.rotation.z = pose.torsoRoll;
pelvis.position.y = 0.92 - pose.pelvisDrop;
bob = isMoving ? Math.abs(cw) * 0.07 : 0;
sh.scale.set(1 + bob*0.6, 1 + bob*0.6, 1);
hd.rotation.y = isMoving ? sw * 0.06 : Math.sin(performance.now()*0.0015) * 0.12;
}
pl.position.set(0, 0, 3);
let items=[], run=false, score=0, combo=1, time=100, spawnT=0, held=null, near=null, stage=1;
let streak=0, streakT=0, maxStreak=0, rushT=25, rushN=0, rushDelay=0;
/* سجل أخطاء الوردية لتقرير النهاية (gameRules.debrief) */
let shiftLog = [];
const logMistake = e => { if(shiftLog.length < 200) shiftLog.push(e); };
/* أحداث اللعب للمهام اليومية والخبرة وشهادة DGR (progress-game.js) */
const progEmit = (e, p) => { if(window.Prog) Prog.emit(e, p); };
/* ===== إثارة: اندفاع + اهتزاز كاميرا + وضع الحمى ===== */
let dashT = 0, dashCD = 0, feverT = 0, shakeTrauma = 0, hitStop = 0;
const FEVER_TIME = 6, FEVER_BOOST = 1.15;
/* مستويات الاندفاع: كل جسم FOD يوضع في مكانه الصحيح يرفع المستوى (مدة أطول وسرعة أعلى وتبريد أقصر) */
const DASH_LV = [{ t: .8, cd: 3, k: 1.6 }, { t: 1.1, cd: 2.6, k: 1.8 }, { t: 1.4, cd: 2.2, k: 2.05 }, { t: 1.8, cd: 1.8, k: 2.3 }];
const FODQ = { n: 0 };
const dashCfg = () => DASH_LV[Math.min(FODQ.n, 3)];
const TRAUMA_DECAY = 1.2, HITSTOP_LARGE = .05;
function feverOn(){ return feverT > 0; }
function addShake(a){ shakeTrauma = Math.min(1, shakeTrauma + a); }
/* وقفة زمنية لحظية تُبرز ثقل الأثر (Large tier) */
function hitStopNow(t = HITSTOP_LARGE){ hitStop = Math.max(hitStop, t); }
/* وميض شاشة: ذهبي للمكافآت الكبرى وأحمر للتعارضات */
function screenFlash(kind){
const el = $('screen-flash'); if(!el) return;
el.className = ''; void el.offsetWidth; el.className = 'on ' + kind;
clearTimeout(screenFlash.t);
screenFlash.t = setTimeout(() => { el.className = ''; }, 340);
}
function setDashButton(){
const b = $('dash-btn'); if(!b) return;
/* أثناء الاندفاع: برتقالي متوهج بدل رمادي التبريد */
const boosting = dashT > 0;
b.classList.toggle('boosting', boosting);
b.classList.toggle('cool', dashCD > 0 && !boosting);
b.style.setProperty('--cd', (dashCD > 0 && !boosting ? (dashCD / dashCfg().cd) * 100 : 0) + '%');
}
function startFever(){
if(feverT > 0) return;
feverT = FEVER_TIME;
progEmit('fever');
$('stage').classList.add('fever');
snd('fever');
toast('🔥 وضع الحمى! النقاط مضاعفة ×2', '#ffd54a');
}
function doDash(){
if(dashCD > 0 || dashT > 0 || !run || introHold || fire.keypad) return;
dashT = dashCfg().t; dashCD = dashCfg().cd;
addShake(.22); engineSnd(Math.min(FODQ.n, 3)); spinSnd(Math.min(FODQ.n, 3), dashT);
$('dash-fx').classList.add('on');
setDashButton();
}
const fire = {active:false, done:false, phase:'idle', t:0, codeT:0, keypad:false, posAwarded:false, siren:null, buzz:null};
const STREAK_MAX = 8;
const streakWindow = () => gameRules.economy.streakWindow(stage);
const bestScore = () => { try { return +(localStorage.getItem('acg_best') || 0) || 0; } catch(e){ return 0; } };
const saveBest = v => { try { localStorage.setItem('acg_best', v); } catch(e){} };
const getTop = () => { try { return gameRules.board.top(JSON.parse(localStorage.getItem('acg_top') || '[]')); } catch(e){ return []; } };
const pushTop = v => { const t = getTop(); t.push({s:v, d:new Date().toLocaleDateString(I18N.lang === 'en' ? 'en' : 'ar')}); t.sort((a,b)=>b.s-a.s); const r = t.slice(0,5); try { localStorage.setItem('acg_top', JSON.stringify(r)); } catch(e){} return r; };
const topHTML = t => t.length ? t.slice(0,4).map((e,i) => `<span class="score-chip"><i class="rank-dot r${i+1}"></i> ${e.s} ${I18N.t('نقطة')}</span>`).join('') : `<span class="lb-empty">${I18N.t('العب لتسجّل أول نتيجة')}</span>`;
function syncMenu(){ const tp = $('top5'); const list = getTop(); if(tp){ tp.innerHTML = topHTML(list); tp.style.display = ''; } const el = $('best'); if(!el) return; const b = bestScore(); el.textContent = b ? I18N.T('أفضل نتيجة: ','Best score: ') + b : I18N.t('كن أول الأبطال'); }
/* حدود المراحل من مصدر واحد (game-rules.js) حتى لا تختلف اللعبة عن الاختبارات */
const STAGE_AT=gameRules.layout.stageThresholds(), STAGE_BELT=[0,1.4,1.8,2.3,2.8];
/* إيقاع أسنان المنشار: نفس هادئ للتنفس + موجة ذروة كل 25 ثانية */
const BREATH_SPAWN=[0,5,4.8,4.4,4], RUSH_GAP=[0,2,1.9,1.7,1.5], RUSH_EVERY=25, RUSH_COUNT=3;
const TUTORIAL_KEY = 'dgr_tutorial_completed';
const tutorialDone = () => { try { return localStorage.getItem(TUTORIAL_KEY) === '1'; } catch(e){ return false; } };
const saveTutorialDone = () => { try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch(e){} };
let demo={insp:false,truck:false,inspDone:false,truckDone:false,truckIn:0}, introT=null, introHold=false;
function showIntro(html,ms=7000,hold=false){
const e=document.getElementById('intro');
const showSkip = hold && (demo.insp || demo.truck);
e.innerHTML=html + (showSkip ? `<button class="skip-tutorial" id="skip-tutorial" type="button">${I18N.T('تخطي الإرشادات','Skip tutorial')}</button>` : '');e.classList.add('on');e.classList.toggle('wait',hold);
placeToastBelowIntro();
clearTimeout(introT);
if(hold){
  introHold=true; run=false; clearMovement(); e.onclick=resumeFromIntro;
  const onGlobalResume = ev => {
    if(ev.target && ev.target.id === 'skip-tutorial') return;
    window.removeEventListener('pointerdown', onGlobalResume, true);
    resumeFromIntro();
  };
  window.addEventListener('pointerdown', onGlobalResume, true);
  introT=setTimeout(()=>{
    window.removeEventListener('pointerdown', onGlobalResume, true);
    resumeFromIntro();
  },20000);
}
else { introHold=false; e.onclick=null; introT=setTimeout(()=>{e.classList.remove('on');placeToastBelowIntro();},ms); }
const sk = e.querySelector('#skip-tutorial');
if(sk) sk.onclick = ev => { ev.stopPropagation(); skipTutorial(); };
}
function skipTutorial(){
demo.insp=false; demo.truck=false; demo.inspDone=true; demo.truckDone=true;
inspector.demo=false; inspector.active=false; inspector.g.visible=false;
document.getElementById('inspector-badge').classList.remove('on');
saveTutorialDone(); resetTruck(); hideIntro();
run=true; pz=false; last=performance.now(); clearMovement();
try { R.domElement.focus({preventScroll:true}); } catch(e){}
toast(I18N.T('تم تخطي الإرشادات — بالتوفيق!','Tutorial skipped — good luck!'), '#64ffda');
}
function hideIntro(){const e=document.getElementById('intro');if(e){e.classList.remove('on','wait');e.onclick=null;}document.getElementById('stage')?.style.removeProperty('--toast-top');introHold=false;clearTimeout(introT);}
// نُبعد شريط الرسائل المؤقتة (toast) تحت فقاعة الرسالة حتى لا يظهر جزء منه خلفها
function placeToastBelowIntro(){
const e=document.getElementById('intro'), st=document.getElementById('stage');
if(!e||!st||!e.classList.contains('on')){ st&&st.style.removeProperty('--toast-top'); return; }
const sb=st.getBoundingClientRect(), ib=e.getBoundingClientRect();
const top=Math.round(ib.bottom-sb.top)+16;
st.style.setProperty('--toast-top', Math.min(top, Math.round(sb.height*.8))+'px');
}
function resumeFromIntro(){
if(!introHold) return;
if($('rules').style.display !== 'none') return;
hideIntro(); run=true; pz=false; last=performance.now(); clearMovement();
/* إعادة تمكين الإدخال (لوحة المفاتيح + العصا) بعد نافذة التنبيه */
try { R.domElement.focus({preventScroll:true}); } catch(e){}
}
function startInspDemo(){
const I_=inspector;demo.insp=true;I_.demo=true;evt.patrol++;evt.lastInsp=evt.t;I_.dir=Math.random()<.5?1:-1;
I_.z=INSP_SAFE.zebraZ; I_.targetZ=INSP_SAFE.zebraZ; I_.x=-INSP_SAFE.maxX*I_.dir;
I_.active=true;I_.g.visible=true;I_.t=0;
I_.g.position.set(I_.x,0,I_.z);
I_.g.rotation.y=I_.dir>0?Math.PI/2:-Math.PI/2;
document.getElementById('inspector-badge').classList.add('on');snd('whistle');
/* لا نوقف اللعبة عند قدوم المفتش؛ يدخل في دورية حية وتستمر اللعبة بسلاسة وبلا تجميد */
showIntro(I18N.T('<b class="t">🦺 جولة المفتش</b>يغرّم كل طرد متروك خارج مناطق الفرز.<small>دورية تفتيشية مباشرة — حافظ على نظافة الممرات والأرضيات!</small>', '<b class="t">🦺 Inspector on Patrol</b>Fines every parcel left outside sorting zones.<small>Live inspection patrol — keep walkways clear!</small>'), 4500, false);
}
function startTruckDemo(){
demo.truck=true;truckState=gameRules.reset();truckState.trips=1;truckState.elapsed=gameRules.startAt;snd('horn');
/* جولة حية دون إيقاف سير اللعبة */
showIntro(I18N.T('<b class="t">🚜 الرافعة الشوكية</b>تُسقط أجساماً غريبة (FOD)؛ اجمعها وضعها في الصندوق الأحمر.<small>جولة تدريبية مباشرة — انتبه أثناء العمل!</small>', '<b class="t">🚜 Forklift Operating</b>Drops foreign objects (FOD); collect them and put them in the red bin.<small>Live training round — stay alert!</small>'), 4500, false);
}
const beltSpeed=()=> gameRules.layout.beltSpeed(stage, feverT > 0) * (window.Prog ? Prog.beltK() : 1);
let sortedCount=0, totalProcessed=0;
const px = pl.position, key = {}, joy = {x:0, y:0};
const tc = {};
function fit(g,t,w,px){ g.font='bold '+px+'px sans-serif'; while(g.measureText(t).width>w&&px>14){ px-=2; g.font='bold '+px+'px sans-serif'; } }
const _dgc = {};
function star(cx,cy,ro,ri,n){ let p=''; for(let i=0;i<n*2;i++){ const r=i%2?ri:ro, a=Math.PI*i/n-Math.PI/2; p+=(cx+r*Math.cos(a)).toFixed(1)+','+(cy+r*Math.sin(a)).toFixed(1)+' '; } return p; }
function sector(cx,cy,r0,r1,a0,a1){
const P=(r,a)=>[(cx+r*Math.cos(a*Math.PI/180)).toFixed(1),(cy-r*Math.sin(a*Math.PI/180)).toFixed(1)];
const A=P(r1,a0),B=P(r1,a1),C=P(r0,a1),D=P(r0,a0);
return `M${A} A${r1} ${r1} 0 0 0 ${B} L${C} A${r0} ${r0} 0 0 1 ${D} Z`;
}
// ملصقات IATA/UN للمواد الخطرة مرسومة بـ SVG (لا تحتاج إنترنت)
function dgLabelSVG(div, imp){
const H='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="240" height="240">';
if(imp === 'RLI'){
return H+'<defs><pattern id="h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="#e53935"/><rect x="3" width="3" height="6" fill="#fff"/></pattern></defs><rect x="4" y="20" width="92" height="60" fill="url(#h)"/><rect x="12" y="27" width="76" height="46" fill="#fff"/><rect x="26" y="34" width="36" height="18" rx="2" fill="none" stroke="#111" stroke-width="3"/><rect x="62" y="39" width="5" height="8" fill="#111"/><path d="M47 36 L40 45 H46 L43 51 L52 41 H46Z" fill="#111"/><text x="50" y="65" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="9" fill="#111">UN3480 • 9A</text></svg>';
}
const k = /^[2456]/.test(div) ? div.slice(0,3) : div[0];
let fg='#111', tx='#111', num=k[0], bg='', sym='';
const full=c=>`<rect width="100" height="100" fill="${c}"/>`;
const half=(a,b)=>`<rect width="100" height="50" fill="${a}"/><rect y="50" width="100" height="50" fill="${b}"/>`;
const flame=(t='')=>`<path ${t} d="M50 20 C52 30 64 36 63 50 C62 61 56 67 50 67 C43 67 37 61 37 51 C37 44 41 40 44 33 C45 38 47 40 49 38 C50 32 49 26 50 20Z" fill="${fg}"/>`;
const ox=()=>`${flame('transform="translate(50,27) scale(.62) translate(-50,-20)"')}<circle cx="50" cy="61" r="8.5" fill="none" stroke="${fg}" stroke-width="3.2"/>`;
switch(k){
case '1': bg=full('#ff6a00'); num=div; sym=`<circle cx="46" cy="58" r="11" fill="${fg}"/><path d="M52 50 L60 41" stroke="${fg}" stroke-width="3" stroke-linecap="round"/><polygon points="${star(63,35,12,5,8)}" fill="${fg}"/>`; break;
case '2.1': bg=full('#e53935'); sym=flame(); break;
case '2.2': bg=full('#2e9b4e'); fg=tx='#fff'; sym=`<rect x="41" y="34" width="18" height="36" rx="8" fill="${fg}"/><rect x="46" y="26" width="8" height="10" fill="${fg}"/><rect x="42" y="23" width="16" height="4" rx="1" fill="${fg}"/>`; break;
case '2.3': case '6.1': bg=full('#fff'); sym=`<circle cx="50" cy="35" r="12" fill="${fg}"/><rect x="44" y="43" width="12" height="9" rx="2" fill="${fg}"/><circle cx="45.5" cy="35" r="3.4" fill="#fff"/><circle cx="54.5" cy="35" r="3.4" fill="#fff"/><path d="M50 40 l-2 4 h4z" fill="#fff"/><path d="M36 52 L64 70 M64 52 L36 70" stroke="${fg}" stroke-width="4.5" stroke-linecap="round"/>`; break;
case '3': bg=full('#e53935'); sym=flame(); break;
case '4.1': bg=full('#fff'); for(let x=12;x<90;x+=10) bg+=`<rect x="${x}" width="5" height="100" fill="#e53935"/>`; sym=`<rect x="41" y="70" width="18" height="17" rx="3" fill="#fff"/>`+flame(); break;
case '4.2': bg=half('#fff','#e53935'); tx='#fff'; sym=flame(); break;
case '4.3': bg=full('#1976d2'); fg=tx='#fff'; sym=flame(); break;
case '5.1': bg=full('#fbc02d'); sym=ox(); break;
case '5.2': bg=half('#e53935','#fbc02d'); sym=ox(); break;
case '6.2': bg=full('#fff'); [90,210,330].forEach(a=>{ const x=50+11*Math.cos(a*Math.PI/180), y=46-11*Math.sin(a*Math.PI/180); sym+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9.5" fill="none" stroke="${fg}" stroke-width="3.4"/>`; }); sym+=`<circle cx="50" cy="46" r="3.5" fill="${fg}"/>`; break;
case '7': bg=half('#fbc02d','#fff'); sym=`<g fill="#111">${[90,210,330].map(a=>`<path d="${sector(50,42,6,22,a-30,a+30)}"/>`).join('')}<circle cx="50" cy="42" r="4.2"/></g><text x="50" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="6.6" fill="#111">RADIOACTIVE</text>`; break;
case '8': bg=half('#fff','#111'); tx='#fff'; sym=`<rect x="35" y="20" width="8" height="18" rx="3" fill="#111" transform="rotate(25 39 29)"/><rect x="57" y="20" width="8" height="18" rx="3" fill="#111" transform="rotate(-25 61 29)"/><circle cx="40" cy="42" r="2.4" fill="#111"/><circle cx="60" cy="42" r="2.4" fill="#111"/><path d="M34 60 L40 64 L46 59 L52 65 L58 60 L66 63" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`; break;
case '9': bg=full('#fff'); for(let x=19;x<85;x+=9.5) bg+=`<rect x="${x}" y="0" width="3.4" height="50" fill="#111"/>`; sym=`<line x1="40" x2="60" y1="90" y2="90" stroke="#111" stroke-width="2"/>`; break;
default: bg=full('#fff');
}
const t=`<text x="50" y="${k==='1'?78:k==='9'?86:85}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="${k==='1'?12:17}" fill="${tx}">${num}</text>`;
return H+'<defs><clipPath id="c"><polygon points="50,3 97,50 50,97 3,50"/></clipPath></defs><g clip-path="url(#c)">'+bg+'</g><polygon points="50,3 97,50 50,97 3,50" fill="none" stroke="#111" stroke-width="3.6" stroke-linejoin="round"/><polygon points="50,9 91,50 50,91 9,50" fill="none" stroke="#111" stroke-width="1.1" stroke-linejoin="round"/>'+sym+t+'</svg>';
}
function dgURL(div, imp){
const k = div + '|' + imp;
return _dgc[k] || (_dgc[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(dgLabelSVG(div, imp)));
}
let _inspK = null, _inspT = 0;
/* ملصق CAO الحقيقي (DANGER — DO NOT LOAD IN PASSENGER AIRCRAFT) بدقة عالية:
   كانفاس 1024 مع تنعيم عالي، ويُستخدم لشحنة واحدة فقط في الوردية. */
let _placardImg = null, _placardCv = null, _placardSig = null;
function placardTex(imp, div){
  const k = '_CAO_PLACARD';
  const sig = (imp || '') + '/' + (div || '');
  if(!_placardCv){ _placardCv = document.createElement('canvas'); _placardCv.width = _placardCv.height = 1024; }
  const ctx = _placardCv.getContext('2d');
  /* يُعاد الرسم عند تبديل الشحنة بين الورديات بدل تكديس خامات 1024² في ذاكرة الـGPU */
  const paint = () => {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#a67c52'; ctx.fillRect(0, 0, 1024, 1024);
    for(let i = 0; i < 2600; i++){
      const x = Math.random()*1024, y = Math.random()*1024;
      ctx.fillStyle = Math.random() > .5 ? 'rgba(50,30,15,.07)' : 'rgba(255,235,190,.08)';
      ctx.fillRect(x, y, Math.random()*34 + 4, 1.5);
    }
    ctx.strokeStyle = '#6c4e33'; ctx.lineWidth = 18; ctx.strokeRect(14, 14, 996, 996);
    ctx.fillStyle = '#caa77b'; ctx.fillRect(478, 0, 68, 1024);
    ctx.fillStyle = 'rgba(65,43,26,.35)'; ctx.fillRect(478, 0, 7, 1024); ctx.fillRect(539, 0, 7, 1024);
    ctx.fillStyle = '#f5f2e8'; ctx.fillRect(62, 54, 900, 914);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 14; ctx.strokeRect(62, 54, 900, 914);
    ctx.imageSmoothingQuality = 'high';
    if(_placardImg && _placardImg.complete) ctx.drawImage(_placardImg, 96, 78, 832, 726);
    else { ctx.fillStyle = '#e9a13a'; ctx.fillRect(96, 78, 832, 726); }
    ctx.fillStyle = '#c99b00'; ctx.fillRect(96, 812, 832, 62);
    ctx.fillStyle = '#1b1300'; ctx.font = '900 38px ui-monospace,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CAO · CARGO AIRCRAFT ONLY', 512, 845);
    ctx.fillStyle = '#20272c'; ctx.fillRect(96, 882, 832, 58);
    ctx.fillStyle = '#ffd54a'; ctx.font = '900 34px ui-monospace,monospace';
    ctx.fillText((imp || 'CAO') + '  ·  CLASS ' + (div || '—'), 512, 913);
    if(tc[k]) tc[k].needsUpdate = true;
  };
  if(sig !== _placardSig){
    _placardSig = sig;
    paint();
    if(!_placardImg || !_placardImg.complete){
      if(!_placardImg){
        _placardImg = new Image();
        _placardImg.decoding = 'async';
        _placardImg.src = 'game/images/cao-placard.png';
      }
      _placardImg.addEventListener('load', paint, { once: true });
    }
  }
  return tc[k] || (tc[k] = rawTex(_placardCv));
}
/* خامة الطرد المجمّد: صندوق عازل أبيض مزرق بشريط لاصق، وعليه ملصق تجميد كبير (ندفة ثلج + FRZ + ≤ −18°C) */
function frzTex(){
const cv = document.createElement('canvas'); cv.width = cv.height = 512;
const g = cv.getContext('2d');
const base = g.createLinearGradient(0, 0, 0, 512); base.addColorStop(0, '#eef8fc'); base.addColorStop(1, '#cfe6ef');
g.fillStyle = base; g.fillRect(0, 0, 512, 512);
for(let i=0;i<1100;i++){ g.fillStyle = Math.random() > .5 ? 'rgba(255,255,255,.55)' : 'rgba(110,160,185,.10)'; g.fillRect(Math.random()*512, Math.random()*512, Math.random()*20+2, 2); }
g.strokeStyle = '#7fb0c6'; g.lineWidth = 10; g.strokeRect(8, 8, 496, 496);
// شريط لاصق أزرق عمودي
g.fillStyle = '#2f7da3'; g.fillRect(238, 0, 36, 512);
g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(242, 0, 4, 512);
// الملصق: ورقة بيضاء بإطار أزرق وشريط علوي
const x = 46, y = 52, w = 420, h = 408, r = 22;
g.save();
g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 14; g.shadowOffsetY = 5;
g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.fill();
g.restore();
g.lineWidth = 12; g.strokeStyle = '#1a6fa3'; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.stroke();
g.fillStyle = '#1a6fa3'; g.fillRect(x + 6, y + 6, w - 12, 62);
g.fillStyle = '#fff'; g.font = '900 38px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('KEEP FROZEN', 256, y + 38);
// ندفة ثلج مرسومة بالخطوط
g.save(); g.translate(256, 196); g.strokeStyle = '#1a6fa3'; g.lineCap = 'round'; g.lineWidth = 9;
for(let k=0;k<6;k++){
g.rotate(Math.PI / 3);
g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -66); g.stroke();
g.lineWidth = 6;
g.beginPath(); g.moveTo(0, -30); g.lineTo(-18, -46); g.moveTo(0, -30); g.lineTo(18, -46); g.stroke();
g.beginPath(); g.moveTo(0, -50); g.lineTo(-12, -62); g.moveTo(0, -50); g.lineTo(12, -62); g.stroke();
g.lineWidth = 9;
}
g.restore();
g.fillStyle = '#0f3347'; g.font = '900 104px monospace'; g.fillText('FRZ', 256, 330);
g.fillStyle = '#c0392b'; g.fillRect(x + 6, 378, w - 12, 50);
g.fillStyle = '#fff'; g.font = '900 33px monospace'; g.fillText('≤ −18°C • DO NOT THAW', 256, 404);
const t = rawTex(cv); t.anisotropy = 4; return t;
}
function tex(it, placard){
const isCao = it[0][0] === 'h' && gameRules.cao.isCao(it[3]);
if(placard && isCao) return placardTex(it[3], it[4]);
const k = it[2] + '_' + it[3] + (isCao ? '_CAO' : '');
if(tc[k]) return tc[k];
if(it === MYS) return tc[k] = mysTex();
if(it === FRZ_RAW) return tc[k] = frzTex();
const cv = document.createElement('canvas'); cv.width = cv.height = 512;
const ctx = cv.getContext('2d');
ctx.fillStyle = '#a67c52'; ctx.fillRect(0,0,512,512);
for(let i=0;i<1600;i++){
const x=Math.random()*512, y=Math.random()*512;
ctx.fillStyle = Math.random()>.5 ? 'rgba(50,30,15,.08)' : 'rgba(255,235,190,.09)';
ctx.fillRect(x,y,Math.random()*28+3,1);
}
ctx.strokeStyle='#6c4e33'; ctx.lineWidth=10; ctx.strokeRect(8,8,496,496);
ctx.fillStyle='#caa77b'; ctx.fillRect(238,0,36,512);
ctx.fillStyle='rgba(65,43,26,.35)'; ctx.fillRect(238,0,4,512); ctx.fillRect(270,0,4,512);
ctx.fillStyle='#f5f2e8'; ctx.fillRect(34,30,444,452);
ctx.strokeStyle='#222'; ctx.lineWidth=8; ctx.strokeRect(34,30,444,452);
if(isCao){ ctx.strokeStyle='#c99b00'; ctx.lineWidth=12; ctx.strokeRect(44,40,424,432); }
ctx.textAlign='center'; ctx.textBaseline='middle';
if(it[0][0] === 'h'){
const div=it[4];
ctx.fillStyle= isCao ? '#c99b00' : '#24292d'; ctx.fillRect(42,38,428,66);
ctx.fillStyle= isCao ? '#1b1300' : '#fff'; ctx.font='bold 27px sans-serif'; ctx.fillText(isCao ? 'CAO · CARGO AIRCRAFT ONLY' : 'DANGEROUS GOODS  •  IATA',256,72);
const lbl = new Image();
lbl.onload = () => { ctx.drawImage(lbl, 131, 108, 250, 250); if(tc[k]) tc[k].needsUpdate = true; };
lbl.src = dgURL(div, it[3]);
ctx.fillStyle='#20272c'; ctx.fillRect(42,366,428,54);
ctx.fillStyle='#fff'; fit(ctx,it[2],400,31); ctx.fillText(it[2],256,393);
ctx.fillStyle='#a82c28'; ctx.font='900 31px monospace'; ctx.fillText('CLASS  '+div,256,450);
ctx.fillStyle='#20272c'; ctx.font='bold 22px monospace'; ctx.fillText('IMP CODE: '+it[3],256,478);
} else {
ctx.fillStyle='#26343b'; ctx.fillRect(42,38,428,60);
ctx.fillStyle='#fff'; ctx.font='bold 29px sans-serif'; ctx.fillText('AIR CARGO  •  HANDLE WITH CARE',256,68);
ctx.font='145px sans-serif'; ctx.fillText(it[1],256,238);
ctx.fillStyle='#20272c'; ctx.font='bold 38px sans-serif'; fit(ctx,it[2],410,38); ctx.fillText(it[2],256,365);
ctx.fillStyle='#9e6b3c'; ctx.font='900 34px monospace'; ctx.fillText(it[3]+' / '+it[4],256,430);
ctx.fillStyle='#222'; ctx.font='bold 22px sans-serif'; ctx.fillText('KEEP THIS SIDE VISIBLE',256,470);
}
ctx.fillStyle='#171b1e';
for(let i=0;i<30;i++){ const x=55+i*7.1; ctx.fillRect(x,486, i%4===0?4:2,18); }
const t=rawTex(cv);
return tc[k]=t;
}
const BOXG = new THREE.BoxGeometry(1.35, 1.35, 1.35), EDGEG = new THREE.EdgesGeometry(BOXG);
const HVS = 1.18;   // مقياس الطرد الثقيل
const EDGEM = new THREE.LineBasicMaterial({color:0x2b1a0d, transparent:true, opacity:0.5});
const SHT = canvasTex(128, 128, (g, w, h) => { const gr=g.createRadialGradient(w/2,h/2,w*.2,w/2,h/2,w/2); gr.addColorStop(0,'rgba(0,0,0,.6)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
SHT.wrapS = SHT.wrapT = THREE.ClampToEdgeWrapping;
const SHM = new THREE.MeshBasicMaterial({map:SHT, transparent:true, depthWrite:false});
const BH = 0.675;
const MYS = ['mys','🎁',I18N.t('صندوق مفاجآت'),'???','?'];
function mysTex(){
const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
const gr = g.createLinearGradient(0,0,512,512); gr.addColorStop(0,'#ffd54a'); gr.addColorStop(1,'#ff9800'); g.fillStyle = gr; g.fillRect(0,0,512,512);
g.fillStyle = 'rgba(255,255,255,.2)'; for(let i=0;i<16;i++){ g.beginPath(); g.arc(Math.random()*512, Math.random()*512, 6+Math.random()*14, 0, 6.3); g.fill(); }
g.fillStyle = '#7b1fa2'; g.fillRect(226,0,60,512); g.fillRect(0,226,512,60);
g.fillStyle = '#ab47bc'; g.fillRect(236,0,12,512); g.fillRect(0,236,512,12);
g.strokeStyle = '#4a148c'; g.lineWidth = 14; g.strokeRect(7,7,498,498);
g.fillStyle = '#fff'; g.beginPath(); g.arc(256,256,120,0,6.3); g.fill(); g.lineWidth = 10; g.stroke();
g.fillStyle = '#7b1fa2'; g.font = '900 190px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?',256,270);
const t = rawTex(cv); return t;
}
let slowT = 0;
/* إبطاء الحزام: زر فيزيائي بجوار الحزام، يُستخدم مرّة واحدة، يبطئ ٣٠ ثانية */
const BELT_BTN_XZ = { x: 22.8, z: 9.95 };
let beltSlowT = 0, beltSlowUsed = false;
function useBeltSlow(){
  if(beltSlowUsed || !run || fire.active) return;
  beltSlowUsed = true; beltSlowT = 30;
  snd('ship'); toast('🐢 الحزام يبطؤ ٣٠ ثانية', '#80d8ff');
  hud();
}
const beltRay = new THREE.Raycaster(), beltNdc = new THREE.Vector2();
R.domElement.addEventListener('pointerdown', e => {
  if(!run || fire.active || introHold || caoQ.active || frzP.active || cardP.active || uldP.active) return;
  const r = R.domElement.getBoundingClientRect();
  beltNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  beltRay.setFromCamera(beltNdc, C);
  if(beltRay.intersectObjects(beltBtnGroup.children, false).length){ useBeltSlow(); return; }
  /* نقرة الفأرة الأساسية على الملعب = التقاط/تفاعل (اللمس يبقى على أزراره) */
  if(e.pointerType === 'mouse' && e.button === 0) act();
});
function mystery(it){
rm(it);
const r = Math.random();
if(r < 0.25){ time += 12; snd('ship'); spawnFloatTag(I18N.T('+12 ث ⏱','+12s ⏱'),'#64ffda'); toast('🎁 مفاجأة: +12 ثانية','#64ffda'); }
else if(r < 0.5){ score += 60; snd('ship'); toast('🎁 مفاجأة: +60 نقطة','#ffd54a'); }
else if(r < 0.7){ combo = gameRules.economy.comboMax; snd('ship'); toast('🎁 مفاجأة: كومبو ×5 🔥','#ff9800'); }
else if(r < 0.85){ slowT = 8; snd('ship'); toast('🎁 مفاجأة: الحزام يبطؤ ٨ ثوانٍ 🐢','#80d8ff'); }
else { time = Math.max(0, time - 6); snd('error'); spawnFloatTag(I18N.T('-6 ث','-6s'),'#ff5252'); toast('💥 مفاجأة سيئة: -6 ثوانٍ','#ff5252'); }
hud();
}
/* المفتش يسأل عن شحنات CAO ثلاث مرات فقط في الوردية.
   لذلك نحدّ ظهور شحنات CAO بنفس العدد: لا شحنة تُمرّ بلا سؤال ولا سؤال زائد. */
const caoRun = { spawned: 0, placardUsed: false };
/* ===== جدولة أحداث الوردية عشوائياً بلا تعارض =====
   • المفتش (أسئلة CAO) ثلاث مرات في أوقات عشوائية متباعدة، وجولاته مرتبطة بالتباعد نفسه.
   • إنذار الحريق مرة واحدة في وقت عشوائي، ولا يبدأ إلا حين لا يكون هناك مفتش أو سؤال أو شاحنة أو لغز أو قيادة رافعة. */
const evt = { t: 0, fireAt: 70, caoAt: [30, 75, 130], caoIdx: 0, patrol: 0, lastInsp: -999, heavyAt: 50, quizAt: [40, 90], quizIdx: 0 };
const rnd = (a, b) => a + Math.random() * (b - a);
function evtReset(){
  evt.t = 0; evt.caoIdx = 0; evt.patrol = 0; evt.lastInsp = -999;
  evt.caoAt = [rnd(15, 40), rnd(60, 90), rnd(110, 145)];
  let f = rnd(45, 110);
  for(let i = 0; i < 30 && evt.caoAt.some(c => Math.abs(c - f) < 22); i++) f = rnd(45, 120);
  evt.fireAt = f;
  evt.heavyAt = rnd(gameRules.heavy.window[0], gameRules.heavy.window[1]);
  evt.quizIdx = 0;
  evt.quizAt = window.InspectorQuiz ? InspectorQuiz.schedule(Math.random, evt.caoAt.concat([evt.fireAt])) : [];
}
function evtAllowPatrol(){
  return evt.patrol < 3 && evt.t >= 14 && evt.t - evt.lastInsp >= 40 && !items.some(i => i.data.cao && !i.caoChecked);
}
function fireSafe(){
  return time > 20 && !(window.Prog && Prog.busy()) && !jam.active && !cardP.active && !uldP.active && !inspector.active && !caoQ.active && !truckState.active && !STUDY.on && !FD.on && !frzP.active && !FRZ.pending &&
    !introHold && !liftAnim.active && rushN === 0 && !items.some(i => i.data.cao && !i.caoChecked) && evt.t - evt.lastInsp >= 12;
}
function caoSwap(raw){
  const pool = HZ.filter(h => !gameRules.cao.isCao(h[3]));
  return pool[Math.random() * pool.length | 0] || raw;
}
function resetCaoRun(){
  caoRun.spawned = 0; caoRun.placardUsed = false;
}
/* مسافة دنيا بين صندوقين على الحزام: لا يتداخلان أبداً (الصندوق الخلفي ينتظر خلف الأمامي حين يبطؤ الحزام أو يتوقف) */
const BELT_GAP = 1.6;
function spawn(){
const bsp = gameRules.layout.beltSpawn();
if(items.some(i => i.st === 'belt' && i.m.position.x < bsp.x + BELT_GAP)) return false;   // نقطة الدخول مشغولة: انتظر
const list = stage===4 ? HZ : ((stage>=2 && Math.random() < (stage===3?0.6:0.45)) ? HZ : I);
let raw = (stage>=2 && stage<4 && Math.random() < 0.13 && !items.some(i => i.data.isMys)) ? MYS : list[Math.random()*list.length | 0];
/* طرد مجمّد عشوائي: واحد فقط في كل مرة، ولا يظهر أثناء حمل/انتظار لغز الباب */
if(raw !== MYS && gameRules.freezer.shouldSpawn({ processed: totalProcessed, present: items.some(i => i.data.isFrz) || frzP.active, rng: Math.random })) raw = FRZ_RAW;
/* شحنات CAO (أسئلة المفتش) تظهر فقط في الأوقات المجدولة العشوائية (٣ مرات) ومتباعدة؛ غير ذلك تُستبدل بشحنة خطرة عادية */
const caoDue = evt.caoIdx < gameRules.cao.maxAsks && evt.t >= evt.caoAt[evt.caoIdx] && !fire.active && !inspector.active && !caoQ.active &&
  !items.some(i => i.data.cao && !i.caoChecked) && evt.t - evt.lastInsp >= 25;
if(caoDue){
  const pool = HZ.filter(h => gameRules.cao.isCao(h[3]));
  if(pool.length){ raw = pool[Math.random() * pool.length | 0]; evt.caoIdx++; }
} else if(raw[0][0]==='h' && gameRules.cao.isCao(raw[3])) raw = caoSwap(raw);
const caoParcel = raw[0][0]==='h' && gameRules.cao.isCao(raw[3]);
/* الشحنة الأولى فقط تحمل لوحة DANGER الحقيقية بدقة عالية */
const placard = caoParcel && !caoRun.placardUsed;
if(caoParcel){ caoRun.spawned++; if(placard) caoRun.placardUsed = true; }
const itObj = { t:raw[0], emoji:raw[1], name:raw[2], imp:raw[3], div:raw[4], isHz:raw[0][0]==='h', isMys:raw===MYS, isFrz:raw===FRZ_RAW, cao: caoParcel, placard };
const m = new THREE.Mesh(BOXG, new THREE.MeshStandardMaterial({map:tex(raw, placard), roughness:0.5, metalness:0.05}));
m.castShadow = true; m.receiveShadow = true; const bs = gameRules.layout.beltSpawn(); m.position.set(bs.x, bs.y, bs.z);
m.add(new THREE.LineSegments(EDGEG, EDGEM));
const csh = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), SHM);
csh.rotation.x = -Math.PI/2; csh.position.y = -BH + 0.015; m.add(csh);
S.add(m);
const it = {m, data:itObj, st:'belt', csh};
makeCrit(it);
items.push(it);
if(window.Prog) Prog.onSpawn(it);   // شحنة VIP عند حدث الوردية
}
/* ===== طرد حرج بمؤقت تفجير (15%) ===== */
/* المؤقت خاص بطرود سلسلة التبريد (❄️) فقط. نسبة الاختيار 45% من طرود التبريد
   ≈ 15% من إجمالي الطرود العادية (التبريد ثلث قائمة الشحن العادي) */
const CRIT_CHANCE = .45, CRIT_TIME = gameRules.economy.critTime, CRIT_PENALTY = gameRules.economy.critPenalty;
const critHaloTex = canvasTex(128, 128, (g, w, h) => {
const gr = g.createRadialGradient(w/2, h/2, w*.1, w/2, h/2, w/2);
gr.addColorStop(0, 'rgba(255,70,40,.9)'); gr.addColorStop(.55, 'rgba(255,100,30,.35)'); gr.addColorStop(1, 'rgba(255,40,0,0)');
g.fillStyle = gr; g.beginPath(); g.arc(w/2, h/2, w/2, 0, Math.PI*2); g.fill();
});
const smokeTex = canvasTex(64, 64, (g, w, h) => {
const gr = g.createRadialGradient(w/2, h/2, 2, w/2, h/2, w/2);
gr.addColorStop(0, 'rgba(78,78,78,.8)'); gr.addColorStop(1, 'rgba(46,46,46,0)');
g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
function critTagCanvas(){
const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
const t = rawTex(cv);
return { cv, t, sec: -1 };
}
/* ساعة عقارب صغيرة بدل الرقم: القطاع الملوّن هو الوقت المتبقي والعقرب يدور معه، وتحمرّ في آخر ٥ ثوانٍ */
function drawCritTag(tag, tleft){
const g = tag.cv.getContext('2d'), w = tag.cv.width, c = w / 2;
const f = Math.max(0, Math.min(1, tleft / CRIT_TIME)), urgent = tleft <= 5, a = -Math.PI / 2 + f * Math.PI * 2;
g.clearRect(0, 0, w, w);
g.beginPath(); g.arc(c, c, 58, 0, Math.PI * 2); g.fillStyle = urgent ? '#fff1f0' : '#fffdf2'; g.fill();
g.lineWidth = 9; g.strokeStyle = urgent ? '#e53935' : '#1d2b3a'; g.stroke();
if(f > 0.002){ g.beginPath(); g.moveTo(c, c); g.arc(c, c, 47, -Math.PI / 2, a); g.closePath(); g.fillStyle = urgent ? 'rgba(229,57,53,.88)' : 'rgba(255,193,7,.9)'; g.fill(); }
g.strokeStyle = '#1d2b3a'; g.lineWidth = 3; g.lineCap = 'round';
for(let i = 0; i < 12; i++){ const t = i * Math.PI / 6, r1 = i % 3 ? 49 : 45, r2 = 53; g.beginPath(); g.moveTo(c + Math.cos(t) * r1, c + Math.sin(t) * r1); g.lineTo(c + Math.cos(t) * r2, c + Math.sin(t) * r2); g.stroke(); }
g.strokeStyle = '#10161d'; g.lineWidth = 7; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * 42, c + Math.sin(a) * 42); g.stroke();
g.beginPath(); g.arc(c, c, 7, 0, Math.PI * 2); g.fillStyle = '#10161d'; g.fill();
tag.sec = Math.round(Math.max(0, tleft) * 8); tag.t.needsUpdate = true;
}
function makeCrit(it){
// المؤقت للطرود التي تحتاج سلسلة تبريد فقط (منطقة ❄️ تبريد) — لا للطرود العامة أو القابلة للتلف
if(it.data.t !== 'cold' || it.data.isFod || it.data.isMys) return;
if(Math.random() >= CRIT_CHANCE || items.some(i => i.crit)) return;
const halo = new THREE.Sprite(new THREE.SpriteMaterial({map:critHaloTex, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
halo.position.y = .05; halo.scale.set(2.3, 2.3, 1); it.m.add(halo);
const tag = critTagCanvas();
const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tag.t, transparent:true, depthTest:false}));
sp.position.y = 1.4; sp.scale.set(.82, .82, 1); sp.renderOrder = 6; it.m.add(sp);
drawCritTag(tag, CRIT_TIME);
it.crit = { t: CRIT_TIME, halo, tag, sp };
}
function clearCrit(it){
if(!it.crit) return;
it.m.remove(it.crit.halo); it.m.remove(it.crit.sp);
it.crit.halo.material.dispose(); it.crit.sp.material.dispose(); it.crit.tag.t.dispose();
it.crit = null;
}
function smokePuff(x, y, z){
for(let i=0; i<8; i++){
const sm = new THREE.MeshBasicMaterial({map:smokeTex, transparent:true, opacity:.85, depthWrite:false});
const s = new THREE.Sprite(sm);
s.position.set(x + (Math.random()-.5)*.7, y + Math.random()*.35, z + (Math.random()-.5)*.7);
const sc = .5 + Math.random()*.6; s.scale.set(sc, sc, 1);
S.add(s);
const vx = (Math.random()-.5)*1.1, vy = .9 + Math.random()*.9, vz = (Math.random()-.5)*1.1;
let life = 0, lastT = performance.now();
const tick = () => {
const nowT = performance.now(), d = Math.min(.05, (nowT - lastT) / 1000); lastT = nowT;
life += d;
s.position.x += vx*d; s.position.y += vy*d; s.position.z += vz*d;
sm.opacity = Math.max(0, .85 * (1 - life/1.35));
const grow = 1 + life*1.4; s.scale.set(sc*grow, sc*grow, 1);
if(life < 1.35) requestAnimationFrame(tick);
else { S.remove(s); sm.dispose(); }
};
requestAnimationFrame(tick);
}
}
function critExplode(it){
if(!it.crit) return;
smokePuff(it.m.position.x, it.m.position.y + .2, it.m.position.z);
const lost = Math.min(score, CRIT_PENALTY);
score = Math.max(0, score - CRIT_PENALTY);
streak = 0; streakT = 0; combo = 1;
totalProcessed++;
logMistake({ k: 'chill', a: it.data, pts: CRIT_PENALTY });
addShake(.6); snd('error');
hitStopNow(.05); screenFlash('red');
penaltyFx(lost, true);
spawnFloatTag('−' + CRIT_PENALTY, '#ff5252', 'big');
toast(I18N.T('☠️ انفجر طرد مبرّد قبل فرزه! -', '☠️ A chilled parcel spoiled before sorting! -') + CRIT_PENALTY + I18N.T(' نقطة',' pts'), '#ff5252');
clearCrit(it); rm(it); hud();
}
/* موارد FOD تُبنى مرة واحدة وتُشارك بين كل الأجسام المتساقطة (بلا تسرّب ذاكرة GPU) */
let FOD_RES = null;
function fodRes(){
if(FOD_RES) return FOD_RES;
const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
const g = cv.getContext('2d'); g.fillStyle='#ffd54a';g.fillRect(0,0,128,64);g.fillStyle='#17252b';g.font='900 40px monospace';g.textAlign='center';g.fillText('FOD',64,46);
return FOD_RES = {
  box: new THREE.BoxGeometry(.5,.3,.7), torus: new THREE.TorusGeometry(.28,.09,6,6), sh: new THREE.PlaneGeometry(1.2,1.2),
  mat: new THREE.MeshStandardMaterial({color:0x94aebc,metalness:.7,roughness:.35}),
  label: new THREE.SpriteMaterial({map:rawTex(cv),depthTest:false})
};
}
/* ثلاثة أشكال للجسم الغريب، يتبدّل الشكل مع كل عبور للرافعة المتهورة: صامولة ومسمار، مفتاح ربط، قطعة إطار */
const FOD_KINDS = [
  { ar: 'مسمار وصامولة', en: 'Bolt and nut', ico: '🔩' },
  { ar: 'مفتاح ربط', en: 'Dropped wrench', ico: '🔧' },
  { ar: 'قطعة إطار', en: 'Tyre fragment', ico: '⚙️' }
];
function dropFod(x,z,trip){
const R_ = fodRes(), kind = (trip || 0) % FOD_KINDS.length;
let m;
if(kind === 1){
  m = new THREE.Mesh(new THREE.BoxGeometry(.95,.1,.2), R_.mat);
  const head = new THREE.Mesh(new THREE.TorusGeometry(.17,.065,8,12,Math.PI*1.6), R_.mat);
  head.rotation.x = Math.PI/2; head.rotation.z = -Math.PI*.3; head.position.set(.52,0,0); m.add(head);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(.1,.05,8,10), R_.mat); eye.rotation.x = Math.PI/2; eye.position.set(-.5,0,0); m.add(eye);
  m.rotation.y = Math.random()*Math.PI;
} else if(kind === 2){
  if(!R_.rubber) R_.rubber = new THREE.MeshStandardMaterial({color:0x1b1b1d,roughness:.95,metalness:0});
  m = new THREE.Mesh(new THREE.BoxGeometry(.8,.2,.42), R_.rubber);
  for(let i=-3;i<=3;i++){ const r = new THREE.Mesh(new THREE.BoxGeometry(.07,.06,.46), R_.rubber); r.position.set(i*.11,.12,0); r.rotation.y = .35; m.add(r); }
  m.rotation.y = Math.random()*Math.PI;
} else {
  m = new THREE.Mesh(R_.box, R_.mat);
  const nut = new THREE.Mesh(R_.torus, R_.mat);
  nut.rotation.x=Math.PI/2; nut.position.set(.15,.15,0); m.add(nut);
}
m.position.set(x,1.2,z); m.castShadow = true; m.receiveShadow = true;
const label = new THREE.Sprite(R_.label);label.position.y=.6;label.scale.set(.95,.48,1);m.add(label);
const csh=new THREE.Mesh(R_.sh,SHM);csh.rotation.x=-Math.PI/2;csh.position.y=-.13;m.add(csh);
const K = FOD_KINDS[kind];
S.add(m);items.push({m,csh,data:{t:'fod',emoji:K.ico,name:I18N.T(K.ar,K.en),imp:'FOD',div:'',isFod:true,isHz:false,isMys:false},st:'floor',fall:true,vy:0,ty:.2});
snd('place');tip('foddrop', K.ico + ' ' + I18N.T('سقط جسم غريب FOD: ' + K.ar + '!', 'FOD dropped: ' + K.en + '!'), '#ffd54a');
}
function resetTruck(){ truckState=gameRules.reset();fearT=0;recklessTruck.visible=false; }
function updateTruck(dt){
fearT=Math.max(0,fearT-dt);
const steps=Math.max(1,Math.ceil(dt/.016)), step=dt/steps;
/* عوائق تتفاداها الرافعة المتهورة: المفتش والرافعة الشوكية (التي يقودها اللاعب أو المتوقفة) */
const obs=[{x:fk.position.x,z:fk.position.z,r:FK_HX}];
if(inspector.active && inspector.g.visible) obs.push({x:inspector.g.position.x,z:inspector.g.position.z,r:.7});
/* اللاعب الماشي عائق أيضاً: تنحرف عنه بدل أن تصدمه (أثناء القيادة يكفي عائق الرافعة أعلاه) */
if(!FD.on) obs.push(gameRules.playerObstacle(px.x, px.z));
for(let i=0;i<steps;i++){
gameRules.dodge(truckState,step,obs);
const before=gameRules.position(truckState), event=gameRules.advance(truckState,step,px.z), after=gameRules.position(truckState);
if(event.entered){snd('horn');addShake(.35);tip('forklift' + (event.trip || 0), '⚠️ رافعة متهورة تعبر المستودع!' + (event.trip ? ' (' + (event.trip + 1) + '/3)' : ''), '#ffd54a');}
if(event.drop) dropFod(after.x,after.z,event.trip);
if(!demo.truck && !FD.on && truckState.active && !truckState.hit && gameRules.touches(before.x,before.z,after.x,after.z,px.x,px.z)){
truckState.hit=true;fearT=gameRules.fearDuration;progEmit('hit');snd('bump');tip('bump', '😨 اصطدام! حركة أبطأ مؤقتًا', '#ffd54a');
}
}
if(demo.truck && truckState.done){ demo.truck=false; demo.truckDone=true; if(demo.inspDone) saveTutorialDone(); hideIntro(); }
const pos=gameRules.position(truckState);
if(window.Prog) Prog.truckTick(pos, truckState);   // النجاة في اللحظة الأخيرة
recklessTruck.visible=truckState.active;recklessTruck.position.set(pos.x,0,pos.z);recklessTruck.rotation.y=pos.yaw;
// اهتزاز كاميرا خفيف عند مرور الرافعة المتهورة قرب اللاعب
if(truckState.active && Math.abs(pos.x - px.x) < 7 && Math.abs(pos.z - px.z) < 5) addShake(dt * 1.8);
recklessTruck.rotation.z=truckState.active && !truckState.turned && truckState.x===0 ? -.12 : 0;
truckDriver.rotation.z=Math.sin(truckState.elapsed*18)*.04;
}
const $ = id => document.getElementById(id);
/* الخروج من اللعب: العودة إلى غلاف اللعبة (index.html) وليس البقاء داخل الإطار */
function exitToShell(){
try {
if(window.parent && window.parent !== window){ window.parent.postMessage({ type: 'acg-exit' }, location.origin); return; }
} catch(e){}
location.href = 'index.html';
}
let tt;
function toast(t, col, ms){
const e = $('toast'); e.textContent = I18N.t(t); e.style.color = col; e.style.opacity = 1;
e.style.transform = 'translateX(-50%) scale(1.05)';
clearTimeout(tt);
tt = setTimeout(() => { e.style.opacity = 0; e.style.transform = 'translateX(-50%) scale(1)'; }, ms || 1300);
}
function spawnFloatTag(txt, col, tier){
const el = document.createElement('div');
const raw = String(txt).trim();
el.className = 'float-tag ' + (/^[-−]/.test(raw) ? 'neg' : 'pos') + (tier === 'big' ? ' big' : '');
el.textContent = I18N.t(txt); el.style.color = col;
el.style.left = '50%'; el.style.top = '44%';
$('floating-fx').appendChild(el);
setTimeout(() => el.remove(), tier === 'big' ? 1000 : 850);
}
/* خصم النقاط: شارة −N تحت عدّاد النقاط + وميض أحمر واضح */
function penaltyFx(n, hz){
const fx = $('floating-fx'), box = $('scbox'), stage = $('stage');
if(!fx) return;
const tag = document.createElement('div');
tag.className = 'penalty-tag' + (hz ? ' hz' : '');
tag.innerHTML = '<b>−' + n + '</b><i>' + (hz ? I18N.t('مادة خطرة فاتت') : I18N.t('طرد فات')) + '</i>';
if(box && stage){
const r = box.getBoundingClientRect(), s = stage.getBoundingClientRect();
tag.style.left = (r.left - s.left + r.width / 2) + 'px';
tag.style.top = (r.bottom - s.top + 8) + 'px';
}
fx.appendChild(tag);
setTimeout(() => tag.remove(), 1400);
if(box){
box.classList.remove('hit'); void box.offsetWidth; box.classList.add('hit');
clearTimeout(penaltyFx.t);
penaltyFx.t = setTimeout(() => box.classList.remove('hit'), 1000);
}
const st = $('stage');
if(st){
st.classList.remove('penalty'); void st.offsetWidth; st.classList.add('penalty');
clearTimeout(penaltyFx.v);
penaltyFx.v = setTimeout(() => st.classList.remove('penalty'), 900);
}
}
function hud(){
$('sc').textContent = score;
const stageIcons = ['','🎓','🚀','⚡','🏁'];
const stgTxt = $('stgtxt'), stgFill = $('stgfill');
/* شارة المرحلة: أيقونة في ميدالية + العنوان + العدّاد (نصوص داخلية فقط، لا مدخلات مستخدم) */
const stgSet = (ico, label, num) => { stgTxt.innerHTML = `<i class="sg-ico">${ico}</i><span class="sg-l">${label}</span>` + (num ? `<span class="sg-n">${num}</span>` : ''); };
if(stage < 4){
const prog = gameRules.layout.stageProgress(stage, score), cap = prog.cap;
const shown = prog.shown;
if(stgTxt) stgSet(stageIcons[stage], `${I18N.T('المرحلة','Stage')} ${stage}`, `${shown}/${cap}`);
if(stgFill) stgFill.style.width = prog.percent + '%';
$('stg').classList.remove('final'); $('stg').title = '';
} else {
if(stgTxt){ stgSet('🏁', I18N.T('المرحلة ٤','Stage 4'), I18N.T('خبير ⭐','Expert ⭐')); $('stg').title = I18N.t('🏁 المرحلة ٤ • مستوى الخبراء — مواد خطرة فقط'); }
if(stgFill) stgFill.style.width = '100%';
$('stg').classList.add('final');
}
$('cb').textContent = '×' + combo;
setDashButton();
$('cbbox').classList.toggle('hot', combo >= 3);
const stkOn = streak >= 2 && streakT > 0;
$('streak').classList.toggle('on', stkOn);
if(stkOn) $('stkbar').style.width = Math.max(0, Math.min(100, (streakT / streakWindow()) * 100)) + '%';
const tsec = Math.max(0, Math.ceil(time));
$('tm').textContent = String(Math.floor(tsec/60)).padStart(2,'0') + ':' + String(tsec%60).padStart(2,'0');
$('tmbox').classList.toggle('urgent', time <= 20);
const insp = $('inspect');
const shownItem = held ? held.data : (!liftAnim.active && near ? near.data : null);
if(shownItem){
insp.style.display = 'flex';
insp.classList.remove('fade');
insp.style.borderColor = shownItem.isHz ? '#ff5252' : shownItem.isMys ? '#ffd54a' : '';
_inspT = performance.now();
if(_inspK !== shownItem){
_inspK = shownItem; const nd = shownItem;
insp.innerHTML = nd.isHz
? `<img class="dgl" alt="" src="${dgURL(nd.div, nd.imp)}"><div class="hc">${nd.imp}, <b>${nd.div}</b></div>`
: nd.isMys ? `<div class="emo">${nd.emoji}</div><div class="hc"><b>???</b></div>`
: `<div class="emo">${nd.emoji}</div><div class="hc">${nd.imp}, <b>${nd.div}</b></div>`;
}
} else if(_inspT && performance.now() - _inspT < 6000){
insp.style.display = 'flex';
insp.classList.add('fade');
} else { insp.style.display = 'none'; insp.classList.remove('fade'); _inspK = null; _inspT = 0; }
$('act').classList.toggle('held', !!held);
const dv = $('drv');
if(dv){
dv.style.display = FD.on ? 'flex' : 'none';
dv.classList.toggle('drive', FD.on);
if(FD.on){
/* بطارية تنتهي مع مهلة القيادة بدل رسالة في منتصف الشاشة */
const pct = Math.max(0, Math.min(1, FD.left / 60));
const fill = $('drvfill');
if(fill){
fill.style.width = (pct * 100).toFixed(1) + '%';
fill.style.background = pct > .5 ? '#3ddc84' : pct > .2 ? '#ffc93c' : '#ff5a52';
}
dv.classList.toggle('low', FD.left <= 12);
dv.setAttribute('aria-label', I18N.T('قيادة الرافعة — المتبقي ','Forklift — left: ') + Math.ceil(FD.left) + I18N.T(' ث (اضغط للنزول)','s (tap to get off)'));
}
}
}
/* ===== مراجعة جدول الفرز: ١٠ ثوانٍ مجانية تُستهلك فقط أثناء الوقوف أمام اللوحة ===== */
let studyKey = '';
function openStudy(){
const el = $('study'); if(!el) return;
el.classList.add('on'); el.setAttribute('aria-hidden', 'false');
document.body.classList.add('study-mode');
/* منظور أول: إخفاء الموظف كاملاً (بما فيه الخوذة) كي لا يحجب اللوحة أثناء القراءة */
pl.visible = false;
if(studyKey !== I18N.lang){
studyKey = I18N.lang;
$('study-title').textContent = I18N.T('جدول الفرز — IATA DGR 9.3.A', 'Segregation table — IATA DGR 9.3.A');
$('study-foot').textContent = I18N.T('🚶 تراجع خطوة للعودة إلى اللعبة', '🚶 Step back to resume the shift');
}
snd('ok', 1.1);
}
function closeStudy(){
const el = $('study'); if(!el) return;
el.classList.remove('on'); el.setAttribute('aria-hidden', 'true');
document.body.classList.remove('study-mode');
if(!FD.on && !EXIT_GATE.active) pl.visible = true;
}
function updateStudy(dt){
const ZB = STUDY.box;
const inZone = run && !fire.active && !fire.keypad && !EXIT_GATE.active && !introHold && !FD.on &&
Math.abs(px.x - ZB.x) <= ZB.hx && Math.abs(px.z - ZB.z) <= ZB.hz;
STUDY.inZone = inZone;
if(!STUDY.inZone && STUDY.on){ STUDY.on = false; closeStudy(); }
if(!STUDY.on && inZone && STUDY.left > 0){
STUDY.on = true; openStudy();
tip('iataBoard', '📋 لوحة جدول الفرز — مراجعة مجانية ١٠ ثوانٍ', '#64ffda');
}
if(!STUDY.on) return;
STUDY.left = Math.max(0, STUDY.left - dt);
const tm = $('study-time');
if(tm) tm.textContent = '⏱ ' + Math.ceil(STUDY.left) + I18N.T(' ث', 's');
if(STUDY.left <= 0){
STUDY.on = false; closeStudy();
toast(I18N.T('⏱ انتهى وقت المراجعة — عُد إلى الوردية', '⏱ Review time is over — back to the shift'), '#ffd54a');
}
}
/* مادة الطرد وظل قاعدته ملك له وحده: نحررهما عند إزالته (الخامات المخزّنة وموارد FOD مشتركة فلا تُحرَّر) */
function disposeItem(it){
if(!it || it.data.isFod || it.disposed) return;
it.disposed = true;
if(it.m.material && it.m.material.dispose) it.m.material.dispose();
if(it.csh && it.csh.geometry) it.csh.geometry.dispose();
}
function rm(it){
clearCrit(it);
/* تحرير أي مرجع حمل يشير إلى الطرد المُتلف قبل إزالته من المشهد */
const h = gameRules.hold.forget(it, { held, lifting: liftAnim.toHold });
held = h.held;
if(liftAnim.toHold && h.lifting === null){ liftAnim.active = false; liftAnim.t = 0; liftAnim.toHold = null; }
S.remove(it.m); disposeItem(it); items = items.filter(i => i !== it);
}
/* الشحن بوقت اللعبة (dt) لا بمؤقت حقيقي: لا نقاط ولا ثوانٍ أثناء الإيقاف أو إخفاء التبويب */
/* مركز الصندوق المحمول يُدفع أمام الكفّين بنصف عمقه تقريباً كي لا يخترق جسم الشخصية */
const HOLD_OFF = 0.5;
let shipQueue = [];
function ship(z){
z.full = true;
snd('ship');
shipQueue.push({ z, t: .9 });
}
function updateShips(dt){
if(!shipQueue.length || dt <= 0) return;
for(const q of shipQueue) q.t -= dt;
const due = shipQueue.filter(q => q.t <= 0);
if(!due.length) return;
shipQueue = shipQueue.filter(q => q.t > 0);
due.forEach(q => finishShip(q.z));
}
function finishShip(z){
{
if(!z.full) return;
z.items.forEach(x => rm(x));
z.items = []; z.full = false; if(z.hz) drawZoneSign(z);
score += 50;
time += 15;
spawnFloatTag(I18N.T('+50 و +15 ث ⏱','+50 & +15s ⏱'), '#69f0ae');
toast(I18N.T('🚚 شُحنت ','🚚 Shipped ') + z.n + I18N.T(' (+50 و +15 ث)',' (+50 and +15s)'), '#69f0ae');
hud();
}
}
/* ===== لغز غرفة التجميد: انزلاق قطع COL / CRT / FRZ إلى صفوف نطاقاتها الحرارية ===== */
const frzEl = { fill: $('frz-fill'), time: $('frz-time'), bar: document.querySelector('.frz-bar'), root: $('frz'), tiles: $('frz-tiles'), moves: $('frz-moves'), lock: $('frz-lock'), title: $('frz-title'), sub: $('frz-sub'), x: $('frz-x'), again: $('frz-new'), board: $('frz-board') };
const FRZ_TIP = { COL: '2–8°C', CRT: '15–25°C', FRZ: '0°C' };
function frzText(){
  frzEl.title.textContent = frzP.solved ? I18N.T('تم فتح الباب!', 'Door unlocked!') : I18N.T('غرفة التجميد مقفلة', 'Freezer room locked');
  frzEl.sub.textContent = frzP.solved ? I18N.T('أدخل الطرد المجمّد الآن', 'Load the frozen parcel now') : I18N.T('رتّب القطع في صف نطاق حرارتها — لديك ' + gameRules.freezer.seconds + ' ثانية وإلا تُخصم ' + gameRules.freezer.timeoutPenalty + ' نقطة', 'Slide each tile into its temperature row — ' + gameRules.freezer.seconds + 's or lose ' + gameRules.freezer.timeoutPenalty + ' points');
  frzEl.moves.textContent = I18N.T('الحركات: ', 'Moves: ') + frzP.moves;
  frzEl.again.textContent = I18N.T('خلط جديد', 'New shuffle');
  frzEl.x.setAttribute('aria-label', I18N.T('إغلاق', 'Close'));
  frzEl.lock.textContent = frzP.solved ? '🔓' : '🔒';
  frzEl.root.querySelectorAll('[data-band]').forEach(b => { b.querySelector('small').textContent = ({ COL: I18N.T('مبرّد', 'Cool'), CRT: I18N.T('حرارة الغرفة', 'Room temp'), FRZ: I18N.T('مجمّد', 'Frozen') })[b.dataset.band]; });
}
function frzPlace(){
  frzP.cells.forEach((t, i) => { if(t) t.el.style.transform = 'translate(' + (i % 3) * 100 + '%,' + Math.floor(i / 3) * 100 + '%)'; });
}
function frzBuild(){
  frzEl.tiles.innerHTML = '';
  const board = gameRules.freezer.shuffle(Math.random, 56);
  frzP.cells = board.map((type) => {
    if(!type) return null;
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'frz-t'; el.dataset.type = type;
    el.setAttribute('aria-label', type + ' ' + FRZ_TIP[type]);
    el.innerHTML = '<span><b>' + type + '</b><small>' + FRZ_TIP[type] + '</small></span>';
    const tile = { type, el };
    el.addEventListener('click', () => frzTap(frzP.cells.indexOf(tile)));
    frzEl.tiles.appendChild(el);
    return tile;
  });
  frzP.moves = 0; frzP.solved = false;
  frzEl.root.classList.remove('solved');
  frzPlace(); frzText();
}
function frzTap(i){
  if(!frzP.active || frzP.solved || i < 0) return;
  const types = frzP.cells.map(t => t && t.type);
  const next = gameRules.freezer.move(types, i);
  if(!next){ snd('warn', .6); return; }
  const blank = types.indexOf(null);
  frzP.cells[blank] = frzP.cells[i]; frzP.cells[i] = null;
  frzP.moves++; snd('pick', .9 + Math.min(frzP.moves, 30) * .005);
  frzPlace(); frzText();
  if(gameRules.freezer.isSolved(frzP.cells.map(t => t && t.type))) frzSolved();
}
function frzSolved(){
  frzP.solved = true;
  frzEl.root.classList.add('solved');
  frzEl.tiles.querySelectorAll('.frz-t').forEach(e => { e.disabled = true; });
  snd('fever'); frzText();
  clearTimeout(frzP.timer);
  frzP.timer = setTimeout(() => { frzClose(true); }, 1100);
}
function frzOpenPuzzle(){
  if(frzP.active) return;
  frzP.active = true;
  for(const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) key[k] = 0;
  frzEl.root.style.display = 'flex';
  frzBuild();
  snd('warn', .8);
  /* مهلة الحل: تبدأ مع فتح اللغز، والخلط الجديد لا يعيدها */
  frzP.t = gameRules.freezer.seconds; frzP.last = performance.now();
  cancelAnimationFrame(frzP.raf); frzP.raf = requestAnimationFrame(frzTick);
  setTimeout(() => { try { const t = frzEl.tiles.querySelector('.frz-t'); if(t) t.focus({ preventScroll: true }); } catch(e){} }, 50);
}
function frzTick(now){
  if(!frzP.active) return;
  const dt = Math.min(.1, (now - frzP.last) / 1000); frzP.last = now;
  if(!document.hidden && !frzP.solved) frzP.t -= dt;
  if(frzEl.fill){
    frzEl.fill.style.transform = 'scaleX(' + Math.max(0, frzP.t / gameRules.freezer.seconds) + ')';
    frzEl.bar.classList.toggle('low', frzP.t <= 10);
    frzEl.time.textContent = Math.max(0, Math.ceil(frzP.t)) + I18N.T(' ث', 's');
  }
  if(frzP.t <= 0 && !frzP.solved){ frzTimeout(); return; }
  frzP.raf = requestAnimationFrame(frzTick);
}
/* انتهت المهلة دون حل: خصم نقاط وإغلاق اللغز (يمكن المحاولة مجدداً بالاقتراب من الباب) */
function frzTimeout(){
  const lost = gameRules.freezer.timeoutLoss(score); score -= lost;
  if(FRZ.pending) FRZ.pending.frzPen = true;   // لا غرامة ثانية لترك الباب مقفلاً لنفس الطرد
  snd('error'); addShake(.3); penaltyFx(lost, false);
  spawnFloatTag('−' + gameRules.freezer.timeoutPenalty + ' ⏱', '#ff5252', 'big');
  toast(I18N.T('⏱ انتهى وقت لغز غرفة التجميد −' + gameRules.freezer.timeoutPenalty, '⏱ Freezer puzzle time is up −' + gameRules.freezer.timeoutPenalty), '#ff8a5c', 2600);
  frzClose(false, true);
}
function frzClose(solvedNow, timedOut){
  clearTimeout(frzP.timer); cancelAnimationFrame(frzP.raf);
  if(!frzP.active) return;
  frzP.active = false;
  frzEl.root.style.display = 'none';
  if(solvedNow) frzUnlock();
  else if(timedOut){}
  else if(FRZ.pending){
    const p = FRZ.pending;
    if(!p.frzPen){ p.frzPen = true; const lost = Math.min(score, gameRules.freezer.penalty); score -= lost; snd('error'); penaltyFx(lost, false); spawnFloatTag('−' + gameRules.freezer.penalty + ' ❄️', '#ff5252', 'big'); toast(I18N.T('❌ لم تفتح غرفة التجميد −' + gameRules.freezer.penalty, '❌ Freezer door not opened −' + gameRules.freezer.penalty), '#ff8a5c'); }
    else toast(I18N.T('الباب ما زال مقفلاً — الطرد بجانبك', 'Door still locked — the parcel is next to you'), '#8fe3ff');
  }
  hud();
}
function frzKey(e){
  e.preventDefault();
  if(e.repeat) return;
  if(e.code === 'Escape' || e.code === 'KeyP'){ frzClose(false); return; }
  if(frzP.solved) return;
  const blank = frzP.cells.indexOf(null), c = blank % 3;
  const src = { ArrowLeft: c < 2 ? blank + 1 : -1, ArrowRight: c > 0 ? blank - 1 : -1, ArrowUp: blank + 3, ArrowDown: blank - 3, KeyA: c < 2 ? blank + 1 : -1, KeyD: c > 0 ? blank - 1 : -1, KeyW: blank + 3, KeyS: blank - 3 }[e.code];
  if(src !== undefined && src >= 0 && src <= 8) frzTap(src);
}
if(frzEl.root){
  frzEl.x.addEventListener('click', () => frzClose(false));
  frzEl.again.addEventListener('click', () => { if(!frzP.solved) frzBuild(); });
  frzEl.root.addEventListener('pointerdown', e => e.stopPropagation());
}
/* فتح الباب: يُسلَّم الطرد المنتظر فوراً إن وُجد، وإلا يبقى الباب مفتوحاً مدة قصيرة */
function frzUnlock(){
  FRZ.open = true; FRZ.closeT = gameRules.freezer.closeIdle;
  const ub = gameRules.freezer.unlockBonus; score += ub;
  snd('ship'); spawnFloatTag('+' + ub + ' 🔓', '#8fe3ff', 'big'); toast(I18N.T('🔓 فُتح باب غرفة التجميد +' + ub, '🔓 Freezer door unlocked +' + ub), '#8fe3ff');
  const it = FRZ.pending;
  if(it && items.includes(it) && it.st === 'floor') frzDeliver(it);
}
function frzDeliver(it){
  FRZ.pending = null;
  const r = gameRules.freezer.reward;
  totalProcessed++; sortedCount++;
  const base = 0;
  score += r.score; time += 3 + r.time;
  streak++; streakT = streakWindow(); maxStreak = Math.max(maxStreak, streak); combo = gameRules.economy.comboAfter(streak);
  if(streak >= 10 && streak % 10 === 0) startFever();
  if(it.crit) clearCrit(it);
  const slot = FRZ.items.length % 6;
  it.st = 'placed'; FRZ.items.push(it);
  if(FRZ.items.length > 6) rm(FRZ.items.shift());
  it.m.position.set(FRZ.x - 1.3 + (slot % 3) * 1.3, 2.6, FRZ.zBack + 1.4 + Math.floor(slot / 3) * 1.5);
  it.m.rotation.set(0, 0, 0); it.fall = true; it.vy = 0; it.ty = 0.1 + BH;
  FRZ.closeT = gameRules.freezer.closeAfterDelivery; FRZ.solved++;
  snd('ok', 1.2); screenFlash('gold');
  spawnFloatTag('+' + (base + r.score) + ' ❄️ +' + (3 + r.time) + I18N.T(' ث', 's'), '#8fe3ff', 'big');
  toast(I18N.T('❄️ دخل الطرد غرفة التجميد +', '❄️ Parcel stored in the freezer +') + (base + r.score), '#69f0ae');
  hud();
}
/* إسقاط طرد أمام غرفة التجميد: المجمّد يطلب فتح الباب، وغيره يُرفض بلا غرامة */
function frzDrop(it, x){
  const fx = Math.max(FRZ.x - FRZ.hw + 0.6, Math.min(FRZ.x + FRZ.hw - 0.6, x));
  if(!it.data.isFrz){
    it.st = 'floor'; it.fall = true; it.vy = 0; it.ty = 0.02 + BH; it.m.position.set(fx, 1.05, -4.3);
    snd('warn'); tip('frz-only', I18N.T('هذه الغرفة للطرود المجمّدة 🧊 فقط', 'This room is for frozen parcels 🧊 only'), '#8fe3ff');
    return;
  }
  if(FRZ.open){ it.st = 'floor'; frzDeliver(it); return; }
  it.st = 'floor'; it.fall = true; it.vy = 0; it.ty = 0.02 + BH; it.m.position.set(fx, 1.05, -4.3); it.m.rotation.set(0, 0, 0);
  FRZ.pending = it;
  frzOpenPuzzle();
}
function inFrzZone(x, z){ return Math.abs(x - FRZ.x) < FRZ.hw + 0.9 && z < -3.4; }   // منطقة الإسقاط أمام الغرفة (أوسع من الحصيرة كي لا يصعب الوقوف فيها)
function updateFreezer(dt){
  const want = FRZ.open ? 1 : 0;
  FRZ.openAmt += (want - FRZ.openAmt) * Math.min(1, dt * 5);
  FRZ.door.position.x = FRZ.x + FRZ.openAmt * (FRZ.doorW + 0.1);
  FRZ.lampMat.color.setHex(FRZ.open ? 0x2fe06d : 0xff3b30); FRZ.lampMat.emissive.setHex(FRZ.open ? 0x2fe06d : 0xff3b30);
  FRZ.glow.intensity = FRZ.openAmt * 1.4;
  if(FRZ.open && dt > 0){ FRZ.closeT -= dt; if(FRZ.closeT <= 0){ FRZ.open = false; snd('place', .7); } }
  if(FRZ.pending && !items.includes(FRZ.pending)) FRZ.pending = null;
}
function resetFreezer(){
  frzP.active = false; clearTimeout(frzP.timer); cancelAnimationFrame(frzP.raf); if(frzEl.root) frzEl.root.style.display = 'none';
  FRZ.open = false; FRZ.openAmt = 0; FRZ.closeT = 0; FRZ.pending = null; FRZ.items = []; FRZ.solved = 0;
  if(FRZ.door) FRZ.door.position.x = FRZ.x;
}
/* ===== أحداث جديدة داخل المستودع: انسداد الحزام · الطرد الثقيل · لغز البطاقات · ألعاب نارية ===== */
const fwCv = $('fw');
const FW = { parts: [], raf: 0, last: 0, g: fwCv ? fwCv.getContext('2d') : null };
function fwSize(){
  if(!fwCv) return;
  const r = fwCv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 1.5);
  if(fwCv.width !== Math.round(r.width * d)){ fwCv.width = Math.round(r.width * d); fwCv.height = Math.round(r.height * d); }
  FW.d = d;
}
function fwBurst(x, y, n, hue){
  if(!FW.g) return;
  fwSize();
  const d = FW.d || 1, base = hue === undefined ? Math.random() * 360 : hue;
  for(let i = 0; i < n; i++){
    const a = Math.PI * 2 * i / n + Math.random() * .3, v = (90 + Math.random() * 160) * d;
    FW.parts.push({ x: x * d, y: y * d, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: .9 + Math.random() * .7, h: (base + Math.random() * 40) % 360, r: (1.6 + Math.random() * 1.6) * d });
  }
  snd('boom', .8 + Math.random() * .5);
  if(!FW.raf){ FW.last = performance.now(); FW.raf = requestAnimationFrame(fwFrame); }
}
function fwShow(count){
  if(!fwCv) return;
  const r = fwCv.getBoundingClientRect();
  for(let i = 0; i < count; i++) setTimeout(() => fwBurst(r.width * (.2 + Math.random() * .6), r.height * (.18 + Math.random() * .4), 34), i * 260);
}
function fwFrame(now){
  const g = FW.g, dt = Math.min(.05, (now - FW.last) / 1000); FW.last = now;
  g.clearRect(0, 0, fwCv.width, fwCv.height);
  g.globalCompositeOperation = 'lighter';
  const d = FW.d || 1;
  FW.parts = FW.parts.filter(p => (p.life += dt) < p.max);
  for(const p of FW.parts){
    p.vy += 220 * d * dt; p.vx *= .985; p.x += p.vx * dt; p.y += p.vy * dt;
    const a = 1 - p.life / p.max;
    g.fillStyle = 'hsla(' + p.h + ',100%,' + (55 + 20 * a) + '%,' + a + ')';
    g.beginPath(); g.arc(p.x, p.y, p.r * (.6 + a * .6), 0, 6.283); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  FW.raf = FW.parts.length ? requestAnimationFrame(fwFrame) : 0;
  if(!FW.parts.length) g.clearRect(0, 0, fwCv.width, fwCv.height);
}

/* --- انسداد الحزام --- */
function beltLoad(){ let n = 0; for(const it of items) if(it.st === 'belt') n++; return n; }
function jamText(n){
  $('jam-n').textContent = n;
  $('jam-goal').textContent = I18N.T('صندوق على الحزام — المطلوب ' + gameRules.belt.clearAt + ' أو أقل', 'parcels on the belt — need ' + gameRules.belt.clearAt + ' or fewer');
}
function startJam(){
  jam.active = true;
  clearInterval(jam.siren);
  jam.siren = setInterval(() => { if(jam.active && run && !document.hidden) snd('jam'); }, 2600);
  snd('jam'); addShake(.5);
  jamText(beltLoad());
  $('jam-banner').classList.add('on');
  tip('jam', I18N.T('⚠️ الحزام توقف: الوزن أثقل من المسموح — انقل الصناديق الزائدة إلى مناطقها', '⚠️ The belt stopped: overweight — move the extra parcels to their zones'), '#ffb020');
  hud();
}
function endJam(){
  jam.active = false; clearInterval(jam.siren); jam.siren = 0;
  $('jam-banner').classList.remove('on');
  score += gameRules.belt.clearReward;
  snd('cardwin'); fwShow(2);
  spawnFloatTag('+' + gameRules.belt.clearReward + ' ⚙️', '#69f0ae');
  toast(I18N.T('✅ عاد الحزام للعمل +' + gameRules.belt.clearReward, '✅ The belt is running again +' + gameRules.belt.clearReward), '#69f0ae');
  hud();
}
/* --- الطرد الثقيل --- */
function heavyTex(){
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = '#4a545d'; g.fillRect(0, 0, 512, 512);
  for(let i = 0; i < 700; i++){ g.fillStyle = Math.random() > .5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.12)'; g.fillRect(Math.random() * 512, Math.random() * 512, Math.random() * 30 + 3, 2); }
  g.fillStyle = '#f5c400';
  for(let i = -8; i < 20; i++){ g.save(); g.translate(i * 44, 0); g.rotate(-.78); g.fillRect(0, -40, 26, 700); g.restore(); }
  g.fillStyle = '#1b2127'; g.fillRect(40, 70, 432, 372);
  g.strokeStyle = '#f5c400'; g.lineWidth = 8; g.strokeRect(40, 70, 432, 372);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f5c400';
  g.font = '900 120px sans-serif'; g.fillText('🏗️', 256, 170);
  g.font = '900 96px monospace'; g.fillText(gameRules.heavy.kg + ' KG', 256, 290);
  g.fillStyle = '#fff'; g.font = '900 38px sans-serif'; g.fillText('HEAVY • FORKLIFT ONLY', 256, 370);
  g.font = '700 28px sans-serif'; g.fillText('DO NOT LIFT BY HAND', 256, 412);
  const t = rawTex(cv); t.anisotropy = 4; return t;
}
function spawnHeavy(){
  /* الطرد الثقيل أكبر قليلاً (HVS): يكبر للأعلى والجانبين وتبقى قاعدته على الباليت */
  if(!spawnHeavy.g){ spawnHeavy.g = BOXG.clone(); spawnHeavy.g.scale(HVS, HVS, HVS); spawnHeavy.g.translate(0, (HVS - 1) * BH, 0); spawnHeavy.e = new THREE.EdgesGeometry(spawnHeavy.g); }
  const m = new THREE.Mesh(spawnHeavy.g, new THREE.MeshStandardMaterial({ map: heavyTex(), roughness: .55, metalness: .25 }));
  m.castShadow = m.receiveShadow = true;
  m.position.set(21 + Math.random() * 2, BH + .02, 3.4 + Math.random() * 1.4);
  m.add(new THREE.LineSegments(spawnHeavy.e, EDGEM));
  const csh = new THREE.Mesh(new THREE.PlaneGeometry(2.1 * HVS, 2.1 * HVS), SHM);
  /* منصة خشبية (باليت) أسفل الطرد: سطح من ألواح + ثلاث عوارض + ألواح سفلية */
  const PH = .22, wood = new THREE.MeshStandardMaterial({ color: 0xa9763f, roughness: .92 }), woodD = new THREE.MeshStandardMaterial({ color: 0x7d5329, roughness: .95 });
  const pal = new THREE.Group(), bx = (w, h, d, x, y, z, mt) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mt); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; pal.add(o); };
  for(let i = 0; i < 5; i++) bx(1.5, .04, .24, 0, -BH - .02, -.6 + i * .3, wood);
  [-.62, 0, .62].forEach(x => bx(.16, .12, 1.5, x, -BH - .04 - .06, 0, woodD));
  [-.62, 0, .62].forEach(z => bx(1.5, .04, .2, 0, -BH - PH + .02, z, wood));
  pal.scale.set(HVS, 1, HVS); m.add(pal); m.position.y += PH;
  csh.rotation.x = -Math.PI / 2; csh.position.y = -BH - PH + .015; m.add(csh);
  S.add(m);
  const data = { t: 'gen', emoji: '🏗️', name: I18N.t('معدات ثقيلة'), imp: 'HVY', div: gameRules.heavy.kg + 'kg', isHz: false, isMys: false, isFrz: false, isHeavy: true, cao: false };
  const it = { m, data, st: 'floor', csh, fined: true };
  items.push(it); hv.item = it; hv.done = true;
  snd('horn');
  showIntro(I18N.T('<b class="t">🏗️ وصل طرد ثقيل ' + gameRules.heavy.kg + ' كغ</b>لا يُرفع باليد — استخدم الرافعة الشوكية لنقله إلى منطقته (+' + gameRules.heavy.deliverReward + ').', '<b class="t">🏗️ A ' + gameRules.heavy.kg + ' kg parcel arrived</b>Too heavy to lift by hand — use the forklift to move it to its zone (+' + gameRules.heavy.deliverReward + ').'), 3600, false);
}
function updateEvents(dt){
  if(!run) return;
  /* الحزام */
  const n = beltLoad();
  if(jam.active){
    $('jam-n').textContent = n;
    if(gameRules.belt.cleared(n)) endJam();
  } else if(gameRules.belt.jammed(n) && !fire.active && !caoQ.active && !frzP.active && !cardP.active && !uldP.active && !STUDY.on && !introHold){
    startJam();
  } else if(n === gameRules.belt.warnAt && !updateEvents.warned){ updateEvents.warned = true; tip('belt-warn', I18N.T('⚖️ الحزام قارب الحد الأقصى — صنّف بسرعة!', '⚖️ The belt is near its limit — sort fast!'), '#ffd54a'); }
  else if(n < gameRules.belt.warnAt) updateEvents.warned = false;
  /* الطرد الثقيل: مرة واحدة بوقت عشوائي، بلا تعارض مع الأحداث الأخرى */
  if(!hv.done && evt.t >= evt.heavyAt && !jam.active && !fire.active && !caoQ.active && !inspector.active && !frzP.active && !cardP.active && !uldP.active && !FD.on && !introHold) spawnHeavy();
}
function resetEvents(){
  jam.active = false; clearInterval(jam.siren); jam.siren = 0; $('jam-banner').classList.remove('on');
  hv.done = false; hv.failed = false; hv.item = null; FD.unlocked = false;
  cardP.active = false; cancelAnimationFrame(cardP.raf); clearTimeout(cardP.closing); const c = $('cards'); if(c) c.style.display = 'none';
  FW.parts.length = 0; updateEvents.warned = false;
  uldReset();
}

/* --- لغز بطاقات تشغيل الرافعة (9 بطاقات: ملصق + كود + شرارة) --- */
const cardsEl = { root: $('cards'), grid: $('cards-grid'), fill: $('cards-fill'), time: $('cards-time'), bar: document.querySelector('.cards-bar'), info: $('cards-info'), title: $('cards-title'), sub: $('cards-sub'), x: $('cards-x') };
function cardsText(){
  cardsEl.title.textContent = I18N.T('تشغيل الرافعة الشوكية', 'Start the forklift');
  cardsEl.sub.textContent = I18N.T('اقلب ملصق المادة الخطرة ثم كودها الصحيح — لديك دقيقة واحدة، وانتهاؤها يخصم ' + gameRules.heavy.failPenalty + ' نقطة', 'Flip a hazard label, then its matching code — one minute, or lose ' + gameRules.heavy.failPenalty + ' points');
  cardsEl.x.setAttribute('aria-label', I18N.T('إغلاق', 'Close'));
}
function cardsPool(){
  const seen = new Set(), pool = [];
  for(const r of HZ){ if(seen.has(r[3])) continue; seen.add(r[3]); pool.push({ key: r[3], imp: r[3], div: r[4], name: r[2] }); }
  return pool;
}
function cardsBuild(){
  cardsEl.grid.innerHTML = '';
  cardP.deck = gameRules.cards.build(cardsPool(), Math.random);
  cardP.open = []; cardP.matched = new Set(); cardP.lock = false; cardP.mistakes = 0; cardP.wild = false;
  cardP.deck.forEach((c, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card9'; b.dataset.i = i;
    let front;
    if(c.kind === 'label') front = '<span class="face front"><img alt="' + c.data.imp + '" src="' + dgURL(c.data.div, c.data.imp) + '"></span>';
    else if(c.kind === 'code') front = '<span class="face front code"><i>CLASS ' + c.data.div + '</i><b>' + c.data.imp + '</b><small>' + c.data.name + '</small></span>';
    else front = '<span class="face front wild">🎆</span>';
    b.innerHTML = '<span class="face back" aria-hidden="true">⚠</span>' + front;
    b.setAttribute('aria-label', I18N.T('بطاقة ' + (i + 1), 'Card ' + (i + 1)));
    b.addEventListener('click', () => cardsFlip(i));
    cardsEl.grid.appendChild(b);
  });
}
function cardsOpen(){
  if(cardP.active) return;
  cardP.active = true; cardP.t = gameRules.cards.seconds;
  for(const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) key[k] = 0;
  cardsText(); cardsBuild();
  cardsEl.info.textContent = I18N.T('ابحث عن 4 ملصقات مع أكوادها — والبطاقة الخاصة 🎆 مفاجأة!', 'Find 4 labels with their codes — the 🎆 card is a surprise!');
  cardsEl.root.style.display = 'flex';
  snd('warn', .8);
  cardP.last = performance.now(); cardP.raf = requestAnimationFrame(cardsTick);
}
function cardsTick(now){
  if(!cardP.active) return;
  const dt = Math.min(.1, (now - cardP.last) / 1000); cardP.last = now;
  if(!document.hidden && !cardP.closing) cardP.t -= dt;
  const f = Math.max(0, cardP.t / gameRules.cards.seconds);
  cardsEl.fill.style.transform = 'scaleX(' + f + ')';
  cardsEl.bar.classList.toggle('low', cardP.t <= 10);
  cardsEl.time.textContent = Math.max(0, Math.ceil(cardP.t)) + (I18N.T(' ث', 's'));
  if(cardP.t <= 0 && !cardP.closing){ cardsFail(); return; }
  cardP.raf = requestAnimationFrame(cardsTick);
}
function cardCenter(i){
  const r = cardsEl.grid.children[i].getBoundingClientRect(), s = fwCv.getBoundingClientRect();
  return [r.left + r.width / 2 - s.left, r.top + r.height / 2 - s.top];
}
function cardsFlip(i){
  if(!cardP.active || cardP.lock || cardP.closing) return;
  const c = cardP.deck[i], el = cardsEl.grid.children[i];
  if(cardP.matched.has(c.id) || cardP.open.includes(i) || (c.kind === 'wild' && cardP.wild)) return;
  el.classList.add('up'); snd('cardflip', 1 + cardP.open.length * .15);
  if(c.kind === 'wild'){
    cardP.wild = true; cardP.t = Math.min(gameRules.cards.seconds, cardP.t + gameRules.cards.wildTimeBonus);
    const [x, y] = cardCenter(i); fwBurst(x, y, 46, 40);
    cardsEl.info.textContent = I18N.T('🎆 شرارة! +' + gameRules.cards.wildTimeBonus + ' ثوانٍ', '🎆 Spark! +' + gameRules.cards.wildTimeBonus + ' seconds');
    return;
  }
  cardP.open.push(i);
  if(cardP.open.length < 2) return;
  const [a, b] = cardP.open.map(k => cardP.deck[k]);
  cardP.lock = true;
  if(gameRules.cards.isPair(a, b)){
    cardP.open.forEach(k => { cardP.matched.add(cardP.deck[k].id); const e = cardsEl.grid.children[k]; e.classList.add('ok', 'matched'); const [x, y] = cardCenter(k); fwBurst(x, y, 22); });
    cardP.open = []; cardP.lock = false; snd('cardmatch');
    const left = gameRules.cards.pairs - cardP.matched.size / 2;
    cardsEl.info.textContent = left > 0 ? I18N.T('✔ تطابق! بقي ' + left, '✔ Match! ' + left + ' left') : '';
    if(gameRules.cards.won(cardP.deck, cardP.matched)) cardsWin();
  } else {
    cardP.mistakes++; snd('cardfail');
    cardsEl.info.textContent = I18N.T('✖ غير متطابقتين — حاول مجدداً', '✖ No match — try again');
    const ks = cardP.open.slice(); ks.forEach(k => cardsEl.grid.children[k].classList.add('bad'));
    setTimeout(() => { ks.forEach(k => { const e = cardsEl.grid.children[k]; e.classList.remove('up', 'bad'); }); cardP.open = []; cardP.lock = false; }, 650);
  }
}
function cardsHide(){
  cardsEl.root.style.display = 'none'; cardP.active = false; cardP.closing = 0; cancelAnimationFrame(cardP.raf);
}
function cardsWin(){
  cardP.closing = 1;
  fwShow(5); snd('cardwin');
  score += gameRules.heavy.solveReward;
  spawnFloatTag('+' + gameRules.heavy.solveReward + ' 🔑', '#ffd54a', 'big');
  toast(I18N.T('🔓 تم تشغيل الرافعة +' + gameRules.heavy.solveReward, '🔓 Forklift unlocked +' + gameRules.heavy.solveReward), '#69f0ae');
  FD.unlocked = true; hud();
  cardP.closing = setTimeout(() => { cardsHide(); mountDrive(); }, 1500);
}
function cardsFail(){
  cardP.closing = 1;
  snd('error'); addShake(.4);
  cardsEl.info.textContent = I18N.T('⏱ انتهت الدقيقة!', '⏱ Time is up!');
  if(!hv.failed){
    hv.failed = true;
    const lost = Math.min(score, gameRules.heavy.failPenalty); score = Math.max(0, score - gameRules.heavy.failPenalty);
    spawnFloatTag('−' + gameRules.heavy.failPenalty, '#ff5252', 'big');
    if(hv.item && items.includes(hv.item)) rm(hv.item);   // يختفي الطرد الثقيل
    hv.item = null;
    toast(I18N.T('❌ فشل تشغيل الرافعة −' + gameRules.heavy.failPenalty + ' واختفى الطرد الثقيل', '❌ Forklift start failed −' + gameRules.heavy.failPenalty + ' and the heavy parcel is gone'), '#ff5252');
    hud();
  } else toast(I18N.T('⏱ انتهى الوقت — جرّب مجدداً', '⏱ Time is up — try again'), '#ffd54a');
  cardP.closing = setTimeout(cardsHide, 1100);
}
/* إغلاق اللغز قبل حلّه استسلام: يُخصم quitPenalty (الوقت المنتهي له غرامته الخاصة في cardsFail) */
function cardsClose(){
  if(cardP.closing) return;
  const q = gameRules.cards.quitPenalty, lost = Math.min(score, q);
  score -= lost; snd('error'); penaltyFx(lost, false);
  spawnFloatTag('−' + q, '#ff5252', 'big');
  toast(I18N.T('🚜 تركت لغز تشغيل الرافعة −' + q, '🚜 Forklift puzzle abandoned −' + q), '#ff8a5c', 2200);
  hud(); cardsHide();
}
if(cardsEl.x) cardsEl.x.addEventListener('click', cardsClose);
if(cardsEl.root) cardsEl.root.addEventListener('pointerdown', e => e.stopPropagation());

/* ===== لغز خطة تحميل ULD — 200 نقطة: رحلة ركاب ومنصة 3×3 =====
   القواعد والتوليد والتحقق في gameRules.uld؛ هنا الواجهة فقط. المحاكاة تتجمد أثناءه (dt = 0). */
const uldEl = { root: $('uld'), grid: $('uld-grid'), tray: $('uld-tray'), off: $('uld-off'), fill: $('uld-fill'), time: $('uld-time'), bar: document.querySelector('#uld .cards-bar'), info: $('uld-info'), ok: $('uld-ok'), x: $('uld-x'), detail: $('uld-detail'), count: $('uld-count'), undo: $('uld-undo'), reset: $('uld-reset') };
const ULD_NAMES = { EAT: ['🍓', 'أغذية طازجة', 'Fresh food'], AVI: ['🐕', 'حيوان حي', 'Live animal'] };
function uldFlight(){ return gameRules.cao.flightFor(Math.floor(evt.t * 7)); }
function uldText(){
  const U = gameRules.uld, f = uldP.flight || uldFlight();
  $('uld-title').textContent = I18N.T('تحميل ULD — ' + f.id + ' ' + f.from + '→' + f.to + ' (ركاب)', 'ULD load — ' + f.id + ' ' + f.from + '→' + f.to + ' (pax)');
  $('uld-sub').textContent = I18N.T(U.seconds + ' ث · +' + U.reward + ' · فشل −' + U.failPenalty + ' · ترك −' + U.quitPenalty, U.seconds + 's · +' + U.reward + ' · fail −' + U.failPenalty + ' · quit −' + U.quitPenalty);
  $('uld-rules').innerHTML = [
    I18N.T('لا تجاور شحنتين متعارضتين (IATA 9.3.A) — القطري مسموح', 'No incompatible neighbours (IATA 9.3.A) — diagonal OK'),
    I18N.T('6.1 و6.2 بعيداً عن الأغذية والحيوانات', '6.1/6.2 away from food & animals'),
    I18N.T('الحيوانات بعيداً عن الثلج الجاف والمشع', 'Animals away from dry ice & radioactive'),
    I18N.T('رحلة ركاب: نزّل كل CAO', 'Pax flight: off-load all CAO')
  ].map(t => '<li>' + t + '</li>').join('');
  $('uld-deck-cap').textContent = I18N.T('منصة PMC', 'PMC pallet');
  $('uld-tray-cap').textContent = I18N.T('بانتظار التحميل', 'To load');
  $('uld-off-cap').textContent = I18N.T('🚫 تنزيل Off-load', '🚫 Off-load');
  uldEl.ok.textContent = I18N.T('✔ اعتماد', '✔ Approve');
  uldEl.x.textContent = '✕';
  uldEl.undo.textContent = I18N.T('↩ تراجع', '↩ Undo'); uldEl.undo.title = I18N.T('تراجع عن آخر نقلة (Z)', 'Undo the last move (Z)');
  uldEl.reset.textContent = I18N.T('⟲ إعادة', '⟲ Clear'); uldEl.reset.title = I18N.T('أعد كل الشحنات إلى القائمة', 'Return every shipment to the waiting list');
  uldEl.x.setAttribute('aria-label', I18N.T('إغلاق', 'Close'));
}
function uldName(p){
  if(ULD_NAMES[p.imp]) return I18N.T(ULD_NAMES[p.imp][1], ULD_NAMES[p.imp][2]);
  const r = HZ.find(h => h[3] === p.imp);
  return r ? r[2] : p.imp;
}
function uldPiece(p){
  const b = document.createElement('button'); b.type = 'button'; b.className = 'uld-pc' + (uldP.sel === p.id ? ' sel' : '') + (uldP.pop === p.id ? ' pop' : ''); b.dataset.id = p.id;
  const face = ULD_NAMES[p.imp] ? '<span class="em">' + ULD_NAMES[p.imp][0] + '</span>' : '<img alt="" src="' + dgURL(p.div, p.imp) + '">';
  b.innerHTML = face + '<span class="lb"><b>' + p.imp + '</b>' + (p.div ? '<small>' + p.div + '</small>' : '') + '</span>';
  const nm = uldName(p);
  b.title = nm; b.setAttribute('aria-label', nm + ' ' + p.imp + (p.div ? ' ' + I18N.T('فئة', 'class') + ' ' + p.div : ''));
  b.addEventListener('click', e => { e.stopPropagation(); uldPick(p.id); });
  /* سحب وإفلات بالفأرة أو اللمس؛ النقرة القصيرة تبقى للتحديد */
  b.addEventListener('pointerdown', e => {
    if(!uldP.active || uldP.closing || (e.pointerType === 'mouse' && e.button !== 0)) return;
    uldDrag.id = p.id; uldDrag.el = b; uldDrag.pid = e.pointerId; uldDrag.sx = e.clientX; uldDrag.sy = e.clientY; uldDrag.on = false;
  });
  b.addEventListener('pointerenter', () => { if(!uldDrag.on) uldDetail(p); });
  b.addEventListener('pointerleave', () => { if(!uldDrag.on) uldDetail(uldP.pieces.find(q => q.id === uldP.sel)); });
  return b;
}
function uldRender(){
  uldEl.grid.innerHTML = ''; uldEl.tray.innerHTML = ''; uldEl.off.innerHTML = '';
  const at = {};
  for(const p of uldP.pieces){ const l = uldP.loc[p.id]; if(typeof l === 'number') at[l] = p; }
  for(let i = 0; i < gameRules.uld.CELLS; i++){
    const c = document.createElement('button'); c.type = 'button'; c.className = 'uld-cell'; c.dataset.i = i;
    c.setAttribute('aria-label', I18N.T('خانة ', 'Slot ') + (i + 1));
    if(at[i]) c.appendChild(uldPiece(at[i])); else c.textContent = String.fromCharCode(65 + Math.floor(i / 3)) + (i % 3 + 1);
    c.addEventListener('click', () => uldDrop(i));
    uldEl.grid.appendChild(c);
  }
  for(const p of uldP.pieces){
    if(uldP.loc[p.id] === 'tray') uldEl.tray.appendChild(uldPiece(p));
    else if(uldP.loc[p.id] === 'off') uldEl.off.appendChild(uldPiece(p));
  }
  uldStatus();
}
function uldPick(id){
  if(!uldP.active || uldP.closing) return;
  const l = uldP.loc[id];
  /* قطعة محددة ثم نقر على قطعة في المنصة = تبديل مكانيهما */
  if(uldP.sel && uldP.sel !== id && typeof l === 'number'){ uldDrop(l); return; }
  uldP.sel = uldP.sel === id ? null : id;
  snd('cardflip', 1.1); uldRender();
}
function uldDrop(i){
  if(!uldP.active || uldP.closing) return;
  const occ = uldP.pieces.find(p => uldP.loc[p.id] === i);
  if(!uldP.sel){ if(occ){ uldP.sel = occ.id; snd('cardflip', 1.1); uldRender(); } return; }
  if(occ && occ.id === uldP.sel){ uldP.sel = null; uldRender(); return; }
  uldPush();
  const from = uldP.loc[uldP.sel];
  if(occ && occ.id !== uldP.sel) uldP.loc[occ.id] = from;   // تبديل: القطعة المزاحة تأخذ مكان القادمة
  uldP.loc[uldP.sel] = i; uldP.pop = uldP.sel; uldP.sel = null;
  snd('cardflip', .9); uldEl.info.textContent = ''; uldRender();
}
function uldToArea(area){
  if(!uldP.active || uldP.closing || !uldP.sel) return;
  if(uldP.loc[uldP.sel] === area){ uldP.sel = null; uldRender(); return; }
  uldPush();
  uldP.loc[uldP.sel] = area; uldP.pop = uldP.sel; uldP.sel = null;
  snd(area === 'off' ? 'cardfail' : 'cardflip', .9); uldRender();
}
if(uldEl.tray) uldEl.tray.addEventListener('click', () => uldToArea('tray'));
if(uldEl.off) uldEl.off.addEventListener('click', () => uldToArea('off'));
/* --- تحسينات التفاعل: تراجع، إعادة الكل، سحب وإفلات، اختصارات، شريط الحالة --- */
function uldPush(){ (uldP.hist = uldP.hist || []).push(Object.assign({}, uldP.loc)); if(uldP.hist.length > 40) uldP.hist.shift(); }
function uldUndo(){
  if(!uldP.active || uldP.closing || !uldP.hist || !uldP.hist.length) return;
  uldP.loc = uldP.hist.pop(); uldP.sel = null; uldP.pop = null; snd('cardflip', .8); uldRender();
}
function uldClear(){
  if(!uldP.active || uldP.closing || uldP.pieces.every(p => uldP.loc[p.id] === 'tray')) return;
  uldPush(); for(const p of uldP.pieces) uldP.loc[p.id] = 'tray';
  uldP.sel = null; uldP.pop = null; snd('cardflip', .7); uldRender();
}
function uldDetail(p){
  if(!uldEl.detail) return;
  uldEl.detail.textContent = p
    ? p.imp + (p.div ? ' · ' + I18N.T('فئة ', 'Class ') + p.div : '') + ' — ' + uldName(p)
    : I18N.T('مرّر فوق شحنة أو حدّدها لقراءة تفاصيلها', 'Hover or select a shipment to read its details');
}
function uldStatus(){
  if(!uldEl.count) return;
  let on = 0, off = 0, left = 0;
  for(const p of uldP.pieces){ const l = uldP.loc[p.id]; if(typeof l === 'number') on++; else if(l === 'off') off++; else left++; }
  uldEl.count.innerHTML = '📦 ' + I18N.T('محمّل', 'Loaded') + ' <b>' + on + '</b> · 🚫 ' + I18N.T('منزَّل', 'Off') + ' <b>' + off + '</b> · ⏳ ' + I18N.T('متبقٍ', 'Left') + ' <b>' + left + '</b>';
  uldEl.undo.disabled = !(uldP.hist && uldP.hist.length);
  uldEl.reset.disabled = left === uldP.pieces.length;
  uldEl.root.classList.toggle('armed', !!uldP.sel);
  uldDetail(uldP.pieces.find(p => p.id === uldP.sel));
}
const uldDrag = { id: null, el: null, ghost: null, pid: 0, sx: 0, sy: 0, w: 0, h: 0, on: false, over: null, suppress: false };
function uldTarget(x, y){
  const e = document.elementFromPoint(x, y); if(!e || !e.closest) return null;
  const cell = e.closest('.uld-cell');
  if(cell && uldEl.grid.contains(cell)) return cell;
  const area = e.closest('.uld-tray');
  return area && uldEl.root.contains(area) ? area : null;
}
function uldDragCancel(){
  if(uldDrag.ghost) uldDrag.ghost.remove();
  if(uldDrag.el) uldDrag.el.classList.remove('drag-src');
  if(uldDrag.over) uldDrag.over.classList.remove('over');
  uldDrag.id = null; uldDrag.el = null; uldDrag.ghost = null; uldDrag.over = null; uldDrag.on = false;
}
document.addEventListener('pointermove', e => {
  if(!uldDrag.id || e.pointerId !== uldDrag.pid) return;
  if(!uldP.active || uldP.closing){ uldDragCancel(); return; }
  if(!uldDrag.on){
    if(Math.hypot(e.clientX - uldDrag.sx, e.clientY - uldDrag.sy) < 8) return;
    uldDrag.on = true;
    const r = uldDrag.el.getBoundingClientRect(), g = uldDrag.el.cloneNode(true);
    g.className = 'uld-pc uld-ghost'; g.style.width = r.width + 'px'; g.style.height = r.height + 'px'; g.removeAttribute('title');
    uldDrag.w = r.width; uldDrag.h = r.height; uldDrag.ghost = g;
    uldEl.root.appendChild(g); uldDrag.el.classList.add('drag-src');
    uldDetail(uldP.pieces.find(q => q.id === uldDrag.id)); snd('cardflip', 1.1);
  }
  const rr = uldEl.root.getBoundingClientRect();
  uldDrag.ghost.style.left = (e.clientX - rr.left - uldDrag.w / 2) + 'px';
  uldDrag.ghost.style.top = (e.clientY - rr.top - uldDrag.h / 2) + 'px';
  const t = uldTarget(e.clientX, e.clientY);
  if(t !== uldDrag.over){ if(uldDrag.over) uldDrag.over.classList.remove('over'); uldDrag.over = t; if(t) t.classList.add('over'); }
  e.preventDefault();
});
document.addEventListener('pointerup', e => {
  if(!uldDrag.id || e.pointerId !== uldDrag.pid) return;
  const was = uldDrag.on, id = uldDrag.id, t = was ? uldTarget(e.clientX, e.clientY) : null;
  uldDragCancel();
  if(!was) return;   // نقرة عادية: يعالجها حدث click
  uldDrag.suppress = true; setTimeout(() => { uldDrag.suppress = false; }, 80);
  if(!t || !uldP.active || uldP.closing){ uldRender(); return; }
  uldP.sel = id;
  if(t.classList.contains('uld-cell')) uldDrop(+t.dataset.i);
  else uldToArea(t.id === 'uld-off' ? 'off' : 'tray');
});
document.addEventListener('pointercancel', uldDragCancel);
if(uldEl.root) uldEl.root.addEventListener('dragstart', e => e.preventDefault());
if(uldEl.root) uldEl.root.addEventListener('click', e => { if(uldDrag.suppress){ e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener('keydown', e => {
  if(!uldP.active || uldP.closing || e.ctrlKey || e.metaKey || e.altKey) return;
  if((e.key === 'Backspace' || e.key === 'Delete') && uldP.sel){ e.preventDefault(); uldToArea('tray'); }
  else if((e.key === 'o' || e.key === 'O') && uldP.sel){ e.preventDefault(); uldToArea('off'); }
  else if(e.key === 'z' || e.key === 'Z'){ e.preventDefault(); uldUndo(); }
});
if(uldEl.undo) uldEl.undo.addEventListener('click', uldUndo);
if(uldEl.reset) uldEl.reset.addEventListener('click', uldClear);
function uldOpen(){
  if(uldP.active) return;
  const U = gameRules.uld, b = U.build(Math.random);
  uldP.active = true; uldP.closing = 0; uldP.t = U.seconds; uldP.sel = null; uldP.tries = 0;
  uldP.pieces = b.pieces; uldP.loc = {}; uldP.flight = uldFlight();
  for(const p of b.pieces) uldP.loc[p.id] = 'tray';
  uldP.hist = []; uldP.pop = null; uldDragCancel(); uldEl.grid.classList.remove('ok'); uldEl.root.classList.remove('armed');
  for(const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) key[k] = 0;
  uldText(); uldRender();
  uldEl.info.textContent = I18N.T('اسحب الشحنة (أو اختر ثم انقر) إلى خانتها — أو منطقة التنزيل', 'Pick a shipment, then its slot — or the off-load area');
  uldEl.root.style.display = 'flex';
  snd('horn');
  uldP.last = performance.now(); uldP.raf = requestAnimationFrame(uldTick);
}
function uldTick(now){
  if(!uldP.active) return;
  const dt = Math.min(.1, (now - uldP.last) / 1000); uldP.last = now;
  if(!document.hidden && !uldP.closing) uldP.t -= dt;
  const f = Math.max(0, uldP.t / gameRules.uld.seconds);
  uldEl.fill.style.transform = 'scaleX(' + f + ')';
  uldEl.bar.classList.toggle('low', uldP.t <= 15);
  uldEl.time.textContent = Math.max(0, Math.ceil(uldP.t)) + I18N.T(' ث', 's');
  if(uldP.t <= 0 && !uldP.closing){ uldFail(); return; }
  uldP.raf = requestAnimationFrame(uldTick);
}
function uldSubmit(){
  if(!uldP.active || uldP.closing) return;
  const U = gameRules.uld, board = new Array(U.CELLS).fill(null), off = [];
  for(const p of uldP.pieces){ const l = uldP.loc[p.id]; if(typeof l === 'number') board[l] = p.id; else if(l === 'off') off.push(p.id); }
  const r = U.check(uldP.pieces, board, off);
  if(r.ok){ uldWin(); return; }
  if(r.missing.length || r.caoLeft.length){
    const n = r.missing.length + r.caoLeft.length;
    uldEl.info.textContent = I18N.T('📦 كل شحنة يجب أن تُحمَّل أو تُنزَّل — بقيت ' + n, '📦 Every shipment must be loaded or off-loaded — ' + n + ' left');
    snd('cardfail'); return;   // تنبيه بلا عقوبة: الخطة لم تكتمل بعد
  }
  uldP.tries++;
  uldP.t -= U.wrongSubmit;
  snd('error'); addShake(.25);
  /* لا نكشف موضع الخطأ ولا نوعه: رسالة عامة فقط */
  uldEl.grid.classList.remove('bad'); void uldEl.grid.offsetWidth; uldEl.grid.classList.add('bad');
  uldEl.info.textContent = I18N.T('✖ هناك خطأ في الخطة — −' + U.wrongSubmit + ' ث', '✖ The plan has a mistake — −' + U.wrongSubmit + 's');
}
if(uldEl.ok) uldEl.ok.addEventListener('click', uldSubmit);
function uldHide(){
  uldEl.root.style.display = 'none'; uldP.active = false; uldP.closing = 0; uldP.sel = null; cancelAnimationFrame(uldP.raf); uldDragCancel();
}
function uldWin(){
  const U = gameRules.uld;
  uldP.closing = 1;
  fwShow(7); snd('cardwin');
  uldEl.grid.dataset.stamp = I18N.T('معتمدة ✔', 'APPROVED ✔'); uldEl.grid.classList.add('ok'); uldP.sel = null; uldRender();
  score += U.reward; time += U.timeBonus;
  uldP.done = true; uldScreenPaint();
  spawnFloatTag('+' + U.reward + ' 📋', '#ffd54a', 'big');
  uldEl.info.textContent = I18N.T('✅ خطة سليمة! وقّع المشرف على NOTOC', '✅ Safe plan! The supervisor signed the NOTOC');
  toast(I18N.T('📋 خطة تحميل ULD معتمدة +' + U.reward + ' و +' + U.timeBonus + ' ث', '📋 ULD load plan approved +' + U.reward + ' and +' + U.timeBonus + 's'), '#69f0ae', 2600);
  hud();
  uldP.closing = setTimeout(uldHide, 1700);
}
function uldFail(){
  const U = gameRules.uld, lost = Math.min(score, U.failPenalty);
  uldP.closing = 1;
  score -= lost; snd('error'); addShake(.4); penaltyFx(lost, true);
  spawnFloatTag('−' + U.failPenalty, '#ff5252', 'big');
  uldEl.info.textContent = I18N.T('⏱ انتهى الوقت — أقلعت الرحلة بدون الشحنة', '⏱ Time is up — the flight left without the cargo');
  toast(I18N.T('❌ فشلت خطة تحميل ULD −' + U.failPenalty, '❌ ULD load plan failed −' + U.failPenalty), '#ff5252', 2400);
  hud();
  uldP.closing = setTimeout(uldHide, 1300);
}
function uldClose(){
  if(!uldP.active || uldP.closing) return;
  const q = gameRules.uld.quitPenalty, lost = Math.min(score, q);
  score -= lost; snd('error'); penaltyFx(lost, false);
  spawnFloatTag('−' + q, '#ff5252', 'big');
  toast(I18N.T('📋 تركت خطة تحميل ULD −' + q, '📋 ULD load plan abandoned −' + q), '#ff8a5c', 2200);
  hud(); uldHide();
}
function uldReset(){
  uldP.done = false; uldP.active = false; uldP.sel = null; cancelAnimationFrame(uldP.raf); clearTimeout(uldP.closing); uldP.closing = 0;
  if(uldEl.root) uldEl.root.style.display = 'none';
  if(typeof uldScreenPaint === 'function') uldScreenPaint();
}
if(uldEl.x) uldEl.x.addEventListener('click', uldClose);
if(uldEl.root) uldEl.root.addEventListener('pointerdown', e => e.stopPropagation());

/* ===== محطة تجهيز ULD: مكان ثابت يسار المستودع يقصده اللاعب متى شاء ويضغط ✋ لفتح خطة التحميل =====
   المكافأة مرة واحدة في الوردية؛ الفشل أو الترك له غرامته ويمكن المحاولة مجدداً بلغز جديد. */
const ULD_ST = { x: -29.0, z: 2.7, reach: 3.0, near: false, g: null, scr: null, sign: null, t: 0 };
function uldScreenPaint(){
  const s = ULD_ST.scr; if(!s) return;
  const g = s.g, ok = uldP.done;
  g.fillStyle = ok ? '#0d3b22' : '#0b1d2b'; g.fillRect(0, 0, 256, 160);
  g.strokeStyle = ok ? '#2fe06d' : '#38c6ff'; g.lineWidth = 6; g.strokeRect(5, 5, 246, 150);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = ok ? '#7dffae' : '#9fe6ff'; g.font = '900 34px ui-monospace,monospace'; g.fillText('ULD PLAN', 128, 44);
  g.fillStyle = '#fff'; g.font = '900 40px system-ui,sans-serif';
  g.fillText(ok ? '✓ OK' : '✋ +' + gameRules.uld.reward, 128, 104);
  s.tex.needsUpdate = true;
}
function uldStationBuild(){
  const g = new THREE.Group(); g.position.set(ULD_ST.x, 0, ULD_ST.z); g.rotation.y = Math.PI / 2;   // الواجهة نحو داخل المستودع (+x)
  const M = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r === undefined ? .6 : r, metalness: m === undefined ? .3 : m });
  const box = (w, h, d, mat, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  /* منصة PMC ألمنيوم على عربة دولي منخفضة */
  const rail = M(0x2b333a, .7, .5);
  [-.95, .25].forEach(z => box(2.5, .1, .14, rail, 0, .05, z - .35));
  box(2.5, .07, 2.1, M(0xbfc9d1, .32, .88), 0, .135, -.35);
  [-1.22, 1.22].forEach(x => box(.06, .1, 2.1, M(0x8d99a3, .4, .8), x, .17, -.35));
  /* شحنات مرصوصة على المنصة (كرتون + شحنة خطرة بشريط برتقالي) */
  const crt = [M(0xc49a6c, .85, 0), M(0xd4a373, .85, 0), M(0xb5835a, .85, 0)];
  const spots = [[-.8, -.9, 1], [0, -.9, 2], [.8, -.9, 1], [-.8, -.1, 1], [.75, -.1, 0]];
  spots.forEach(([x, z, n], k) => { for(let i = 0; i < n + 1 && i < 2; i++){ box(.7, .62, .7, crt[(k + i) % 3], x, .5 + i * .63, z); } });
  const hz = box(.66, .58, .66, M(0xf4f1e6, .7, 0), -.05, .48, -.1);
  box(.67, .12, .67, M(0xff7a1a, .6, 0), -.05, .62, -.1); hz.castShadow = true;
  /* أحزمة صفراء فوق الشحنات */
  const strap = M(0xf5c400, .6, .1);
  [-.5, .4].forEach(x => box(.07, .03, 1.6, strap, x, 1.42, -.5));
  /* طرفية خطة التحميل بشاشة متوهجة */
  const post = M(0x2c3742, .55, .7);
  box(.5, .06, .5, M(0x232c34, .78, .4), 1.0, .03, .7);
  box(.12, 1.15, .12, post, 1.0, .6, .7);
  const head = box(.78, .52, .1, M(0x161c22, .5, .5), 1.0, 1.36, .7); head.rotation.x = -.35;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
  const tex = rawTex(cv);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.7, .44), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.set(1.0, 1.36 + Math.sin(.35) * .056, .7 + Math.cos(.35) * .056); face.rotation.x = -.35; g.add(face);
  ULD_ST.scr = { g: cv.getContext('2d'), tex };
  /* خطوط أرضية صفراء حول المحطة */
  const floorMat = new THREE.MeshBasicMaterial({ color: 0xf5c400, transparent: true, opacity: .85 });
  [[3.0, .1, 0, -1.55], [3.0, .1, 0, 1.25], [.1, 2.9, -1.5, -.15], [.1, 2.9, 1.5, -.15]].forEach(([w, d, x, z]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat); m.rotation.x = -Math.PI / 2; m.position.set(x, .012, z); g.add(m);
  });
  /* لافتة عائمة تُرى من بعيد */
  const sc = document.createElement('canvas'); sc.width = 320; sc.height = 120;
  const c = sc.getContext('2d');
  c.fillStyle = '#1b2127'; c.fillRect(0, 0, 320, 120);
  c.strokeStyle = '#f5c400'; c.lineWidth = 8; c.strokeRect(4, 4, 312, 112);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#f5c400'; c.font = '900 46px system-ui,sans-serif'; c.fillText('📋 ULD', 160, 46);
  c.fillStyle = '#fff'; c.font = '800 28px system-ui,sans-serif'; c.fillText(I18N.T('خطة التحميل +' + gameRules.uld.reward, 'Load plan +' + gameRules.uld.reward), 160, 92);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: rawTex(sc), transparent: true, depthTest: false }));
  sign.scale.set(2.4, .9, 1); sign.position.set(0, 3.1, -.3); sign.renderOrder = 5; g.add(sign);
  ULD_ST.sign = sign;
  S.add(g); ULD_ST.g = g;
  /* جسم المحطة صلب: المنصة (عمق محلي −1.45…+0.9 ⇒ x عالمي) والعرض ±1.3 ⇒ z عالمي */
  STATIC_OBSTACLES.push({ minX: ULD_ST.x - 1.45, maxX: ULD_ST.x + .95, minZ: ULD_ST.z - 1.3, maxZ: ULD_ST.z + 1.3 });
  uldScreenPaint();
}
uldStationBuild();
function uldStationNear(){ return Math.hypot(px.x - ULD_ST.x, px.z - ULD_ST.z) < ULD_ST.reach; }
function uldCanOpen(){
  return run && !uldP.active && !fire.active && !caoQ.active && !cardP.active && !frzP.active && !STUDY.on && !FD.on && !introHold && !liftAnim.active && !demo.insp && !(window.Prog && Prog.busy());
}
function uldStationUse(){
  if(uldP.done){ toast(I18N.T('✅ خطة تحميل هذه الوردية معتمدة مسبقاً', '✅ This shift’s load plan is already approved'), '#69f0ae', 1800); return; }
  if(!uldCanOpen()){ snd('error'); toast(I18N.T('⏳ ليس الآن — أنهِ ما بين يديك أولاً', '⏳ Not now — finish what you’re doing first'), '#ffd54a', 1600); return; }
  uldOpen();
}
function uldStationTick(dt){
  if(!ULD_ST.g) return;
  ULD_ST.t += dt;
  if(ULD_ST.sign) ULD_ST.sign.position.y = 3.1 + Math.sin(ULD_ST.t * 2.2) * .08;
  const nr = run && !FD.on && uldStationNear();
  if(nr && !ULD_ST.near && !uldP.active){
    if(uldP.done) toast(I18N.T('✅ خطة ULD معتمدة لهذه الوردية', '✅ ULD plan approved for this shift'), '#69f0ae', 1400);
    else toast(I18N.T('📋 محطة خطة تحميل ULD — اضغط ✋ للبدء (+' + gameRules.uld.reward + ')', '📋 ULD load-plan station — press ✋ to start (+' + gameRules.uld.reward + ')'), '#ffd54a', 2400);
  }
  ULD_ST.near = nr;
}

/* ===== تجميعات FOD: ٣ خانات أعلى الشاشة ترفع مستوى الاندفاع مع احتفال عند كل جسم ===== */
const FOD_NAMES = ['١', '٢', '٣', '٤'];
/* ===== زر الاندفاع = مسرّع يتطور مع كل ترقية FOD =====
   ٠: محرك مروحي كلاسيكي (غطاء أحمر، أسطوانات نجمية، مروحة بيضاء بطرفين أحمرين)
   ١: توربوفان تيتانيوم بشفرات مقوّسة • ٢: توربوفان رقمي بشبكة سيان متوهجة
   ٣: مفاعل بلازما مدرّع بحلقة احتراق برتقالية */
const ENG_LV = [
  { id: 'prop',  ar: 'المحرك المروحي',    en: 'Prop engine',       bl: '#f2f4f5', glow: 'rgba(255,80,70,.35)',  spin: 1500, fade: .7 },
  { id: 'fan',   ar: 'توربوفان التيتانيوم', en: 'Titanium turbofan', bl: '#e3e9ed', glow: 'rgba(205,222,235,.5)', spin: 1800, fade: .6 },
  { id: 'cyber', ar: 'التوربوفان الرقمي',  en: 'Digital turbofan',  bl: '#b8f2ff', glow: 'rgba(63,227,255,.8)',  spin: 2200, fade: .6 },
  { id: 'core',  ar: 'مفاعل البلازما',     en: 'Plasma reactor',    bl: '#ffb347', glow: 'rgba(255,150,40,.9)',  spin: 700,  fade: 0 }
];
const engName = lv => I18N.T(ENG_LV[lv].ar, ENG_LV[lv].en);
const ENG = { a: 0, w: 0, lv: -1, fan: null, blades: null, blur: null, glow: null, net: null };
/* نقطة على دائرة: الزاوية بالدرجات من الأعلى مع عقارب الساعة */
const eP = (r, d) => { const a = d * Math.PI / 180; return [(24 + r * Math.sin(a)).toFixed(2), (24 - r * Math.cos(a)).toFixed(2)]; };
const eRot = (d, s) => `<g transform="rotate(${d.toFixed(2)} 24 24)">${s}</g>`;
function engineSVG(lv){
  const c = ENG_LV[lv];
  const blurDef = `<radialGradient id="egBlur" cx="50%" cy="50%" r="50%"><stop offset=".2" stop-color="${c.bl}" stop-opacity="${lv === 3 ? .55 : .08}"/><stop offset=".8" stop-color="${c.bl}" stop-opacity=".5"/><stop offset="1" stop-color="${c.bl}" stop-opacity=".1"/></radialGradient>`;
  const spinDef = `<radialGradient id="egSpin" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#c9ced3"/><stop offset="1" stop-color="#5f676e"/></radialGradient>`;
  let defs = blurDef + spinDef, body = '', fan = '', after = '', blurR = 17.6;

  if(lv === 0){
    /* محرك نجمي بغطاء أحمر ومروحة ثنائية تتجاوز الإطار */
    defs += `<radialGradient id="egCowl" cx="40%" cy="32%" r="70%"><stop offset="0" stop-color="#ff7a6b"/><stop offset=".55" stop-color="#d81b1b"/><stop offset="1" stop-color="#6e0909"/></radialGradient>
<linearGradient id="egBlade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#e8ebed"/><stop offset="1" stop-color="#aab2b9"/></linearGradient>`;
    let cyl = '';
    for(let i = 0; i < 9; i++){
      let fins = '';
      for(let k = 0; k < 4; k++) fins += `<line x1="22.5" x2="25.5" y1="${(10 + k * 1.7).toFixed(1)}" y2="${(10 + k * 1.7).toFixed(1)}" stroke="#8c959d" stroke-width=".45"/>`;
      cyl += eRot(i * 40, `<rect x="22.4" y="8.6" width="3.2" height="7.6" rx="1" fill="#3a4047" stroke="#111" stroke-width=".35"/>${fins}`);
      cyl += eRot(i * 40 + 20, `<line x1="24" y1="10.5" x2="24" y2="17" stroke="#6d757c" stroke-width=".55" stroke-linecap="round"/>`);
    }
    body = `<circle cx="24" cy="24" r="21" fill="url(#egCowl)" stroke="rgba(0,0,0,.6)" stroke-width="1"/>
<path d="M9.5 15 A17 17 0 0 1 30 5.6" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.4" stroke-linecap="round"/>
<circle cx="24" cy="24" r="16.4" fill="#141619" stroke="#4a0606" stroke-width="1"/>${cyl}
<circle cx="24" cy="24" r="7.2" fill="#262a2f" stroke="#0b0c0e" stroke-width=".6"/>`;
    const blade = `<path d="M22.6 21.5 C21.4 15 21.1 6 22 -.4 Q24 -2.2 26 -.4 C26.9 6 26.6 15 25.4 21.5 Z" fill="url(#egBlade)" stroke="rgba(0,0,0,.35)" stroke-width=".4"/>
<path d="M22 -.4 Q24 -2.2 26 -.4 L26.3 2.8 L21.7 2.8 Z" fill="#e53935"/>`;
    fan = `<g class="eblades">${eRot(8, blade)}${eRot(188, blade)}</g>
<circle cx="24" cy="24" r="4.8" fill="url(#egSpin)" stroke="rgba(0,0,0,.5)" stroke-width=".5"/>`;
    blurR = 25.4;
  } else if(lv <= 2){
    /* توربوفان: إطار تيتانيوم وشفرات منجلية ومخروط داكن؛ المستوى ٢ يضيف شبكة رقمية سيان */
    const n = lv === 1 ? 18 : 22, cy = lv === 2;
    defs += `<linearGradient id="egRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7f9"/><stop offset=".5" stop-color="#7f8b94"/><stop offset="1" stop-color="#dfe6eb"/></linearGradient>
<radialGradient id="egIn" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${cy ? '#0c2a3c' : '#20272e'}"/><stop offset="1" stop-color="#05080b"/></radialGradient>
<linearGradient id="egFan" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbfdfe"/><stop offset=".55" stop-color="${cy ? '#bcd6e2' : '#bcc6ce'}"/><stop offset="1" stop-color="#5f6b75"/></linearGradient>`;
    let net = '';
    if(cy){
      /* شبكة مضلعات وخطوط دارات ثابتة (حتمية) حول الإطار */
      const pts = Array.from({ length: 28 }, (_, i) => eP(20.6 + 2.8 * Math.abs(Math.sin(i * 2.37)), i * 360 / 28 + 6 * Math.sin(i * 1.7)));
      let l = '';
      pts.forEach((p, i) => { const q = pts[(i + 1) % 28], s = pts[(i + 3) % 28]; l += `M${p[0]} ${p[1]}L${q[0]} ${q[1]}` + (i % 2 ? `M${p[0]} ${p[1]}L${s[0]} ${s[1]}` : ''); });
      const dots = pts.filter((_, i) => i % 3 === 0).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r=".55" fill="#bff6ff"/>`).join('');
      const trace = [64, 92, 118].map(d => { const a = eP(21.4, d), b = eP(25.5, d), e = eP(25.5, d + 9); return `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}L${e[0]} ${e[1]}" fill="none"/><circle cx="${e[0]}" cy="${e[1]}" r=".6" fill="#3fe3ff"/>`; }).join('');
      net = `<g class="enet" stroke="#3fe3ff" stroke-width=".32" stroke-opacity=".75" fill="none"><path d="${l}"/>${dots}${trace}</g>`;
    }
    body = `${net}<circle cx="24" cy="24" r="21" fill="url(#egRim)" stroke="rgba(0,0,0,.55)" stroke-width="1"/>
<circle cx="24" cy="24" r="19" fill="#2a3138" stroke="#0d1013" stroke-width=".5"/>
<circle cx="24" cy="24" r="18.5" fill="url(#egIn)"/>
${cy ? '<circle cx="24" cy="24" r="20" fill="none" stroke="#3fe3ff" stroke-width=".6" stroke-dasharray="2 1.2" opacity=".85"/>' : ''}`;
    const blade = `<path d="M23 18 C22.1 13.5 22 9.5 23.4 5.8 L27.9 6.6 C27 10.2 26.5 14 25.4 18.1 Z" fill="url(#egFan)" stroke="rgba(0,0,0,.42)" stroke-width=".32" stroke-linejoin="round"/>`;
    let bl = '';
    for(let i = 0; i < n; i++) bl += eRot(i * 360 / n, blade);
    fan = `<g class="eblades">${bl}</g>
<circle cx="24" cy="24" r="6.6" fill="#c7cfd5" stroke="rgba(0,0,0,.5)" stroke-width=".5"/>
<circle cx="24" cy="24" r="5" fill="#0b0f13"/>
<circle cx="24" cy="24" r="1.7" fill="${cy ? '#3fe3ff' : '#5d7489'}"/>
<path d="M21.4 21.6 A3.6 3.6 0 0 1 25.8 20.6" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".6" stroke-linecap="round"/>`;
    blurR = 18.2;
  } else {
    /* مفاعل: درع معدني بكتل تثبيت، حلقة احتراق برتقالية دوّارة، ومحور فضي */
    defs += `<radialGradient id="egArm" cx="42%" cy="35%" r="70%"><stop offset="0" stop-color="#6a737b"/><stop offset=".6" stop-color="#2c3238"/><stop offset="1" stop-color="#121518"/></radialGradient>
<radialGradient id="egCore" gradientUnits="userSpaceOnUse" cx="24" cy="24" r="15"><stop offset=".55" stop-color="#fff3c2"/><stop offset=".75" stop-color="#ffab2e"/><stop offset="1" stop-color="#d9480a"/></radialGradient>
<linearGradient id="eFl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#ff8a1a"/><stop offset="1" stop-color="#ff3d00"/></linearGradient>`;
    let plates = '', glints = '';
    for(let i = 0; i < 8; i++) plates += eRot(i * 45 + 22.5, `<rect x="21.2" y=".9" width="5.6" height="4.6" rx=".8" fill="#4c545c" stroke="#15181b" stroke-width=".5"/><line x1="21.9" x2="26.1" y1="1.8" y2="1.8" stroke="#9aa3ab" stroke-width=".4"/>`);
    [[200, 230], [300, 318], [20, 40], [110, 128]].forEach(([a0, a1]) => { const p = eP(21.6, a0), q = eP(21.6, a1); glints += `<path d="M${p[0]} ${p[1]} A21.6 21.6 0 0 1 ${q[0]} ${q[1]}"/>`; });
    body = `<circle class="eflame" cx="24" cy="24" r="23.3" fill="none" stroke="url(#eFl)" stroke-width="1.6"/>
<circle cx="24" cy="24" r="21.6" fill="url(#egArm)" stroke="#0a0c0e" stroke-width=".8"/>${plates}
<g fill="none" stroke="#ffae3a" stroke-width="1.1" stroke-linecap="round" opacity=".95">${glints}</g>
<circle cx="24" cy="24" r="16.6" fill="#16191d" stroke="#6d757d" stroke-width=".9"/>`;
    let seg = '';
    for(let i = 0; i < 12; i++){
      const a = i * 30, p1 = eP(8.6, a + 3), p2 = eP(15, a + 3), p3 = eP(15, a + 26), p4 = eP(8.6, a + 26);
      seg += `<path d="M${p1[0]} ${p1[1]}L${p2[0]} ${p2[1]}A15 15 0 0 1 ${p3[0]} ${p3[1]}L${p4[0]} ${p4[1]}A8.6 8.6 0 0 0 ${p1[0]} ${p1[1]}Z"/>`;
    }
    let vanes = '';
    for(let i = 0; i < 6; i++) vanes += eRot(i * 60 + 15, '<rect x="23.2" y="8.4" width="1.6" height="7" rx=".5"/>');
    fan = `<g class="eblades" fill="url(#egCore)">${seg}</g>
<g fill="#30363c" stroke="#0e1012" stroke-width=".4">${vanes}</g>
<circle cx="24" cy="24" r="7.6" fill="#2a2f35" stroke="#8a929a" stroke-width=".7"/>
<circle cx="24" cy="24" r="5.4" fill="url(#egSpin)"/>
<circle cx="24" cy="24" r="3.1" fill="#d5dade" stroke="#59616a" stroke-width=".6"/>
<circle cx="24" cy="24" r="1.4" fill="#7f8890"/>`;
    blurR = 15.2;
  }
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><defs>${defs}</defs>
<circle class="eglow" cx="24" cy="24" r="21.8" fill="none" stroke="${c.glow}" stroke-width="3"/>
${body}
<circle class="eblur" cx="24" cy="24" r="${blurR}" fill="url(#egBlur)" opacity="0"/>
<g class="efan">${fan}</g>${after}
</svg>`;
}
function engineRender(){
  const b = $('dash-btn'); if(!b) return;
  const lv = Math.min(FODQ.n, 3);
  if(ENG.lv === lv && ENG.fan) return;
  ENG.lv = lv; b.innerHTML = engineSVG(lv);
  b.dataset.eng = ENG_LV[lv].id;
  b.setAttribute('aria-label', I18N.T('اندفاع — ', 'Dash — ') + engName(lv)); b.title = engName(lv);
  ENG.fan = b.querySelector('.efan'); ENG.blades = b.querySelector('.eblades'); ENG.blur = b.querySelector('.eblur'); ENG.glow = b.querySelector('.eglow'); ENG.net = b.querySelector('.enet');
}
/* الدوران: يقلع بسرعة عند الضغط ثم يتباطأ؛ قرص ضبابي يخفي تقطّع الشفرات، والمفاعل يزداد توهجاً بدل أن يختفي */
function engineTick(dt){
  if(!ENG.fan) return;
  const c = ENG_LV[ENG.lv], target = dashT > 0 ? c.spin * 1.8 : (run ? (ENG.lv === 3 ? 30 : 40) : 0);
  if(ENG.boost !== dashT > 0){ ENG.boost = dashT > 0; setDashButton(); if(!ENG.boost) spinSndStop(); }
  ENG.w += (target - ENG.w) * Math.min(1, dt * (target > ENG.w ? 14 : 1.6));
  ENG.a = (ENG.a + ENG.w * dt) % 360;
  ENG.fan.setAttribute('transform', 'rotate(' + ENG.a.toFixed(1) + ' 24 24)');
  const f = Math.min(1, ENG.w / (ENG.lv === 3 ? 600 : 1100));
  ENG.blades.style.opacity = (1 - c.fade * f).toFixed(2);
  ENG.blur.setAttribute('opacity', (.9 * f).toFixed(2));
  ENG.glow.setAttribute('stroke-width', (2 + 3 * f).toFixed(2));
  if(ENG.net) ENG.net.setAttribute('transform', 'rotate(' + (-ENG.a * .04).toFixed(2) + ' 24 24)');
}
/* ===== أصوات المسرّعات: توليف Web Audio أصلي لكل محرك، وتُفصل كل العقد بعد انتهائها ===== */
let engNoise = null;
function engNoiseBuf(){
  if(engNoise && engNoise.sampleRate === actx.sampleRate) return engNoise;
  const len = (actx.sampleRate * 1.3) | 0, b = actx.createBuffer(1, len, actx.sampleRate), d = b.getChannelData(0);
  for(let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return (engNoise = b);
}
function engineSnd(lv){
  if(!soundEnabled || !actx || document.hidden) return;
  const t = actx.currentTime + .005, nodes = [], srcs = [];
  const mk = n => { nodes.push(n); return n; };
  const osc = (type, f) => { const o = mk(actx.createOscillator()); o.type = type; o.frequency.setValueAtTime(f, t); srcs.push(o); return o; };
  const amp = v => { const g = mk(actx.createGain()); g.gain.setValueAtTime(v, t); return g; };
  const filt = (type, f, q) => { const b = mk(actx.createBiquadFilter()); b.type = type; b.frequency.setValueAtTime(f, t); b.Q.value = q || 1; return b; };
  const noise = () => { const s = mk(actx.createBufferSource()); s.buffer = engNoiseBuf(); srcs.push(s); return s; };
  /* غلاف: صعود ← ثبات ← خفوت أسي، مع بداية مؤجلة اختيارية */
  const env = (g, peak, at, a, hold, rel) => { g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(peak, t + at + a); g.gain.setValueAtTime(peak, t + at + hold); g.gain.exponentialRampToValueAtTime(.0001, t + at + hold + rel); };
  const chain = (...ns) => { for(let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); };
  const out = amp(.9); out.connect(sfxOut());
  let dur;
  if(lv === 0){
    /* مروحي: سعال المُشغِّل ثم احتراقات مكبس تتسارع (نبض مربع يقطّع منشارياً مفلتراً) */
    const o = osc('sawtooth', 46); o.frequency.exponentialRampToValueAtTime(98, t + .7);
    const lfo = osc('square', 12); lfo.frequency.exponentialRampToValueAtTime(44, t + .7);
    const am = amp(.5), depth = amp(.5), g = amp(0);
    chain(lfo, depth); depth.connect(am.gain);
    chain(o, filt('lowpass', 560, 2.5), am, g, out); env(g, .2, 0, .04, .6, .32);
    const ng = amp(0); chain(noise(), filt('bandpass', 850, 1.4), ng, out); env(ng, .16, 0, .005, .05, .12);
    dur = 1;
  } else if(lv === 1){
    /* توربوفان: صفير توربيني صاعد + هسيس هواء يتسع + هدير منخفض */
    const w1 = osc('triangle', 380), w2 = osc('sine', 571);
    w1.frequency.exponentialRampToValueAtTime(2300, t + .6); w2.frequency.exponentialRampToValueAtTime(3450, t + .6);
    const wg = amp(0); chain(w1, wg); chain(w2, wg); wg.connect(out); env(wg, .06, 0, .08, .5, .35);
    const bp = filt('bandpass', 300, .8); bp.frequency.exponentialRampToValueAtTime(2800, t + .55);
    const ng = amp(0); chain(noise(), bp, ng, out); env(ng, .28, 0, .12, .42, .4);
    const r = osc('sine', 62), rg = amp(0); chain(r, rg, out); env(rg, .14, 0, .05, .5, .3);
    dur = 1;
  } else if(lv === 2){
    /* رقمي: صفير متدرّج بخطوات (كمّي) + نغمات بيانات متتابعة + هسيس عالي النبرة */
    const w = osc('square', 500), lp = filt('lowpass', 3200, 1), wg = amp(0);
    for(let i = 1; i <= 14; i++) w.frequency.setValueAtTime(500 * Math.pow(1.13, i), t + i * .038);
    chain(w, lp, wg, out); env(wg, .045, 0, .02, .55, .25);
    const b = osc('sine', 1760), bg = amp(0); chain(b, bg, out);
    bg.gain.setValueAtTime(0, t);
    [1760, 2349, 3136, 4186].forEach((f, i) => { const s = t + .06 + i * .085; b.frequency.setValueAtTime(f, s); bg.gain.setValueAtTime(.07, s); bg.gain.setValueAtTime(0, s + .045); });
    const hp = filt('bandpass', 1200, 1.2); hp.frequency.exponentialRampToValueAtTime(5200, t + .6);
    const ng = amp(0); chain(noise(), hp, ng, out); env(ng, .16, 0, .1, .45, .3);
    const r = osc('triangle', 80), rg = amp(0); chain(r, rg, out); env(rg, .12, 0, .04, .4, .3);
    dur = .95;
  } else {
    /* مفاعل: طنين نووي عميق + شحن رنّان يتصاعد + انفجار اشتعال مع لمعان */
    const sub = osc('sine', 38), sg = amp(0); sub.frequency.exponentialRampToValueAtTime(66, t + .9);
    chain(sub, sg, out); env(sg, .3, 0, .1, .8, .3);
    const saw = osc('sawtooth', 70); saw.frequency.exponentialRampToValueAtTime(300, t + .55);
    const lp = filt('lowpass', 160, 9); lp.frequency.exponentialRampToValueAtTime(2600, t + .55);
    const cg = amp(0); chain(saw, lp, cg, out); env(cg, .09, 0, .3, .3, .25);
    const ng = amp(0), nl = filt('lowpass', 2200, .7); chain(noise(), nl, ng, out); env(ng, .34, .52, .01, .08, .5);
    const sh = osc('sine', 1250), tr = osc('sine', 22), td = amp(.012), shg = amp(0);
    sh.frequency.exponentialRampToValueAtTime(2500, t + 1); chain(tr, td); td.connect(shg.gain);
    chain(sh, shg, out); env(shg, .025, .5, .05, .25, .4);
    dur = 1.25;
  }
  let left = srcs.length;
  srcs.forEach(s => { s.onended = () => { if(--left === 0) nodes.forEach(n => { try { n.disconnect(); } catch(e){} }); }; s.start(t); s.stop(t + dur); });
}
/* صوت الدوران المستمر طوال الاندفاع: أزيز توربين يتقطّع بإيقاع مرور الشفرات ويتصاعد، ثم يخفت عند التوقف */
let spinNode = null;
function spinSndStop(){
  const s = spinNode; spinNode = null;
  if(!s || !actx) return;
  const t = actx.currentTime;
  try { s.g.gain.cancelScheduledValues(t); s.g.gain.setValueAtTime(Math.max(.0001, s.g.gain.value), t); s.g.gain.exponentialRampToValueAtTime(.0001, t + .35); } catch(e){}
  s.srcs.forEach(o => { try { o.stop(t + .4); } catch(e){} });
}
function spinSnd(lv, dur){
  spinSndStop();
  if(!soundEnabled || !actx || document.hidden) return;
  const t = actx.currentTime + .01, nodes = [], srcs = [];
  const mk = n => { nodes.push(n); return n; };
  const base = [90, 140, 180, 60][lv], rate = [18, 26, 32, 14][lv];
  const g = mk(actx.createGain()); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .15);
  g.connect(sfxOut());
  /* نبض الشفرات: LFO يقطّع المستوى بإيقاع يتسارع */
  const chop = mk(actx.createGain()); chop.gain.value = .55; chop.connect(g);
  const lfo = mk(actx.createOscillator()); lfo.type = 'triangle'; lfo.frequency.setValueAtTime(rate * .5, t); lfo.frequency.exponentialRampToValueAtTime(rate, t + .3);
  const depth = mk(actx.createGain()); depth.gain.value = .45; lfo.connect(depth); depth.connect(chop.gain); srcs.push(lfo);
  /* أزيز منشاري مفلتر يرتفع نغمه */
  const o = mk(actx.createOscillator()); o.type = 'sawtooth'; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 2.4, t + .35);
  const lp = mk(actx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = lv === 3 ? 900 : 1600; lp.Q.value = 3;
  const og = mk(actx.createGain()); og.gain.value = .35; o.connect(lp); lp.connect(og); og.connect(chop); srcs.push(o);
  /* هواء مندفع */
  const n = mk(actx.createBufferSource()); n.buffer = engNoiseBuf(); n.loop = true;
  const bp = mk(actx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(lv === 3 ? 1400 : 2600, t + .35); bp.Q.value = 1.2;
  const ng = mk(actx.createGain()); ng.gain.value = .5; n.connect(bp); bp.connect(ng); ng.connect(chop); srcs.push(n);
  let left = srcs.length;
  srcs.forEach(s => { s.onended = () => { if(--left === 0) nodes.forEach(x => { try { x.disconnect(); } catch(e){} }); }; s.start(t); s.stop(t + dur + .5); });
  g.gain.setValueAtTime(.16, t + Math.max(.16, dur - .1)); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .4);
  spinNode = { g, srcs };
}
function fodRender(){
  engineRender();
  const el = $('fod-col'); if(!el) return;
  el.dataset.lv = FODQ.n; el.querySelectorAll('.fs').forEach((s, i) => s.classList.toggle('on', i < FODQ.n));
  const b = $('dash-btn'); if(b) b.dataset.lv = FODQ.n;
  const l = $('fod-lv'); if(l) l.textContent = engName(Math.min(FODQ.n, 3)) + ' ' + I18N.T(FOD_NAMES[FODQ.n] + '/٤', (FODQ.n + 1) + '/4');
}
engineRender();
/* لوحة FOD تبقى في سطر الشريط نفسه: إن غطّى توسيطُها الكبسولاتِ المجاورة (شاشات صغيرة)
   تنتقل إلى منتصف الفراغ بين المجموعتين وتصغر قليلاً بقدر الحاجة؛ لا تنزل سطراً إلا إن ضاق الفراغ جداً */
function placeFod(){
  const el = $('fod-col'), hud = $('hud'); if(!el || !hud) return;
  const a = hud.querySelector('.hud-start'), b = hud.querySelector('.hud-end'); if(!a || !b) return;
  el.style.left = ''; el.style.transform = ''; el.classList.remove('fod-low');
  const H = hud.getBoundingClientRect(), f = el.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
  if(!f.width || !H.width) return;
  const lg = ra.left < rb.left ? ra : rb, rg = lg === ra ? rb : ra, M = 8;
  const lo = lg.right + M, hi = rg.left - M;
  if(f.left >= lo && f.right <= hi) return;   // التوسيط العادي لا يغطي شيئاً
  const s = Math.min(1, (hi - lo) / f.width);
  if(s < 0.62){ el.classList.add('fod-low'); return; }
  el.style.left = ((lo + hi) / 2 - H.left) + 'px';
  el.style.transform = 'translateX(-50%) scale(' + s.toFixed(3) + ')';
}
{
  let fodRaf = 0;
  const q = () => { if(!fodRaf) fodRaf = requestAnimationFrame(() => { fodRaf = 0; placeFod(); }); };
  addEventListener('resize', q); addEventListener('orientationchange', q);
  if(window.ResizeObserver){ const ro = new ResizeObserver(q); document.querySelectorAll('#hud .hud-start, #hud .hud-end, #fod-col').forEach(e => ro.observe(e)); }
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(q);
  q();
}
function fodCollect(){
  const was = FODQ.n; FODQ.n = Math.min(3, FODQ.n + 1);
  const up = FODQ.n > was, el = $('fod-col'), slot = el && el.querySelector('.fs[data-i="' + FODQ.n + '"]');
  fodRender();
  screenFlash('gold');
  if(up){
    snd('fever'); hitStopNow();
    if(slot){ slot.classList.remove('pop'); void slot.offsetWidth; slot.classList.add('pop'); }
    if(el){ el.classList.remove('cele'); void el.offsetWidth; el.classList.add('cele'); }
    const b = $('dash-btn'); if(b){ b.classList.remove('lvup', 'lvdown'); void b.offsetWidth; b.classList.add('lvup'); }
    try { if(slot && fwCv){ const r = slot.getBoundingClientRect(), c = fwCv.getBoundingClientRect(); fwBurst(r.left - c.left + r.width / 2, r.top - c.top + r.height / 2, 38, [28, 200, 48][FODQ.n - 1]); } } catch(e){}
    fwShow(FODQ.n === 3 ? 5 : FODQ.n + 1);
    const c = dashCfg();
    spawnFloatTag('⚡ ' + I18N.T('المستوى ', 'Level ') + (FODQ.n + 1), '#ffd54a', 'big');
    toast(I18N.T('⚡ مسرّع جديد: ' + engName(FODQ.n) + ' — المستوى ' + (FODQ.n + 1) + ' — مدة ' + c.t + ' ث وأسرع ×' + c.k, '⚡ New booster: ' + engName(FODQ.n) + ' — Level ' + (FODQ.n + 1) + ' — ' + c.t + 's and ×' + c.k + ' faster'), '#ffd54a');
    if(FODQ.n === 3) tip('fodmax', I18N.T('🏆 اكتملت تجميعات FOD — اندفاع بأقصى مستوى', '🏆 FOD collection complete — max dash'), '#ffd54a');
  } else {
    snd('ok'); fwShow(1);
    toast(I18N.T('⭐ اندفاعك في أقصى مستوى', '⭐ Dash already at max level'), '#ffd54a');
  }
}
/* كل فرز خاطئ يُسقط ترقية اندفاع واحدة (تدريجياً حتى المستوى الأساسي) */
function fodLose(){
  if(FODQ.n <= 0) return;
  FODQ.n--;
  if(dashT > 0) dashT = Math.min(dashT, dashCfg().t);
  fodRender(); setDashButton();
  const b = $('dash-btn'); if(b){ b.classList.remove('lvdown', 'lvup'); void b.offsetWidth; b.classList.add('lvdown'); }
  const el = $('fod-col'), slot = el && el.querySelector('.fs[data-i="' + (FODQ.n + 1) + '"]');
  if(slot){ slot.classList.remove('lost'); void slot.offsetWidth; slot.classList.add('lost'); }
  spawnFloatTag('⚡ ' + I18N.T('−ترقية', '−upgrade'), '#ff8a65');
  tip('fodlose', I18N.T('⚠️ الفرز الخاطئ يُفقدك ترقية من سرعة الاندفاع', '⚠️ Wrong sorts cost you a dash speed upgrade'), '#ff8a65');
}
function resolvePlacement(z, it){
const d = it.data;
if(d.isFod){
const bonus=gameRules.reward(true,z.k);
if(bonus){score+=bonus;rm(it);fodCollect();progEmit('fod');snd('ok');spawnFloatTag('+'+bonus+' FOD','#69f0ae');toast(I18N.T('✔ جمع الجسم الغريب +','✔ FOD collected +')+bonus+I18N.T(' نقطة',' pts'),'#69f0ae');}
else {it.st='floor';it.fall=false;it.m.position.set(px.x, .2, Math.max(-4,px.z+1.5));snd('warn');tip('fodbox', '🔩 ضعه في صندوق FOD الأحمر','#ffd54a');}
hud();return;
}
if(z.k==='fod'){ it.st='floor';it.fall=false;it.m.position.set(z.x,.7,-4);snd('warn');tip('fodonly', 'هذا الصندوق للأجسام الغريبة FOD فقط','#ffd54a');hud();return; }
if(d.isMys){ mystery(it); return; }
totalProcessed++;
const verdict = gameRules.placement.decide(z, d, z.items);
let ok = verdict.ok;
let conflict = verdict.conflict;
let conflictReason = '', conflictWith = null;
if(verdict.reason === 'cao-pax'){
conflictReason = I18N.T('طرد CAO — طائرة شحن فقط! لا يُحمّل على رحلة ركاب: ارفضه عند الفحص.','CAO parcel — cargo aircraft only! Never load it on a passenger flight: refuse it at the check.');
} else if(verdict.reason === 'hazardous-only'){
conflictReason = I18N.t('هذه الحاوية مخصصة فقط للمواد الخطرة (DGR)!');
} else if(verdict.reason === 'iata-conflict'){
let hasConflict = false;
for(const placed of z.items){
if(gameRules.conflict(d, placed.data)){
hasConflict = true; conflictWith = placed.data;
conflictReason = I18N.T('تعارض IATA: لا يُخلط [','IATA conflict: never stow [') + `${d.imp} . ${d.div}] ` + I18N.T('مع [','with [') + `${placed.data.imp} . ${placed.data.div}` + I18N.T('] في حاوية واحدة!','] in one container!');
break;
}
}
if(hasConflict){ conflict = true; ok = false; }
} else if(!ok && d.isHz){
conflictReason = I18N.T('ممنوع وضع مادة خطرة (','Never stow a dangerous good (') + `${d.imp} . ${d.div}) ` + I18N.t('في مناطق الشحن العادي! ضعها في إحدى حاويات المواد الخطرة.');
} else if(!ok){
conflictReason = 'منطقة فرز غير مطابقة لنوع الشحنة!';
}
if(ok){
sortedCount++;
progEmit('sort', { ok: true }); if(d.isHz) progEmit('dgr', { ok: true });
if(window.Prog) Prog.onSorted(it, true);
/* ذروة الشحن تضاعف نقاط الفرز */
const p = Math.round(gameRules.economy.sortReward({ isHz: !!d.isHz, combo, fever: feverT > 0 }) * (window.Prog ? Prog.scoreK() : 1));
score += p;
streak++; streakT = streakWindow(); maxStreak = Math.max(maxStreak, streak);
combo = gameRules.economy.comboAfter(streak);
time += 3;
balletOnSort();
let critMsg = '';
if(it.crit){
/* Large tier: hit-stop + ضربة اهتزاز + وميض ذهبي + رقم كبير بارتداد */
score += gameRules.economy.critBonus; time += 5;
const heatB = window.Prog ? Prog.heatBonus() : 0;
if(heatB){ score += heatB; setTimeout(() => spawnFloatTag('+' + heatB + ' 🌡️', '#ffb74d'), 260); }
snd('fever');
hitStopNow(.05); addShake(.6); screenFlash('gold');
spawnFloatTag('+' + gameRules.economy.critBonus + ' ❄️ +5 ث', '#69f0ae', 'big');
critMsg = I18N.T(' • ❄️ طرد تبريد +',' • ❄️ chilled parcel +') + gameRules.economy.critBonus + I18N.T(' و +5 ث',' and +5s');
clearCrit(it);
}
/* Medium tier: طرد خطير أو كومبو ≥3 ⇒ اهتزاز خفيف ووميض ذهبي للشارة */
if(!it.crit && (d.isHz || combo >= 3)){ addShake(.25); snd('crit'); }
if(streak >= 10 && streak % 10 === 0) startFever();
if(d.isHeavy){ score += gameRules.heavy.deliverReward; hv.item = null; spawnFloatTag('+' + gameRules.heavy.deliverReward + ' 🏗️', '#ffd54a', 'big'); fwShow(3); snd('cardwin'); }
snd('ok', 1 + Math.min(streak, STREAK_MAX) * .05);
spawnFloatTag(I18N.T('+3 ث ⏱','+3s ⏱'), '#69f0ae');
let chainMsg = '';
if(streak > 4){
const b = gameRules.economy.chainBonus(streak);
score += b; chainMsg = I18N.T(` • سلسلة +${b} 🔥`,` • chain +${b} 🔥`);
stageEl.classList.remove('flash'); void stageEl.offsetWidth; stageEl.classList.add('flash');
setTimeout(() => stageEl.classList.remove('flash'), 550);
snd('ship', 1 + Math.min(streak, 8) * .04);
}
toast(I18N.T(`✔ فرز متوافق +${p}`,`✔ Compatible sort +${p}`) + chainMsg + critMsg + (d.isHz ? ` [${d.imp} . ${d.div}]` : ''), '#69f0ae');
const i = z.hz ? z.items.length : z.n_++ % z.cap;
if(z.items[i]) rm(z.items[i]);
z.items[i] = it; it.st = 'placed'; if(z.hz) drawZoneSign(z);
const slot = gameRules.layout.containerSlot(z, i);
it.m.position.set(slot.x, slot.y, slot.z);
it.m.rotation.set(0,0,0); it.fall = true; it.vy = 0; it.ty = 0.06 + BH;
if(z.hz && z.items.length >= z.cap) ship(z);
} else {
const pen = gameRules.economy.penalty(conflict);
const lost = Math.min(score, pen);
score = Math.max(0, score - pen);
combo = 1; streak = 0; streakT = 0;
{
const mk = verdict.reason === 'cao-pax' ? 'cao' : verdict.reason === 'hazardous-only' ? 'hz-only' : conflictWith ? 'iata' : d.isHz ? 'hz-general' : 'zone';
logMistake({ k: mk, a: d, b: conflictWith, zone: z.k, pts: pen });
}
progEmit('sort', { ok: false }); if(d.isHz || conflict) progEmit('dgr', { ok: false });
if(window.Prog) Prog.onSorted(it, false);
snd('error');
penaltyFx(lost, conflict);
fodLose();
balletReset();
spawnFloatTag('−' + pen, '#ff5252', conflict ? 'big' : undefined);
if(conflict){
/* Large tier: تعارض IATA جسيم — وقفة + صدمة اهتزاز + وميض أحمر */
hitStopNow(.05); addShake(.6); screenFlash('red');
stageEl.classList.remove('conflict'); void stageEl.offsetWidth; stageEl.classList.add('conflict');
setTimeout(() => stageEl.classList.remove('conflict'), 900);
}
toast(`✖ ${conflictReason} (−${pen} ` + I18N.T('نقطة)', 'pts)'), '#ff5252');
rm(it);
}
hud();
}
function mountDrive(){
if(FD.on || FD.left <= 0 || held || liftAnim.active) return;
if(!FD.unlocked){ cardsOpen(); return; }   // التشغيل يتطلب حل لغز البطاقات أولاً
FD.on = true; FD.near = false;
fk.visible = true;
/* السائق هو الشخصية المختارة نفسها جالسة على المقعد (شخصيات Mixamo)؛ غيرها تبقى على المجسّم الاحتياطي */
const sc = activeCharRig();
if(sc && sc.sitCfg && sc.root.visible){ FD.seated = sc; forkDriver.visible = false; }
else { FD.seated = null; crewShow(false); forkDriver.visible = true; }
px.set(fk.position.x, 0, fk.position.z);
snd('horn');
toast(I18N.T('🚜 قُد الرافعة الشوكية','🚜 Driving the forklift'), '#ffd54a');
hud();
}
function stopDrive(msg){
if(!FD.on) return;
FD.on = false;
if(FD.seated){ FD.seated.root.position.set(0, 0, 0); FD.seated.root.scale.setScalar(FD.seated.baseScale || 1); FD.seated = null; }
crewShow(true); forkDriver.visible = false;
const ox = Math.cos(fk.rotation.y) * 2.1, oz = -Math.sin(fk.rotation.y) * 2.1;
/* النزول بجانب الرافعة في نقطة حرة فعلاً (الجانب الأيمن ثم الأيسر ثم أقرب مكان خالٍ) */
const side = (sg) => ({ x: Math.max(-33, Math.min(33, fk.position.x + sg*ox)), z: Math.max(-11, Math.min(9.7, fk.position.z + sg*oz)) });
let spot = side(1);
if(blockedAt(spot.x, spot.z)){ const alt = side(-1); spot = blockedAt(alt.x, alt.z) ? findFreeSpot(spot.x, spot.z) : alt; }
px.set(spot.x, 0, spot.z);
if(held){
const h = held; held = null;
h.st = 'floor'; h.fall = true; h.vy = 0; h.ty = h.data.isFod ? .2 : 0.02 + BH;
h.m.position.set(gameRules.forklift.forkX(fk.position.x, fk.rotation.y), gameRules.forklift.carryY, gameRules.forklift.forkZ(fk.position.z, fk.rotation.y));
}
clearMovement(); snd('ok');
if(msg) toast(msg, '#ffd54a');
hud();
}
// سر اللعبة: بضائع الرافعة — بلا أي تلميح أو رسالة تعليمية
function forkCargo(){
const pool = [];
for(const it of items){
if(it.st !== 'floor' && it.st !== 'belt') continue;
if(it.data.isMys) continue;
pool.push({x: it.m.position.x, z: it.m.position.z, it});
}
const found = gameRules.forklift.nearest(pool, fk.position.x, fk.position.z);
return found ? found.it : null;
}
function forkLoad(it){
/* طرد CAO: لا يُحمّل بالرافعة قبل فحص القبول/الرفض */
if(it.data.cao && !it.caoChecked){ caoOpen(it); return; }
held = it; it.st = 'held';
it.fall = false; it.vy = 0;
cargoSmoothPos.copy(it.m.position);
snd('pick');
}
function forkUnload(){
const it = held; held = null;
if(inFrzZone(fk.position.x, fk.position.z)){ frzDrop(it, fk.position.x); hud(); return; }
const z = Z.find(z => Math.abs(fk.position.x - z.x) < z.hw && fk.position.z < -4.9 && !z.full);
if(z){ it.st = 'floor'; resolvePlacement(z, it); return; }
it.st = 'floor'; it.fall = true; it.vy = 0; it.ty = it.data.isFod ? .2 : 0.02 + BH;
it.m.position.set(gameRules.forklift.forkX(fk.position.x, fk.rotation.y), gameRules.forklift.carryY, gameRules.forklift.forkZ(fk.position.z, fk.rotation.y));
it.m.rotation.set(0, fk.rotation.y, 0);
snd('place');
hud();
}
// نزول بزر الشريط نفسه (يترك ✋ لتحميل البضائع)
const _drvEl = $('drv');
if(_drvEl) _drvEl.onclick = () => { if(FD.on) stopDrive(I18N.t('🚜 نزلت من الرافعة')); };
function act(){
initAudio();
if(!run || liftAnim.active || caoQ.active || frzP.active || cardP.active || uldP.active) return;
if(FD.on){
if(held) forkUnload();
else { const it = forkCargo(); if(it) forkLoad(it); else stopDrive(); }
return;
}
/* الحيوان الأليف: الإمساك به ووضعه في القفص له الأولوية حين يكون قريباً */
if(window.Prog && Prog.act()) return;
if(!held && FD.near && FD.left > 0){ mountDrive(); return; }
if(!held && uldStationNear()){ uldStationUse(); return; }
// تشغيل زر إبطاء الحزام بالوقوف بجانبه والضغط على ✋
if(!held && !near && !beltSlowUsed && Math.hypot(px.x - BELT_BTN_XZ.x, px.z - BELT_BTN_XZ.z) < 2.4){ useBeltSlow(); return; }
if(!held){
if(!near) return;
const targetItem = near;
if(!gameRules.heavy.canLiftByHand(targetItem.data)){ snd('error'); toast(I18N.T('⚠️ الطرد ثقيل (' + gameRules.heavy.kg + ' كغ) — استخدم الرافعة الشوكية', '⚠️ The parcel is too heavy (' + gameRules.heavy.kg + ' kg) — use the forklift'), '#ffb020'); return; }
/* طرد CAO: يُفتح فحص القبول/الرفض قبل أي تحميل */
if(targetItem.data.cao && !targetItem.caoChecked){ caoOpen(targetItem); return; }
const lastSecond = targetItem.st === 'belt' && targetItem.m.position.x > 18.5;
liftAnim.active = true; liftAnim.t = 0;
liftAnim.fromPos.copy(targetItem.m.position);
liftAnim.toHold = targetItem;
targetItem.st = 'lifting';
snd('pick');
const d = targetItem.data;
if(d.isHz){
tip('dg-' + d.imp + d.div, I18N.T('⚠️ تم التقاط مادة خطرة: ','⚠️ Dangerous good picked up: ') + `${d.imp} . ${d.div}`, '#ffb020');
} else if(d.isFrz){
tip('frz-pick', I18N.T('🧊 طرد مجمّد: أوصله إلى غرفة التجميد (يسار المستودع) — الباب مقفل وتحتاج لحل اللغز','🧊 Frozen parcel: take it to the freezer room (left side) — the door is locked, solve the puzzle'), '#8fe3ff');
} else {
toast(I18N.T('تم الالتقاط: ','Picked up: ') + d.name, '#fff');
}
if(lastSecond){
score += 25;
snd('ok', 1.4);
spawnFloatTag('⚡ إنقاذ +25', '#69f0ae');
toast('⚡ التقاط في اللحظة الأخيرة +25', '#ffd54a');
hud();
}
} else {
if(inFrzZone(px.x, px.z)){
const it = held; held = null;
frzDrop(it, px.x); hud();
return;
}
const z = Z.find(z => Math.abs(px.x - z.x) < z.hw && px.z < -4.8 && !z.full);
if(z){
const it = held; held = null;
resolvePlacement(z, it);
} else {
dropHeldAtFeet();
}
hud();
}
}
/* إسقاط فوري للطرد المحمول على الأرض أمام اللاعب (بلا اشتراط حاوية) */
function dropHeldAtFeet(){
if(!held) return false;
snd('place');
held.st = 'floor';
held.m.position.set(Math.max(-33, Math.min(33, px.x + Math.sin(rig.rotation.y)*1.25)), 1.05, Math.max(-11.9, Math.min(9.6, px.z + Math.cos(rig.rotation.y)*1.25)));
held.m.rotation.set(0, rig.rotation.y, 0); held.fall = true; held.vy = 0; held.ty = held.data.isFod ? .2 : 0.02 + BH;
held = null;
hud();
return true;
}
/* إيقاف/استئناف مؤقت بمفتاح Esc أو P */
const CTRL_HINT = I18N.T('🎮 الحركة [WASD أو الأسهم] • الالتقاط/التفاعل [E أو F أو مسافة] • الإسقاط السريع [Q/X] • الجري [Shift] • الاندفاع [Enter] • الإيقاف [Esc]', '🎮 Move [WASD / arrows] • Pick up [E/F/Space] • Quick drop [Q/X] • Sprint [Shift] • Dash [Enter] • Pause [Esc]');
function pauseGame(){
if(!run || introHold || FD.on || fire.active) return;
showIntro(I18N.T('<b class="t">⏸ إيقاف مؤقت</b>اضغط <b style="display:inline">Esc</b> أو <b style="display:inline">P</b> للمتابعة.<span class="hint">', '<b class="t">⏸ Paused</b>Press <b style="display:inline">Esc</b> or <b style="display:inline">P</b> to resume.<span class="hint">') + CTRL_HINT + '</span>',0,true);
clearTimeout(introT);
}
addEventListener('keydown', e => {
if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyQ','KeyX'].includes(e.code)) e.preventDefault();
if(introHold){ if(['Space','KeyE','KeyF','Enter','NumpadEnter','Escape','KeyP'].includes(e.code)){ e.preventDefault(); if(!e.repeat) resumeFromIntro(); } return; }
if(caoQ.active){
  e.preventDefault();
  if(caoQ.mode === 'quiz' && !e.repeat){
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if(n !== undefined && !caoQ.answered && QUIZ_BUBBLE.classList.contains('in')) quizAnswer(n);
    else if(caoQ.answered && ['Enter','NumpadEnter','Space','Escape'].includes(e.code)) caoEnd();
  }
  return;
}
if(frzP.active){ frzKey(e); return; }
if(cardP.active){ e.preventDefault(); if(e.code === 'Escape') cardsClose(); return; }
if(uldP.active){ if(e.code === 'Escape'){ e.preventDefault(); uldClose(); } else if(e.code === 'Enter'){ e.preventDefault(); uldSubmit(); } return; }
if(fire.keypad){ handlePadKey(e); return; }
key[e.code] = 1;
/* Esc / P = إيقاف مؤقت أو متابعة */
if(e.code === 'Escape' || e.code === 'KeyP'){ e.preventDefault(); if(!e.repeat && !FD.on) pauseGame(); return; }
/* إدخال (Enter) = اندفاع سريع */
if(e.code === 'Enter' || e.code === 'NumpadEnter'){
  e.preventDefault();
  if(!e.repeat) doDash();
  return;
}
/* Q / X = إسقاط سريع للطرد المحمول */
if(e.code === 'KeyQ' || e.code === 'KeyX'){
  e.preventDefault();
  if(!e.repeat && run && !liftAnim.active && !FD.on) dropHeldAtFeet();
  return;
}
/* مسافة / E / F = التقاط وتفاعل وركوب الرافعة */
if(['Space','KeyE','KeyF'].includes(e.code)){ e.preventDefault(); if(!e.repeat) act(); }
});
addEventListener('keyup', e => key[e.code] = 0);
function clearMovement(){ for(const code in key) key[code] = 0; if(window.__joyReset) window.__joyReset(); inX = inZ = animSpd = 0; }
/* ===== نقطة البداية الآمنة: لا يقف اللاعب داخل جدار أو صندوق عند انتقال المرحلة ===== */
const SAFE_SPAWN = {x:0, z:3};
function blockedAt(x, z, r = PLAYER_RADIUS){
  if(x < WALK.minX + r || x > WALK.maxX - r || z < WALK.minZ + r || z > WALK.maxZ - r) return true;
  for(const o of STATIC_OBSTACLES)
    if(x + r > o.minX && x - r < o.maxX && z + r > o.minZ && z - r < o.maxZ) return true;
  for(const b of BOLLARDS)
    if(Math.hypot(x - b.x, z - b.z) < r + b.r) return true;
  if(!FD.on){ const fh = fkHalf(); if(Math.abs(x - fk.position.x) < fh.hx + r && Math.abs(z - fk.position.z) < fh.hz + r) return true; }
  return false;
}
function findFreeSpot(x, z, r = PLAYER_RADIUS){
  if(!blockedAt(x, z, r)) return {x, z};
  for(let ring = 1; ring <= 18; ring++){
    const d = ring * 0.6;
    for(let i = 0; i < 16; i++){
      const a = (i / 16) * Math.PI * 2;
      const nx = Math.max(WALK.minX, Math.min(WALK.maxX, x + Math.cos(a) * d));
      const nz = Math.max(WALK.minZ, Math.min(WALK.maxZ, z + Math.sin(a) * d));
      if(!blockedAt(nx, nz, r)) return {x:nx, z:nz};
    }
  }
  return {x, z};
}
/* إخراج أي طرد كان في منتصف حركة الرفع ثم تصفير كل أقفال الحركة وإعادة اللاعب لنقطة آمنة */
function safeSpawnPlayer(){
  if(liftAnim.active){
    const pending = liftAnim.toHold;
    liftAnim.active = false; liftAnim.t = 0; liftAnim.toHold = null;
    if(pending && pending.m){
      pending.st = 'floor'; pending.fall = true; pending.vy = 0;
      pending.ty = pending.data && pending.data.isFod ? .2 : 0.02 + BH;
    }
  }
  fearT = 0; inX = inZ = animSpd = 0; clearMovement();
  if(held && held.m) held.m.position.set(px.x, 1.38, px.z);
  const spot = findFreeSpot(SAFE_SPAWN.x, SAFE_SPAWN.z);
  px.set(spot.x, 0, spot.z);
  curRotY = 0; turnLean = 0;
  rig.rotation.set(0, 0, 0);
  last = performance.now();
}
addEventListener('blur', clearMovement);
/* التبويب المخفي يجمّد اللعبة، فنعلّق الصوت أيضاً (المحيط والارتطامات والصفارة) ونستأنفه عند العودة */
document.addEventListener('visibilitychange', () => {
  if(document.hidden){ clearMovement(); if(actx && actx.state === 'running') actx.suspend().catch(() => {}); try{ speechSynthesis.pause(); }catch(e){} }
  else { if(actx && actx.state === 'suspended') actx.resume().catch(() => {}); try{ speechSynthesis.resume(); }catch(e){} }
});
R.domElement.tabIndex = 0;
R.domElement.addEventListener('pointerdown', () => R.domElement.focus({preventScroll:true}));
document.addEventListener('pointerdown', e => {
if(!introHold) return;
if(e.target.closest && e.target.closest('.top-btns, #rules')) return;
e.preventDefault(); e.stopPropagation();
initAudio(); resumeFromIntro(); R.domElement.focus({preventScroll:true});
}, true);
$('act').addEventListener('pointerdown', e => { e.preventDefault(); act(); });
$('code-pad').addEventListener('click', e => {
const b = e.target.closest('button[data-k]');
if(!b) return;
e.preventDefault(); codePress(b.dataset.k);
});
/* جويستيك اللمس يُدار بالكامل من game/touch-ui.js
   ونكتفي هنا بكشف متجه الحركة الحالي حتى يكتب فيه (نفس joy.x/joy.y المستخدم أدناه) */
const jy = $('joy');
window.__gameJoy = joy;
window.__initAudio = initAudio;
$('dash-btn').addEventListener('pointerdown', e => { e.preventDefault(); doDash(); });
function setStage(n,silent){
stage=n;
inspector.demo=false; demo.insp=false; demo.truck=false;
if(n > 1 && (!demo.inspDone || !demo.truckDone)){ demo.inspDone=true; demo.truckDone=true; saveTutorialDone(); }
hideIntro();
if(n===2) resetInspector();
if(n>=3) resetTruck();
/* بداية الوردية (silent): نقطة البداية الآمنة مع تصفير أقفال الحركة.
   الترقّي أثناء اللعب لا يقطع الحركة: يبقى اللاعب حيث هو (غالباً عند منطقة الفرز) بما يحمله،
   ولا يُزاح إلى أقرب موضع فارغ إلا إن صار موضعه مسدوداً */
if(silent) safeSpawnPlayer();
else if(!FD.on && blockedAt(px.x, px.z)){ const spot = findFreeSpot(px.x, px.z); px.set(spot.x, 0, spot.z); }
if(!silent){
snd('ship'); time += 10;
spawnFloatTag(I18N.T('+10 ث ⏱','+10s ⏱'),'#64ffda');
tip(n===2?'stage2':n===3?'stage3':'stage4', n===2?'🚀 المرحلة ٢: إيقاع العمل والطرود الباردة':n===3?'⚡ المرحلة ٣: الضغط وساعات الذروة':'💥 المرحلة ٤: مستوى الخبراء — مواد خطرة فقط','#64ffda');
}
/* استئناف الإدخال بعد أي نافذة تنبيه علّقت اللعب */
if(!fire.active && !fire.keypad && !introHold && $('rules').style.display === 'none'){ run = true; pz = false; }
hud();
}
function start(){
if(window.Online && !Online.user() && !Online.guest){ const l = $('login'); if(l){ l.classList.remove('shake'); void l.offsetWidth; l.classList.add('shake'); const i = $('emp-id'); if(i) i.focus(); } return; }
try { if(parent !== window) parent.postMessage({ type: 'acg-state', playing: true }, location.origin); } catch(e){}
try { if(window.Online && Online.playStart) Online.playStart().catch(() => {}); } catch(e){}
const td = tutorialDone();
initAudio();
stopVib();
items.forEach(i => { clearCrit(i); S.remove(i.m); disposeItem(i); }); items = [];
shipQueue = [];
resetFreezer(); resetEvents();
Z.forEach(z => { z.items = []; z.n_ = 0; z.full = false; if(z.hz && z.signCv) drawZoneSign(z); });
slowT = 0; beltSlowT = 0; beltSlowUsed = false; beltBtnMat.color.setHex(0x14e0b0); beltBtnMat.emissiveIntensity = 1; beltBtnHalo.scale.setScalar(1);
score = 0; combo = 1; time = 100; spawnT = 0; held = null; stage = 1;
streak = 0; streakT = 0; maxStreak = 0; rushT = 25; rushN = 0; rushDelay = 0;
balletReset();
$('streak').classList.remove('on');
dashT = 0; dashCD = 0; feverT = 0; shakeTrauma = 0; FODQ.n = 0; fodRender();
$('dash-fx').classList.remove('on'); $('stage').classList.remove('fever'); setDashButton();
demo = {insp:false,truck:false,inspDone:td,truckDone:td,truckIn:0}; inspector.demo = false; hideIntro();
sortedCount = 0; totalProcessed = 0; warnTicker = 0; pz = false; shiftLog = [];
/* كل وردية جديدة تبدأ بحصة ٣ أسئلة للمفتش وشحنة ملصق واحدة */
resetCaoRun(); evtReset();
if(window.Prog) Prog.roundStart();
$('rules').style.display = 'none';
resetExitGate();
resetFire();
px.set(SAFE_SPAWN.x, 0, SAFE_SPAWN.z); curRotY = 0; liftAnim.active = false; resetInspector(); resetTruck();
FD.on = false; if(FD.seated){ FD.seated.root.position.set(0, 0, 0); FD.seated.root.scale.setScalar(FD.seated.baseScale || 1); FD.seated = null; } FD.left = 60; FD.near = false; crewShow(true); forkDriver.visible = false; fk.position.set(FD.home.x, 0, FD.home.z); fk.rotation.y = -Math.PI/2;
STUDY.left = STUDY.total; STUDY.on = false; closeStudy();
clearMovement(); last = performance.now();
run = true; document.body.classList.add('ingame'); $('ov').style.display = 'none'; R.domElement.focus({preventScroll:true});
setStage(1, true);
hud();
tip('stage1', '🎓 المرحلة ١: التعريف والأساسيات — التقط وافرز', '#64ffda');
}
$('go').onclick = () => start();
/* الدخول بالرقم الوظيفي + المتصدرون عالمياً */
function loginUI(){
if(!window.Online || !$('login')) return;
const f = $('login-form'), who = $('login-who'), msg = $('login-msg'), go = $('go');
const refresh = () => { const u = Online.user(); f.hidden = !!u; who.hidden = !u; go.disabled = !u && !Online.guest; if(u) $('who-name').textContent = '👤 ' + Online.nameOf(u.id, I18N.lang, u.name); if(window.Prog) Prog.onPlayer(); };
f.onsubmit = async e => { e.preventDefault();
  /* رمز خاص في خانة الرقم الوظيفي: يفتح كل الشخصيات على هذا الجهاز بدل تسجيل الدخول */
  if(window.Prog && Prog.isAllCharsCode($('emp-id').value)){ Prog.unlockAllChars(); $('emp-id').value = ''; msg.textContent = I18N.T('🔓 تم فتح كل الشخصيات', '🔓 All characters unlocked'); return; }
  msg.textContent = '…'; const u = await Online.login($('emp-id').value); if(!u){ msg.textContent = I18N.t('الرقم الوظيفي غير موجود'); return; } msg.textContent = ''; refresh(); globalTop(); };
$('guest').onclick = () => { Online.guest = true; refresh(); start(); };
$('who-out').onclick = () => { Online.guest = false; Online.logout(); $('emp-id').value = ''; refresh(); $('emp-id').focus(); };
Online.directory().then(refresh); refresh(); globalTop();
}
async function globalTop(){
const ol = $('gtop'); if(!ol) return;
if(!Online.enabled()){ ol.innerHTML = '<li class="gl-empty">سيُفعَّل قريباً</li>'; return; }
try { await Online.directory(); const t = await Online.top(5); ol.innerHTML = t.length ? t.map((p, i) => `<li><b>${i + 1}</b><span>${Online.nameOf(p.id, I18N.lang, p.name).replace(/[<&]/g, '')}</span><i>${p.best}</i></li>`).join('') : '<li class="gl-empty">كن أول المتصدرين</li>'; } catch(e){ ol.innerHTML = '<li class="gl-empty">تعذّر التحميل</li>'; }
}
loginUI();
/* نوافذ الغلاف في الشاشات الضيقة: تمرير بالسحب/اللمس بين «الدخول والشخصية» و«النتائج والإعدادات» */
(function(){
const p = $('pager'), dots = document.querySelectorAll('#pager-dots .pd'); if(!p) return;
/* الصفحات بعروض مختلفة (البطاقة أعرض من اللوحات): نحسب موضع كل صفحة بمركزها */
const pages = () => [...p.children];
const target = i => { const c = pages()[i]; if(!c) return p.scrollLeft; const pr = p.getBoundingClientRect(), r = c.getBoundingClientRect(); return p.scrollLeft + (r.left + r.width / 2) - (pr.left + pr.width / 2); };
const current = () => { const pr = p.getBoundingClientRect(), mid = pr.left + pr.width / 2; let best = 0, bd = Infinity; pages().forEach((c, k) => { const r = c.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid); if(d < bd){ bd = d; best = k; } }); return best; };
const go = i => p.scrollTo({ left: target(i), behavior: 'smooth' });
dots.forEach(d => d.onclick = () => go(+d.dataset.i));
p.addEventListener('scroll', () => { const i = current(); dots.forEach((d, k) => d.classList.toggle('on', k === Math.min(i, dots.length - 1))); }, { passive: true });
let d = null;
p.addEventListener('pointerdown', e => { if(e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('input,button,a,label,canvas')) return; d = { x: e.clientX, s: p.scrollLeft, m: false }; });
window.addEventListener('pointermove', e => { if(!d) return; const dx = e.clientX - d.x; if(!d.m && Math.abs(dx) < 6) return; if(!d.m){ d.m = true; p.classList.add('drag'); } p.scrollLeft = d.s - dx; });
window.addEventListener('pointerup', () => { if(!d) return; const m = d.m; d = null; p.classList.remove('drag'); if(m) go(current()); });
})();
let pz = false;
const openRules = () => {
const r = $('rules'), o = r.style.display === 'none';
r.style.display = o ? 'flex' : 'none';
if(o){ pz = run; run = false; } else if(pz){ run = true; pz = false; }
};
$('rc').onclick = openRules;
$('how').onclick = openRules;
document.querySelectorAll('#rules .rtab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#rules .rtab').forEach(t => { const on = t === b; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); const p = $(t.dataset.p); if(p) p.hidden = !on; });
  $('rules').scrollTop = 0;
}));
function end(){
try { if(parent !== window) parent.postMessage({ type: 'acg-state', playing: false }, location.origin); } catch(e){}
run = false; resetEvents();
stopVib();
if(STUDY.on){ STUDY.on = false; closeStudy(); }
feverT = 0; dashT = 0; dashCD = 0; shakeTrauma = 0;
$('stage').classList.remove('fever'); $('dash-fx').classList.remove('on'); setDashButton();
document.body.classList.remove('ingame');
if(FD.on) stopDrive();
resetFire();
const o = $('ov'); o.style.display = 'flex';
/* شاشة النتائج تُعيد بناء #ov بالكامل، فنحفظ لوحة الإعدادات ونُعيد إلحاقها مخفية (#ov.ended) حتى لا تضيع عناصرها */
const dock = $('corner-opts');
const acc = gameRules.scoreboard.accuracy(sortedCount, totalProcessed);
const best = bestScore();
const record = score > best && score > 0;
if(record) saveBest(score);
const topList = score > 0 ? pushTop(score) : getTop();
try { if(window.Online) Online.submit(score).then(() => globalTop()).catch(() => {}); } catch(e){}
/* الخبرة والمهام والترقية: تُحسب مرة واحدة بنهاية الوردية وتُعرض في شاشة النتائج */
const career = window.Prog ? Prog.roundEnd(score) : '';
const grade = gameRules.scoreboard.grade(score, acc);
const titles = { s:I18N.t('خبير DGR معتمد'), a:I18N.t('مشرف فرز متمكن'), b:I18N.t('فني مستودع واعد'), c:I18N.t('متدرب قيد التأهيل') };
const stars = gameRules.scoreboard.stars(grade);
const hubStars = gameRules.scoreboard.hubStars(stars);
let hub = null;
try { if(window.GameHub) hub = GameHub.saveGameScore('game1', score, hubStars); } catch(e){}
const totalScore = hub ? hub.totalScore : score;
const starPath = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
const starsHTML = Array.from({ length: 5 }, (_, i) => `<svg class="star${i < stars ? ' lit' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${starPath}"/></svg>`).join('');
const lessonTip = window.ShiftReport ? ShiftReport.tip(shiftLog) : '';
const tipTxt = lessonTip ? lessonTip : totalProcessed === 0 ? I18N.t('لم تُصنّف أي طرد هذه الوردية — جرّب مرة أخرى!') : acc >= 80 ? I18N.t('أداء قوي — حافظ على الدقة مع السرعة في الوردية القادمة.') : I18N.t('راجع دليل الفرز السريع ثم عُد لكسر رقمك.');
/* تقرير الوردية على هيئة بوليصة شحن جوي: رقم الوردية والتاريخ والباركود مشتقة من النتيجة */
const now = new Date();
const shiftNo = 'SH-' + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(score % 10000).padStart(4, '0');
const dateTxt = now.toLocaleDateString('en-GB');
const bars = String(score * 7919 + sortedCount * 104729 + maxStreak + 31337).repeat(8).slice(0, 56).split('').map(d => `<i style="width:${1 + (+d % 3)}px"></i>`).join('');
const lbChips = topList.length ? topList.slice(0, 4).map((e, i) => `<span class="score-chip${e.s === score && score > 0 ? ' me' : ''}"><i class="rank-dot r${i + 1}"></i> ${e.s} ${I18N.t('نقطة')}</span>`).join('') : `<span class="lb-empty">${I18N.t('العب لتسجّل أول نتيجة')}</span>`;
o.classList.add('ended');
o.innerHTML = `<div class="end-wrap g-${grade}">
<section class="ep-main" role="dialog" aria-labelledby="ep-title">
<header class="ep-top"><span class="ep-kick"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>${I18N.T('تقرير الوردية','Shift report')}</span><span class="ep-no">${shiftNo} · ${dateTxt}</span></header>
<div class="ep-hero">
<div class="ep-stamp" aria-label="${I18N.T('التقييم','Grade')} ${grade.toUpperCase()}"><b>${grade.toUpperCase()}</b><small>${I18N.T('التقييم','GRADE')}</small></div>
<div class="ep-hd">
<h1 class="ep-title" id="ep-title">${I18N.t('انتهت الوردية')}</h1>
<div class="ep-stars">${starsHTML}</div>
<span class="ep-rank">${titles[grade]}</span>
</div>
</div>
<div class="ep-score">
<span class="ep-score-l">${I18N.t('النقاط')}</span>
<b class="ep-score-n">${score}</b>
${record ? `<em class="ep-new">${I18N.t('رقم قياسي جديد!')}</em>` : ''}
</div>
<div class="ep-stats">
<div class="ep-cell"><b>${sortedCount}</b><span>${I18N.t('طرود مصنّفة')}</span></div>
<div class="ep-cell"><b>${acc}%</b><span>${I18N.t('دقة IATA')}</span><i class="ep-meter"><b style="width:${acc}%"></b></i></div>
<div class="ep-cell"><b>${maxStreak}</b><span>${I18N.t('أطول سلسلة')}</span></div>
</div>
<p class="ep-tip">${tipTxt}</p>
<div class="ep-tear" aria-hidden="true"></div>
<div class="ep-actions">
<button id="go" class="ep-btn ep-replay" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg><span>${I18N.T('إعادة المحاولة','Replay level')}</span></button>
<button id="rb2" class="ep-btn" type="button"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg><span>${I18N.t('الدليل')}</span></button>
<button id="ex2" class="ep-btn" type="button"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg><span>${I18N.t('الغلاف')}</span></button>
${window.ShiftReport ? `<button id="sh2" class="ep-btn ep-share" type="button" aria-label="${I18N.T('مشاركة النتيجة','Share score')}" title="${I18N.T('مشاركة النتيجة','Share score')}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg></button>` : ''}
</div>
<div class="ep-code" aria-hidden="true"><span class="ep-bars">${bars}</span><span class="ep-code-t">${shiftNo}</span></div>
</section>
${window.ShiftReport ? ShiftReport.panel(shiftLog, totalProcessed) : ''}
<aside class="ep-side" aria-labelledby="ep-side-t">
<h2 class="panel-t" id="ep-side-t"><span aria-hidden="true">🧰</span> ${I18N.T('سجل الموظف','Employee record')}</h2>
${career}
<h2 class="panel-t"><span aria-hidden="true">🏆</span> ${I18N.T('الأرقام القياسية','Records')}</h2>
<div class="ep-recs">
<div class="ep-rec"><span>${I18N.T('أفضل نتيجة','Best score')}</span><b>${Math.max(best, score)}</b></div>
<div class="ep-rec"><span>${I18N.T('المجموع التراكمي','Total score')}</span><b>${totalScore}</b></div>
</div>
<div class="lb-chips">${lbChips}</div>
</aside>
</div>`;
if(dock) o.appendChild(dock);
$('go').onclick = () => start();
const shareBtn = $('sh2');
if(shareBtn) shareBtn.onclick = () => {
  let cert = false, rank = '';
  try { const ps = window.Prog && Prog.state(); cert = !!(ps && ps.dgr && ps.dgr.cert); if(ps && window.WarehouseProgress) rank = WarehouseProgress.rankTitle(ps.xp, I18N.lang); } catch(e){}
  ShiftReport.share({ score, grade, title: titles[grade], acc, sorted: sortedCount, streak: maxStreak, shiftNo, cert, rank }, shareBtn);
};
$('rb2').onclick = openRules;
$('ex2').onclick = exitToShell;
}
// ===== تسلسل الإرشاد وفتح البوابة والانتقال إلى اللعبة التالية =====
function buildExitTrail(){
const fx = px.x, fz = px.z, tx = EXIT_GATE.targetX, tz = EXIT_GATE.targetZ;
const dx = tx - fx, dz = tz - fz, len = Math.hypot(dx, dz) || 1;
const angle = Math.atan2(-dx / len, -dz / len);
const count = Math.max(6, Math.min(EXIT_GATE.trail.length, Math.round(len / 1.4)));
EXIT_GATE.trail.forEach((arrow, i) => {
const on = i < count;
arrow.visible = on;
arrow.material.opacity = 0;
if(!on) return;
const t = (i + 1) / (count + 1);
arrow.position.set(fx + dx * t, 0.05, fz + dz * t);
arrow.rotation.y = angle;
arrow.userData.delay = i * 0.08;
});
gateTrailGroup.visible = true;
}
/* مسار الخروج: بحث شبكي (BFS) يتفادى كل العوائق الحقيقية — الرافعة المتوقفة، الأعمدة،
   أقفاص المواد الخطرة، الجدران — بدل خط مستقيم قد يعلق الموظف في عائق. */
function buildExitRoute(){
const CELL = .5;
const walkable = (x, z) => !blockedAt(x, z, PLAYER_RADIUS + .12);
const gKey = (x, z) => x + ',' + z;
const goalW = { x: EXIT_GATE.targetX, z: EXIT_GATE.targetZ };
const findFree = (cx, cz) => {
for(let r = 0; r <= 8; r++) for(let dx = -r; dx <= r; dx++) for(let dz = -r; dz <= r; dz++){
const x = (cx + dx) * CELL, z = (cz + dz) * CELL;
if(!walkable(x, z)) continue;
return { x: cx + dx, z: cz + dz };
}
return null;
};
const start = findFree(Math.round(px.x / CELL), Math.round(px.z / CELL));
const goal = findFree(Math.round(goalW.x / CELL), Math.round(goalW.z / CELL));
if(!start || !goal) return [{ x: goalW.x, z: goalW.z }];
const prev = new Map(), seen = new Set([gKey(start.x, start.z)]);
const q = [start];
let found = false;
while(q.length){
const cur = q.shift();
if(cur.x === goal.x && cur.z === goal.z){ found = true; break; }
for(const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
const nx = cur.x + dx, nz = cur.z + dz, k = gKey(nx, nz);
if(seen.has(k)) continue;
const wx = nx * CELL, wz = nz * CELL;
if(wx < WALK.minX || wx > WALK.maxX || wz < WALK.minZ || wz > WALK.maxZ) continue;
if(!walkable(wx, wz)) continue;
seen.add(k); prev.set(k, { x: cur.x, z: cur.z }); q.push({ x: nx, z: nz });
}
}
if(!found) return [{ x: goalW.x, z: goalW.z }];
const cells = [];
for(let c = goal; c; c = prev.get(gKey(c.x, c.z))){ cells.push(c); if(c.x === start.x && c.z === start.z) break; }
cells.reverse();
let pts = cells.map(c => ({ x: c.x * CELL, z: c.z * CELL }));
/* تنعيم المسار: نقفز لأبعد نقطة يصلها خط نظر سالك */
const los = (a, b) => {
const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .25));
for(let i = 1; i < n; i++){ const t = i / n; if(!walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false; }
return true;
};
const out = [pts[0]];
for(let i = 1; i < pts.length; i++){
let j = i;
while(j + 1 < pts.length && los(out[out.length - 1], pts[j + 1])) j++;
out.push(pts[j]); i = j;
}
out.push({ x: goalW.x, z: goalW.z });
/* إزالة النقاط المتطابقة (مركز الخلية الأخيرة = البوابة تقريباً) */
const clean = [out[0]];
for(let i = 1; i < out.length; i++){
const prevP = clean[clean.length - 1];
if(Math.hypot(out[i].x - prevP.x, out[i].z - prevP.z) > .3) clean.push(out[i]);
}
if(clean.length > 1) clean[clean.length - 1] = { x: goalW.x, z: goalW.z };
else clean.push({ x: goalW.x, z: goalW.z });
return clean;
}
function exitRouteLength(){
  let len = 0, ax = px.x, az = px.z;
  for(const p of EXIT_GATE.route){ len += Math.hypot(p.x - ax, p.z - az); ax = p.x; az = p.z; }
  return len;
}
/* مشي تلقائي ذكي: إن سدّ عائقٌ الاتجاه المطلوب (رافعة، عمود، جدار قفص) نجرّب زوايا بديلة
   حوله بدل الاصطدام المتكرر والتوقف — ثم نكمل نحو البوابة. */
function autoWalkStep(ux, uz, spd, dt){
  const steps = Math.max(1, Math.ceil(dt / (1/60))), stepDt = dt / steps;
  const want = spd * dt;
  const tryDir = (vx, vz) => {
    let x = px.x, z = px.z;
    for(let i = 0; i < steps; i++){
      const r = resolvePlayerCollisions(x + vx * spd * stepDt, z + vz * spd * stepDt, vx, vz, stepDt, { probe: true });
      x = r.x; z = r.z;
    }
    return { x, z, moved: Math.hypot(x - px.x, z - px.z) };
  };
  /* الاتجاهات تُفحص بلا آثار، ثم يُنفَّذ الاتجاه المختار وحده بدفع الطرود الحقيقي */
  const commit = (r) => {
    for(let i = 0; i < steps; i++){
      const c = resolvePlayerCollisions(px.x + r.vx * spd * stepDt, px.z + r.vz * spd * stepDt, r.vx, r.vz, stepDt);
      px.x = c.x; px.z = c.z;
    }
    return r;
  };
  let best = tryDir(ux, uz);
  best.vx = ux; best.vz = uz;
  if(best.moved > want * 0.6) return commit(best);
  for(const off of [.35, -.35, .7, -.7, 1.05, -1.05, 1.4, -1.4, Math.PI/2, -Math.PI/2]){
    const c = Math.cos(off), s = Math.sin(off);
    const vx = ux * c - uz * s, vz = ux * s + uz * c;
    const r = tryDir(vx, vz);
    if(r.moved > best.moved){ r.vx = vx; r.vz = vz; best = r; }
  }
  return commit(best);
}
function resetExitGate(){
EXIT_GATE.active = false; EXIT_GATE.phase = 'idle'; EXIT_GATE.t = 0; EXIT_GATE.open = 0; EXIT_GATE.warped = false;
EXIT_GATE.route = []; EXIT_GATE.wp = 0; EXIT_GATE.stuckT = 0;
gateDoorL.position.z = -1.36; gateDoorR.position.z = 1.36;
portalMat.opacity = 0; gatePadMat.opacity = 0; gateLight.intensity = 0; gateMarkerMat.opacity = 0;
EXIT_GATE.trail.forEach(arrow => { arrow.visible = false; arrow.material.opacity = 0; });
gateTrailGroup.visible = false;
document.body.classList.remove('exit-mode');
const warp = $('portal-warp'); if(warp) warp.classList.remove('on');
}
function beginExitSequence(){
if(EXIT_GATE.active) return;
initAudio();
EXIT_GATE.active = true; EXIT_GATE.phase = 'guide'; EXIT_GATE.t = 0; EXIT_GATE.open = 0; EXIT_GATE.warped = false;
run = false; clearMovement(); stopVib();
if(STUDY.on){ STUDY.on = false; closeStudy(); }
if(FD.on) stopDrive();
resetFire();
document.body.classList.remove('ingame');
document.body.classList.add('exit-mode');
const ov = $('ov');
if(ov){ ov.classList.add('fade-out'); setTimeout(() => { ov.style.display = 'none'; ov.classList.remove('fade-out'); }, 460); }
buildExitTrail();
EXIT_GATE.route = buildExitRoute(); EXIT_GATE.wp = 0; EXIT_GATE.stuckT = 0; EXIT_GATE.lastX = px.x; EXIT_GATE.lastZ = px.z;
EXIT_GATE.limit = 4 + exitRouteLength() / 5.4 * 1.6;
snd('gate');
toast(I18N.T('🚪 البوابة على يسارك — اتبع مسار الإرشاد','🚪 The gate is on your left — follow the trail'), '#64ffda');
try { if(window.GameHub) GameHub.setActiveGame('game1'); } catch(e){}
}
function startPortalWarp(){
if(EXIT_GATE.warped) return;
EXIT_GATE.warped = true; EXIT_GATE.phase = 'warp'; EXIT_GATE.t = 0;
snd('warp'); addShake(0.55);
const warp = $('portal-warp'); if(warp) warp.classList.add('on');
setTimeout(() => {
const next = window.GameHub ? GameHub.nextUrl('game1') : 'm1/pairs.html?source=game1&session=active';
window.location.href = next;
}, 1250);
}
function updateExitSequence(now, dt){
if(!EXIT_GATE.active) return;
EXIT_GATE.t += dt;
const t = EXIT_GATE.t;
if(EXIT_GATE.phase !== 'warp'){
const step = Math.min(1, Math.max(0, (t - 0.55) / 1.3));
EXIT_GATE.open = step * step * (3 - 2 * step);
}
const open = EXIT_GATE.open, pulse = 0.55 + 0.45 * Math.sin(now * 0.006);
gateDoorL.position.z = -1.36 - open * 2.72;
gateDoorR.position.z = 1.36 + open * 2.72;
portalMat.opacity = open * (0.55 + 0.35 * pulse);
gatePadMat.opacity = open * (0.22 + 0.18 * pulse);
gateLight.intensity = open * (2.2 + pulse * 1.6);
gateMarkerMat.opacity = Math.min(1, t / 0.6);
gateMarker.position.y = 6.6 + Math.sin(now * 0.0026) * 0.12;
gateNeon.emissiveIntensity = 1.4 + pulse * 1.3;
EXIT_GATE.trail.forEach(arrow => {
if(!arrow.visible) return;
const phase = ((now * 0.0016 - arrow.userData.delay) % 1 + 1) % 1;
const wave = Math.sin(phase * Math.PI);
arrow.material.opacity = 0.25 + 0.75 * wave * wave;
arrow.scale.setScalar(0.82 + 0.18 * wave);
});
if(EXIT_GATE.phase === 'guide' && t > 0.9){
const route = EXIT_GATE.route;
const lastWp = Math.max(0, route.length - 1);
const wp = route[Math.min(EXIT_GATE.wp, lastWp)] || { x: EXIT_GATE.targetX, z: EXIT_GATE.targetZ };
const dx = wp.x - px.x, dz = wp.z - px.z;
const dist = Math.hypot(dx, dz);
const final = EXIT_GATE.wp >= lastWp;
if(dist <= (final ? 0.4 : 0.5)){
if(final){ startPortalWarp(); return; }
EXIT_GATE.wp++; EXIT_GATE.stuckT = 0;
} else {
const walk = autoWalkStep(dx / dist, dz / dist, 5.4, dt);
/* إن حاصر عائقٌ اللاعب: تجاوز المحطة، وعلى المحطة الأخيرة انتقل فوراً بدل تعليق اللعبة */
const moved = walk.moved;
EXIT_GATE.stuckT = moved < 0.02 ? EXIT_GATE.stuckT + dt : 0;
if(EXIT_GATE.stuckT > 1.1){
EXIT_GATE.stuckT = 0;
if(!final){ EXIT_GATE.wp++; }
else { px.set(EXIT_GATE.targetX, 0, EXIT_GATE.targetZ); startPortalWarp(); return; }
}
const targetRot = Math.atan2(walk.vx, walk.vz);
curRotY += Math.atan2(Math.sin(targetRot - curRotY), Math.cos(targetRot - curRotY)) * Math.min(1, dt * 10);
rig.rotation.y = curRotY;
anim(dt, 8.2, walk.vx, walk.vz);
}
EXIT_GATE.lastX = px.x; EXIT_GATE.lastZ = px.z;
/* حماية نهائية: لا يبقى الانتقال معلقاً مهما حدث */
if(EXIT_GATE.t > EXIT_GATE.limit){ px.set(EXIT_GATE.targetX, 0, EXIT_GATE.targetZ); startPortalWarp(); return; }
}
}
// ===== إنذار الحريق: إيقاف الحزام، إخلاء إلى منطقة التجمع، ورقم الطوارئ =====
function vib(pattern){
// اهتزاز الهاتف: يعمل على أندرويد/كروم بعد أول لمسة في اللعبة
const nav = typeof navigator !== 'undefined' ? navigator : null;
if(!nav || typeof nav.vibrate !== 'function') return false;
try{ return nav.vibrate(pattern); }catch(e){ return false; }
}
function stopVib(){ vib(0); }
// بعض الهواتف تُلغي النمط بعد انتهائه: نعيد النبض طوال مدة الإنذار، وأي لمسة أثناءه تُعيد التنبيه
function startFireBuzz(){
  if(fire.buzz) clearInterval(fire.buzz);
  fire.buzz = setInterval(() => {
    if(fire.active && fire.phase !== 'done') vib([260, 140, 260]);
  }, 2400);
}
function stopFireBuzz(){ if(fire.buzz){ clearInterval(fire.buzz); fire.buzz = null; } stopVib(); }
// لمسة أثناء الإنذار تعيد الهزّة فوراً (بعض المتصفحات تسمح بالاهتزاز بعد تفاعل المستخدم فقط)
document.getElementById('stage').addEventListener('pointerdown', () => {
  if(fire.active && fire.phase !== 'done') vib([300, 120, 300]);
}, { passive: true });
function speakFireAlert(){
if(!soundEnabled || !('speechSynthesis' in window)) return;
try{
const u = new SpeechSynthesisUtterance('Attention, attention. A fire has been detected in the warehouse. Please evacuate immediately through the nearest emergency exit');
u.lang = 'en-US'; u.rate = .95; u.pitch = .9; u.volume = audioLevel('snd');
speechSynthesis.cancel(); speechSynthesis.speak(u);
}catch(e){}
}
function startFireDrill(){
if(fire.active || fire.done || introHold) return;
fire.active = true; fire.phase = 'evac'; fire.t = 0; fire.keypad = false; fire.posAwarded = false;
demo.insp = false; demo.truck = false; demo.inspDone = true; demo.truckDone = true;
inspector.demo = false; inspector.active = false; inspector.g.visible = false; $('inspector-badge').classList.remove('on');
resetTruck(); hideIntro(); clearMovement();
$('stage').classList.add('fire');
$('fire-banner').classList.add('on');
$('fire-hint').classList.add('on');
alarmFlash.group.visible = true;
snd('fire');
addShake(.6);
// هزّات الهاتف عند صدور الإنذار: نمط قوي أوّلي ثم نبضات متكررة أثناء الإنذار
startFireBuzz();
vib([600, 200, 600, 200, 900]);
speakFireAlert();
fire.siren = setInterval(() => { if(fire.active && fire.phase !== 'done' && run && !document.hidden){ snd('fire'); vib([350, 160, 350]); } }, 7000);
toast('🚨 إنذار حريق — توجّه يميناً إلى منطقة التجمع', '#ff5252');
hud();
}
function openCodePad(){
if(fire.keypad) return;
fire.keypad = true; fire.phase = 'code'; fire.codeT = 20; fire.code = '';
$('fire-hint').classList.remove('on');
clearMovement();
$('cp-disp').textContent = '••••••••';
$('cp-err').textContent = '';
$('cp-err').style.color = '#ff8a80';
$('cp-timer').textContent = I18N.T('⏱ 20 ث','⏱ 20s');
$('code-pad').classList.add('on');
toast(I18N.t('🔢 أدخل رقم الطوارئ لتأكيد الإخلاء'), '#ffd54a');
}
function codePress(ch){
if(!fire.keypad || fire.phase !== 'code') return;
$('cp-err').textContent = ''; $('cp-err').style.color = '#ff8a80';
if(ch === 'del') fire.code = fire.code.slice(0, -1);
else if(ch === 'ok'){ submitCode(); return; }
else if(fire.code.length < 8){
  fire.code += ch; snd('pick', 1.25);
  // الرقم الصحيح يُقبل تلقائياً بلا حاجة لزر الإدخال
  if(fire.code.length === 8 && gameRules.emergency.correct(fire.code)){
    $('cp-disp').textContent = fire.code;
    setTimeout(() => { if(fire.phase === 'code' && gameRules.emergency.correct(fire.code)) submitCode(); }, 220);
    return;
  }
}
$('cp-disp').textContent = fire.code.padEnd(8, '•');
}
function submitCode(){
if(gameRules.emergency.correct(fire.code)){
fire.phase = 'done';
const bonus = gameRules.emergency.codePoints;
score += bonus; hud();
snd('ok', 1.3);
spawnFloatTag(I18N.T('+' + bonus + ' كود الطوارئ','+' + bonus + ' emergency code'), '#69f0ae');
$('cp-err').textContent = I18N.T('✅ تم تأكيد الإخلاء +','✅ Evacuation confirmed +') + bonus;
$('cp-err').style.color = '#69f0ae';
$('cp-disp').textContent = fire.code;
$('fire-banner').classList.remove('on');
awardPosition();
setTimeout(() => finishFire(I18N.t('✅ اكتمل الإخلاء — استؤنفت الوردية')), 1400);
} else {
snd('error');
fire.code = '';
$('cp-disp').textContent = '••••••••';
$('cp-err').textContent = I18N.t('✖ رقم غير صحيح — حاول مرة أخرى');
$('cp-err').style.color = '#ff8a80';
}
}
function awardPosition(){
if(fire.posAwarded || !gameRules.emergency.inMuster(px.x, px.z)) return;
fire.posAwarded = true;
const p = gameRules.emergency.positionPoints;
score += p; hud();
spawnFloatTag(I18N.T('+' + p + ' موقع صحيح','+' + p + ' correct position'), '#69f0ae');
toast(I18N.T('✔ +' + p + ' لوجودك في منطقة التجمع','✔ +' + p + ' for being at the muster point'), '#69f0ae');
}
function closeCodePad(){
fire.keypad = false;
$('code-pad').classList.remove('on');
clearMovement();
}
function cancelCodePad(){
if(!fire.keypad) return;
snd('warn');
closeCodePad();
awardPosition();
finishFire('⚠️ معرفة رقم الطوارئ إلزامية لكل موظف — راجع لوحة الطوارئ في المستودع');
}
$('cp-cancel').onclick = cancelCodePad;
function finishFire(msg){
if(!fire.active) return;
fire.active = false; fire.done = true; fire.phase = 'idle'; fire.t = 0;
clearInterval(fire.siren); fire.siren = null;
stopFireBuzz();
try{ speechSynthesis.cancel(); }catch(e){}
closeCodePad();
$('fire-banner').classList.remove('on');
$('fire-hint').classList.remove('on');
alarmFlash.group.visible = false;
alarmFlash.redLight.intensity = alarmFlash.whiteLight.intensity = 0;
$('stage').classList.remove('fire');
$('cp-err').textContent = '';
clearMovement(); last = performance.now(); evt.lastInsp = Math.max(evt.lastInsp, evt.t - 15);   // بعد الإنذار يمهل المفتش قليلاً
if(msg) toast(msg, '#64ffda');
hud();
}
function updateFire(dt){
if(fire.phase === 'evac'){
fire.t += dt;
if(gameRules.emergency.inMuster(px.x, px.z)){ fire.t = 0; openCodePad(); }
else if(fire.t > 45) finishFire('⏱ انتهت مهلة الإخلاء — استؤنفت الوردية');
} else if(fire.phase === 'code'){
fire.codeT -= dt;
$('cp-timer').textContent = '⏱ ' + Math.max(0, Math.ceil(fire.codeT)) + I18N.T(' ث','s');
if(fire.codeT <= 0){
closeCodePad();
awardPosition();
finishFire('⏱ أُغلق إدخال الرقم — استؤنفت الوردية');
}
}
}
function resetFire(){
clearInterval(fire.siren); fire.siren = null;
stopFireBuzz();
fire.active = false; fire.done = false; fire.phase = 'idle'; fire.t = 0; fire.codeT = 0; fire.keypad = false; fire.posAwarded = false;
$('stage').classList.remove('fire');
$('fire-banner').classList.remove('on');
$('fire-hint').classList.remove('on');
$('code-pad').classList.remove('on');
alarmFlash.group.visible = false;
alarmFlash.redLight.intensity = alarmFlash.whiteLight.intensity = 0;
try{ speechSynthesis.cancel(); }catch(e){}
}
function handlePadKey(e){
if(e.code === 'Backspace' || e.code === 'Delete'){ e.preventDefault(); codePress('del'); return; }
if(e.code === 'Enter' || e.code === 'NumpadEnter'){ e.preventDefault(); codePress('ok'); return; }
const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
if(m){ e.preventDefault(); codePress(m[1]); }
}
function boxHalf(it){ return BH * (Math.abs(Math.cos(it.m.rotation.y)) + Math.abs(Math.sin(it.m.rotation.y))); }
function overlapVec(pa, ha, cx, cz, hbx, hbz){
const ox = ha + hbx - Math.abs(pa.x - cx), oz = ha + hbz - Math.abs(pa.z - cz);
if(ox <= 0 || oz <= 0) return null;
return ox < oz ? [(pa.x >= cx ? 1 : -1) * ox, 0] : [0, (pa.z >= cz ? 1 : -1) * oz];
}
// الطرود المتروكة على الأرض لا تتداخل مع بعضها ولا مع الطرود المفروزة ولا مع الحزام والجدران
function separateBoxes(){
const fl = items.filter(i => i.st === 'floor' && !i.fall), solid = items.filter(i => i.st === 'placed');
for(let n = 0; n < 3; n++){
for(let a = 0; a < fl.length; a++){
const A = fl[a], pa = A.m.position, ha = boxHalf(A);
for(const o of STATIC_OBSTACLES){
const v = overlapVec(pa, ha, (o.minX+o.maxX)/2, (o.minZ+o.maxZ)/2, (o.maxX-o.minX)/2, (o.maxZ-o.minZ)/2);
if(v){ pa.x += v[0]; pa.z += v[1]; }
}
for(const b of solid){ const pb = b.m.position, v = overlapVec(pa, ha, pb.x, pb.z, BH, BH); if(v){ pa.x += v[0]; pa.z += v[1]; } }
for(let c = a + 1; c < fl.length; c++){
const B_ = fl[c], pb = B_.m.position, v = overlapVec(pa, ha, pb.x, pb.z, boxHalf(B_), boxHalf(B_));
if(v){ const wa = A.data.isHeavy ? 0 : B_.data.isHeavy ? 1 : .5; pa.x += v[0]*wa; pa.z += v[1]*wa; pb.x -= v[0]*(1 - wa); pb.z -= v[1]*(1 - wa); A.wob = Math.max(A.wob||0, 0.5); B_.wob = Math.max(B_.wob||0, 0.5); }
}
pa.x = Math.max(-33, Math.min(33, pa.x)); pa.z = Math.max(-11.9, Math.min(9.6, pa.z));
}
}
}

// ===== المفتش: يمر بسرعة مرة واحدة ويخالف الطرود المتروكة خارج المناطق =====
/* ممرات المشاة الآمنة للمفتش — على المستوى الأعلى لأن resetInspector و caoOpen تستخدمانها خارج الإغلاق */
const INSP_SAFE = { minZ: -2.2, maxZ: 5.8, zebraZ: 2.5, minX: -33.2, maxX: 33.2 };
/* الحد الأدنى للمسافة بين المفتش والرافعة الشوكية (يُضاف إلى نصف عرض الرافعة) */
const INSP_FK_GAP = 1.5;
/* المسافة بين المفتش والموظف: وقفة سؤال CAO، وهامش جسده الصلب، ومدى تفاديه للموظف أثناء الدورية */
const CAO_GAP = 3.2, INSP_BODY_GAP = .8, INSP_PLAYER_SIDE = 1.9;
const inspector = (() => {
const g = new THREE.Group();
const procMesh = new THREE.Group();
g.add(procMesh);
const M = (c, r=0.6, m=0.05) => new THREE.MeshStandardMaterial({color:c, roughness:r, metalness:m});
const shirt = M(0xeef3f8), vest = M(0xff7a00, .55), skin = M(0xe0b08a, .7), pants = M(0x1f2d42), boot = M(0x1a1410, .5), helm = M(0xffffff, .35, .1), refl = new THREE.MeshStandardMaterial({color:0xf4f8fb, emissive:0x9aa4ad, roughness:.3}), dark = M(0x111111, .4), hair = M(0x3b2a20, .8);
const add = (geo, mat, x, y, z, par=procMesh) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
const limb = (r, len, mat, par) => { add(new THREE.CylinderGeometry(r, r*0.92, len, 14), mat, 0, -len/2, 0, par); add(new THREE.SphereGeometry(r, 14, 10), mat, 0, 0, 0, par); add(new THREE.SphereGeometry(r*0.92, 14, 10), mat, 0, -len, 0, par); };
// جذع ممتلئ بقميص وسترة عاكسة (احتياطي عند بطء التحميل)
const body = add(new THREE.CylinderGeometry(0.36, 0.3, 0.72, 22), shirt, 0, 1.28, 0); body.scale.z = 0.78;
const vst = add(new THREE.CylinderGeometry(0.375, 0.315, 0.66, 22, 1, true), vest, 0, 1.26, 0); vst.scale.z = 0.8; vst.material.side = THREE.DoubleSide;
[1.12, 1.32].forEach(y => { const r = add(new THREE.CylinderGeometry(0.38 - (1.32-y)*0.2, 0.38 - (1.32-y)*0.2, 0.06, 22, 1, true), refl, 0, y, 0); r.scale.z = 0.81; });
const shoulders = add(new THREE.SphereGeometry(0.36, 22, 12, 0, Math.PI*2, 0, Math.PI/2), shirt, 0, 1.62, 0); shoulders.scale.set(1, .45, .78);
add(new THREE.BoxGeometry(0.1, 0.12, 0.02), M(0x1565c0), 0.17, 1.42, 0.29);
add(new THREE.CylinderGeometry(0.1, 0.11, 0.1, 14), skin, 0, 1.72, 0);
const head = add(new THREE.SphereGeometry(0.23, 22, 18), skin, 0, 1.95, 0); head.scale.set(1, 1.08, 1);
[-1,1].forEach(sx => {
add(new THREE.SphereGeometry(0.035, 10, 8), M(0xffffff, .2), sx*0.08, 1.99, 0.2);
add(new THREE.SphereGeometry(0.02, 8, 6), dark, sx*0.08, 1.99, 0.225);
const brow = add(new THREE.BoxGeometry(0.09, 0.02, 0.02), hair, sx*0.08, 2.05, 0.215); brow.rotation.z = -sx*0.25;
add(new THREE.SphereGeometry(0.05, 10, 8), skin, sx*0.235, 1.95, 0);
const lens = add(new THREE.TorusGeometry(0.045, 0.01, 6, 16), dark, sx*0.08, 1.99, 0.225);
});
add(new THREE.BoxGeometry(0.06, 0.01, 0.01), dark, 0, 1.99, 0.235);
const nose = add(new THREE.SphereGeometry(0.04, 10, 8), skin, 0, 1.93, 0.23); nose.scale.z = 1.3;
const mus = add(new THREE.SphereGeometry(0.075, 12, 8), hair, 0, 1.875, 0.2); mus.scale.set(1.5, .35, .5);
const hat = add(new THREE.SphereGeometry(0.255, 22, 12, 0, Math.PI*2, 0, Math.PI/2), helm, 0, 2.02, 0);
add(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 24), helm, 0, 2.03, 0.03);
add(new THREE.BoxGeometry(0.05, 0.08, 0.38), helm, 0, 2.24, 0);
const legs = [], arms = [];
for(const sx of [-0.15, 0.15]){
const lp = new THREE.Group(); lp.position.set(sx, 0.92, 0); procMesh.add(lp);
limb(0.13, 0.76, pants, lp);
const bt = add(new THREE.BoxGeometry(0.22, 0.14, 0.34), boot, 0, -0.84, 0.05, lp); legs.push(lp);
const ap = new THREE.Group(); ap.position.set(sx*2.6, 1.58, 0); procMesh.add(ap);
limb(0.085, 0.56, shirt, ap);
add(new THREE.SphereGeometry(0.08, 12, 10), skin, 0, -0.64, 0, ap); arms.push(ap);
}
const clip = new THREE.Group(); clip.position.set(0, -0.6, 0.12); arms[1].add(clip);
add(new THREE.BoxGeometry(0.28, 0.36, 0.025), M(0x8d6e63), 0, 0, 0, clip);
add(new THREE.BoxGeometry(0.24, 0.28, 0.01), M(0xffffff, .9), 0, -0.02, 0.016, clip);
add(new THREE.BoxGeometry(0.1, 0.04, 0.03), M(0xb0bec5, .3, .8), 0, 0.17, 0.01, clip);
add(new THREE.CylinderGeometry(0.305, 0.305, 0.06, 22), dark, 0, 0.94, 0).scale.z = 0.8;
procMesh.traverse(o => { if(o.isMesh) o.castShadow = true; });

const scanRingGeo = new THREE.RingGeometry(0.75, 0.95, 32);
const scanRingMat = new THREE.MeshBasicMaterial({ color: 0xffa000, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
const scanRing = new THREE.Mesh(scanRingGeo, scanRingMat);
scanRing.rotation.x = -Math.PI / 2;
scanRing.visible = false;
S.add(scanRing);

// ممرات المشاة الطبيعية للمفتش: تمنعه تماماً من السير داخل أقفاص الحاويات أو فوق الحزام أو عبر الرافعة والجدران

const I_ = { g, legs, arms, procMesh, scanRing, rig:null, glbRoot:null, active:false, state:"walk", targetItem:null, inspectT:0, pauseT:0, x:0, z:INSP_SAFE.zebraZ, targetZ:INSP_SAFE.zebraZ, dir:1, t:0, cooldown:0 };

// تحميل وتحريك مجسم المفتش الجديد ثلاثي الأبعاد GLB
/* المفتش: نموذج مُرقَّم بـ Mixamo بحركات حقيقية؛ وإن فشل تنزيله يعود إلى المفتش القديم ثم إلى المجسّم الإجرائي */
function attachInspector(rig, url, scale, label){
  return rig.load(url).then(root => {
    I_.rig = rig; I_.glbRoot = root;
    if(scale) root.scale.setScalar(scale);
    g.add(root);
    procMesh.visible = false;
    console.log('[inspector] ' + label + ' loaded');
  });
}
afterLoad(() => {
  const tryOld = err => {
    console.warn('[inspector] Mixamo inspector unavailable, using classic rig:', err);
    if(window.InspectorRig && window.InspectorRig.create) attachInspector(window.InspectorRig.create(), 'game/models/inspector.glb?v=4', 1.55, 'classic GLB').catch(e => console.warn('[inspector] fallback to procedural:', e));
  };
  if(window.MixamoInspector) attachInspector(window.MixamoInspector.create(), 'game/models/inspector-mx.glb', 0, 'Mixamo').catch(tryOld);
  else tryOld('no loader');
});

g.scale.setScalar(1.08); g.visible = false; S.add(g);
return I_;
})();
function resetInspector(){
  inspector.active = false;
  inspector.g.visible = false;
  inspector.cooldown = 6;
  inspector.done = false;
  inspector.elapsed = 0;
  inspector.state = "walk";
  inspector.targetItem = null;
  inspector.inspectT = 0;
  inspector.pauseT = 0;
  inspector.targetZ = INSP_SAFE.zebraZ;
  inspector.z = INSP_SAFE.zebraZ;
  if(inspector.scanRing) inspector.scanRing.visible = false;
  $('inspector-badge').classList.remove('on');
}
function updateInspector(dt){
const I_ = inspector;
if(!I_.active){
if(I_.done) return;
I_.elapsed = (I_.elapsed||0) + dt;
I_.cooldown -= dt;
if(I_.cooldown > 0) return;
if(!evtAllowPatrol()) return;
const bad = items.filter(i => i.st === 'floor' && !i.data.isFod && !i.fall && !i.fined && (i.floorT = (i.floorT||0) + dt) > 2.5);
if(!bad.length && I_.elapsed < 30) return;
const cand = bad.length ? bad : items.filter(i => i.st === 'floor' && !i.data.isFod && !i.fall && !i.fined);
let tgt = {m:{position:{z:px.z - 1.6}}}, bn = -1;
for(const c of cand){ const n = cand.filter(o => Math.abs(o.m.position.z - c.m.position.z) < 5.5).length; if(n > bn){ bn = n; tgt = c; } }

// اختيار ممر دورية طبيعي في المساحة المفتوحة دون دخول الحاويات أو الحزام
let patrolZ = INSP_SAFE.zebraZ;
if(tgt && tgt.m && tgt.m.position){
  const tz = tgt.m.position.z;
  if(tz <= 0.5){
    patrolZ = Math.max(INSP_SAFE.minZ, Math.min(0.5, tz + 2.2));
  } else if(tz >= 3.5){
    patrolZ = Math.min(INSP_SAFE.maxZ, Math.max(3.0, tz - 2.2));
  } else {
    patrolZ = tz > 2.0 ? Math.max(INSP_SAFE.minZ, tz - 1.6) : Math.min(INSP_SAFE.maxZ, tz + 1.6);
  }
}

I_.dir = Math.random() < 0.5 ? 1 : -1;
I_.z = Math.max(INSP_SAFE.minZ, Math.min(INSP_SAFE.maxZ, patrolZ));
I_.targetZ = I_.z;
I_.x = -INSP_SAFE.maxX * I_.dir; // البداية من عتبة باب المستودع داخل المبنى
I_.active = true; I_.g.visible = true; I_.t = 0; evt.patrol++; evt.lastInsp = evt.t;
I_.state = 'walk';
I_.targetItem = null;
I_.inspectT = 0;
I_.pauseT = 0;
I_.g.position.set(I_.x, 0, I_.z);
I_.g.rotation.y = I_.dir > 0 ? Math.PI/2 : -Math.PI/2;
$('inspector-badge').classList.add('on');
snd('whistle');
return;
}

// 1. مرحلة التفتيش الدقيق مع إيماءات اليدين وحلقة المسح الضوئي
if(I_.state === 'inspect'){
  I_.inspectT += dt;
  const it = I_.targetItem;
  if(!it || it.st !== 'floor' || it.fall){
    if(I_.scanRing) I_.scanRing.visible = false;
    I_.state = 'verdict_pause';
    I_.pauseT = 0.8;
    return;
  }
  const dx = it.m.position.x - I_.x;
  const dz = it.m.position.z - I_.z;
  const faceAngle = Math.atan2(dx, dz);
  I_.g.rotation.y = lrp(I_.g.rotation.y, faceAngle, Math.min(1, dt * 10));

  if(I_.scanRing){
    I_.scanRing.visible = true;
    I_.scanRing.position.set(it.m.position.x, 0.04, it.m.position.z);
    const pulse = 1.0 + Math.sin(I_.inspectT * 7.0) * 0.12;
    I_.scanRing.scale.set(pulse, pulse, 1);
  }

  if(I_.rig && I_.rig.pose){
    I_.rig.pose({ dt, mode: 'inspect', timer: I_.inspectT });
  }

  if(I_.inspectT >= 2.0){
    it.fined = true;
    if(window.Prog) Prog.fined();
    score = Math.max(0, score - 15);
    combo = 1;
    time = Math.max(0, time - 4);
    logMistake({ k: 'fine', a: it.data, pts: 15 });
    snd('whistle');
    spawnFloatTag('−15 🦺 مخالفة', '#ff5252');
    tip('fine', '📋 المفتش: طرد متروك خارج المنطقة المخصصة! (-15 و -4 ث)', '#ffb020');
    if(it.m.material.emissive) it.m.material.emissive.setHex(0x552200);
    hud();

    if(I_.scanRing) I_.scanRing.visible = false;
    I_.state = 'verdict_pause';
    I_.pauseT = 1.3; // توقف واضح لمدة 1.3 ثانية
  }
  return;
}

// 2. مرحلة التوقف الواضح والحاسم بعد انتهاء الفحص
if(I_.state === 'verdict_pause'){
  I_.pauseT -= dt;
  if(I_.scanRing) I_.scanRing.visible = false;
  if(I_.rig && I_.rig.pose){
    I_.rig.pose({ dt, mode: 'verdict_pause', timer: 1.3 - I_.pauseT });
  }
  if(I_.pauseT <= 0){
    I_.state = 'walk';
    // تفادي الصندوق الذي تم فحصه عند استئناف المشي حتى لا يمر من خلاله
    if(I_.targetItem && I_.targetItem.m){
      const bz = I_.targetItem.m.position.z;
      if(Math.abs(bz - I_.z) < 1.1){
        const detour = bz >= I_.z ? -1.2 : 1.2;
        I_.targetZ = Math.max(INSP_SAFE.minZ, Math.min(INSP_SAFE.maxZ, I_.z + detour));
      }
    }
    I_.targetItem = null;
  }
  return;
}

// 3. مرحلة المشي والدورية في ممرات المستودع الطبيعية (walk)
/* الرافعة الشوكية أمامه: ينحرف عنها جانبياً، وإن كانت قريبة جداً يتوقف حتى تبتعد */
const fkx = fk.position.x - I_.x, fkz = fk.position.z - I_.z, fkAhead = fkx * I_.dir, fkD = Math.hypot(fkx, fkz);
const fkNeed = FK_HX + INSP_FK_GAP + .6;
let fkAvoid = 0, fkWait = false;
if(fkAhead > -(FK_HX + 1.8) && fkAhead < fkNeed + 3.5 && Math.abs(fkz) < fkNeed){
  let side = fkz >= 0 ? -1 : 1, goal = fk.position.z + side * fkNeed;
  if(goal < INSP_SAFE.minZ || goal > INSP_SAFE.maxZ){ side = -side; goal = fk.position.z + side * fkNeed; }
  if(goal >= INSP_SAFE.minZ && goal <= INSP_SAFE.maxZ) fkAvoid = goal - (I_.targetZ || I_.z);
  fkWait = fkAhead > 0 && fkAhead < fkNeed + .4 && Math.abs(fkz) < fkNeed - .3;
}
/* الموظف أمامه: يتنحّى جانباً بمسافة INSP_PLAYER_SIDE، وإن كان ملاصقاً يتوقف حتى يبتعد بدل أن يصطدم به */
let plAvoid = 0;
if(!FD.on){
  const plx = px.x - I_.x, plz = px.z - I_.z, plAhead = plx * I_.dir;
  if(plAhead > -1.2 && plAhead < 5.2 && Math.abs(plz) < INSP_PLAYER_SIDE){
    let side = plz >= 0 ? -1 : 1, goal = px.z + side * INSP_PLAYER_SIDE;
    if(goal < INSP_SAFE.minZ || goal > INSP_SAFE.maxZ){ side = -side; goal = px.z + side * INSP_PLAYER_SIDE; }
    plAvoid = Math.max(INSP_SAFE.minZ, Math.min(INSP_SAFE.maxZ, goal)) - (I_.targetZ || I_.z);
    if(plAhead > 0 && plAhead < PLAYER_RADIUS + INSP_BODY_GAP + .5 && Math.abs(plz) < PLAYER_RADIUS + INSP_BODY_GAP){ fkWait = true; if(!fkAvoid) fkAvoid = plAvoid; }
  }
}
if(fkWait){
  I_.waitT = (I_.waitT || 0) + dt;
  if(I_.rig && I_.rig.pose) I_.rig.pose({ dt, phase: I_.t * 5, moving: false });
  I_.z = lrp(I_.z, Math.max(INSP_SAFE.minZ, Math.min(INSP_SAFE.maxZ, (I_.targetZ || I_.z) + fkAvoid)), Math.min(1, dt * 3));
  I_.g.position.set(I_.x, 0, I_.z);
  /* انتظار طويل (الرافعة تسد الممر): يستدير ويكمل دوريته في الاتجاه المعاكس */
  if(I_.waitT > 2.5){ I_.dir = -I_.dir; I_.waitT = 0; }
  const ta = I_.dir > 0 ? Math.PI/2 : -Math.PI/2;
  I_.g.rotation.y = lrp(I_.g.rotation.y, ta, Math.min(1, dt * 6));
  return;
}
I_.waitT = 0;
I_.t += dt;
I_.x += I_.dir * (I_.demo ? 5.5 : 3.4) * dt;

// توجيه المسار إلى الممر المركزي عند الاقتراب من البوابات الطرفية لتفادي منصات البضائع
if(Math.abs(I_.x) > 28){
  I_.targetZ = lrp(I_.targetZ, INSP_SAFE.zebraZ, Math.min(1, dt * 5));
}

// تجنب الصناديق الملقاة على الأرض والمشي حولها بسلاسة بدل اختراقها
let avoidZ = 0;
for(const it of items){
  if(it.st !== 'floor') continue;
  const bx = it.m.position.x, bz = it.m.position.z;
  const dx = bx - I_.x, dz = bz - I_.z;
  if(dx * I_.dir > -0.4 && dx * I_.dir < 1.8 && Math.abs(dz) < 1.0){
    const sign = dz >= 0 ? -1 : 1;
    avoidZ = sign * Math.max(0.7, 1.2 - Math.abs(dz));
    break;
  }
}

const curGoalZ = Math.max(INSP_SAFE.minZ, Math.min(INSP_SAFE.maxZ, (I_.targetZ || I_.z) + (fkAvoid || plAvoid || avoidZ)));
I_.z = lrp(I_.z, curGoalZ, Math.min(1, dt * 4.5));

const targetWalkAngle = I_.dir > 0 ? Math.PI/2 : -Math.PI/2;
I_.g.rotation.y = lrp(I_.g.rotation.y, targetWalkAngle, Math.min(1, dt * 8));
I_.g.rotation.z = Math.sin(I_.t * 5) * 0.05;

const sw = Math.sin(I_.t * 5) * 0.4;
if(I_.legs && I_.legs.length >= 2){ I_.legs[0].rotation.x = sw; I_.legs[1].rotation.x = -sw; }
if(I_.arms && I_.arms.length >= 2){ I_.arms[0].rotation.x = -sw * 0.8; I_.arms[1].rotation.x = sw * 0.4 - 0.5; }
if(I_.rig && I_.rig.pose){ I_.rig.pose({ dt, phase: I_.t * 5, moving: true }); }
I_.g.position.set(I_.x, Math.abs(Math.sin(I_.t * 5)) * 0.04, I_.z);

// رصد الطرود المخالفة من مسافة رؤية آمنة دون التصادم معها
for(const it of items){
  if(I_.demo || it.st !== 'floor' || it.data.isFod || it.fined) continue;
  const dx = it.m.position.x - I_.x;
  const dz = it.m.position.z - I_.z;
  const dist = Math.hypot(dx, dz);
  const ahead = dx * I_.dir;
  if(dist <= 5.8 && ahead >= -0.2 && ahead <= 3.2 && Math.abs(dz) <= 5.2){
    I_.state = 'inspect';
    I_.targetItem = it;
    I_.inspectT = 0;
    break;
  }
}

// انتهاء الجولة والوصول إلى بوابة الخروج دون اختراق الجدران الخارجية
if(Math.abs(I_.x) >= INSP_SAFE.maxX){
  I_.active = false; I_.g.visible = false; I_.done = true; I_.cooldown = 14; I_.elapsed = 0;
  if(I_.scanRing) I_.scanRing.visible = false;
  if(I_.demo){ I_.demo = false; demo.insp = false; demo.inspDone = true; if(demo.truckDone) saveTutorialDone(); demo.truckIn = 6; hideIntro(); }
  $('inspector-badge').classList.remove('on');
}
}
/* ===== فحص شحنة CAO قبل التحميل: قرار قبول/رفض بسبب ===== */
const CAO_PANEL = $('cao-panel');
const CAO_BUBBLE = $('cao-bubble');
const CAO_SAY = $('cao-say');
/* أزرار القرار: نصوصها الأصلية محفوظة لاستعادتها بعد سؤال الملصق (نعم/لا) */
const caoAccept = CAO_BUBBLE && CAO_BUBBLE.querySelector('button[data-a="accept"]');
const caoStow = CAO_BUBBLE && CAO_BUBBLE.querySelector('button[data-a="stow"]');
const caoReject = CAO_BUBBLE && CAO_BUBBLE.querySelector('button[data-a="reject"]');
[caoAccept, caoStow, caoReject].forEach(b => { if(b) b.setAttribute('data-t', b.textContent); });
const CAO_Q = $('cao-q');
const CAO_Q_DEFAULT = CAO_Q ? CAO_Q.textContent : '';
const caoQ = { active:false, answered:false, it:null, flight:null, v:new THREE.Vector3() };
const caoV = new THREE.Vector3();
/* فقاعة الحوار تُثبَّت فوق رأس المفتش: إسقاط موضعه ثلاثي الأبعاد إلى الشاشة */
function caoAnchor(el, lift){
caoV.set(inspector.x, 2.64, inspector.z).project(C);
const w = el.offsetWidth || 320, h = el.offsetHeight || 220;
let sx = (caoV.x * 0.5 + 0.5) * innerWidth;
let sy = (-caoV.y * 0.5 + 0.5) * innerHeight - (lift || 0);
sx = Math.max(w / 2 + 8, Math.min(innerWidth - w / 2 - 8, sx));
sy = Math.max(h + 26, Math.min(innerHeight - 12, sy));
el.style.left = sx + 'px';
el.style.top = sy + 'px';
}
const caoBubble = () => caoQ.mode === 'quiz' && QUIZ_BUBBLE ? QUIZ_BUBBLE : CAO_BUBBLE;
function caoPlace(){
if(!caoQ.active) return;
caoAnchor(caoBubble(), 0);
caoAnchor(CAO_SAY, 0);
}
/* المشهد المجمّد: المفتش يمشي حتى يقف أمامك ثم تُفتح فقاعته */
function updateCaoScene(r){
const I_ = inspector;
I_.t += r;
const cd = I_.caoDir || -1;
if((I_.toX - I_.x) * cd > 0) I_.x = cd < 0 ? Math.max(I_.toX, I_.x - 3.8 * r) : Math.min(I_.toX, I_.x + 3.8 * r);
const walking = (I_.toX - I_.x) * cd > .01;
const sw = Math.sin(I_.t * 7) * (walking ? .5 : .06);
if(I_.legs && I_.legs.length >= 2){ I_.legs[0].rotation.x = sw; I_.legs[1].rotation.x = -sw; }
if(I_.arms && I_.arms.length >= 2){ I_.arms[0].rotation.x = -sw * .7; I_.arms[1].rotation.x = sw * .4 - .62; }
if(I_.rig && I_.rig.pose){
  if(walking){
    I_.g.rotation.y = cd * Math.PI / 2;
    I_.rig.pose({ dt: r, phase: I_.t * 7, moving: true });
  } else if(!caoQ.answered){
    const facePlayer = Math.atan2(px.x - I_.x, px.z - I_.z);
    I_.g.rotation.y = lrp(I_.g.rotation.y, facePlayer, Math.min(1, r * 8));
    I_.rig.pose({ dt: r, mode: 'cao_inspect', timer: I_.t });
  } else {
    const facePlayer = Math.atan2(px.x - I_.x, px.z - I_.z);
    I_.g.rotation.y = lrp(I_.g.rotation.y, facePlayer, Math.min(1, r * 8));
    I_.rig.pose({ dt: r, mode: caoQ.lastOk ? 'cao_approved' : 'cao_rejected', timer: I_.t });
  }
}
I_.g.position.set(I_.x, walking ? Math.abs(Math.sin(I_.t * 7)) * .05 : 0, I_.z);
/* الموظف يلتفت إلى المفتش ويقف في وضع انتظار حيّ بدل أن يتجمّد وهو يمشي */
{
  const faceInsp = Math.atan2(I_.x - px.x, I_.z - px.z);
  let dA = faceInsp - curRotY; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
  curRotY += dA * Math.min(1, r * 6); rig.rotation.y = curRotY;
  const acr = activeCharRig();
  if(acr && acr.root.visible){ acr.root.rotation.y = curRotY; acr.pose({ dt: r, moving: false, speed: 0, held: false }); }
}
if(!walking && !caoQ.answered) caoBubble().classList.add('in');
caoPlace();
}
/* بُعد نقطة عن الرافعة: عن جسمها (صندوق يدور مع اتجاهها) وعن شوكتيها الممتدتين للأمام */
function fkClearance(x, z){
const h = fkHalf(), bx = Math.max(0, Math.abs(x - fk.position.x) - h.hx), bz = Math.max(0, Math.abs(z - fk.position.z) - h.hz);
const ax = fk.position.x, az = fk.position.z;
const dx = gameRules.forklift.forkX(ax, fk.rotation.y) - ax, dz = gameRules.forklift.forkZ(az, fk.rotation.y) - az;
const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
return Math.min(Math.hypot(bx, bz), Math.hypot(x - ax - dx * t, z - az - dz * t));
}
/* الطرد الثقيل على الأرض جسم صلب أيضاً: نصف عرض الباليت ≈ 0.9، ويكفي المفتشَ هامش جسده INSP_BODY_GAP منه
   (نُعيدها بمقياس INSP_FK_GAP لتُقارن مع خلوص الرافعة بالعتبة نفسها) */
function inspClearance(x, z){
let c = fkClearance(x, z);
const h = hv.item;
if(h && h.st === 'floor' && !h.fall){
  const bx = Math.max(0, Math.abs(x - h.m.position.x) - .9), bz = Math.max(0, Math.abs(z - h.m.position.z) - .9);
  c = Math.min(c, Math.hypot(bx, bz) - INSP_BODY_GAP + INSP_FK_GAP);
}
return c;
}
/* نقطة وقوف المفتش للسؤال: على خط الموظف، يميناً أو يساراً، على مسافة CAO_GAP على الأقل،
   بعيدة عن الرافعة بـ INSP_FK_GAP، وطريق اقترابها (7.4م من الخارج) خالٍ من الرافعة أيضاً */
function caoStand(z0){
const pref = px.x + CAO_GAP <= 22 ? 1 : -1;
let best = null;
for(let d = CAO_GAP; d <= 10; d += .3){
  for(const side of [pref, -pref]){
    const x = px.x + side * d;
    if(x < -24 || x > 22) continue;
    let clear = inspClearance(x, z0);
    for(let s = .5; s <= 7.4 && clear >= INSP_FK_GAP; s += .5) clear = Math.min(clear, inspClearance(x + side * s, z0) + .9);
    const c = { x, dir: -side, clear };
    if(clear >= INSP_FK_GAP) return c;
    if(!best || clear > best.clear) best = c;
  }
}
return best || { x: Math.max(-24, Math.min(22, px.x + pref * CAO_GAP)), dir: -pref, clear: 0 };
}
function caoOpen(it){
const f = gameRules.cao.flightFor(Math.round(it.m.position.x) + totalProcessed);
caoQ.active = true; caoQ.answered = false; caoQ.it = it; caoQ.flight = f; caoQ.mode = 'cao'; evt.lastInsp = evt.t;
const placardQ = !!it.data.placard;
$('cao-item').textContent = it.data.name + ' • ' + it.data.imp + ' / ' + it.data.div;
$('cao-flight').textContent = I18N.T('الرحلة ','Flight ') + (f.id + ' · ' + f.from + ' ✈ ' + f.to) + I18N.T(' — طائرة ركاب',' — passenger aircraft');
/* شحنة الملصق عالي الدقة: سؤال نعم/لا مباشر بدل خيارات التحميل الثلاثة */
CAO_BUBBLE.classList.toggle('placard', placardQ);
if(CAO_Q) CAO_Q.textContent = placardQ
  ? I18N.T('هل يُسمح بشحن هذه الشحنة على طائرة ركاب؟','Is this shipment allowed on a passenger aircraft?')
  : CAO_Q_DEFAULT;
if(caoAccept) caoAccept.hidden = false;
if(caoStow) caoStow.hidden = placardQ;
if(caoAccept) caoAccept.textContent = placardQ ? I18N.T('✅ نعم، مسموح','✅ Yes, allowed') : caoAccept.getAttribute('data-t');
if(caoReject) caoReject.textContent = placardQ ? I18N.T('🚫 لا، غير مسموح','🚫 No, not allowed') : caoReject.getAttribute('data-t');
/* المفتش يحضر بنفسه: يقف أمام اللاعب في الممر الطبيعي المفتوح ويطلب القرار */
const I_ = inspector;
// ضمان موضع وقوف آمن وطبيعي في مساحة المشي بعيداً عن أقفاص الحاويات والحزام والرافعة
/* يقف المفتش بجانب الموظف على الخط نفسه (وجهاً لوجه) فيظهر الاثنان جانبياً بوضوح ولا يحجب أحدهما الآخر */
const z0 = Math.max(INSP_SAFE.minZ, Math.min(INSP_SAFE.maxZ, px.z));
/* يأتي من الجهة التي فيها متسع ويقف قبل الموظف بمسافة حوار CAO_GAP، فلا يعبر من خلاله أبداً،
   ولا يقف داخل الرافعة (التي يقودها الموظف أو المتوقفة) ولا يمر عبرها أثناء الاقتراب */
caoApproach(z0);
}
/* المفتش يمشي حتى يقف بجانب الموظف ثم تُفتح الفقاعة النشطة (CAO أو سؤال) */
function caoApproach(z0){
const I_ = inspector;
const stand = caoStand(z0);
const x0 = stand.x;
inspector.caoDir = stand.dir;
I_.active = true; I_.demo = false; I_.done = false; I_.t = 0;
I_.g.visible = true;
I_.z = z0;
I_.targetZ = z0;
I_.toX = x0;
I_.x = Math.max(-32, Math.min(32, x0 - I_.caoDir * 7.4));
I_.g.rotation.y = I_.caoDir * Math.PI / 2; // يواجه اتجاه مشيه أثناء الاقتراب
I_.g.position.set(I_.x, 0, I_.z);
CAO_BUBBLE.classList.remove('in');
if(QUIZ_BUBBLE) QUIZ_BUBBLE.classList.remove('in');
CAO_SAY.classList.remove('in');
CAO_PANEL.classList.add('on');
CAO_PANEL.setAttribute('aria-hidden','false');
caoPlace();
snd('whistle'); snd('warn');
}
/* رد المفتش: فقاعة بيضاء واضحة تبقى معروضة حتى تُقرأ */
let caoHoldT = null;
function caoSay(text, ok){
$('cao-say-text').textContent = text;
CAO_SAY.classList.remove('good', 'bad');
CAO_SAY.classList.add(ok ? 'good' : 'bad');
CAO_SAY.classList.remove('in');
/* إعادة تدفق متزامنة بدل rAF: الفقاعة تظهر حتى لو كان التبويب في الخلفية */
void CAO_SAY.offsetWidth;
caoPlace();
CAO_SAY.classList.add('in');
}
function caoEnd(){
clearTimeout(caoHoldT);
caoQ.active = false; caoQ.answered = false; caoQ.it = null; caoQ.mode = null; caoQ.quiz = null;
if(QUIZ_BUBBLE) QUIZ_BUBBLE.classList.remove('in');
CAO_PANEL.classList.remove('on');
CAO_PANEL.setAttribute('aria-hidden','true');
CAO_BUBBLE.classList.remove('placard');
if(CAO_Q) CAO_Q.textContent = CAO_Q_DEFAULT;
if(caoStow) caoStow.hidden = false;
if(caoAccept) caoAccept.textContent = caoAccept.getAttribute('data-t');
if(caoReject) caoReject.textContent = caoReject.getAttribute('data-t');
CAO_BUBBLE.classList.remove('in');
CAO_SAY.classList.remove('in');
const I_ = inspector;
I_.active = false; I_.g.visible = false; I_.done = false; I_.cooldown = 8; I_.elapsed = 0;
}
function caoAnswer(opt){
const it = caoQ.it;
if(!it || !caoQ.active || caoQ.answered) return;
const ok = gameRules.cao.correct(opt);
progEmit('cao', { ok }); progEmit('dgr', { ok });
it.caoChecked = true;
caoQ.answered = true;
caoQ.lastOk = ok;
totalProcessed++;
CAO_BUBBLE.classList.remove('in');
if(ok){
sortedCount++;
const p = gameRules.cao.reward;
score += p; time += 2;
streak++; streakT = streakWindow(); maxStreak = Math.max(maxStreak, streak);
combo = gameRules.economy.comboAfter(streak);
snd('ok', 1.3); screenFlash('gold');
spawnFloatTag('+' + p + ' 🚫', '#69f0ae');
caoSay(I18N.T('قرار صحيح. هذا الطرد CAO لا يُحمَّل إلا على طائرة شحن، وكل رحلاتنا ركاب — رفضته في مكانه. +','Correct call. A CAO parcel may only fly on a cargo aircraft, and every flight here is passenger — you refused it. +') + p + I18N.T(' نقطة.',' pts.'), true);
rm(it);
} else {
const lost = Math.min(score, gameRules.cao.penalty);
score = Math.max(0, score - gameRules.cao.penalty);
time = Math.max(0, time - 4);
streak = 0; streakT = 0; combo = 1;
logMistake({ k: 'cao', a: it && it.data, pts: gameRules.cao.penalty });
snd('error'); penaltyFx(lost, true);
balletReset();
spawnFloatTag('−' + gameRules.cao.penalty + ' −4 ث', '#ff5252');
caoSay(I18N.T('قرار خاطئ. الطرد يحمل ملصق CAO — Cargo Aircraft Only — ورحلتنا ركاب، فتحميله مخالفة. أوقفه وأعد تصديره على طائرة شحن. −','Wrong call. The parcel is labelled CAO — Cargo Aircraft Only — and this is a passenger flight, so loading it is a violation. Hold it and re-route it on a freighter. −') + gameRules.cao.penalty + I18N.T(' نقطة و −4 ثوانٍ.',' pts and −4s.'), false);
it.st = 'belt';
}
/* الرسالة تبقى معروضة بوقت كافٍ للقراءة ثم ينسحب المفتش */
clearTimeout(caoHoldT);
caoHoldT = setTimeout(caoEnd, ok ? 4600 : 5600);
hud();
}
if(CAO_PANEL){
/* تفويض النقر: الإجابة على السؤال، أو النقر في أي مكان بعد الإجابة للاستئناف الفوري دون انتظار */
CAO_PANEL.addEventListener('click', e => {
if(caoQ.answered){
  e.preventDefault(); e.stopPropagation();
  caoEnd();
  return;
}
const qb = e.target.closest && e.target.closest('button[data-qa]');
if(qb){
  e.preventDefault(); e.stopPropagation();
  if(caoQ.active && caoQ.mode === 'quiz' && QUIZ_BUBBLE.classList.contains('in')) quizAnswer(+qb.dataset.qa);
  return;
}
const b = e.target.closest && e.target.closest('button[data-a]');
if(!b) return;
e.preventDefault(); e.stopPropagation();
/* لا إجابة من فقاعة مخفية: الأزرار غير المرئية لا تمنح نقاطاً */
if(!caoQ.active || !CAO_BUBBLE.classList.contains('in')) return;
caoAnswer(b.dataset.a);
});
}
if(CAO_SAY){
CAO_SAY.addEventListener('click', e => {
  e.preventDefault(); e.stopPropagation();
  caoEnd();
});
}
/* ===== سؤال المفتش: أسئلة من صفحة الإدارة (أو الافتراضية) تظهر عشوائياً مرتين في الوردية =====
   الإجابة الأولى المخزّنة هي الصحيحة، وتُخلط الإجابات في كل مرة. */
const QUIZ_BUBBLE = $('quiz-bubble');
const QUIZ_CACHE = 'acg_quiz_v1';
const quizBank = { list: null, recent: [] };
/* فوراً من التخزين المحلي أو الأسئلة الافتراضية، ثم تحديث من قاعدة البيانات في الخلفية */
(function quizLoad(){
  if(!window.InspectorQuiz) return;
  try { const c = JSON.parse(localStorage.getItem(QUIZ_CACHE) || 'null'); if(c && Array.isArray(c.list)) quizBank.list = c.list; } catch(e){}
  if(!quizBank.list) quizBank.list = InspectorQuiz.defaults();
  try { quizBank.recent = JSON.parse(localStorage.getItem(QUIZ_CACHE + '_recent') || '[]').slice(-InspectorQuiz.recentKeep); } catch(e){}
  if(window.Online && Online.enabled() && Online.quizList){
    Online.quizList().then(r => {
      if(!r) return;
      quizBank.list = r.seeded ? r.list.map(InspectorQuiz.normalize) : InspectorQuiz.defaults();
      try { localStorage.setItem(QUIZ_CACHE, JSON.stringify({ list: r.seeded ? quizBank.list : null, at: Date.now() })); } catch(e){}
    }).catch(() => {});
  }
})();
const quizHasAny = () => !!(window.InspectorQuiz && InspectorQuiz.pick(quizBank.list || [], [], () => 0));
function quizDue(){
  return run && window.InspectorQuiz && evt.quizIdx < evt.quizAt.length && evt.t >= evt.quizAt[evt.quizIdx] && (stage >= 2 || demo.inspDone);
}
function quizSafe(){
  return time > 12 && !caoQ.active && !inspector.active && !fire.active && !jam.active && !cardP.active && !uldP.active && !frzP.active && !FRZ.pending &&
    !truckState.active && !STUDY.on && !FD.on && !introHold && !liftAnim.active && rushN === 0 && !demo.insp &&
    !(window.Prog && Prog.busy()) && !items.some(i => i.data.cao && !i.caoChecked) && evt.t - evt.lastInsp >= 15;
}
function quizOpen(){
  evt.quizIdx++;
  if(!QUIZ_BUBBLE || !quizHasAny()) return;
  const q = InspectorQuiz.pick(quizBank.list, quizBank.recent);
  if(!q) return;
  quizBank.recent = quizBank.recent.filter(id => id !== q.id).concat(q.id).slice(-InspectorQuiz.recentKeep);
  try { localStorage.setItem(QUIZ_CACHE + '_recent', JSON.stringify(quizBank.recent)); } catch(e){}
  const sh = InspectorQuiz.shuffle(q), tx = InspectorQuiz.localize(q, I18N.lang);
  caoQ.active = true; caoQ.answered = false; caoQ.it = null; caoQ.mode = 'quiz';
  caoQ.quiz = { q, order: sh.order, correct: sh.correct, text: tx };
  evt.lastInsp = evt.t;
  const img = $('quiz-img');
  if(q.img){ img.src = q.img; img.hidden = false; } else { img.hidden = true; img.removeAttribute('src'); }
  $('quiz-q').textContent = tx.q;
  $('quiz-tag').textContent = I18N.T('سؤال ', 'Q ') + evt.quizIdx + '/' + evt.quizAt.length;
  $('quiz-ans').innerHTML = sh.order.map((k, i) => `<button class="cq-b quiz-b" type="button" data-qa="${i}"><kbd>${i + 1}</kbd><span></span></button>`).join('');
  [...$('quiz-ans').children].forEach((b, i) => { b.lastChild.textContent = tx.a[sh.order[i]]; });
  $('quiz-keys').hidden = matchMedia('(pointer: coarse)').matches;
  caoApproach(Math.max(INSP_SAFE.minZ, Math.min(INSP_SAFE.maxZ, px.z)));
}
function quizAnswer(i){
  const Q = caoQ.quiz;
  if(!Q || !caoQ.active || caoQ.answered || !(i >= 0 && i < Q.order.length)) return;
  const ok = i === Q.correct, IQ = InspectorQuiz, right = Q.text.a[0];
  caoQ.answered = true; caoQ.lastOk = ok;
  [...$('quiz-ans').children].forEach((b, k) => { b.disabled = true; b.classList.toggle('right', k === Q.correct); b.classList.toggle('wrong', k === i && !ok); });
  QUIZ_BUBBLE.classList.remove('in');
  progEmit('dgr', { ok });
  if(ok){
    score += IQ.reward; time += IQ.timeBonus;
    streak++; streakT = streakWindow(); maxStreak = Math.max(maxStreak, streak);
    combo = gameRules.economy.comboAfter(streak);
    snd('ok', 1.3); screenFlash('gold');
    spawnFloatTag('+' + IQ.reward + ' 🎓', '#69f0ae');
    caoSay(I18N.T('إجابة صحيحة، أحسنت! «', 'Correct, well done! “') + right + I18N.T('». +', '”. +') + IQ.reward + I18N.T(' نقطة و +', ' pts and +') + IQ.timeBonus + I18N.T(' ث.', 's.'), true);
  } else {
    const lost = Math.min(score, IQ.penalty);
    score = Math.max(0, score - IQ.penalty);
    streak = 0; streakT = 0; combo = 1;
    logMistake({ k: 'quiz', txt: right, pts: IQ.penalty });
    snd('error'); penaltyFx(lost, true);
    spawnFloatTag('−' + IQ.penalty, '#ff5252');
    caoSay(I18N.T('إجابة خاطئة. الإجابة الصحيحة: «', 'Wrong answer. The correct one is: “') + right + I18N.T('». −', '”. −') + IQ.penalty + I18N.T(' نقطة.', ' pts.'), false);
  }
  clearTimeout(caoHoldT);
  caoHoldT = setTimeout(caoEnd, ok ? 3800 : 5200);
  hud();
}
let last = performance.now();
const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.12, 40), new THREE.MeshBasicMaterial({color:0xffc94d, transparent:true, opacity:0.85, depthWrite:false}));
ring.rotation.x = -Math.PI/2; ring.visible = false; S.add(ring);
let warnTicker = 0;
let hudTicker = 0;
const cargoTarget = new THREE.Vector3();
let camTarget = new THREE.Vector3(), camLook = new THREE.Vector3(0,0.9,0.8), camLookT = new THREE.Vector3();
/* أثناء سؤال المفتش: تتحرك الكاميرا نحو الاثنين (الموظف والمفتش) وتُزيحهما إلى جهة الشاشة المقابلة للفقاعة */
let caoView = 0;
C.position.set(0, 13.2, 15.4);
function loop(now){
requestAnimationFrame(loop);
const rawDt = (now - last) / 1000;
let dt = document.hidden || rawDt > 1 ? 0 : Math.min(rawDt, .5); last = now;
for(const L of FOD_PULSE) L.intensity = 0.8 + 0.5 * Math.sin(now / 260);
/* نافذة قرار CAO تجمّد الوردية كلها حتى يُحسم القبول أو الرفض */
if(caoQ.active){ dt = 0; updateCaoScene(Math.min(rawDt, .05)); }
if(frzP.active || cardP.active || uldP.active) dt = 0;
/* Hit-stop: تجميد لحظي لكل المحاكاة لإبراز الأثر الكبير */
if(hitStop > 0){ hitStop = Math.max(0, hitStop - Math.max(rawDt, 0)); dt = 0; }
/* تباطؤ الزمن لحظة النجاة من الرافعة */
if(window.Prog) dt = Prog.timeScale(dt, rawDt);
if(!document.hidden && rawDt > 0 && rawDt < 1){
// حماية الأداء: أقل من 35 إطاراً/ث لعدّتين متتاليتين ⇒ خفض مؤقت للنسبة؛ وعند الاستقرار نعود للنسبة الهدف
if(perfWarm < 2.5) perfWarm += rawDt;
else {
perfWin += rawDt; perfFrames++;
if(perfFrames >= 30 || (perfFrames >= 10 && perfWin >= 1.4)){
const avg = perfWin / perfFrames; perfWin = 0; perfFrames = 0;
if(avg > 1/35){ slowStreak++; fastStreak = 0; }
else if(avg < 1/52){ fastStreak++; slowStreak = 0; }
else { slowStreak = 0; fastStreak = 0; }
let next = renderScale;
if(slowStreak >= 2) next = Math.max(.5, renderScale - .25);
else if(fastStreak >= 3) next = Math.min(scaleCeil, renderScale + .25);
next = Math.max(.5, Math.min(scaleCeil, next));
if(Math.abs(next - renderScale) > .001){
renderScale = next; slowStreak = 0; fastStreak = 0; rs();
}
}
}
}
updateExitSequence(now, dt);
if(liftAnim.active){
liftAnim.t += dt / liftAnim.dur;
const progress = Math.min(1, liftAnim.t);
const dx = liftAnim.fromPos.x - px.x;
const dz = liftAnim.fromPos.z - px.z;
const tr = Math.atan2(dx, dz); curRotY += Math.atan2(Math.sin(tr-curRotY), Math.cos(tr-curRotY)) * Math.min(1, dt*14);
rig.rotation.y = curRotY;
const arc = Math.sin(progress * Math.PI) * 0.45;
const holdTargetX = px.x + Math.sin(curRotY) * 0.78;
const holdTargetZ = px.z + Math.cos(curRotY) * 0.78;
liftAnim.toHold.m.position.lerpVectors(liftAnim.fromPos, cargoTarget.set(holdTargetX, 1.38, holdTargetZ), progress);
liftAnim.toHold.m.position.y += arc;
liftAnim.toHold.m.rotation.y = curRotY;
if(progress >= 1){
liftAnim.active = false;
held = liftAnim.toHold; held.st = 'held';
cargoSmoothPos.copy(held.m.position);
hud();
}
}
let tx = (key.KeyD || key.ArrowRight ? 1 : 0) - (key.KeyA || key.ArrowLeft ? 1 : 0) + joy.x;
let tz = (key.KeyS || key.ArrowDown ? 1 : 0) - (key.KeyW || key.ArrowUp ? 1 : 0) + joy.y;
const tl = Math.hypot(tx, tz);
if(tl > 1){ tx /= tl; tz /= tl; }
const inputK = 1 - Math.exp(-dt * ((tx * inX < 0 || tz * inZ < 0 || tl === 0) ? 28 : 16));
inX += (tx - inX) * inputK; inZ += (tz - inZ) * inputK;
let vx = inX, vz = inZ;
let l = Math.hypot(vx, vz);
if(l < .015){ vx = vz = 0; l = 0; }
if(l > 1){ vx /= l; vz /= l; l = 1; }
animSpd += (l - animSpd) * (1 - Math.exp(-dt * 12));
if(fire.active) updateFire(dt);
/* مؤقتات الاندفاع والحمى */
if(dashT > 0){ dashT = Math.max(0, dashT - dt); if(dashT === 0) $('dash-fx').classList.remove('on'); }
engineTick(dt);
if(dashCD > 0) dashCD = Math.max(0, dashCD - dt);
if(feverT > 0){ feverT = Math.max(0, feverT - dt); if(feverT === 0) $('stage').classList.remove('fever'); }
shakeTrauma = Math.max(0, shakeTrauma - dt * TRAUMA_DECAY);
/* لوحة الفرز: تُحسب قبل حركة هذا الإطار حتى تُجمّد الساعة فور الوقوف أمامها */
updateStudy(dt);
if(run) updateShips(dt);
updateFreezer(dt);
if(run && !fire.keypad){
if(!fire.active && !STUDY.on && !jam.active && (stage>=3 || demo.truck)) updateTruck(dt);
const sprintOn = !held && !!(key.ShiftLeft || key.ShiftRight);
const sprintK = (dashT > 0 ? dashCfg().k : 1) * (feverT > 0 ? FEVER_BOOST : 1) * (sprintOn ? 1.35 : 1);
const spd = liftAnim.active ? 0 : (held ? 6.2 : 8.2) * gameRules.movementMultiplier(fearT) * sprintK * (window.Prog ? Prog.walkK() : 1);
// Small collision steps preserve full travel time even when rendering slows down.
const steps = Math.max(1, Math.ceil(dt / (1/60))), stepDt = dt / steps;
if(FD.on){
FD.left = Math.max(0, FD.left - dt);
/* الاندفاع يسرّع الرافعة أيضاً */
const dSpd = gameRules.forklift.driveSpeed * sprintK * (window.Prog ? Prog.driveK() : 1);   /* العاصفة: أرض مبتلة */
if(l > .001) fk.rotation.y = Math.atan2(vx, vz);
/* جسم الرافعة = دائرتان على محورها الطويل بنصف قطر halfZ بدل نصف قطر اللاعب، فلا تخترق الجدران */
const fkR = FK_HZ, fkOff = FK_HX - FK_HZ, fy = fk.rotation.y, ohx = Math.sin(fy) * fkOff, ohz = Math.cos(fy) * fkOff;
for(let step=0; step<steps; step++){
let cx = fk.position.x + vx * dSpd * stepDt, cz = fk.position.z + vz * dSpd * stepDt;
for(const sg of [1, -1]){
const c = resolvePlayerCollisions(cx + sg*ohx, cz + sg*ohz, vx, vz, stepDt, { rad: fkR, yaw: fy, reach: gameRules.forklift.forkOffset - sg*fkOff });
cx = c.x - sg*ohx; cz = c.z - sg*ohz;
}
fk.position.x = Math.max(-33.2, Math.min(33.2, cx));
fk.position.z = Math.max(-11.2, Math.min(9.7, cz));
}
px.x = fk.position.x; px.z = fk.position.z;
if(FD.seated){
const sc = FD.seated, yw = fk.rotation.y;
/* الرافعة أصغر (FK_SCALE) فيصغر السائق قليلاً (DRV_SCALE) ويُنزَّل مقعده بالنسبة نفسها كي يتناسق مع المقعد والسقف */
if(sc.baseScale === undefined) sc.baseScale = sc.root.scale.x || 1;
sc.root.scale.setScalar(sc.baseScale / (sc.grow || 1) * DRV_SCALE);   // التكبير للمشي فقط: السائق يبقى بمقاس المقعد
const sz = (sc.seatZ !== undefined ? sc.seatZ : SEAT.z) * FK_SCALE;
sc.root.position.set(Math.sin(yw) * sz, (sc.seatY !== undefined ? sc.seatY : SEAT.hips) * FK_SCALE - (sc.hipsHeight || 1.8) * DRV_SCALE, Math.cos(yw) * sz);
sc.root.rotation.set(0, yw, 0);
sc.pose({ dt, sit: true, moving: false, speed: 0 });
}
if(FD.left <= 0) stopDrive('⏱ انتهت مدة قيادة الرافعة (٦٠ ثانية)');
} else if(l > .001){
for(let step=0; step<steps; step++){
const correctedPos = resolvePlayerCollisions(px.x + vx * spd * stepDt, px.z + vz * spd * stepDt, vx, vz, stepDt);
px.x = correctedPos.x; px.z = correctedPos.z;
}
}
if(!FD.on) anim(dt, liftAnim.active ? 0 : animSpd, vx, vz);
FD.near = !FD.on && FD.left > 0 && Math.hypot(px.x - fk.position.x, px.z - fk.position.z) < 4.2;
uldStationTick(dt);
/* المراجعة أمام اللوحة تجمّد ساعة الوردية والأحداث كلها */
if(!fire.keypad && !STUDY.on && !jam.active){ time -= dt; evt.t += dt; }   // الإنذار لا يجمّد الوقت؛ يتوقف فقط أثناء إدخال الرقم
if(time <= 20){
warnTicker += dt;
if(warnTicker > 1){ snd('warn'); warnTicker = 0; }
}
if(time <= 0){ time = 0; hud(); end(); }
if(!fire.active && !fire.done && evt.t >= evt.fireAt && fireSafe()) startFireDrill();
if(quizDue() && quizSafe()) quizOpen();
if(stage===1){
if(!demo.inspDone){ if(!demo.insp && (score >= 20 || time <= 90) && !fire.active && !caoQ.active && !inspector.active && !items.some(i => i.data.cao && !i.caoChecked)) startInspDemo(); }
else if(!demo.truckDone && !demo.truck){
demo.truckIn = Math.max(0, demo.truckIn - dt);
if(demo.truckIn <= 0) startTruckDemo();
}
}
if(stage<4 && score >= STAGE_AT[stage+1]) setStage(gameRules.layout.stageForScore(stage, score));if(!fire.keypad && !STUDY.on && !jam.active){
spawnT -= dt;
if(spawnT <= 0){
if(spawn() === false) spawnT = .25; else spawnT = BREATH_SPAWN[stage];
}
}
if(stage >= 2 && !fire.active && !STUDY.on && !jam.active){
rushT -= dt;
if(rushT <= 0){
rushT = RUSH_EVERY; rushN = RUSH_COUNT; rushDelay = 0;
snd('horn');
showIntro(I18N.T('<b class="t">⚡ تدفق سريع!</b>ثلاث شحنات متتابعة على الحزام — ركّز وسرّع الفرز.', '<b class="t">⚡ Rush hour!</b>Three shipments in a row on the belt — focus and sort faster.'), 2600);
}
if(rushN > 0){
rushDelay -= dt;
if(rushDelay <= 0 && items.length < 14){
if(spawn() === false) rushDelay = .25; else { rushN--; rushDelay = RUSH_GAP[stage]; }
/* بعد الموجة: استراحة أطول لالتقاط الأنفاس */
if(rushN === 0) spawnT = Math.max(spawnT, BREATH_SPAWN[stage] * 1.4);
}
}
}
if(streakT > 0 && !STUDY.on){ streakT -= dt; if(streakT <= 0){ streakT = 0; streak = 0; combo = 1; } }
/* الحركة للرقصة من إزاحة اللاعب الفعلية (لا تتأثر ببطء الإطارات) */
{ const bm = balletPrev ? Math.hypot(px.x - balletPrev.x, px.z - balletPrev.z) : 0;
  balletPrev = { x: px.x, z: px.z };
  balletMoving = dt > 0 && bm / dt > 0.6 && bm < 6;
  if(!STUDY.on && !FD.on) ballet = gameRules.ballet.tick(ballet, dt, balletMoving); }
for(const it of items.slice()){
/* الطرد المجمّد المتروك على الأرض أمام غرفة التجميد (بأي طريقة: إسقاط عادي أو سريع أو رافعة) يفتح لوحة اللغز تلقائياً */
if(it.data.isFrz){
  if(it.st === 'floor' && inFrzZone(it.m.position.x, it.m.position.z)){ if(!it.frzAsked){ it.frzAsked = true; frzDrop(it, it.m.position.x); } }   // فور الإسقاط (حتى أثناء السقوط) بلا انتظار الاستقرار
  else if(it.st !== 'floor' || !inFrzZone(it.m.position.x, it.m.position.z)) it.frzAsked = false;
}
if(it.st !== 'floor' || it.fall) continue;
const zz = Z.find(z => (it.data.isFod ? z.k==='fod' : z.k!=='fod') && Math.abs(it.m.position.x - z.x) < z.hw && it.m.position.z < -5.6 && !z.full);
if(zz){ it.st = 'sorting'; resolvePlacement(zz, it); }
}
separateBoxes();
if(!fire.active && !STUDY.on && !jam.active && !caoQ.active && (stage>=2 || demo.insp)) updateInspector(dt);
updateEvents(dt);
if(window.Prog) Prog.tick(dt);   // أحداث الوردية: الانقطاع، الذروة، VIP، الحيوان الأليف
if(jy){
  const tp2 = gameRules.position(truckState);
  const nearTruck = truckState.active && tp2.x < px.x + 4 && Math.abs(tp2.x - px.x) < 14;
  const nearInsp = inspector.active && Math.abs(inspector.x - px.x) < 12;
  jy.classList.toggle('warn', run && !fire.active && (nearTruck || nearInsp));
}
slowT = STUDY.on ? slowT : Math.max(0, slowT - dt);
beltSlowT = STUDY.on ? beltSlowT : Math.max(0, beltSlowT - dt);
const beltK = (fire.keypad || STUDY.on || jam.active) ? 0 : (slowT > 0 ? 0.35 : (beltSlowT > 0 ? 0.6 : 1));
let best = null, bd = 2.8;
/* طابور الحزام: كل صندوق يتقدم حتى يبقى BELT_GAP خلف الذي أمامه */
const beltLim = new Map();
{ const q = items.filter(i => i.st === 'belt').sort((a, b) => b.m.position.x - a.m.position.x); for(let k = 1; k < q.length; k++) beltLim.set(q[k], q[k - 1].m.position.x - BELT_GAP); }
for(const it of items.slice()){
it.csh.visible = it.st !== 'held' && it.st !== 'lifting';
if(it.fall){ it.vy -= 32 * dt; it.m.position.y += it.vy * dt; if(it.m.position.y <= it.ty){ it.m.position.y = it.ty; it.fall = false; if(it.st === 'floor'){ snd('bump'); const dd = Math.hypot(it.m.position.x - px.x, it.m.position.z - px.z); if(dd < 9) addShake(.45 * (1 - dd / 9)); } } }
if(it.st === 'belt'){
{ const nx = it.m.position.x + beltSpeed() * beltK * dt, lim = beltLim.get(it); it.m.position.x = lim === undefined ? nx : Math.max(it.m.position.x, Math.min(nx, lim)); }
/* نقطة تفتيش CAO: تُوقف الشحنة قبل التحميل لطلب قرار القبول/الرفض */
if(it.data.cao && !it.caoChecked && !caoQ.active && it.m.position.x > 8) caoOpen(it);
if(it.m.position.x > 23.5){
if(it.data.isMys){ rm(it); continue; }
const miss = it.data.isFrz ? gameRules.freezer.penalty : 10;
totalProcessed++;
logMistake({ k: 'missed', a: it.data, pts: miss });
rm(it);
const lost = Math.min(score, miss);
score = Math.max(0, score - miss);
time = Math.max(0, time - 2);
streak = 0; streakT = 0; combo = 1;
snd('error');
penaltyFx(lost, it.data.isHz);
spawnFloatTag('−' + miss + ' −2 ث', '#ff5252');
toast((it.data.isHz ? I18N.T('⚠️ فاتتك مادة خطرة! ','⚠️ You missed a dangerous good! ') : I18N.T('فاتك طرد! ','Parcel missed! ')) + (lost ? '−' + lost + I18N.T(' نقاط و −2 ث',' pts and −2s') : I18N.t('بدون خصم')), '#ff8a5c'); hud(); continue;
}
}
if(it.st === 'held'){
if(FD.on){
const targetPos = cargoTarget.set(gameRules.forklift.forkX(fk.position.x, fk.rotation.y), gameRules.forklift.carryY + (it.data.isHeavy ? .22 : 0), gameRules.forklift.forkZ(fk.position.z, fk.rotation.y));   // الطرد الثقيل يرتفع بقدر الباليت ليبقى فوق الشوكة
cargoSmoothPos.lerp(targetPos, Math.min(1, dt * 20));
it.m.position.copy(cargoSmoothPos);
it.m.rotation.set(0, fk.rotation.y, 0);
} else {
const fX = Math.sin(rig.rotation.y), fZ = Math.cos(rig.rotation.y);
const lX = Math.cos(rig.rotation.y), lZ = -Math.sin(rig.rotation.y);
const sway = l > 0.08 ? Math.sin(walk) * 0.06 : 0;
const bnc = l > 0.08 ? Math.sin(walk * 2) * 0.04 : 0;
cargoInertiaY += (bnc - cargoInertiaY) * Math.min(1, dt * 14);
        const acr = activeCharRig();
        const bodyH = (acr && acr.root.visible && acr.height) ? acr.height : 0;
        /* إن كانت الشخصية تكشف كفّيها نحمل الصندوق بينهما بدل ارتفاع تقديري */
        const hp = (acr && acr.root.visible && acr.holdPoint) ? acr.holdPoint(cargoHold) : null;
        const targetPos = cargoTarget.set(
          hp ? hp.x + fX * HOLD_OFF + lX * sway : px.x + fX * 0.78 + lX * sway,
          (hp ? hp.y : (bodyH ? bodyH * 0.5 : 1.38) + bob * 0.55) + cargoInertiaY,
          hp ? hp.z + fZ * HOLD_OFF + lZ * sway : px.z + fZ * 0.78 + lZ * sway
        );
cargoSmoothPos.lerp(targetPos, Math.min(1, dt * 22));
it.m.position.copy(cargoSmoothPos);
it.m.rotation.y = rig.rotation.y;
it.m.rotation.z = -rig.rotation.z * 0.7;
it.m.rotation.x = -pose.torsoLean * 0.5;
}
} else if(it.st !== 'placed' && it.st !== 'lifting'){
const ox = it.m.position.x - px.x, oz = it.m.position.z - px.z;
const d = Math.hypot(ox, oz);
const facing = d > 0.01 ? (ox*Math.sin(curRotY) + oz*Math.cos(curRotY)) / d : 1;
const score_ = d - Math.max(0, facing) * 0.6;
if(d < 2.6 && score_ < bd){ bd = score_; best = it; }
if(it.wob){ it.wob *= Math.exp(-dt*6); it.m.rotation.z = Math.sin(performance.now()*0.03)*0.06*it.wob; if(it.wob < 0.02){ it.wob = 0; it.m.rotation.z = 0; } }
}
{ const ts = !FD.on && (it.st === 'held' || it.st === 'lifting') ? 0.8 : 1;   /* يصغر الطرد في اليد فقط؛ على شوكة الرافعة يبقى بحجمه */ if(Math.abs(it.m.scale.x - ts) > 0.001) it.m.scale.setScalar(it.m.scale.x + (ts - it.m.scale.x) * Math.min(1, dt * 12)); }
if(it.m.material.emissive) it.m.material.emissive.setHex(0);
if(it.data.isFrz && it.m.material.emissive){ it.m.material.emissive.setHex(0x2a8fb8); it.m.material.emissiveIntensity = 0.1 + Math.sin(now*0.005)*0.07; }
if(it.data.isMys && it.m.material.emissive){ it.m.material.emissive.setHex(0x4a3000); it.m.material.emissiveIntensity = 0.5 + Math.sin(now*0.006)*0.4; }
if(it.crit){
if(it.st === 'belt' || it.st === 'floor' || it.st === 'held'){
if(!STUDY.on && !jam.active) it.crit.t -= dt * (window.Prog ? Prog.chillK() : 1);   /* موجة الحر تُسرّع الفساد */
if(Math.round(Math.max(0, it.crit.t) * 8) !== it.crit.tag.sec) drawCritTag(it.crit.tag, it.crit.t);
const pl = 1 + Math.sin(now * 0.012) * 0.16;
it.crit.halo.scale.set(2.3 * pl, 2.3 * pl, 1);
it.crit.halo.material.opacity = .55 + Math.sin(now * 0.012) * .3;
if(it.crit.t <= 0){ critExplode(it); continue; }
} else if(it.st === 'placed' || it.st === 'sorting') clearCrit(it);
}
}
near = held || liftAnim.active ? null : best;
if(near && near.m.material.emissive){ near.m.material.emissive.setHex(0x3a2400); near.m.material.emissiveIntensity = 0.6 + Math.sin(now*0.008)*0.4; }
if(near){ ring.visible = true; ring.position.set(near.m.position.x, near.st==='belt' ? 0.75 : 0.02, near.m.position.z); ring.rotation.z += dt*2; } else ring.visible = false;
beacons.forEach((b,i) => b.material.emissiveIntensity = 0.4 + Math.max(0, Math.sin(now*0.006 + i*Math.PI))*2.2);
muster.beacon.material.emissiveIntensity = 0.6 + Math.max(0, Math.sin(now*0.003))*1.6;
muster.light.intensity = 0.5 + Math.max(0, Math.sin(now*0.003))*0.7;
if(alarmFlash.group.visible){
const redOn = Math.sin(now*0.0135) > 0;
alarmFlash.redMats.forEach(m => { m.emissiveIntensity = redOn ? 2.8 : 0.06; });
alarmFlash.whiteMats.forEach(m => { m.emissiveIntensity = redOn ? 0.08 : 2.8; });
alarmFlash.redLight.intensity = redOn ? 1.6 : 0.04;
alarmFlash.whiteLight.intensity = redOn ? 0.04 : 1.6;
}
stripes.forEach(s => {
s.position.x += beltSpeed() * beltK * dt;
if(s.position.x > 24) s.position.x -= 50;
});
if(beltSlowUsed){
  const on = beltSlowT > 0;
  beltBtnMat.emissiveIntensity = on ? 0.9 + Math.max(0, Math.sin(now*0.009))*0.4 : 0.02;
  beltBtnMat.color.setHex(on ? 0x12b98c : 0x3b4a4a);
  beltBtnRing.material.emissiveIntensity = on ? 0.6 : 0.05;
  beltBtnHalo.material.opacity = on ? 0.12 + Math.max(0, Math.sin(now*0.005))*0.1 : 0;
} else {
  // سر مخفي: نبض واضح على اللوحة لكن بلا أي علامة على الشاشة
  beltBtnMat.emissiveIntensity = 0.55 + Math.max(0, Math.sin(now*0.0026))*0.35;
  beltBtnRing.material.emissiveIntensity = 0.7 + Math.max(0, Math.sin(now*0.0026))*0.45;
  beltBtnHalo.material.opacity = 0.26 + Math.max(0, Math.sin(now*0.0026))*0.2;
}
hudTicker += dt;
if(hudTicker >= .1){ hudTicker = 0; hud(); }
}
const evacView = fire.active && fire.phase !== 'done' ? -Math.max(0, -px.x) * 0.3 : 0;
if(STUDY.on){
/* منظور أول: إخفاء الموظف والخوذة كل إطار حتى لا يحجبا اللوحة */
pl.visible = false;
/* تقريب الكاميرا إلى اللوحة القائمة أثناء المراجعة: الجدول يُقرأ داخل اللعبة بلا نافذة منبثقة */
const tHalf = Math.tan(C.fov * Math.PI / 360);
/* اللوحة داخل 80% ارتفاعاً و86% عرضاً: هوامش ظاهرة من كل جهة فلا يُغطّى الصف الأخير */
const d = Math.max(STUDY.bh / (2 * tHalf * 0.80), STUDY.bw / (2 * tHalf * Math.max(.35, C.aspect) * 0.86));
const k = 1 - Math.exp(-dt * 6);
C.position.lerp(camTarget.set(STUDY.bx, STUDY.by, STUDY.bz + d), k);
camLook.lerp(camLookT.set(STUDY.bx, STUDY.by, STUDY.bz), 1 - Math.exp(-dt * 7));
C.lookAt(camLook);
} else if(EXIT_GATE.active){
// توجيه الكاميرا نحو بوابة الخروج على اليسار أثناء تسلسل الانتقال
const gateK = 1 - Math.exp(-dt * 2.2);
C.position.lerp(camTarget.set(px.x + 10.6, 8.4, px.z + 5.2), gateK);
camLook.lerp(camLookT.set(-34.2, 3.2, -6), 1 - Math.exp(-dt * 2.6));
C.lookAt(camLook);
} else {
// الكاميرا تتبع الموظف كاملاً (مع سقف عند جدران المستودع) فلا يصل إلى حافة الشاشة
const cdt = caoQ.active ? Math.min(rawDt, .05) : dt;   // الكاميرا تتحرك حتى والمحاكاة مجمّدة
caoView += ((caoQ.active ? 1 : 0) - caoView) * Math.min(1, cdt * 5);
const pairX = caoQ.active ? (px.x + inspector.x) / 2 : px.x, pairZ = caoQ.active ? (px.z + inspector.z) / 2 : px.z;
const midX = px.x + (pairX - px.x) * caoView, midZ = px.z + (pairZ - px.z) * caoView;
const camX = Math.max(-camMaxX, Math.min(camMaxX, midX));
const wide = innerWidth >= innerHeight;
const sideShift = (wide ? 4.6 : 0) * caoView, upShift = (wide ? 0 : 8.5) * caoView;   // عرضي: الفقاعة يميناً · طولي: الفقاعة أسفل الشاشة
C.position.lerp(camTarget.set(camX + evacView + sideShift, 9.6 - 1.9 * caoView, midZ + upShift + 11.0 - 2.6 * caoView), 1 - Math.exp(-cdt*9));
camLook.lerp(camLookT.set(midX + evacView + sideShift, 1.15 + 0.5 * caoView, midZ + upShift - 2.0 + 1.4 * caoView), 1 - Math.exp(-cdt*10));
C.lookAt(camLook);
if(!FD.on && !EXIT_GATE.active && !STUDY.on) pl.visible = true;
}
// اهتزاز الكاميرا (Trauma): يُطبَّق بعد lookAt حتى يهتز المنظور فعلاً
const shake = (frzP.active || cardP.active || uldP.active || caoQ.active || STUDY.on) ? 0 : shakeTrauma * shakeTrauma;   // لا اهتزاز للكاميرا والمحاكاة متوقفة (الاهتزاز لا يتلاشى حين يتجمّد الزمن)
if(shake > 0.0005){
C.position.x += (Math.random() - 0.5) * shake * 0.7;
C.position.y += (Math.random() - 0.5) * shake * 0.5;
C.rotation.z += (Math.random() - 0.5) * shake * 0.03;
}
R.render(S, C);
if(!loadingDone){ loadingDone = true; loading.frameReady(); }
}
syncMenu();
/* زر غرفة الشخصيات في بطاقة البداية: يفتح صفحة المعاينة (من الغلاف المضيف أو مباشرة) */
const roomBtn = $('chars-room');
if(roomBtn) roomBtn.onclick = e => { e.stopPropagation(); try { if(parent !== window){ parent.location.href = 'characters.html'; return; } } catch(err){} location.href = 'characters.html'; };
const shellBtn = $('shell'); if(shellBtn) shellBtn.onclick = e => { e.stopPropagation(); exitToShell(); };
let loadingDone = false;
loading.phase(88, I18N.t('تسخين الشيدرات والمؤثرات...'));
/* تسخين مسبق للشيدرات لمنع تقطيعة أول إطار */
try{ R.compile(S, C); }catch(e){}
loading.phase(96, I18N.t('اكتمل التجهيز — لحظة واحدة...'));
requestAnimationFrame(loop);

// ===== لون السترة واختيار الشخصية: يبنيهما progress-game.js بحسب رتبة الموظف (Prog.buildPickers) =====

// ===== معاينة حيّة للشخصية المختارة في شاشة البداية (عرض ثانٍ لنفس المشهد بكاميرا قريبة) =====
(() => {
const cv = document.getElementById('pick-cv'), ov = document.getElementById('ov');
if(!cv || !ov) return;
let PR;
try { PR = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch(e){ cv.style.display = 'none'; return; }
PR.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); PR.setSize(cv.width, cv.height, false);
PR.outputEncoding = R.outputEncoding; PR.toneMapping = R.toneMapping; PR.toneMappingExposure = R.toneMappingExposure;
const cam = new THREE.PerspectiveCamera(26, cv.width / cv.height, 0.1, 140);
let t0 = 0;
function pv(now){
  requestAnimationFrame(pv);
  if(ov.style.display === 'none' || ov.classList.contains('hidden') || document.hidden || !cv.offsetParent) return;
  if(now - t0 < 33) return; t0 = now;
  const a = Math.sin(now / 1800) * 0.35, ry = (activeCharRig() && activeCharRig().root.rotation.y) || 0;
  const fx = Math.sin(ry + a), fz = Math.cos(ry + a);
  cam.position.set(px.x + fx * 10.5, 2.6, px.z + fz * 10.5);
  cam.lookAt(px.x, 1.95, px.z);
  const bg = S.background; S.background = null;
  PR.render(S, cam);
  S.background = bg;
}
requestAnimationFrame(pv);
})();

// ===== ذرات غبار خفيفة في شاشة البداية (بدون مكتبات خارجية) =====
(() => {
const cv = document.getElementById('dust'), ov = document.getElementById('ov');
if (!cv || !ov) return;
const g = cv.getContext('2d'); if (!g) return;
const COUNT = 40;
let w = 1, h = 1, dpr = 1, parts = [], running = false, raf = 0, prev = 0;

function reset(p, anywhere) {
  p.x = Math.random() * w;
  p.y = anywhere ? Math.random() * h : h + 10 + Math.random() * 40;
  p.r = 0.7 + Math.random() * 1.8;
  p.vx = (Math.random() - 0.5) * 7;
  p.vy = -(5 + Math.random() * 13);
  p.a = 0.07 + Math.random() * 0.2;
  p.ph = Math.random() * Math.PI * 2;
  p.warm = Math.random() < 0.55;
  return p;
}

function size() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  w = Math.max(1, r.width); h = Math.max(1, r.height);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frame(t) {
  if (!running) return;
  raf = requestAnimationFrame(frame);
  const dt = prev ? Math.min(0.05, (t - prev) / 1000) : 0.016;
  prev = t;
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    p.x += (p.vx + Math.sin(t * 0.0006 + p.ph) * 6) * dt;
    p.y += p.vy * dt;
    if (p.y < -10 || p.x < -14 || p.x > w + 14) reset(p, false);
    const tw = 0.55 + 0.45 * Math.sin(t * 0.0011 + p.ph);
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, 6.2832);
    g.fillStyle = p.warm
      ? 'rgba(255,203,112,' + (p.a * tw).toFixed(3) + ')'
      : 'rgba(186,222,255,' + (p.a * tw * 0.9).toFixed(3) + ')';
    g.fill();
  }
}

function start() {
  if (running || !parts.length) return;
  size(); running = true; prev = 0;
  raf = requestAnimationFrame(frame);
}
function stop() {
  running = false; cancelAnimationFrame(raf);
  g.clearRect(0, 0, w, h);
}
function sync() {
  /* بعد end() يُستبدل محتوى #ov فتصبح اللوحة منفصلة عن المستند: لا نرسم في لوحة مهجورة */
  if (!cv.isConnected) { stop(); return; }
  const shown = getComputedStyle(ov).display !== 'none';
  if (shown) start(); else stop();
}

size();
for (let i = 0; i < COUNT; i++) parts.push(reset({}, true));
window.addEventListener('resize', () => { size(); parts.forEach(p => { if (p.x > w || p.y > h) reset(p, true); }); }, { passive: true });
if (window.ResizeObserver) new ResizeObserver(() => { if (running) size(); }).observe(ov);
sync();
new MutationObserver(sync).observe(ov, { attributes: true, attributeFilter: ['style', 'class'] });
})();
