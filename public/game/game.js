const gameRules = WarehouseRules;
/* ===== شاشة التحميل: تقدّم حقيقي مبني على مراحل البناء الفعلية ===== */
const loading = (() => {
const screen = document.getElementById('loading-screen');
const fill = document.getElementById('loading-bar-fill');
const pct = document.getElementById('loading-percent');
const tip = document.getElementById('loading-tip');
const TIPS = [
'تلميح: حافظ على فصل المواد الخطرة لتجنب الغرامات!',
'تلميح: المسافة أو E أو F للالتقاط والتفاعل.',
'تلميح: Shift للجري، و Q أو X لإسقاط الطرد فوراً.',
'تلميح: الطرود المبرّدة لها مؤقت — أسرع قبل أن تفسد!'
];
let value = 0, done = false, tipIdx = 0, tipTimer = 0, safety = 0;
function paint(v){
value = Math.max(value, Math.min(100, Math.round(v)));
if(fill) fill.style.width = value + '%';
if(pct) pct.textContent = value + '%';
}
/* إخفاء الشاشة بعد أول إطار مرسوم فعلياً (لا شاشة بيضاء ولا تقطيع أول) */
function finish(){
if(done) return;
done = true;
clearTimeout(safety); clearInterval(tipTimer);
paint(100);
setTimeout(() => { if(screen) screen.classList.add('hidden'); }, 400);
}
function phase(amount, label){
if(done) return;
if(label && tip) tip.textContent = label;
paint(amount);
}
paint(8);
if(tip) tipTimer = setInterval(() => { tip.textContent = I18N.t(TIPS[(++tipIdx) % TIPS.length]); }, 2600);
/* صمام أمان: لا نحجب اللعب أكثر من 7 ثوانٍ مهما حدث */
safety = setTimeout(finish, 7000);
return { phase, finish, get value(){ return value; } };
})();
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx = null, soundEnabled = true, ambEnabled = true, ambNode = null;
function initAudio(){
if(!actx && AudioCtx) actx = new AudioCtx();
if(actx && actx.state === 'suspended') actx.resume();
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
master.gain.setTargetAtTime(ambEnabled ? .22 : 0, actx.currentTime, .4);
scheduleClank();
}
function scheduleClank(){
setTimeout(() => {
if(actx && ambEnabled){
const at = actx.currentTime;
const osc = actx.createOscillator(), g = actx.createGain();
osc.type = 'triangle'; osc.frequency.setValueAtTime(210 + Math.random() * 260, at);
osc.frequency.exponentialRampToValueAtTime(90, at + .22);
g.gain.setValueAtTime(0, at);
g.gain.linearRampToValueAtTime(.016, at + .01);
g.gain.exponentialRampToValueAtTime(.0001, at + .35);
osc.connect(g); g.connect(actx.destination); osc.start(at); osc.stop(at + .4);
osc.onended = () => { osc.disconnect(); g.disconnect(); };
}
scheduleClank();
}, 6000 + Math.random() * 9000);
}
function setAmb(v){
ambEnabled = v;
try { localStorage.setItem('acg_amb', ambEnabled ? '1' : '0'); } catch(e){}
if(actx && ambNode) ambNode.master.gain.setTargetAtTime(ambEnabled ? .22 : 0, actx.currentTime, .3);
syncAudioUI();
}
// ===== الرسائل التعليمة: تظهر مرة واحدة فقط، ويمكن إظهارها/إخفاؤها =====
let tipsEnabled = true;
try { tipsEnabled = localStorage.getItem('acg_tips') !== '0'; } catch(e){}
function setSnd(v){
soundEnabled = v;
try { localStorage.setItem('acg_snd', v ? '1' : '0'); } catch(e){}
syncAudioUI();
}
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
if(!soundEnabled || !actx || !retroCues[type]) return;
let at = actx.currentTime;
for(const [frequency,duration] of retroCues[type]){
const osc = actx.createOscillator(), gain = actx.createGain();
osc.type = type === 'bump' || type === 'place' ? 'triangle' : 'square';
osc.frequency.setValueAtTime(frequency * pitch, at);
osc.connect(gain); gain.connect(actx.destination);
gain.gain.setValueAtTime(0, at);
gain.gain.linearRampToValueAtTime(type === 'warn' ? .035 : .065, at + .003);
gain.gain.setValueAtTime(type === 'warn' ? .035 : .065, at + duration * .65);
gain.gain.linearRampToValueAtTime(0, at + duration);
osc.start(at); osc.stop(at + duration + .005);
osc.onended = () => { osc.disconnect(); gain.disconnect(); };
at += duration;
}
}
document.getElementById('snd').onclick = () => { initAudio(); setSnd(!soundEnabled); };
document.getElementById('amb').onclick = () => { initAudio(); setAmb(!ambEnabled); };
const tipsBtn = document.getElementById('tips'); if(tipsBtn) tipsBtn.onclick = () => { setTips(!tipsEnabled); };
function syncAudioUI(){
const s = document.getElementById('snd'), a = document.getElementById('amb');
if(s) s.classList.toggle('off', !soundEnabled);
if(a) a.classList.toggle('off', !ambEnabled);
document.querySelectorAll('[data-audio="snd"]').forEach(b => b.classList.toggle('off', !soundEnabled));
document.querySelectorAll('[data-audio="amb"]').forEach(b => b.classList.toggle('off', !ambEnabled));
document.querySelectorAll('[data-tips-toggle]').forEach(b => b.classList.toggle('off', !tipsEnabled));
const t = document.getElementById('tips'); if(t) t.classList.toggle('off', !tipsEnabled);
}
document.querySelectorAll('[data-audio="snd"]').forEach(b => b.onclick = () => { initAudio(); setSnd(!soundEnabled); });
document.querySelectorAll('[data-audio="amb"]').forEach(b => b.onclick = () => { initAudio(); setAmb(!ambEnabled); });
document.querySelectorAll('[data-tips-toggle]').forEach(b => b.onclick = () => setTips(!tipsEnabled));
(() => {
try {
const s = localStorage.getItem('acg_snd'), a = localStorage.getItem('acg_amb');
if(s === '0') soundEnabled = false;
if(a === '0') ambEnabled = false;
} catch(e){}
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
const HCOL = {
'1.3':0xff8a1f, '1.4':0xff8a1f,
'2.1':0xe53935, '2.2':0x2e7d32, '2.3':0xffffff,
'3':0xe53935,
'4.1':0xf44336, '4.2':0xffffff, '4.3':0x1976d2,
'5.1':0xfbc02d, '5.2':0xfbc02d,
'6.1':0xffffff, '6.2':0xffffff,
'7':0xfff176,
'8':0xffffff,
'9':0xffffff
};
const I = [
['cold','💉','لقاحات مبردة','COL','REF'],['cold','🐟','أسماك طازجة','PES','COL'],['cold','💊','أنسولين وأدوية','MED','COL'],
['perish','🍓','فراولة طازجة','PER','EAT'],['perish','🌹','زهور مقطوفة','PEF','EAT'],['perish','🍞','مخبوزات طازجة','PEM','EAT'],
['gen','👕','ملابس قطنية','GEN','GEN'],['gen','📚','كتب ومطبوعات','GEN','GEN'],['gen','🧸','ألعاب أطفال','GEN','GEN']
];
const HZ = [
['h1','🧨','ذخائر خفيفة','RXS','1.4S'],
['h1','🎆','ألعاب نارية','RCX','1.3G'],
['h2','⛽','غاز البترول المسال','RFG','2.1'],
['h2','🧯','غاز الهيليوم المضغوط','RNG','2.2'],
['h2','☣️','غاز الكلور السام','RPG','2.3'],
['h3','🛢️','وقود طائرات كيروسين','RFL','3'],
['h3','🎨','دهانات ومذيبات نفطية','RFL','3'],
['h4','🔥','أعواد فسفور وكبريت','RFS','4.1'],
['h4','✨','فحم نباتي منشط','RSC','4.2'],
['h4','⚡','كاربيد الكالسيوم','RWR','4.3'],
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
addEventListener('resize', rsSoon, { passive:true });
addEventListener('orientationchange', rsSoon, { passive:true });
if(window.visualViewport) visualViewport.addEventListener('resize', rsSoon, { passive:true });
if(window.screen && screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', rsSoon);
rs();
// ===== الإضاءة: ضوء سماوي بارد من النوافذ العلوية + مصابيح صناعية دافئة + إضاءة مركّزة على مناطق الفرز
const hemiLight = new THREE.HemisphereLight(0xcfe2ff, 0x3a3226, 0.55);
S.add(hemiLight);
const amb = new THREE.AmbientLight(0x404a58, 0.25); S.add(amb);
const sun = new THREE.DirectionalLight(0xdfeaff, 0.95);
sun.position.set(-14, 34, 18);
sun.castShadow = true;
const shadowRes = (stageEl.clientWidth || innerWidth) > 1400 ? 3072 : 2048;
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
const EXIT_GATE = { x:-34.1, z:-6, targetX:-32.95, targetZ:-6, active:false, phase:'idle', t:0, open:0, warped:false, trail:[] };
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
gateMarker.scale.set(7.6, 1.9, 1); gateMarker.position.set(0, 8.15, 0); gateGroup.add(gateMarker);
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
[-28, -14, 2, 16].forEach(x => {
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
BOLLARDS.push({x:-22.8, z:9.95, r:0.22});
const fk = new THREE.Group(); fk.position.set(-30.8, 0, 9.2); fk.rotation.y = Math.PI/2; S.add(fk);
B(1.5, 0.9, 2.2, 0xf2a900, 0, 0.75, 0, fk, 0.45, 0.3);
B(1.3, 0.5, 0.9, 0x222, 0, 1.4, -0.6, fk, 0.7, 0.2);
[-0.6,0.6].forEach(s => B(0.08, 2.2, 0.08, 0x333, s, 1.8, 0.2, fk, 0.5, 0.6));
B(1.3, 0.08, 0.08, 0x333, 0, 2.85, 0.2, fk, 0.5, 0.6); B(1.3, 0.08, 0.08, 0x333, 0, 2.85, -0.9, fk, 0.5, 0.6);
[-0.6,0.6].forEach(s => B(0.08, 2.2, 0.08, 0x333, s, 1.8, -0.9, fk, 0.5, 0.6));
B(0.12, 2.6, 0.2, 0x2a2a2a, 0, 1.3, 1.2, fk, 0.5, 0.6);
[-0.45,0.45].forEach(s => B(0.15, 0.06, 1.3, 0x555, s, 0.15, 1.8, fk, 0.4, 0.8));
[[-0.78,0.7],[0.78,0.7],[-0.78,-0.7],[0.78,-0.7]].forEach(([x,z]) => { const w = CY(0.32,0.32,0.3,0x161616,x,0.32,z,fk,0.9,0.1); w.rotation.z = Math.PI/2; });
// Moving forklift reuses the parked vehicle, with a visible seated driver.
const recklessTruck = fk.clone(); S.add(recklessTruck); recklessTruck.visible = false;
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
const FD = { on:false, left:60, near:false, home:{x:-30.8, z:9.2} };
// لافتات حائطية
function wallSign(txt, sub, bg, x, y, z, ry=0, w=4){
const t = canvasTex(512, 256, (g)=>{ g.fillStyle=bg; g.fillRect(0,0,512,256); g.strokeStyle='#fff'; g.lineWidth=10; g.strokeRect(12,12,488,232); g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle'; g.font='bold 74px sans-serif'; g.fillText(txt,256,100); g.font='bold 38px sans-serif'; g.fillText(sub,256,185); });
const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w/2), new THREE.MeshStandardMaterial({map:t, roughness:0.6})); m.position.set(x,y,z); m.rotation.y = ry; S.add(m);
}
wallSign(I18N.t('🚭 ممنوع التدخين'),'NO SMOKING • DGR AREA','#b3261e', 8.5, 8.6, -17.15);
wallSign(I18N.t('⚠️ منطقة مواد خطرة'),'IATA DGR CLASS 1–9','#c77800', 26, 8.6, -17.15);
wallSign(I18N.t('✈️ مخرج الطيران'),'AIRSIDE GATE B','#1b6b3a', -34.65, 7.5, -6, Math.PI/2, 3.4);
wallSign(I18N.t('🚚 رصيف التحميل'),'LOADING DOCK 4','#204f8c', 34.65, 7.5, -6, -Math.PI/2, 3.4);
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
beltBtnGroup.position.set(-22.8, 0, 9.95);
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
ctx.direction = I18N.lang === 'en' ? 'ltr' : 'rtl';
// شريط العنوان
ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(24,20,W-48,92,20); ctx.fill();
ctx.fillStyle = '#fff'; fit(ctx, z.e + '  ' + z.n, W-90, 48); ctx.fillText(z.e + '  ' + z.n, W/2, 66);
// قائمة المحتويات: بطاقة لكل طرد مع شريحة فئة وشريحة كود
const listTop = 126, listBottom = H - 76;
ctx.fillStyle = 'rgba(0,0,0,.38)'; rr(24, listTop, W-48, listBottom-listTop, 18); ctx.fill();
if(!z.items.length){ ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.font = 'bold 34px sans-serif'; ctx.fillText(I18N.t('— فارغة —'), W/2, (listTop+listBottom)/2); }
const rows = Math.max(1, Math.min(6, z.cap));
const rowH = (listBottom - listTop - 14) / rows;
const divW = 104, impW = 92;
z.items.forEach((it, i) => {
if(!it) return;
const y = listTop + 7 + i*rowH, mid = y + rowH/2, cardH = rowH - 8;
ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.20)';
rr(30, y+4, W-60, cardH, 10); ctx.fill();
ctx.fillStyle = '#ffd54a'; rr(W-30-divW-6, mid-cardH/2, divW, cardH, 8); ctx.fill();
ctx.fillStyle = '#1a1200'; ctx.font = '900 28px monospace'; ctx.fillText(it.data.div, W-30-divW/2-6, mid+1);
ctx.fillStyle = 'rgba(255,255,255,.16)'; rr(36, mid-cardH/2, impW, cardH, 8); ctx.fill();
ctx.fillStyle = '#eaf2fb'; ctx.font = '800 24px monospace'; ctx.fillText(it.data.imp, 36+impW/2, mid+1);
ctx.fillStyle = '#fff'; fit(ctx, it.data.name, W-60-divW-impW-34, 28); ctx.fillText(it.data.name, W/2, mid+1);
});
ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.font = '800 27px sans-serif';
ctx.fillText(I18N.T('المحتوى ','Contents ') + z.items.length + I18N.T(' من ',' of ') + z.cap, W/2, H-38);
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
spr.scale.set(z.w*0.95, z.w*0.95*(cv.height/cv.width), 1);
return spr;
}
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
(function pulse(ms){L.intensity=0.8+0.5*Math.sin(ms/260);requestAnimationFrame(pulse);})(0);
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
const sh = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), new THREE.MeshBasicMaterial({color:0x000, transparent:true, opacity:0.28, depthWrite:false}));
sh.rotation.x = -Math.PI/2; sh.position.y = 0.02; pl.add(sh);
const G = (par,x,y,z) => { const g = new THREE.Group(); g.position.set(x,y,z); par.add(g); return g; };
const C_SKIN = 0xe2b492, C_VEST = 0xd4ff00, C_VEST_SEC = 0xff6d00, C_PANTS = 0x243240, C_BOOTS = 0x1b1614, C_HELMET = 0xffb700, C_GLOVE = 0x37474f;
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
band(0.285, 0.03, C_VEST_SEC, 0.055, tor);
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
const helmetCap = M(new THREE.SphereGeometry(0.265, 26, 16, 0, Math.PI*2, 0, Math.PI*0.56), C_HELMET, 0.45, 0.1);
helmetCap.position.y = 0.05; helmet.add(helmetCap);
const hRim = M(new THREE.TorusGeometry(0.255, 0.028, 12, 40), C_HELMET, 0.45, 0.1);
hRim.rotation.x = Math.PI/2; hRim.position.y = 0.05; helmet.add(hRim);
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
cap(0.09, 0.32, C_VEST, 0, -0.15, 0, uArm);
const elbow = G(uArm, 0, -0.32, 0);
elbow.add(M(new THREE.SphereGeometry(0.08, 14, 12), C_SKIN, 0.62, 0.02));
cap(0.075, 0.3, C_SKIN, 0, -0.15, 0, elbow);
const hand = G(elbow, 0, -0.32, 0);
const glove = M(new THREE.SphereGeometry(0.088, 16, 12), C_GLOVE, 0.75, 0.05);
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
B(0.5, 0.16, 0.46, C_VEST_SEC, 0, 1.46, -0.2, forkDriver, 0.55, 0.15);
const forkHead = M(new THREE.SphereGeometry(0.25, 16, 12), C_SKIN);
forkHead.position.set(0, 2.14, -0.18); forkHead.scale.set(0.94, 1.06, 0.96); forkDriver.add(forkHead);
CY(0.28, 0.28, 0.16, C_HELMET, 0, 2.37, -0.18, forkDriver);
const forkWheel = M(new THREE.TorusGeometry(0.24, 0.035, 8, 20), 0x181c20);
forkWheel.position.set(0, 1.36, 0.46); forkWheel.rotation.x = -1.15; forkDriver.add(forkWheel);
B(0.08, 0.5, 0.08, 0x2a2a2a, 0, 1.12, 0.58, forkDriver, 0.5, 0.4);
const PLAYER_RADIUS = 0.45;
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
let bumpCD = 0, lastBump = 0;
// دفع دائرة اللاعب خارج مستطيل مع انزلاق ناعم على الحواف بدل القفز للمحور الأقرب
// دفع اللاعب خارج مستطيل مع الانزلاق على السطح: نُصحّح المحور الأقل اختراقاً فقط
// فيبقى المحور الآخر حراً تماماً (Wall Sliding) بدل الارتجاج عند الزوايا
function pushOutAABB(p, minX, maxX, minZ, maxZ, r){
if(p.x + r <= minX || p.x - r >= maxX || p.z + r <= minZ || p.z - r >= maxZ) return false;
const penL = (p.x + r) - minX, penR = maxX - (p.x - r);
const penT = (p.z + r) - minZ, penB = maxZ - (p.z - r);
const px = Math.min(penL, penR), pz = Math.min(penT, penB);
if(px <= pz) p.x += penL < penR ? -px : px;
else p.z += penT < penB ? -pz : pz;
return true;
}
function resolvePlayerCollisions(targetX, targetZ, mvx=0, mvz=0, dt=0.016) {
const p = { x: Math.max(-33.6, Math.min(33.6, targetX)), z: Math.max(-11.5, Math.min(10.1, targetZ)) };
let hit = false;
for(let iter=0; iter<3; iter++){
for (const o of STATIC_OBSTACLES) if(pushOutAABB(p, o.minX, o.maxX, o.minZ, o.maxZ, PLAYER_RADIUS)) hit = true;
for (const b of BOLLARDS){
const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz), m = PLAYER_RADIUS + b.r;
if(d < m && d > 1e-6){ p.x += dx/d*(m-d); p.z += dz/d*(m-d); hit = true; }
}
// الرافعة المتوقفة جسم صلب ما دام اللاعب لا يقودها
if(!FD.on && pushOutAABB(p, fk.position.x-1.15, fk.position.x+1.15, fk.position.z-0.85, fk.position.z+0.85, PLAYER_RADIUS)) hit = true;
for (const it of items) {
if (it.st === 'held' || it.st === 'lifting' || it.st === 'belt') continue;
const h = 0.68, bx = it.m.position.x, bz = it.m.position.z;
if(it.st === 'floor'){
// الطرود على الأرض تُدفع بلطف عند ملامستها
const cx = Math.max(bx-h, Math.min(p.x, bx+h)), cz = Math.max(bz-h, Math.min(p.z, bz+h));
const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
if(d < PLAYER_RADIUS){
const pen = PLAYER_RADIUS - d, nx = d > 1e-6 ? dx/d : -mvx, nz = d > 1e-6 ? dz/d : -mvz;
it.m.position.x -= nx * pen * 0.7; it.m.position.z -= nz * pen * 0.7;
it.m.position.x = Math.max(-33, Math.min(33, it.m.position.x));
it.m.position.z = Math.max(-11.9, Math.min(9.6, it.m.position.z));
it.m.rotation.y += (nx*mvz - nz*mvx) * pen * 0.6;
it.wob = 1;
p.x += nx * pen * 0.3; p.z += nz * pen * 0.3;
hit = true;
}
} else if(pushOutAABB(p, bx-h, bx+h, bz-h, bz+h, PLAYER_RADIUS)) hit = true;
}
}
if(held && !liftAnim.active){
const hh = boxHalf({m:{rotation:{y:curRotY}}}), fx = Math.sin(curRotY)*0.78, fz = Math.cos(curRotY)*0.78;
for(let k=0;k<2;k++){
const bp = {x:p.x+fx, z:p.z+fz};
for(const o of STATIC_OBSTACLES){
const v = overlapVec(bp, hh, (o.minX+o.maxX)/2, (o.minZ+o.maxZ)/2, (o.maxX-o.minX)/2, (o.maxZ-o.minZ)/2);
if(v){ const m = Math.hypot(v[0], v[1]), f = m < 0.3 ? 1 : 0.3/m; p.x += v[0]*f; p.z += v[1]*f; hit = true; break; }
}
}
}
if(hit && (Math.abs(mvx)+Math.abs(mvz)) > 0.3 && performance.now() - lastBump > 380){ lastBump = performance.now(); snd('bump'); addShake(.45); }
return p;
}
let bob=0, walk=0, turnLean=0, curRotY=0, inX=0, inZ=0, animSpd=0;
let liftAnim = {active:false, t:0, dur:0.32, fromPos:new THREE.Vector3(), toHold:null};
const cargoSmoothPos = new THREE.Vector3();
let cargoInertiaY = 0;
const pose = {
lHip:0, rHip:0, lKnee:0, rKnee:0,
lShldX:0, rShldX:0, lShldZ:0, rShldZ:0,
lElb:0, rElb:0,
torsoTwist:0, torsoLean:0, torsoRoll:0, pelvisDrop:0
};
function anim(dt, spd, vx, vz){
const isMoving = spd > 0.08;
const isHeld = !!held;
const sprinting = !isHeld && !!(key.ShiftLeft || key.ShiftRight);
if(isMoving){
walk += dt * (isHeld ? 9.2 : 13.5) * (sprinting ? 1.35 : 1) * gameRules.movementMultiplier(fearT);
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
let items=[], run=false, score=0, combo=1, time=100, spawnT=0, held=null, lvl=1, near=null, stage=1;
let streak=0, streakT=0, maxStreak=0, rushT=30, rushN=0, rushDelay=0;
/* ===== إثارة: اندفاع + اهتزاز كاميرا + وضع الحمى ===== */
let dashT = 0, dashCD = 0, feverT = 0, shakeTrauma = 0;
const DASH_TIME = .8, DASH_CD = 3, DASH_BOOST = 1.6, FEVER_TIME = 8, FEVER_BOOST = 1.15;
function feverOn(){ return feverT > 0; }
function addShake(a){ shakeTrauma = Math.min(1, shakeTrauma + a); }
function setDashButton(){
const b = $('dash-btn'); if(!b) return;
b.classList.toggle('cool', dashCD > 0);
b.style.setProperty('--cd', (dashCD > 0 ? (dashCD / DASH_CD) * 100 : 0) + '%');
}
function startFever(){
if(feverT > 0) return;
feverT = FEVER_TIME;
$('stage').classList.add('fever');
snd('fever');
toast('🔥 وضع الحمى! النقاط مضاعفة ×2', '#ffd54a');
}
function doDash(){
if(dashCD > 0 || dashT > 0 || !run || introHold || fire.keypad || FD.on) return;
dashT = DASH_TIME; dashCD = DASH_CD;
addShake(.22); snd('dash');
$('dash-fx').classList.add('on');
setDashButton();
}
const fire = {active:false, done:false, phase:'idle', t:0, codeT:0, keypad:false, posAwarded:false, siren:null, buzz:null};
const STREAK_MAX = 8;
const streakWindow = () => stage === 1 ? 7 : 5.5;
const bestScore = () => { try { return +(localStorage.getItem('acg_best') || 0) || 0; } catch(e){ return 0; } };
const saveBest = v => { try { localStorage.setItem('acg_best', v); } catch(e){} };
const getTop = () => { try { return JSON.parse(localStorage.getItem('acg_top') || '[]'); } catch(e){ return []; } };
const pushTop = v => { const t = getTop(); t.push({s:v, d:new Date().toLocaleDateString(I18N.lang === 'en' ? 'en' : 'ar')}); t.sort((a,b)=>b.s-a.s); const r = t.slice(0,5); try { localStorage.setItem('acg_top', JSON.stringify(r)); } catch(e){} return r; };
const topHTML = t => t.length ? t.slice(0,4).map((e,i) => `<span class="score-chip"><i class="rank-dot r${i+1}"></i> ${e.s} ${I18N.t('نقطة')}</span>`).join('') : `<span class="lb-empty">${I18N.t('العب لتسجّل أول نتيجة')}</span>`;
function syncMenu(){ const tp = $('top5'); const list = getTop(); if(tp){ tp.innerHTML = topHTML(list); tp.style.display = ''; } const el = $('best'); if(!el) return; const b = bestScore(); el.textContent = b ? I18N.T('أفضل نتيجة: ','Best score: ') + b : I18N.t('كن أول الأبطال'); }
const STAGE_AT=[0,0,100,200,320], STAGE_BELT=[0,1.5,1.9,2.4,2.7];
let demo={insp:false,truck:false,inspDone:false,truckDone:false,truckIn:0}, introT=null, introHold=false;
function showIntro(html,ms=7000,hold=false){
const e=document.getElementById('intro');
e.innerHTML=html;e.classList.add('on');e.classList.toggle('wait',hold);
placeToastBelowIntro();
clearTimeout(introT);
if(hold){ introHold=true; e.onclick=resumeFromIntro; run=false; clearMovement(); introT=setTimeout(resumeFromIntro,20000); }
else { introHold=false; e.onclick=null; introT=setTimeout(()=>{e.classList.remove('on');placeToastBelowIntro();},ms); }
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
}
function startInspDemo(){
const I_=inspector;demo.insp=true;I_.demo=true;I_.dir=Math.random()<.5?1:-1;I_.x=-36*I_.dir;I_.z=4;I_.active=true;I_.g.visible=true;I_.t=0;
I_.g.rotation.y=I_.dir>0?Math.PI/2:-Math.PI/2;
document.getElementById('inspector-badge').classList.add('on');snd('whistle');
showIntro(I18N.T('<b class="t">🦺 المفتش</b>يغرّم كل طرد متروك خارج مناطق الفرز.<small>جولة تعريفية — بلا غرامات</small><span class="hint">⏸ اللعبة متوقفة — اضغط في أي مكان للمتابعة</span>', '<b class="t">🦺 Inspector</b>Fines every parcel left outside the sorting zones.<small>Intro round — no fines</small><span class="hint">⏸ Game paused — press anywhere to resume</span>'),0,true);
}
function startTruckDemo(){
demo.truck=true;truckState=gameRules.reset();truckState.elapsed=gameRules.startAt;snd('horn');
showIntro(I18N.T('<b class="t">🚜 الرافعة الشوكية</b>تُسقط أجساماً غريبة (FOD)؛ اجمعها وضعها في الصندوق الأحمر.<small>جولة تعريفية — لن تصطدم بك</small><span class="hint">⏸ اللعبة متوقفة — اضغط في أي مكان للمتابعة</span>', '<b class="t">🚜 Forklift</b>Drops foreign objects (FOD); collect them and put them in the red bin.<small>Intro round — it won\'t hit you</small><span class="hint">⏸ Game paused — press anywhere to resume</span>'),0,true);
}
const beltSpeed=()=>(STAGE_BELT[stage]+(lvl-1)*(stage===1?0.06:0.12)) * (feverT > 0 ? FEVER_BOOST : 1);
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
function tex(it){
const k = it[2] + '_' + it[3];
if(tc[k]) return tc[k];
if(it === MYS) return tc[k] = mysTex();
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
ctx.textAlign='center'; ctx.textBaseline='middle';
if(it[0][0] === 'h'){
const div=it[4];
const colHex=HCOL[div] || HCOL[div.slice(0,3)] || 0xffffff;
ctx.fillStyle='#24292d'; ctx.fillRect(42,38,428,66);
ctx.fillStyle='#fff'; ctx.font='bold 27px sans-serif'; ctx.fillText('DANGEROUS GOODS  •  IATA',256,72);
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
const BELT_BTN_XZ = { x: -22.8, z: 9.95 };
let beltSlowT = 0, beltSlowUsed = false;
function useBeltSlow(){
  if(beltSlowUsed || !run || fire.active) return;
  beltSlowUsed = true; beltSlowT = 30;
  snd('ship'); toast('🐢 الحزام يبطؤ ٣٠ ثانية', '#80d8ff');
  hud();
}
const beltRay = new THREE.Raycaster(), beltNdc = new THREE.Vector2();
R.domElement.addEventListener('pointerdown', e => {
  if(!run || fire.active || introHold) return;
  const r = R.domElement.getBoundingClientRect();
  beltNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  beltRay.setFromCamera(beltNdc, C);
  if(beltRay.intersectObjects(beltBtnGroup.children, false).length){ useBeltSlow(); return; }
  /* نقرة الفأرة الأساسية على الملعب = التقاط/تفاعل (اللمس يبقى على أزراره) */
  if(e.pointerType === 'mouse' && e.button === 0) act();
});
function mystery(it){
rm(it); totalProcessed = Math.max(0, totalProcessed);
const r = Math.random();
if(r < 0.25){ time += 12; snd('ship'); spawnFloatTag(I18N.T('+12 ث ⏱','+12s ⏱'),'#64ffda'); toast('🎁 مفاجأة: +12 ثانية','#64ffda'); }
else if(r < 0.5){ score += 60; snd('ship'); toast('🎁 مفاجأة: +60 نقطة','#ffd54a'); }
else if(r < 0.7){ combo = 8; snd('ship'); toast('🎁 مفاجأة: كومبو ×8 🔥','#ff9800'); }
else if(r < 0.85){ slowT = 8; snd('ship'); toast('🎁 مفاجأة: الحزام يبطؤ ٨ ثوانٍ 🐢','#80d8ff'); }
else { time = Math.max(0, time - 6); snd('error'); spawnFloatTag(I18N.T('-6 ث','-6s'),'#ff5252'); toast('💥 مفاجأة سيئة: -6 ثوانٍ','#ff5252'); }
hud();
}
function spawn(){
const list = stage===4 ? HZ : ((stage>=2 && Math.random() < (stage===3?0.6:0.45)) ? HZ : I);
const raw = (stage>=2 && stage<4 && Math.random() < 0.13 && !items.some(i => i.data.isMys)) ? MYS : list[Math.random()*list.length | 0];
const itObj = { t:raw[0], emoji:raw[1], name:raw[2], imp:raw[3], div:raw[4], isHz:raw[0][0]==='h', isMys:raw===MYS };
const m = new THREE.Mesh(BOXG, new THREE.MeshStandardMaterial({map:tex(raw), roughness:0.5, metalness:0.05}));
m.castShadow = true; m.receiveShadow = true; m.position.set(-22.5, 0.74 + BH, 12);
m.add(new THREE.LineSegments(EDGEG, EDGEM));
const csh = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), SHM);
csh.rotation.x = -Math.PI/2; csh.position.y = -BH + 0.015; m.add(csh);
S.add(m);
const it = {m, data:itObj, st:'belt', csh};
makeCrit(it);
items.push(it);
}
/* ===== طرد حرج بمؤقت تفجير (15%) ===== */
/* المؤقت خاص بطرود سلسلة التبريد (❄️) فقط. نسبة الاختيار 45% من طرود التبريد
   ≈ 15% من إجمالي الطرود العادية (التبريد ثلث قائمة الشحن العادي) */
const CRIT_CHANCE = .45, CRIT_TIME = 18, CRIT_BONUS = 80, CRIT_PENALTY = 40;
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
const cv = document.createElement('canvas'); cv.width = 192; cv.height = 96;
const t = rawTex(cv);
return { cv, t, sec: -1 };
}
function drawCritTag(tag, sec){
const g = tag.cv.getContext('2d'), w = tag.cv.width, h = tag.cv.height;
g.clearRect(0, 0, w, h);
g.fillStyle = sec <= 5 ? 'rgba(120,8,8,.92)' : 'rgba(14,10,10,.88)';
g.fillRect(8, 10, w-16, h-20);
g.strokeStyle = sec <= 5 ? '#ff5252' : '#ffd54a'; g.lineWidth = 5; g.strokeRect(8, 10, w-16, h-20);
g.fillStyle = sec <= 5 ? '#fff' : '#ffd54a';
g.font = '900 52px ui-monospace,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
g.fillText(sec + 's', w/2, h/2 + 4);
tag.sec = sec; tag.t.needsUpdate = true;
}
function makeCrit(it){
// المؤقت للطرود التي تحتاج سلسلة تبريد فقط (منطقة ❄️ تبريد) — لا للطرود العامة أو القابلة للتلف
if(it.data.t !== 'cold' || it.data.isFod || it.data.isMys) return;
if(Math.random() >= CRIT_CHANCE || items.some(i => i.crit)) return;
const halo = new THREE.Sprite(new THREE.SpriteMaterial({map:critHaloTex, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
halo.position.y = .05; halo.scale.set(2.3, 2.3, 1); it.m.add(halo);
const tag = critTagCanvas();
const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tag.t, transparent:true, depthTest:false}));
sp.position.y = 1.35; sp.scale.set(1.15, .58, 1); sp.renderOrder = 6; it.m.add(sp);
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
addShake(.65); snd('error');
penaltyFx(lost, true);
spawnFloatTag('-' + CRIT_PENALTY, '#ff5252');
toast(I18N.T('☠️ انفجر طرد مبرّد قبل فرزه! -', '☠️ A chilled parcel spoiled before sorting! -') + CRIT_PENALTY + I18N.T(' نقطة',' pts'), '#ff5252');
clearCrit(it); rm(it); hud();
}
function dropFod(x,z){
const m = new THREE.Mesh(new THREE.BoxGeometry(.5,.3,.7), new THREE.MeshStandardMaterial({color:0x94aebc,metalness:.7,roughness:.35}));
m.position.set(x,1.2,z); m.castShadow = true; m.receiveShadow = true;
const nut = new THREE.Mesh(new THREE.TorusGeometry(.28,.09,6,6),m.material);
nut.rotation.x=Math.PI/2; nut.position.set(.15,.15,0); m.add(nut);
const marker = canvasTex(128,64,(g,w,h)=>{g.fillStyle='#ffd54a';g.fillRect(0,0,w,h);g.fillStyle='#17252b';g.font='900 40px monospace';g.textAlign='center';g.fillText('FOD',w/2,46);});
const label = new THREE.Sprite(new THREE.SpriteMaterial({map:marker,depthTest:false}));label.position.y=.6;label.scale.set(.95,.48,1);m.add(label);
const csh=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.2),SHM);csh.rotation.x=-Math.PI/2;csh.position.y=-.13;m.add(csh);
S.add(m);items.push({m,csh,data:{t:'fod',emoji:'🔩',name:I18N.t('جسم غريب'),imp:'FOD',div:'',isFod:true,isHz:false,isMys:false},st:'floor',fall:true,vy:0,ty:.2});
snd('place');tip('foddrop', '🔩 سقط جسم غريب FOD!', '#ffd54a');
}
function resetTruck(){ truckState=gameRules.reset();fearT=0;recklessTruck.visible=false; }
function updateTruck(dt){
fearT=Math.max(0,fearT-dt);
const steps=Math.max(1,Math.ceil(dt/.016)), step=dt/steps;
for(let i=0;i<steps;i++){
const before=gameRules.position(truckState), event=gameRules.advance(truckState,step,px.z), after=gameRules.position(truckState);
if(event.entered){snd('horn');addShake(.35);tip('forklift', '⚠️ رافعة متهورة تعبر المستودع!', '#ffd54a');}
if(event.drop) dropFod(after.x,after.z);
if(!demo.truck && truckState.active && !truckState.hit && gameRules.touches(before.x,before.z,after.x,after.z,px.x,px.z)){
truckState.hit=true;fearT=gameRules.fearDuration;snd('bump');tip('bump', '😨 اصطدام! حركة أبطأ مؤقتًا', '#ffd54a');
}
}
if(demo.truck && truckState.done){ demo.truck=false; demo.truckDone=true; hideIntro(); }
const pos=gameRules.position(truckState);
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
if(window.parent && window.parent !== window){ window.parent.location.href = 'index.html'; return; }
} catch(e){}
location.href = 'index.html';
}
let tt;
function toast(t, col){
const e = $('toast'); e.textContent = I18N.t(t); e.style.color = col; e.style.opacity = 1;
e.style.transform = 'translateX(-50%) scale(1.05)';
clearTimeout(tt);
tt = setTimeout(() => { e.style.opacity = 0; e.style.transform = 'translateX(-50%) scale(1)'; }, 1300);
}
function spawnFloatTag(txt, col){
const el = document.createElement('div');
el.className = 'float-tag'; el.textContent = I18N.t(txt); el.style.color = col;
el.style.left = '50%'; el.style.top = '44%';
$('floating-fx').appendChild(el);
setTimeout(() => el.remove(), 850);
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
$('sc').textContent = score;$('stg').textContent = stage<4 ? `${I18N.T('🎓 المرحلة','🎓 Stage')} ${stage} • ${Math.min(score,STAGE_AT[stage+1])}/${STAGE_AT[stage+1]}` : I18N.t('🏁 المرحلة ٤ • الأخيرة — مواد خطرة فقط');
$('cb').textContent = '×' + combo;
setDashButton();
$('cbbox').classList.toggle('hot', combo > 1);
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
if(FD.on){ dv.textContent = I18N.T('🚜 القيادة: ','🚜 Driving: ') + Math.ceil(FD.left) + I18N.T(' ث • اضغط هنا للنزول','s • tap to get off'); dv.style.display = 'block'; }
else dv.style.display = 'none';
dv.classList.toggle('drive', FD.on);
}
}
function rm(it){ clearCrit(it); S.remove(it.m); items = items.filter(i => i !== it); }
function ship(z){
z.full = true;
snd('ship');
setTimeout(() => {
if(!z.full) return;
z.items.forEach(x => rm(x));
z.items = []; z.full = false; if(z.hz) drawZoneSign(z);
score += 40;
time += 15;
spawnFloatTag(I18N.T('+15 ثوانٍ ⏱','+15s ⏱'), '#64ffda');
toast(I18N.T('🚚 شُحنت ','🚚 Shipped ') + z.n + I18N.T(' (+40 و +15 ث)',' (+40 and +15s)'), '#64ffda');
hud();
}, 900);
}
function resolvePlacement(z, it){
const d = it.data;
if(d.isFod){
const bonus=gameRules.reward(true,z.k);
if(bonus){score+=bonus;rm(it);snd('ok');spawnFloatTag('+'+bonus+' FOD','#69f0ae');toast(I18N.T('✔ جمع الجسم الغريب +','✔ FOD collected +')+bonus+I18N.T(' نقطة',' pts'),'#69f0ae');}
else {it.st='floor';it.fall=false;it.m.position.set(px.x, .2, Math.max(-4,px.z+1.5));snd('warn');tip('fodbox', '🔩 ضعه في صندوق FOD الأحمر','#ffd54a');}
hud();return;
}
if(z.k==='fod'){ it.st='floor';it.fall=false;it.m.position.set(z.x,.7,-4);snd('warn');tip('fodonly', 'هذا الصندوق للأجسام الغريبة FOD فقط','#ffd54a');hud();return; }
if(d.isMys){ mystery(it); return; }
totalProcessed++;
let ok = false;
let conflictReason = '';
if(z.hz){
if(!d.isHz){
conflictReason = I18N.t('هذه الحاوية مخصصة فقط للمواد الخطرة (DGR)!');
} else {
let hasConflict = false;
for(const placed of z.items){
if(gameRules.conflict(d, placed.data)){
hasConflict = true;
conflictReason = I18N.T('تعارض IATA: لا يُخلط [','IATA conflict: never stow [') + `${d.imp} . ${d.div}] ` + I18N.T('مع [','with [') + `${placed.data.imp} . ${placed.data.div}` + I18N.T('] في حاوية واحدة!','] in one container!');
break;
}
}
if(!hasConflict) ok = true;
}
} else {
ok = (z.k === d.t);
if(!ok && d.isHz){
conflictReason = I18N.T('ممنوع وضع مادة خطرة (','Never stow a dangerous good (') + `${d.imp} . ${d.div}) ` + I18N.t('في مناطق الشحن العادي! ضعها في إحدى حاويات المواد الخطرة.');
} else if(!ok){
conflictReason = 'منطقة فرز غير مطابقة لنوع الشحنة!';
}
}
if(ok){
sortedCount++;
const p = 10 * combo * (d.isHz ? 2 : 1) * (feverT > 0 ? 2 : 1);
score += p;
combo = Math.min(combo + 1, 8);
streak++; streakT = streakWindow(); maxStreak = Math.max(maxStreak, streak);
time += 3;
let critMsg = '';
if(it.crit){
score += CRIT_BONUS;
snd('fever');
spawnFloatTag('+' + CRIT_BONUS + ' 🎉', '#ffd54a');
critMsg = I18N.T(' • ❄️ طرد تبريد +',' • ❄️ chilled parcel +') + CRIT_BONUS;
addShake(.25);
clearCrit(it);
}
if(streak >= 5 && streak % 5 === 0) startFever();
snd('ok', 1 + Math.min(streak, STREAK_MAX) * .05);
spawnFloatTag(I18N.T('+3 ث ⏱','+3s ⏱'), '#69f0ae');
let chainMsg = '';
if(streak % 4 === 0){
const b = Math.min(30, streak * 2.5);
score += b; chainMsg = I18N.T(` • سلسلة +${b} 🔥`,` • chain +${b} 🔥`);
stageEl.classList.remove('flash'); void stageEl.offsetWidth; stageEl.classList.add('flash');
setTimeout(() => stageEl.classList.remove('flash'), 550);
snd('ship', 1 + Math.min(streak, 8) * .04);
}
toast(I18N.T(`✔ فرز متوافق +${p}`,`✔ Compatible sort +${p}`) + chainMsg + critMsg + (d.isHz ? ` [${d.imp} . ${d.div}]` : ''), '#69f0ae');
const i = z.hz ? z.items.length : z.n_++ % z.cap;
if(z.items[i]) rm(z.items[i]);
z.items[i] = it; it.st = 'placed'; if(z.hz) drawZoneSign(z);
const P_ = 1.37, rows_ = z.cap / z.cols;
it.m.position.set(z.x + (i%z.cols - (z.cols-1)/2)*P_, 0.74 + 0.5, -8.6 + (Math.floor(i/z.cols) - (rows_-1)/2)*P_);
it.m.rotation.set(0,0,0); it.fall = true; it.vy = 0; it.ty = 0.06 + BH;
if(z.hz && z.items.length >= z.cap) ship(z);
} else {
score = Math.max(0, score - 10);
combo = 1; streak = 0; streakT = 0;
const tp = stage===1 ? 2 : 5;
time = Math.max(0, time - tp);
snd('error');
spawnFloatTag(I18N.T('-'+tp+' ث','-'+tp+'s'), '#ff5252');
toast(`✖ ${conflictReason} (-${tp} ` + I18N.T('ث)', 's)'), '#ff5252');
rm(it);
}
hud();
}
function mountDrive(){
if(FD.on || FD.left <= 0 || held || liftAnim.active) return;
FD.on = true; FD.near = false;
fk.visible = true; rig.visible = false; forkDriver.visible = true;
px.set(fk.position.x, 0, fk.position.z);
snd('horn');
toast(I18N.T('🚜 قُد الرافعة الشوكية — المتبقي ','🚜 Driving the forklift — left: ') + Math.ceil(FD.left) + I18N.T(' ث','s'), '#ffd54a');
hud();
}
function stopDrive(msg){
if(!FD.on) return;
FD.on = false; rig.visible = true; forkDriver.visible = false;
const ox = Math.cos(fk.rotation.y) * 2.1, oz = -Math.sin(fk.rotation.y) * 2.1;
px.set(Math.max(-33, Math.min(33, fk.position.x + ox)), 0, Math.max(-11, Math.min(9.7, fk.position.z + oz)));
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
held = it; it.st = 'held';
it.fall = false; it.vy = 0;
cargoSmoothPos.copy(it.m.position);
snd('pick');
}
function forkUnload(){
const it = held; held = null;
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
if(!run || liftAnim.active) return;
if(FD.on){
if(held) forkUnload();
else { const it = forkCargo(); if(it) forkLoad(it); else stopDrive(); }
return;
}
if(!held && FD.near && FD.left > 0){ mountDrive(); return; }
// تشغيل زر إبطاء الحزام بالوقوف بجانبه والضغط على ✋
if(!held && !near && !beltSlowUsed && Math.hypot(px.x - BELT_BTN_XZ.x, px.z - BELT_BTN_XZ.z) < 2.4){ useBeltSlow(); return; }
if(!held){
if(!near) return;
const targetItem = near;
const lastSecond = targetItem.st === 'belt' && targetItem.m.position.x > 18.5;
liftAnim.active = true; liftAnim.t = 0;
liftAnim.fromPos.copy(targetItem.m.position);
liftAnim.toHold = targetItem;
targetItem.st = 'lifting';
snd('pick');
const d = targetItem.data;
if(d.isHz){
tip('dg-' + d.imp + d.div, I18N.T('⚠️ تم التقاط مادة خطرة: ','⚠️ Dangerous good picked up: ') + `${d.imp} . ${d.div}`, '#ffb020');
} else {
toast(I18N.T('تم الالتقاط: ','Picked up: ') + d.name, '#fff');
}
if(lastSecond){
score += 25;
snd('ok', 1.4);
spawnFloatTag('⚡ إنقاذ +25', '#ffd54a');
toast('⚡ التقاط في اللحظة الأخيرة +25', '#ffd54a');
hud();
}
} else {
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
function clearMovement(){ for(const code in key) key[code] = 0; je(); inX = inZ = animSpd = 0; }
addEventListener('blur', clearMovement);
document.addEventListener('visibilitychange', () => { if(document.hidden) clearMovement(); });
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
const jy = $('joy'), kn = $('knob');
let jid = null, joyBaseR = null;
function jm(e){
const r = jy.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2;
let dx = e.clientX - cx, dy = e.clientY - cy;
const d = Math.hypot(dx, dy), m = r.width * 0.3;
if(d > m){ dx *= m/d; dy *= m/d; }
let jx = dx / m, jv = dy / m;
const mag = Math.hypot(jx, jv), dead = .12;
if(mag < dead){ jx = jv = 0; }
else { const s = (mag - dead) / (1 - dead) / mag; jx = Math.max(-1, Math.min(1, jx * s)); jv = Math.max(-1, Math.min(1, jv * s)); }
joy.x = jx; joy.y = jv;
kn.style.transform = `translate(${dx}px,${dy}px)`;
}
/* الجويستيك العائم: ينتقل إلى مركز اللمسة في النصف الأيسر ثم يعود لمكانه */
function joyFloatTo(cx, cy){
  if(!joyBaseR) joyBaseR = jy.getBoundingClientRect();
  const st = stageEl.getBoundingClientRect(), r = joyBaseR.width / 2;
  const tx = Math.max(st.left + r, Math.min(st.right - r, cx));
  const ty = Math.max(st.top + r, Math.min(st.bottom - r, cy));
  jy.style.transform = `translate(${tx - (joyBaseR.left + r)}px,${ty - (joyBaseR.top + r)}px)`;
  jy.classList.add('floating');
}
function joyFloatEnd(){ jy.classList.remove('floating'); jy.style.transform = ''; joyBaseR = null; }
jy.addEventListener('pointerdown', e => { initAudio(); jid = e.pointerId; jy.setPointerCapture(jid); jm(e); });
jy.addEventListener('pointermove', e => { if(e.pointerId === jid) jm(e); });
const je = () => { jid = null; joy.x = joy.y = 0; kn.style.transform = ''; joyFloatEnd(); };
jy.addEventListener('pointerup', je); jy.addEventListener('pointercancel', je);
/* لمس النصف الأيسر من الشاشة يبدأ الجويستيك العائم فوراً (بدل تفويت اللمسة) */
stageEl.addEventListener('pointerdown', e => {
  if(jid !== null || !run || introHold || fire.keypad || FD.on) return;
  if(e.pointerType === 'mouse') return;
  if(e.clientX > innerWidth * 0.48) return;
  if(e.target.closest && e.target.closest('#controls-ui, .top-btns, .ov, #code-pad')) return;
  initAudio();
  jid = e.pointerId; joyBaseR = jy.getBoundingClientRect();
  joyFloatTo(e.clientX, e.clientY);
  jm(e);
});
addEventListener('pointermove', e => {
  if(e.pointerId !== jid || !jy.classList.contains('floating')) return;
  e.preventDefault();
  jm(e);
}, { passive:false });
addEventListener('pointerup', e => { if(e.pointerId === jid) je(); });
addEventListener('pointercancel', e => { if(e.pointerId === jid) je(); });
$('dash-btn').addEventListener('pointerdown', e => { e.preventDefault(); doDash(); });
function setStage(n,silent){
stage=n;
inspector.demo=false; demo.insp=false; demo.truck=false; hideIntro();
if(n===2) resetInspector();
if(n>=3) resetTruck();
if(!silent){
snd('ship'); time += 10;
spawnFloatTag(I18N.T('+10 ث ⏱','+10s ⏱'),'#64ffda');
tip(n===2?'stage2':n===3?'stage3':'stage4', n===2?'🚀 المرحلة ٢: المواد الخطرة والمفتش! السير أسرع':n===3?'🏁 المرحلة ٣: الرافعة الشوكية تعبر المستودع!':'💥 المرحلة ٤: مواد خطرة فقط — ثلاث حاويات حسب الفئة!','#64ffda');
}
hud();
}
function start(){
initAudio();
stopVib();
items.forEach(i => { clearCrit(i); S.remove(i.m); }); items = [];
Z.forEach(z => { z.items = []; z.n_ = 0; z.full = false; if(z.hz && z.signCv) drawZoneSign(z); });
slowT = 0; beltSlowT = 0; beltSlowUsed = false; beltBtnMat.color.setHex(0x14e0b0); beltBtnMat.emissiveIntensity = 1; beltBtnHalo.scale.setScalar(1);
score = 0; combo = 1; time = 100; spawnT = 0; held = null; lvl = 1; stage = 1;
streak = 0; streakT = 0; maxStreak = 0; rushT = 30; rushN = 0; rushDelay = 0;
$('streak').classList.remove('on');
dashT = 0; dashCD = 0; feverT = 0; shakeTrauma = 0;
$('dash-fx').classList.remove('on'); $('stage').classList.remove('fever'); setDashButton();
demo = {insp:false,truck:false,inspDone:false,truckDone:false,truckIn:0}; inspector.demo = false; hideIntro();
sortedCount = 0; totalProcessed = 0; warnTicker = 0; pz = false;
$('rules').style.display = 'none';
resetExitGate();
resetFire();
px.set(0, 0, 3); curRotY = 0; liftAnim.active = false; resetInspector(); resetTruck();
FD.on = false; FD.left = 60; FD.near = false; rig.visible = true; forkDriver.visible = false; fk.position.set(FD.home.x, 0, FD.home.z); fk.rotation.y = Math.PI/2;
clearMovement(); last = performance.now();
run = true; document.body.classList.add('ingame'); $('ov').style.display = 'none'; R.domElement.focus({preventScroll:true}); hud();
tip('stage1', '🎓 المرحلة ١: التدريب — التقط وافرز', '#64ffda');
}
$('go').onclick = start;
let pz = false;
const openRules = () => {
const r = $('rules'), o = r.style.display === 'none';
r.style.display = o ? 'flex' : 'none';
if(o){ pz = run; run = false; } else if(pz){ run = true; pz = false; }
};
const rbBtn = $('rb'); if(rbBtn) rbBtn.onclick = openRules;
$('rc').onclick = openRules;
$('how').onclick = openRules;
function end(){
run = false;
stopVib();
feverT = 0; dashT = 0; dashCD = 0; shakeTrauma = 0;
$('stage').classList.remove('fever'); $('dash-fx').classList.remove('on'); setDashButton();
document.body.classList.remove('ingame');
if(FD.on) stopDrive();
resetFire();
const o = $('ov'); o.style.display = 'flex';
const acc = totalProcessed > 0 ? Math.round((sortedCount / totalProcessed) * 100) : 0;
const best = bestScore();
const record = score > best && score > 0;
if(record) saveBest(score);
const topList = score > 0 ? pushTop(score) : getTop();
const grade = (score >= 500 && acc >= 90) ? 's' : (score >= 350 && acc >= 80) ? 'a' : score >= 200 ? 'b' : 'c';
const titles = { s:I18N.t('خبير DGR معتمد'), a:I18N.t('مشرف فرز متمكن'), b:I18N.t('فني مستودع واعد'), c:I18N.t('متدرب قيد التأهيل') };
const stars = { s:5, a:4, b:3, c:2 }[grade];
const hubStars = Math.max(1, Math.min(3, Math.round((stars * 3) / 5)));
let hub = null;
try { if(window.GameHub) hub = GameHub.saveGameScore('game1', score, hubStars); } catch(e){}
const totalScore = hub ? hub.totalScore : score;
const stageBest = hub ? hub.bestScore : Math.max(best, score);
const p = stars / 5;
const dash = (351.86 * (1 - p)).toFixed(2);
const deg = p * 360;
const rad = deg * Math.PI / 180;
const planeX = (70 + 56 * Math.sin(rad)).toFixed(2);
const planeY = (70 - 56 * Math.cos(rad)).toFixed(2);
const starPath = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
const starsHTML = Array.from({ length: 5 }, (_, i) => `<svg class="star${i < stars ? ' lit' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${starPath}"/></svg>`).join('');
const recLine = record ? '<span class="new-record"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2H6v7a6 6 0 0 0 12 0V2ZM4 22h16v-2H4v2Zm7-5.08V20h2v-3.08A8 8 0 0 1 11 16.92Z"/></svg>' + I18N.t('رقم قياسي جديد!') + '</span>' : '';
o.innerHTML = `<div class="shift-panel">
<section class="hero-section">
<div class="flight-dial">
<svg class="dial-svg" viewBox="0 0 140 140" aria-hidden="true">
<defs><linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#fbbf24"/></linearGradient></defs>
<circle cx="70" cy="70" r="64" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2" stroke-dasharray="2 6"/>
<circle cx="70" cy="70" r="56" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6"/>
<circle cx="70" cy="70" r="56" fill="none" stroke="url(#arcGrad)" stroke-width="6" stroke-linecap="round" stroke-dasharray="351.86" stroke-dashoffset="${dash}" transform="rotate(-90 70 70)"/>
<g transform="translate(${planeX}, ${planeY}) rotate(${deg})"><path d="M 8 0 L -2 -7 L -4 -7 L -1 -1 L -6 -1 L -8 -4 L -9 -4 L -8 0 L -9 4 L -8 4 L -6 1 L -1 1 L -4 7 L -2 7 Z" fill="#fbbf24"/></g>
</svg>
<div class="grade-core g-${grade}">${grade.toUpperCase()}</div>
</div>
<div class="stars-row">${starsHTML}</div>
<h1 class="main-title">${I18N.t('انتهت الوردية')}</h1>
<div class="rank-chip">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
<span>${I18N.t('الرتبة:')}</span><strong>${titles[grade]}</strong>
</div>
</section>
<section class="stats-grid">
<div class="stat-card c-amber">
<svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
<strong class="stat-num">${score}</strong><span class="stat-lbl">${I18N.t('النقاط')}</span>
</div>
<div class="stat-card c-cyan">
<svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>
<strong class="stat-num">${sortedCount}</strong><span class="stat-lbl">${I18N.t('طرود مصنّفة')}</span>
</div>
<div class="stat-card c-emerald">
<svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
<strong class="stat-num">${acc}%</strong><span class="stat-lbl">${I18N.t('دقة IATA')}</span>
<div class="mini-bar"><span style="width:${acc}%"></span></div>
</div>
<div class="stat-card c-orange">
<svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
<strong class="stat-num">${maxStreak}</strong><span class="stat-lbl">${I18N.t('أطول سلسلة')}</span>
</div>
</section>
<div class="records-panel">
<div class="best-badge">
<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2H6v7a6 6 0 0 0 12 0V2ZM4 22h16v-2H4v2Zm7-5.08V20h2v-3.08A8 8 0 0 1 11 16.92Z"/></svg>
<span>${I18N.T('أفضل نتيجة:','Best score:')} ${Math.max(best, score)}</span>
</div>
<div class="best-badge total-badge">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 7h18v13H3z"/><path d="M8 7V4h8v3M3 12h18"/></svg>
<span>${I18N.T('المجموع التراكمي:','Total score:')} ${totalScore}</span>
</div>
${recLine}
<div class="leaderboard-wrap"><span>${I18N.T('لوحة المتصدرين:','Leaderboard:')}</span><div class="lb-chips">${topHTML(topList)}</div></div>
</div>
<p class="tip-msg">${totalProcessed === 0 ? I18N.t('لم تُصنّف أي طرد هذه الوردية — جرّب مرة أخرى!') : acc >= 80 ? I18N.t('أداء قوي — حافظ على الدقة مع السرعة في الوردية القادمة.') : I18N.t('راجع دليل الفرز السريع ثم عُد لكسر رقمك.')}</p>
<div class="actions-row">
<button id="next" class="btn btn-primary" type="button"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M3 12h18"/><path d="M15 6l6 6-6 6"/></svg><span>${I18N.T('الانتقال للمرحلة التالية','Next stage')}</span></button>
<button id="go" class="btn btn-secondary" type="button"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg><span>${I18N.T('إعادة المحاولة','Replay level')}</span></button>
<button id="rb2" class="btn btn-secondary" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg><span>${I18N.t('الدليل')}</span></button>
<button id="ex2" class="btn btn-secondary" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg><span>${I18N.t('الغلاف')}</span></button>
</div>
</div>`;
$('go').onclick = start;
$('next').onclick = beginExitSequence;
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
function resetExitGate(){
EXIT_GATE.active = false; EXIT_GATE.phase = 'idle'; EXIT_GATE.t = 0; EXIT_GATE.open = 0; EXIT_GATE.warped = false;
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
if(FD.on) stopDrive();
resetFire();
document.body.classList.remove('ingame');
document.body.classList.add('exit-mode');
const ov = $('ov');
if(ov){ ov.classList.add('fade-out'); setTimeout(() => { ov.style.display = 'none'; ov.classList.remove('fade-out'); }, 460); }
buildExitTrail();
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
const next = window.GameHub ? GameHub.nextUrl('game1') : 'https://dgr-exp.netlify.app/m1/pairs.html?source=game1&session=active';
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
gateMarker.position.y = 8.15 + Math.sin(now * 0.0026) * 0.16;
gateNeon.emissiveIntensity = 1.4 + pulse * 1.3;
EXIT_GATE.trail.forEach(arrow => {
if(!arrow.visible) return;
const phase = ((now * 0.0016 - arrow.userData.delay) % 1 + 1) % 1;
const wave = Math.sin(phase * Math.PI);
arrow.material.opacity = 0.25 + 0.75 * wave * wave;
arrow.scale.setScalar(0.82 + 0.18 * wave);
});
if(EXIT_GATE.phase === 'guide' && t > 0.9){
const dx = EXIT_GATE.targetX - px.x, dz = EXIT_GATE.targetZ - px.z;
const dist = Math.hypot(dx, dz);
if(dist <= 0.4){ startPortalWarp(); return; }
const ux = dx / dist, uz = dz / dist, spd = 5.4;
const steps = Math.max(1, Math.ceil(dt / (1/60))), stepDt = dt / steps;
for(let i = 0; i < steps; i++){
const c = resolvePlayerCollisions(px.x + ux * spd * stepDt, px.z + uz * spd * stepDt, ux, uz, stepDt);
px.x = c.x; px.z = c.z;
}
const targetRot = Math.atan2(ux, uz);
curRotY += Math.atan2(Math.sin(targetRot - curRotY), Math.cos(targetRot - curRotY)) * Math.min(1, dt * 10);
rig.rotation.y = curRotY;
anim(dt, 8.2, ux, uz);
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
u.lang = 'en-US'; u.rate = .95; u.pitch = .9;
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
fire.siren = setInterval(() => { if(fire.active && fire.phase !== 'done'){ snd('fire'); vib([350, 160, 350]); } }, 7000);
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
clearMovement(); last = performance.now();
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
if(v){ pa.x += v[0]/2; pa.z += v[1]/2; pb.x -= v[0]/2; pb.z -= v[1]/2; A.wob = Math.max(A.wob||0, 0.5); B_.wob = Math.max(B_.wob||0, 0.5); }
}
pa.x = Math.max(-33, Math.min(33, pa.x)); pa.z = Math.max(-11.9, Math.min(9.6, pa.z));
}
}
}

// ===== المفتش: يمر بسرعة مرة واحدة ويخالف الطرود المتروكة خارج المناطق =====
const inspector = (() => {
const g = new THREE.Group();
const M = (c, r=0.6, m=0.05) => new THREE.MeshStandardMaterial({color:c, roughness:r, metalness:m});
const shirt = M(0xeef3f8), vest = M(0xff7a00, .55), skin = M(0xe0b08a, .7), pants = M(0x1f2d42), boot = M(0x1a1410, .5), helm = M(0xffffff, .35, .1), refl = new THREE.MeshStandardMaterial({color:0xf4f8fb, emissive:0x9aa4ad, roughness:.3}), dark = M(0x111111, .4), hair = M(0x3b2a20, .8);
const add = (geo, mat, x, y, z, par=g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
const limb = (r, len, mat, par) => { add(new THREE.CylinderGeometry(r, r*0.92, len, 14), mat, 0, -len/2, 0, par); add(new THREE.SphereGeometry(r, 14, 10), mat, 0, 0, 0, par); add(new THREE.SphereGeometry(r*0.92, 14, 10), mat, 0, -len, 0, par); };
// جذع ممتلئ بقميص وسترة عاكسة
const body = add(new THREE.CylinderGeometry(0.36, 0.3, 0.72, 22), shirt, 0, 1.28, 0); body.scale.z = 0.78;
const vst = add(new THREE.CylinderGeometry(0.375, 0.315, 0.66, 22, 1, true), vest, 0, 1.26, 0); vst.scale.z = 0.8; vst.material.side = THREE.DoubleSide;
[1.12, 1.32].forEach(y => { const r = add(new THREE.CylinderGeometry(0.38 - (1.32-y)*0.2, 0.38 - (1.32-y)*0.2, 0.06, 22, 1, true), refl, 0, y, 0); r.scale.z = 0.81; });
const shoulders = add(new THREE.SphereGeometry(0.36, 22, 12, 0, Math.PI*2, 0, Math.PI/2), shirt, 0, 1.62, 0); shoulders.scale.set(1, .45, .78);
add(new THREE.BoxGeometry(0.1, 0.12, 0.02), M(0x1565c0), 0.17, 1.42, 0.29); // شارة
add(new THREE.CylinderGeometry(0.1, 0.11, 0.1, 14), skin, 0, 1.72, 0); // رقبة
// رأس بوجه واضح
const head = add(new THREE.SphereGeometry(0.23, 22, 18), skin, 0, 1.95, 0); head.scale.set(1, 1.08, 1);
[-1,1].forEach(sx => {
add(new THREE.SphereGeometry(0.035, 10, 8), M(0xffffff, .2), sx*0.08, 1.99, 0.2);
add(new THREE.SphereGeometry(0.02, 8, 6), dark, sx*0.08, 1.99, 0.225);
const brow = add(new THREE.BoxGeometry(0.09, 0.02, 0.02), hair, sx*0.08, 2.05, 0.215); brow.rotation.z = -sx*0.25;
add(new THREE.SphereGeometry(0.05, 10, 8), skin, sx*0.235, 1.95, 0); // أذن
const lens = add(new THREE.TorusGeometry(0.045, 0.01, 6, 16), dark, sx*0.08, 1.99, 0.225);
});
add(new THREE.BoxGeometry(0.06, 0.01, 0.01), dark, 0, 1.99, 0.235);
const nose = add(new THREE.SphereGeometry(0.04, 10, 8), skin, 0, 1.93, 0.23); nose.scale.z = 1.3;
const mus = add(new THREE.SphereGeometry(0.075, 12, 8), hair, 0, 1.875, 0.2); mus.scale.set(1.5, .35, .5);
// خوذة سلامة بيضاء مع حافة
const hat = add(new THREE.SphereGeometry(0.255, 22, 12, 0, Math.PI*2, 0, Math.PI/2), helm, 0, 2.02, 0);
add(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 24), helm, 0, 2.03, 0.03);
add(new THREE.BoxGeometry(0.05, 0.08, 0.38), helm, 0, 2.24, 0);
const legs = [], arms = [];
for(const sx of [-0.15, 0.15]){
const lp = new THREE.Group(); lp.position.set(sx, 0.92, 0); g.add(lp);
limb(0.13, 0.76, pants, lp);
const bt = add(new THREE.BoxGeometry(0.22, 0.14, 0.34), boot, 0, -0.84, 0.05, lp); legs.push(lp);
const ap = new THREE.Group(); ap.position.set(sx*2.6, 1.58, 0); g.add(ap);
limb(0.085, 0.56, shirt, ap);
add(new THREE.SphereGeometry(0.08, 12, 10), skin, 0, -0.64, 0, ap); arms.push(ap);
}
// لوح الملاحظات مع ورقة
const clip = new THREE.Group(); clip.position.set(0, -0.6, 0.12); arms[1].add(clip);
add(new THREE.BoxGeometry(0.28, 0.36, 0.025), M(0x8d6e63), 0, 0, 0, clip);
add(new THREE.BoxGeometry(0.24, 0.28, 0.01), M(0xffffff, .9), 0, -0.02, 0.016, clip);
add(new THREE.BoxGeometry(0.1, 0.04, 0.03), M(0xb0bec5, .3, .8), 0, 0.17, 0.01, clip);
// حزام وصفارة
add(new THREE.CylinderGeometry(0.305, 0.305, 0.06, 22), dark, 0, 0.94, 0).scale.z = 0.8;
g.traverse(o => { if(o.isMesh) o.castShadow = true; });
g.scale.setScalar(1.25); g.visible = false; S.add(g);
return { g, legs, arms, active:false, x:0, z:0, dir:1, t:0, cooldown:0 };
})();
function resetInspector(){ inspector.active = false; inspector.g.visible = false; inspector.cooldown = 6; inspector.done = false; inspector.elapsed = 0; $('inspector-badge').classList.remove('on'); }
function updateInspector(dt){
const I_ = inspector;
if(!I_.active){
if(I_.done) return;
I_.elapsed = (I_.elapsed||0) + dt;
I_.cooldown -= dt;
if(I_.cooldown > 0) return;
const bad = items.filter(i => i.st === 'floor' && !i.data.isFod && !i.fall && !i.fined && (i.floorT = (i.floorT||0) + dt) > 2.5);
if(!bad.length && I_.elapsed < 30) return;
const cand = bad.length ? bad : items.filter(i => i.st === 'floor' && !i.data.isFod && !i.fall && !i.fined);
let tgt = {m:{position:{z:px.z - 1.6}}}, bn = -1;
for(const c of cand){ const n = cand.filter(o => Math.abs(o.m.position.z - c.m.position.z) < 5.5).length; if(n > bn){ bn = n; tgt = c; } }
I_.dir = Math.random() < 0.5 ? 1 : -1;
I_.x = -36 * I_.dir; I_.z = Math.max(-11, Math.min(9, tgt.m.position.z + 1.6));
I_.active = true; I_.g.visible = true; I_.t = 0;
I_.g.rotation.y = I_.dir > 0 ? Math.PI/2 : -Math.PI/2;
$('inspector-badge').classList.add('on');
snd('whistle');
return;
}
I_.t += dt;
const prevX = I_.x;
I_.x += I_.dir * (I_.demo ? 6 : 3.6) * dt;
const sw = Math.sin(I_.t * 5) * 0.4;
I_.g.rotation.z = Math.sin(I_.t * 5) * 0.09;
I_.legs[0].rotation.x = sw; I_.legs[1].rotation.x = -sw;
I_.arms[0].rotation.x = -sw * 0.8; I_.arms[1].rotation.x = sw * 0.4 - 0.5;
I_.g.position.set(I_.x, Math.abs(Math.sin(I_.t * 5)) * 0.04, I_.z);
for(const it of items){
if(I_.demo || it.st !== 'floor' || it.data.isFod || it.fined) continue;
const bx = it.m.position.x;
if(Math.abs(it.m.position.z - I_.z) < 5.5 && (prevX - bx) * (I_.x - bx) <= 0){
it.fined = true;
score = Math.max(0, score - 15); combo = 1; time = Math.max(0, time - 4);
snd('whistle');
spawnFloatTag('🦺 مخالفة -15', '#ffb020');
tip('fine', '📋 المفتش: طرد متروك خارج المنطقة المخصصة! (-15 و -4 ث)', '#ffb020');
it.m.material.emissive && it.m.material.emissive.setHex(0x552200);
hud();
}
}
if(Math.abs(I_.x) > 37){ I_.active = false; I_.g.visible = false; I_.done = true; I_.cooldown = 14; I_.elapsed = 0; if(I_.demo){ I_.demo = false; demo.insp = false; demo.inspDone = true; demo.truckIn = 6; hideIntro(); } $('inspector-badge').classList.remove('on'); }
}
let last = performance.now();
const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.12, 40), new THREE.MeshBasicMaterial({color:0xffc94d, transparent:true, opacity:0.85, depthWrite:false}));
ring.rotation.x = -Math.PI/2; ring.visible = false; S.add(ring);
let warnTicker = 0;
let hudTicker = 0;
const cargoTarget = new THREE.Vector3();
let camTarget = new THREE.Vector3(), camLook = new THREE.Vector3(0,0.9,0.8), camLookT = new THREE.Vector3();
C.position.set(0, 13.2, 15.4);
function loop(now){
requestAnimationFrame(loop);
const rawDt = (now - last) / 1000;
const dt = document.hidden || rawDt > 1 ? 0 : Math.min(rawDt, .5); last = now;
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
if(dashCD > 0) dashCD = Math.max(0, dashCD - dt);
if(feverT > 0){ feverT = Math.max(0, feverT - dt); if(feverT === 0) $('stage').classList.remove('fever'); }
shakeTrauma = Math.max(0, shakeTrauma - dt * 2.5);
if(run && !fire.keypad){
if(!fire.active && (stage>=3 || demo.truck)) updateTruck(dt);
const sprintOn = !held && !!(key.ShiftLeft || key.ShiftRight);
const sprintK = (dashT > 0 ? DASH_BOOST : 1) * (feverT > 0 ? FEVER_BOOST : 1) * (sprintOn ? 1.35 : 1);
const spd = liftAnim.active ? 0 : (held ? 6.2 : 8.2) * gameRules.movementMultiplier(fearT) * sprintK;
// Small collision steps preserve full travel time even when rendering slows down.
const steps = Math.max(1, Math.ceil(dt / (1/60))), stepDt = dt / steps;
if(FD.on){
FD.left = Math.max(0, FD.left - dt);
const dSpd = gameRules.forklift.driveSpeed;
if(l > .001) fk.rotation.y = Math.atan2(vx, vz);
for(let step=0; step<steps; step++){
const c = resolvePlayerCollisions(fk.position.x + vx * dSpd * stepDt, fk.position.z + vz * dSpd * stepDt, vx, vz, stepDt);
fk.position.x = Math.max(-33.2, Math.min(33.2, c.x));
fk.position.z = Math.max(-11.2, Math.min(9.7, c.z));
}
px.x = fk.position.x; px.z = fk.position.z;
if(FD.left <= 0) stopDrive('⏱ انتهت مدة قيادة الرافعة (٦٠ ثانية)');
} else if(l > .001){
for(let step=0; step<steps; step++){
const correctedPos = resolvePlayerCollisions(px.x + vx * spd * stepDt, px.z + vz * spd * stepDt, vx, vz, stepDt);
px.x = correctedPos.x; px.z = correctedPos.z;
}
}
if(!FD.on) anim(dt, liftAnim.active ? 0 : animSpd, vx, vz);
FD.near = !FD.on && FD.left > 0 && Math.hypot(px.x - fk.position.x, px.z - fk.position.z) < 2.6;
if(!fire.active) time -= dt;
if(time <= 20){
warnTicker += dt;
if(warnTicker > 1){ snd('warn'); warnTicker = 0; }
}
if(time <= 0){ time = 0; hud(); end(); }
if(!fire.active && !fire.done && time > 0 && time <= 30) startFireDrill();
lvl = 1 + Math.floor(score / 120);
if(stage===1){
if(!demo.inspDone){ if(!demo.insp && (score >= 20 || time <= 90)) startInspDemo(); }
else if(!demo.truckDone && !demo.truck){
demo.truckIn = Math.max(0, demo.truckIn - dt);
if(demo.truckIn <= 0) startTruckDemo();
}
}
if(stage<4 && score >= STAGE_AT[stage+1] && (stage!==1 || (demo.inspDone && demo.truckDone))) setStage(stage+1);
if(!fire.active){
spawnT -= dt;
if(spawnT <= 0){
spawn();
spawnT = stage===1 ? 5.4 : stage===2 ? Math.max(1.8, 3.4 - lvl * 0.22) : stage===4 ? Math.max(1.5, 2.9 - lvl * 0.2) : Math.max(1.4, 2.8 - lvl * 0.2);
}
}
if(stage >= 2 && !fire.active){
rushT -= dt;
if(rushT <= 0){
rushT = 24 + Math.random() * 12; rushN = 3; rushDelay = 0;
snd('horn');
showIntro(I18N.T('<b class="t">⚡ تدفق سريع!</b>ثلاث شحنات متتابعة على الحزام — ركّز وسرّع الفرز.', '<b class="t">⚡ Rush hour!</b>Three shipments in a row on the belt — focus and sort faster.'), 2600);
}
if(rushN > 0){
rushDelay -= dt;
if(rushDelay <= 0 && items.length < 14){ spawn(); rushN--; rushDelay = .5; }
}
}
if(streakT > 0){ streakT -= dt; if(streakT <= 0){ streakT = 0; streak = 0; } }
for(const it of items.slice()){
if(it.st !== 'floor' || it.fall) continue;
const zz = Z.find(z => (it.data.isFod ? z.k==='fod' : z.k!=='fod') && Math.abs(it.m.position.x - z.x) < z.hw && it.m.position.z < -5.6 && !z.full);
if(zz){ it.st = 'sorting'; resolvePlacement(zz, it); }
}
separateBoxes();
if(!fire.active && (stage>=2 || demo.insp)) updateInspector(dt);
if(jy){
  const tp2 = gameRules.position(truckState);
  const nearTruck = truckState.active && tp2.x < px.x + 4 && Math.abs(tp2.x - px.x) < 14;
  const nearInsp = inspector.active && Math.abs(inspector.x - px.x) < 12;
  jy.classList.toggle('warn', run && !fire.active && (nearTruck || nearInsp));
}
slowT = Math.max(0, slowT - dt);
beltSlowT = Math.max(0, beltSlowT - dt);
const beltK = fire.active ? 0 : (slowT > 0 ? 0.35 : (beltSlowT > 0 ? 0.6 : 1));
let best = null, bd = 2.8;
for(const it of items.slice()){
it.csh.visible = it.st !== 'held' && it.st !== 'lifting';
if(it.fall){ it.vy -= 32 * dt; it.m.position.y += it.vy * dt; if(it.m.position.y <= it.ty){ it.m.position.y = it.ty; it.fall = false; if(it.st === 'floor'){ snd('bump'); const dd = Math.hypot(it.m.position.x - px.x, it.m.position.z - px.z); if(dd < 9) addShake(.45 * (1 - dd / 9)); } } }
if(it.st === 'belt'){
it.m.position.x += beltSpeed() * beltK * dt;
if(it.m.position.x > 23.5){
if(it.data.isMys){ rm(it); continue; }
const miss = it.data.isHz ? 3 : 2;
totalProcessed++;
rm(it);
const lost = Math.min(score, miss);
score = Math.max(0, score - miss);
streak = 0; streakT = 0;
if(stage >= 2) combo = 1;
snd('error');
penaltyFx(lost, it.data.isHz);
toast((it.data.isHz ? I18N.T('⚠️ فاتتك مادة خطرة! ','⚠️ You missed a dangerous good! ') : I18N.T('فاتك طرد! ','Parcel missed! ')) + (lost ? '−' + lost + I18N.T(' نقاط',' pts') : I18N.t('بدون خصم')), '#ff8a5c'); hud(); continue;
}
}
if(it.st === 'held'){
if(FD.on){
const targetPos = cargoTarget.set(gameRules.forklift.forkX(fk.position.x, fk.rotation.y), gameRules.forklift.carryY, gameRules.forklift.forkZ(fk.position.z, fk.rotation.y));
cargoSmoothPos.lerp(targetPos, Math.min(1, dt * 20));
it.m.position.copy(cargoSmoothPos);
it.m.rotation.set(0, fk.rotation.y, 0);
} else {
const fX = Math.sin(rig.rotation.y), fZ = Math.cos(rig.rotation.y);
const lX = Math.cos(rig.rotation.y), lZ = -Math.sin(rig.rotation.y);
const sway = l > 0.08 ? Math.sin(walk) * 0.06 : 0;
const bnc = l > 0.08 ? Math.sin(walk * 2) * 0.04 : 0;
cargoInertiaY += (bnc - cargoInertiaY) * Math.min(1, dt * 14);
const targetPos = cargoTarget.set(
px.x + fX * 0.78 + lX * sway,
1.38 + bob * 0.55 + cargoInertiaY,
px.z + fZ * 0.78 + lZ * sway
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
{ const ts = (it.st === 'held' || it.st === 'lifting') ? 0.8 : 1; if(Math.abs(it.m.scale.x - ts) > 0.001) it.m.scale.setScalar(it.m.scale.x + (ts - it.m.scale.x) * Math.min(1, dt * 12)); }
if(it.m.material.emissive) it.m.material.emissive.setHex(0);
if(it.data.isMys && it.m.material.emissive){ it.m.material.emissive.setHex(0x4a3000); it.m.material.emissiveIntensity = 0.5 + Math.sin(now*0.006)*0.4; }
if(it.crit){
if(it.st === 'belt' || it.st === 'floor' || it.st === 'held'){
it.crit.t -= dt;
const sec = Math.max(0, Math.ceil(it.crit.t));
if(sec !== it.crit.tag.sec) drawCritTag(it.crit.tag, sec);
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
if(EXIT_GATE.active){
// توجيه الكاميرا نحو بوابة الخروج على اليسار أثناء تسلسل الانتقال
const gateK = 1 - Math.exp(-dt * 2.2);
C.position.lerp(camTarget.set(px.x + 10.6, 8.4, px.z + 5.2), gateK);
camLook.lerp(camLookT.set(-34.2, 3.2, -6), 1 - Math.exp(-dt * 2.6));
C.lookAt(camLook);
} else {
// الكاميرا تتبع الموظف كاملاً (مع سقف عند جدران المستودع) فلا يصل إلى حافة الشاشة
const camX = Math.max(-camMaxX, Math.min(camMaxX, px.x));
C.position.lerp(camTarget.set(camX + evacView, 13.2, px.z + 12.4), 1 - Math.exp(-dt*9));
camLook.lerp(camLookT.set(px.x + evacView, 0.9, px.z - 2.2), 1 - Math.exp(-dt*10));
C.lookAt(camLook);
}
// اهتزاز الكاميرا (Trauma): يُطبَّق بعد lookAt حتى يهتز المنظور فعلاً
const shake = shakeTrauma * shakeTrauma;
if(shake > 0.0005){
C.position.x += (Math.random() - 0.5) * shake * 0.7;
C.position.y += (Math.random() - 0.5) * shake * 0.5;
C.rotation.z += (Math.random() - 0.5) * shake * 0.03;
}
R.render(S, C);
if(!loadingDone){ loadingDone = true; loading.finish(); }
}
syncMenu();
const shellBtn = $('shell'); if(shellBtn) shellBtn.onclick = e => { e.stopPropagation(); exitToShell(); };
let loadingDone = false;
loading.phase(88, I18N.t('تسخين الشيدرات والمؤثرات...'));
/* تسخين مسبق للشيدرات لمنع تقطيعة أول إطار */
try{ R.compile(S, C); }catch(e){}
loading.phase(96, I18N.t('اكتمل التجهيز — لحظة واحدة...'));
requestAnimationFrame(loop);

// ===== تخصيص لون سترة العامل =====
(() => {
const vestMats = []; rig.traverse(o => { if(o.isMesh && o.material && o.material.color && o.material.color.getHex() === C_VEST) vestMats.push(o.material); });
vestMats.push(forkVest.material);
const COLORS = [[0xd4ff00,I18N.t('أصفر فوسفوري')],[0xff6d00,I18N.t('برتقالي سلامة')],[0x00e676,I18N.t('أخضر نيون')]];
const apply = c => { vestMats.forEach(m => m.color.setHex(c)); try { localStorage.setItem('acg_vest', c); } catch(e){} document.querySelectorAll('#skins button').forEach(b => b.classList.toggle('on', +b.dataset.c === c)); };
const row = document.getElementById('skins'); if(!row) return;
COLORS.forEach(([c,n]) => { const b = document.createElement('button'); b.dataset.c = c; b.style.background = '#' + c.toString(16).padStart(6,'0'); b.setAttribute('aria-label', n); b.title = n; b.onclick = e => { e.stopPropagation(); apply(c); }; row.appendChild(b); });
let saved = COLORS[0][0]; try { saved = +(localStorage.getItem('acg_vest') || COLORS[0][0]); } catch(e){}
apply(COLORS.some(([c]) => c === saved) ? saved : COLORS[0][0]);
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
