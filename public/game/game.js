const gameRules = WarehouseRules;
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
warn:[[880,.06],[660,.045]]
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
Z.forEach(z => { z.items = []; z.n_ = 0; z.full = false; z.hw = z.w / 2; });
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
const R = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance', alpha:false});
function renderPixelRatio(width, height, dpr){
return Math.min(dpr, 2, Math.sqrt(2600000 / Math.max(1, width * height)));
}
let renderScale = 1;
const stageEl = document.getElementById('stage');
R.setPixelRatio(renderPixelRatio(stageEl.clientWidth, stageEl.clientHeight, devicePixelRatio));
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
function rs(){
const w = stageEl.clientWidth || innerWidth, h = stageEl.clientHeight || innerHeight;
R.setPixelRatio(renderPixelRatio(w, h, devicePixelRatio) * renderScale);
R.setSize(w, h);
C.aspect = w / h;
C.fov = w < h ? 62 : 48;
C.updateProjectionMatrix();
}
addEventListener('resize', rs); rs();
// ===== الإضاءة: ضوء سماوي بارد من النوافذ العلوية + مصابيح صناعية دافئة + إضاءة مركّزة على مناطق الفرز
const hemiLight = new THREE.HemisphereLight(0xcfe2ff, 0x3a3226, 0.55);
S.add(hemiLight);
const amb = new THREE.AmbientLight(0x404a58, 0.25); S.add(amb);
const sun = new THREE.DirectionalLight(0xdfeaff, 0.95);
sun.position.set(-14, 34, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
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
function canvasTex(w, h, draw, rx=1, ry=1){
const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
draw(cv.getContext('2d'), w, h);
const t = new THREE.CanvasTexture(cv);
t.encoding = THREE.sRGBEncoding;
t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
t.anisotropy = R.capabilities.getMaxAnisotropy();
return t;
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
wallSign('🚭 ممنوع التدخين','NO SMOKING • DGR AREA','#b3261e', 8.5, 8.6, -17.15);
wallSign('⚠️ منطقة مواد خطرة','IATA DGR CLASS 1–9','#c77800', 26, 8.6, -17.15);
wallSign('✈️ مخرج الطيران','AIRSIDE GATE B','#1b6b3a', -34.65, 7.5, -6, Math.PI/2, 3.4);
wallSign('🚚 رصيف التحميل','LOADING DOCK 4','#204f8c', 34.65, 7.5, -6, -Math.PI/2, 3.4);
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
// زر إبطاء الحزام: سر مخفي — صندوق صغير عند قاعدة الحزام خارج ممر اللاعب (بلا أي نص أو علامة)
const beltBtnGroup = new THREE.Group();
beltBtnGroup.position.set(-22.8, 0, 10.3);
S.add(beltBtnGroup);
const beltBtnBase = new THREE.Mesh(
  new THREE.BoxGeometry(0.32, 0.26, 0.32),
  new THREE.MeshStandardMaterial({color:0x232c34, roughness:.78, metalness:.35})
);
beltBtnBase.position.y = 0.13; beltBtnGroup.add(beltBtnBase);
const beltBtnPlate = new THREE.Mesh(
  new THREE.BoxGeometry(0.27, 0.03, 0.27),
  new THREE.MeshStandardMaterial({color:0x2f3a44, roughness:.6, metalness:.55})
);
beltBtnPlate.position.y = 0.262; beltBtnGroup.add(beltBtnPlate);
const beltBtnBezel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.095, 0.1, 0.04, 20),
  new THREE.MeshStandardMaterial({color:0x141b21, roughness:.6, metalness:.6})
);
beltBtnBezel.position.y = 0.285; beltBtnGroup.add(beltBtnBezel);
const beltBtnMat = new THREE.MeshStandardMaterial({color:0x14e0b0, emissive:0x00ffc4, emissiveIntensity:1.1, roughness:.32, metalness:.2});
const beltBtnCap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 0.05, 20), beltBtnMat);
beltBtnCap.position.y = 0.315; beltBtnGroup.add(beltBtnCap);
const beltBtnRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.078, 0.01, 10, 22),
  new THREE.MeshStandardMaterial({color:0x9dffe4, emissive:0x2bffd0, emissiveIntensity:.6, roughness:.4})
);
beltBtnRing.rotation.x = Math.PI / 2;
beltBtnRing.position.y = 0.335; beltBtnGroup.add(beltBtnRing);
// توهج خفيف جداً يكشفه فقط عند الاقتراب
const beltBtnHalo = new THREE.Mesh(
  new THREE.RingGeometry(0.1, 0.14, 24),
  new THREE.MeshBasicMaterial({color:0x54ffd8, transparent:true, opacity:.08, side:THREE.DoubleSide, depthWrite:false})
);
beltBtnHalo.rotation.x = -Math.PI / 2;
beltBtnHalo.position.y = 0.3; beltBtnGroup.add(beltBtnHalo);
// هدف لمس أكبر من الحجم المرئي لسهولة الضغط على الهاتف
const beltBtnHit = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 8, 6),
  new THREE.MeshBasicMaterial({transparent:true, opacity:0, depthWrite:false})
);
beltBtnHit.position.y = 0.22; beltBtnGroup.add(beltBtnHit);
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
const cv = z.signCv, ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
ctx.clearRect(0,0,W,H);
ctx.fillStyle = '#' + z.c.toString(16).padStart(6,'0');
ctx.beginPath(); ctx.roundRect ? ctx.roundRect(8,8,W-16,H-16,32) : ctx.rect(8,8,W-16,H-16);
ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 12; ctx.stroke();
ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
if(z.hz){
ctx.direction = 'rtl';
// شريط العنوان
ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(24,24,W-48,96,20) : ctx.rect(24,24,W-48,96); ctx.fill();
ctx.fillStyle = '#fff'; fit(ctx, z.e + '  ' + z.n, W-90, 52); ctx.fillText(z.e + '  ' + z.n, W/2, 74);
ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(24,140,W-48,H-232,16) : ctx.rect(24,140,W-48,H-232); ctx.fill();
if(!z.items.length){ ctx.fillStyle = 'rgba(255,255,255,.68)'; ctx.font = 'bold 32px sans-serif'; ctx.fillText('— فارغة —', W/2, 140 + (H-232)/2); }
z.items.forEach((it, i) => {
if(!it) return;
const y = 186 + i*52;
ctx.textAlign = 'right'; ctx.fillStyle = '#ffd54a'; ctx.font = '900 34px monospace'; ctx.fillText(it.data.div, W-46, y);
ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '800 26px monospace'; ctx.fillText(it.data.imp, 46, y);
ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; fit(ctx, it.data.name, W-230, 28); ctx.fillText(it.data.name, W/2, y);
});
ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '800 28px sans-serif';
ctx.fillText('المحتوى ' + z.items.length + ' من ' + z.cap, W/2, H-52);
} else {
ctx.fillStyle = '#111'; ctx.font = '96px sans-serif'; ctx.fillText(z.e, 256, 80);
fit(ctx, z.n, 440, 75); ctx.fillText(z.n, 256, 185);
}
z.signTex.needsUpdate = true;
}
function makeZoneSign(z){
const cv = document.createElement('canvas'); cv.width = z.hz ? 640 : 512; cv.height = z.hz ? 480 : 256;
z.signCv = cv; z.signTex = new THREE.CanvasTexture(cv); z.signTex.encoding = THREE.sRGBEncoding;
z.signTex.anisotropy = R.capabilities.getMaxAnisotropy();
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
// شريط سفلي أصفر عالي التباين
sg.fillStyle = '#ffd54a'; sg.fillRect(80,704,1888,240);
sg.fillStyle = '#0a2a18'; sg.textAlign = 'center'; sg.textBaseline = 'middle';
sg.direction = 'rtl'; sg.font = '900 108px "Segoe UI",Tahoma,sans-serif';
sg.fillText('مخرج طوارئ • EMERGENCY EXIT', 1024, 826);
// العنوان العربي
sg.fillStyle = '#ffffff';
sg.font = '900 300px "Segoe UI",Tahoma,sans-serif';
sg.fillText('منطقة التجمع', 1024, 330);
sg.direction = 'ltr'; sg.font = 'bold 124px "Segoe UI",Tahoma,sans-serif'; sg.fillStyle = '#baffd6';
sg.fillText('MUSTER POINT', 1024, 566);
const signTex = new THREE.CanvasTexture(signCv);
signTex.encoding = THREE.sRGBEncoding;
signTex.anisotropy = R.capabilities.getMaxAnisotropy();
signTex.minFilter = THREE.LinearMipmapLinearFilter;
signTex.magFilter = THREE.LinearFilter;
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
function pushOutAABB(p, minX, maxX, minZ, maxZ, r){
const cx = Math.max(minX, Math.min(p.x, maxX));
const cz = Math.max(minZ, Math.min(p.z, maxZ));
let dx = p.x - cx, dz = p.z - cz;
const d2 = dx*dx + dz*dz;
if(d2 >= r*r) return false;
if(d2 > 1e-8){
const d = Math.sqrt(d2), push = r - d;
p.x += dx/d * push; p.z += dz/d * push;
} else {
const l = p.x - minX, rr = maxX - p.x, t = p.z - minZ, b = maxZ - p.z;
const m = Math.min(l, rr, t, b);
if(m === l) p.x = minX - r; else if(m === rr) p.x = maxX + r; else if(m === t) p.z = minZ - r; else p.z = maxZ + r;
}
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
if(hit && (Math.abs(mvx)+Math.abs(mvz)) > 0.3 && performance.now() - lastBump > 380){ lastBump = performance.now(); snd('bump'); }
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
if(isMoving){
walk += dt * (isHeld ? 9.2 : 13.5) * gameRules.movementMultiplier(fearT);
const targetRot = Math.atan2(vx, vz);
const diff = Math.atan2(Math.sin(targetRot - curRotY), Math.cos(targetRot - curRotY));
const turnK = Math.min(.3, dt * (14 + Math.abs(diff) * 9));
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
const fire = {active:false, done:false, phase:'idle', t:0, codeT:0, keypad:false, posAwarded:false, siren:null, buzz:null};
const STREAK_MAX = 8;
const streakWindow = () => stage === 1 ? 7 : 5.5;
const bestScore = () => { try { return +(localStorage.getItem('acg_best') || 0) || 0; } catch(e){ return 0; } };
const saveBest = v => { try { localStorage.setItem('acg_best', v); } catch(e){} };
const getTop = () => { try { return JSON.parse(localStorage.getItem('acg_top') || '[]'); } catch(e){ return []; } };
const pushTop = v => { const t = getTop(); t.push({s:v, d:new Date().toLocaleDateString('ar')}); t.sort((a,b)=>b.s-a.s); const r = t.slice(0,5); try { localStorage.setItem('acg_top', JSON.stringify(r)); } catch(e){} return r; };
const topHTML = t => t.length ? t.slice(0,4).map((e,i) => `<span class="score-chip"><i class="rank-dot r${i+1}"></i> ${e.s} نقطة</span>`).join('') : '<span class="lb-empty">العب لتسجّل أول نتيجة</span>';
function syncMenu(){ const tp = $('top5'); const list = getTop(); if(tp){ tp.innerHTML = topHTML(list); tp.style.display = ''; } const el = $('best'); if(!el) return; const b = bestScore(); el.textContent = b ? `أفضل نتيجة: ${b}` : 'كن أول الأبطال'; }
const STAGE_AT=[0,0,100,200,320], STAGE_BELT=[0,1.5,1.9,2.4,2.7];
let demo={insp:false,truck:false,inspDone:false,truckDone:false,truckIn:0}, introT=null, introHold=false;
function showIntro(html,ms=7000,hold=false){
const e=document.getElementById('intro');
e.innerHTML=html;e.classList.add('on');e.classList.toggle('wait',hold);
clearTimeout(introT);
if(hold){ introHold=true; e.onclick=resumeFromIntro; run=false; clearMovement(); introT=setTimeout(resumeFromIntro,20000); }
else { introHold=false; e.onclick=null; introT=setTimeout(()=>e.classList.remove('on'),ms); }
}
function hideIntro(){const e=document.getElementById('intro');if(e){e.classList.remove('on','wait');e.onclick=null;}introHold=false;clearTimeout(introT);}
function resumeFromIntro(){
if(!introHold) return;
if($('rules').style.display !== 'none') return;
hideIntro(); run=true; pz=false; last=performance.now(); clearMovement();
}
function startInspDemo(){
const I_=inspector;demo.insp=true;I_.demo=true;I_.dir=Math.random()<.5?1:-1;I_.x=-36*I_.dir;I_.z=4;I_.active=true;I_.g.visible=true;I_.t=0;
I_.g.rotation.y=I_.dir>0?Math.PI/2:-Math.PI/2;
document.getElementById('inspector-badge').classList.add('on');snd('whistle');
showIntro('<b class="t">🦺 المفتش</b>يغرّم كل طرد متروك خارج مناطق الفرز.<small>جولة تعريفية — بلا غرامات</small><span class="hint">⏸ اللعبة متوقفة — اضغط في أي مكان للمتابعة</span>',0,true);
}
function startTruckDemo(){
demo.truck=true;truckState=gameRules.reset();truckState.elapsed=gameRules.startAt;snd('horn');
showIntro('<b class="t">🚜 الرافعة الشوكية</b>تُسقط أجساماً غريبة (FOD)؛ اجمعها وضعها في الصندوق الأحمر.<small>جولة تعريفية — لن تصطدم بك</small><span class="hint">⏸ اللعبة متوقفة — اضغط في أي مكان للمتابعة</span>',0,true);
}
const beltSpeed=()=>STAGE_BELT[stage]+(lvl-1)*(stage===1?0.06:0.12);
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
const t=new THREE.CanvasTexture(cv); t.encoding=THREE.sRGBEncoding; t.anisotropy=R.capabilities.getMaxAnisotropy();
return tc[k]=t;
}
const BOXG = new THREE.BoxGeometry(1.35, 1.35, 1.35), EDGEG = new THREE.EdgesGeometry(BOXG);
const EDGEM = new THREE.LineBasicMaterial({color:0x2b1a0d, transparent:true, opacity:0.5});
const SHT = canvasTex(128, 128, (g, w, h) => { const gr=g.createRadialGradient(w/2,h/2,w*.2,w/2,h/2,w/2); gr.addColorStop(0,'rgba(0,0,0,.6)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
SHT.wrapS = SHT.wrapT = THREE.ClampToEdgeWrapping;
const SHM = new THREE.MeshBasicMaterial({map:SHT, transparent:true, depthWrite:false});
const BH = 0.675;
const MYS = ['mys','🎁','صندوق مفاجآت','???','?'];
function mysTex(){
const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
const gr = g.createLinearGradient(0,0,512,512); gr.addColorStop(0,'#ffd54a'); gr.addColorStop(1,'#ff9800'); g.fillStyle = gr; g.fillRect(0,0,512,512);
g.fillStyle = 'rgba(255,255,255,.2)'; for(let i=0;i<16;i++){ g.beginPath(); g.arc(Math.random()*512, Math.random()*512, 6+Math.random()*14, 0, 6.3); g.fill(); }
g.fillStyle = '#7b1fa2'; g.fillRect(226,0,60,512); g.fillRect(0,226,512,60);
g.fillStyle = '#ab47bc'; g.fillRect(236,0,12,512); g.fillRect(0,236,512,12);
g.strokeStyle = '#4a148c'; g.lineWidth = 14; g.strokeRect(7,7,498,498);
g.fillStyle = '#fff'; g.beginPath(); g.arc(256,256,120,0,6.3); g.fill(); g.lineWidth = 10; g.stroke();
g.fillStyle = '#7b1fa2'; g.font = '900 190px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?',256,270);
const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = R.capabilities.getMaxAnisotropy(); return t;
}
let slowT = 0;
/* إبطاء الحزام: زر فيزيائي بجوار الحزام، يُستخدم مرّة واحدة، يبطئ ٣٠ ثانية */
const BELT_BTN_XZ = { x: -22.8, z: 10.3 };
let beltSlowT = 0, beltSlowUsed = false;
function useBeltSlow(){
  if(beltSlowUsed || !run || fire.active) return;
  beltSlowUsed = true; beltSlowT = 30;
  snd('ship'); toast('🐢 الحزام يبطؤ ٣٠ ثانية', '#80d8ff');
  hud();
}
const beltRay = new THREE.Raycaster(), beltNdc = new THREE.Vector2();
R.domElement.addEventListener('pointerdown', e => {
  if(!run || fire.active) return;
  const r = R.domElement.getBoundingClientRect();
  beltNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  beltRay.setFromCamera(beltNdc, C);
  if(beltRay.intersectObjects(beltBtnGroup.children, false).length) useBeltSlow();
});
function mystery(it){
rm(it); totalProcessed = Math.max(0, totalProcessed);
const r = Math.random();
if(r < 0.25){ time += 12; snd('ship'); spawnFloatTag('+12 ث ⏱','#64ffda'); toast('🎁 مفاجأة: +12 ثانية','#64ffda'); }
else if(r < 0.5){ score += 60; snd('ship'); toast('🎁 مفاجأة: +60 نقطة','#ffd54a'); }
else if(r < 0.7){ combo = 8; snd('ship'); toast('🎁 مفاجأة: كومبو ×8 🔥','#ff9800'); }
else if(r < 0.85){ slowT = 8; snd('ship'); toast('🎁 مفاجأة: الحزام يبطؤ ٨ ثوانٍ 🐢','#80d8ff'); }
else { time = Math.max(0, time - 6); snd('error'); spawnFloatTag('-6 ث','#ff5252'); toast('💥 مفاجأة سيئة: -6 ثوانٍ','#ff5252'); }
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
S.add(m); items.push({m, data:itObj, st:'belt', csh});
}
function dropFod(x,z){
const m = new THREE.Mesh(new THREE.BoxGeometry(.5,.3,.7), new THREE.MeshStandardMaterial({color:0x94aebc,metalness:.7,roughness:.35}));
m.position.set(x,1.2,z); m.castShadow = true; m.receiveShadow = true;
const nut = new THREE.Mesh(new THREE.TorusGeometry(.28,.09,6,6),m.material);
nut.rotation.x=Math.PI/2; nut.position.set(.15,.15,0); m.add(nut);
const marker = canvasTex(128,64,(g,w,h)=>{g.fillStyle='#ffd54a';g.fillRect(0,0,w,h);g.fillStyle='#17252b';g.font='900 40px monospace';g.textAlign='center';g.fillText('FOD',w/2,46);});
const label = new THREE.Sprite(new THREE.SpriteMaterial({map:marker,depthTest:false}));label.position.y=.6;label.scale.set(.95,.48,1);m.add(label);
const csh=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.2),SHM);csh.rotation.x=-Math.PI/2;csh.position.y=-.13;m.add(csh);
S.add(m);items.push({m,csh,data:{t:'fod',emoji:'🔩',name:'جسم غريب',imp:'FOD',div:'',isFod:true,isHz:false,isMys:false},st:'floor',fall:true,vy:0,ty:.2});
snd('place');tip('foddrop', '🔩 سقط جسم غريب FOD!', '#ffd54a');
}
function resetTruck(){ truckState=gameRules.reset();fearT=0;recklessTruck.visible=false; }
function updateTruck(dt){
fearT=Math.max(0,fearT-dt);
const steps=Math.max(1,Math.ceil(dt/.016)), step=dt/steps;
for(let i=0;i<steps;i++){
const before=gameRules.position(truckState), event=gameRules.advance(truckState,step,px.z), after=gameRules.position(truckState);
if(event.entered){snd('horn');tip('forklift', '⚠️ رافعة متهورة تعبر المستودع!', '#ffd54a');}
if(event.drop) dropFod(after.x,after.z);
if(!demo.truck && truckState.active && !truckState.hit && gameRules.touches(before.x,before.z,after.x,after.z,px.x,px.z)){
truckState.hit=true;fearT=gameRules.fearDuration;snd('bump');tip('bump', '😨 اصطدام! حركة أبطأ مؤقتًا', '#ffd54a');
}
}
if(demo.truck && truckState.done){ demo.truck=false; demo.truckDone=true; hideIntro(); }
const pos=gameRules.position(truckState);
recklessTruck.visible=truckState.active;recklessTruck.position.set(pos.x,0,pos.z);recklessTruck.rotation.y=pos.yaw;
recklessTruck.rotation.z=truckState.active && !truckState.turned && truckState.x===0 ? -.12 : 0;
truckDriver.rotation.z=Math.sin(truckState.elapsed*18)*.04;
}
const $ = id => document.getElementById(id);
let tt;
function toast(t, col){
const e = $('toast'); e.textContent = t; e.style.color = col; e.style.opacity = 1;
e.style.transform = 'translateX(-50%) scale(1.05)';
clearTimeout(tt);
tt = setTimeout(() => { e.style.opacity = 0; e.style.transform = 'translateX(-50%) scale(1)'; }, 1300);
}
function spawnFloatTag(txt, col){
const el = document.createElement('div');
el.className = 'float-tag'; el.textContent = txt; el.style.color = col;
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
tag.innerHTML = '<b>−' + n + '</b><i>' + (hz ? 'مادة خطرة فاتت' : 'طرد فات') + '</i>';
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
$('stg').textContent = stage<4 ? `🎓 المرحلة ${stage} • ${Math.min(score,STAGE_AT[stage+1])}/${STAGE_AT[stage+1]}` : '🏁 المرحلة ٤ • الأخيرة — مواد خطرة فقط';
$('cb').textContent = '×' + combo;
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
if(FD.on){ dv.textContent = '🚜 القيادة: ' + Math.ceil(FD.left) + ' ث • اضغط هنا للنزول'; dv.style.display = 'block'; }
else dv.style.display = 'none';
dv.classList.toggle('drive', FD.on);
}
}
function rm(it){ S.remove(it.m); items = items.filter(i => i !== it); }
function ship(z){
z.full = true;
snd('ship');
setTimeout(() => {
if(!z.full) return;
z.items.forEach(x => rm(x));
z.items = []; z.full = false; if(z.hz) drawZoneSign(z);
score += 40;
time += 15;
spawnFloatTag('+15 ثوانٍ ⏱', '#64ffda');
toast('🚚 شُحنت ' + z.n + ' (+40 و +15 ث)', '#64ffda');
hud();
}, 900);
}
function resolvePlacement(z, it){
const d = it.data;
if(d.isFod){
const bonus=gameRules.reward(true,z.k);
if(bonus){score+=bonus;rm(it);snd('ok');spawnFloatTag('+'+bonus+' FOD','#69f0ae');toast('✔ جمع الجسم الغريب +'+bonus+' نقطة','#69f0ae');}
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
conflictReason = 'هذه الحاوية مخصصة فقط للمواد الخطرة (DGR)!';
} else {
let hasConflict = false;
for(const placed of z.items){
if(gameRules.conflict(d, placed.data)){
hasConflict = true;
conflictReason = `تعارض IATA: لا يُخلط [${d.imp} . ${d.div}] مع [${placed.data.imp} . ${placed.data.div}] في حاوية واحدة!`;
break;
}
}
if(!hasConflict) ok = true;
}
} else {
ok = (z.k === d.t);
if(!ok && d.isHz){
conflictReason = `ممنوع وضع مادة خطرة (${d.imp} . ${d.div}) في مناطق الشحن العادي! ضعها في إحدى حاويات المواد الخطرة.`;
} else if(!ok){
conflictReason = 'منطقة فرز غير مطابقة لنوع الشحنة!';
}
}
if(ok){
sortedCount++;
const p = 10 * combo * (d.isHz ? 2 : 1);
score += p;
combo = Math.min(combo + 1, 8);
streak++; streakT = streakWindow(); maxStreak = Math.max(maxStreak, streak);
time += 3;
snd('ok', 1 + Math.min(streak, STREAK_MAX) * .05);
spawnFloatTag('+3 ث ⏱', '#69f0ae');
let chainMsg = '';
if(streak % 4 === 0){
const b = Math.min(30, streak * 2.5);
score += b; chainMsg = ` • سلسلة +${b} 🔥`;
stageEl.classList.remove('flash'); void stageEl.offsetWidth; stageEl.classList.add('flash');
setTimeout(() => stageEl.classList.remove('flash'), 550);
snd('ship', 1 + Math.min(streak, 8) * .04);
}
toast(`✔ فرز متوافق +${p}${chainMsg}` + (d.isHz ? ` [${d.imp} . ${d.div}]` : ''), '#69f0ae');
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
spawnFloatTag('-'+tp+' ث', '#ff5252');
toast(`✖ ${conflictReason} (-${tp} ث)`, '#ff5252');
rm(it);
}
hud();
}
function mountDrive(){
if(FD.on || FD.left <= 0 || held || liftAnim.active) return;
FD.on = true; FD.near = false;
fk.visible = true; rig.visible = false;
px.set(fk.position.x, 0, fk.position.z);
snd('horn');
toast('🚜 قُد الرافعة الشوكية — المتبقي ' + Math.ceil(FD.left) + ' ث', '#ffd54a');
hud();
}
function stopDrive(msg){
if(!FD.on) return;
FD.on = false; rig.visible = true;
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
if(_drvEl) _drvEl.onclick = () => { if(FD.on) stopDrive('🚜 نزلت من الرافعة'); };
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
tip('dg-' + d.imp + d.div, `⚠️ تم التقاط مادة خطرة: ${d.imp} . ${d.div}`, '#ffb020');
} else {
toast(`تم الالتقاط: ${d.name}`, '#fff');
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
snd('place');
held.st = 'floor';
held.m.position.set(Math.max(-33, Math.min(33, px.x + Math.sin(rig.rotation.y)*1.25)), 1.05, Math.max(-11.9, Math.min(9.6, px.z + Math.cos(rig.rotation.y)*1.25)));
held.m.rotation.set(0, rig.rotation.y, 0); held.fall = true; held.vy = 0; held.ty = held.data.isFod ? .2 : 0.02 + BH;
held = null;
}
hud();
}
}
addEventListener('keydown', e => {
if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
if(introHold){ if(['Space','KeyE','Enter','Escape'].includes(e.code)){ e.preventDefault(); if(!e.repeat) resumeFromIntro(); } return; }
if(fire.keypad){ handlePadKey(e); return; }
key[e.code] = 1;
if(['Space','KeyE','Enter'].includes(e.code)){ e.preventDefault(); if(!e.repeat) act(); }
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
let jid = null;
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
jy.addEventListener('pointerdown', e => { initAudio(); jid = e.pointerId; jy.setPointerCapture(jid); jm(e); });
jy.addEventListener('pointermove', e => { if(e.pointerId === jid) jm(e); });
const je = () => { jid = null; joy.x = joy.y = 0; kn.style.transform = ''; };
jy.addEventListener('pointerup', je); jy.addEventListener('pointercancel', je);
function setStage(n,silent){
stage=n;
inspector.demo=false; demo.insp=false; demo.truck=false; hideIntro();
if(n===2) resetInspector();
if(n>=3) resetTruck();
if(!silent){
snd('ship'); time += 10;
spawnFloatTag('+10 ث ⏱','#64ffda');
tip(n===2?'stage2':n===3?'stage3':'stage4', n===2?'🚀 المرحلة ٢: المواد الخطرة والمفتش! السير أسرع':n===3?'🏁 المرحلة ٣: الرافعة الشوكية تعبر المستودع!':'💥 المرحلة ٤: مواد خطرة فقط — ثلاث حاويات حسب الفئة!','#64ffda');
}
hud();
}
function start(){
initAudio();
stopVib();
items.forEach(i => S.remove(i.m)); items = [];
Z.forEach(z => { z.items = []; z.n_ = 0; z.full = false; if(z.hz && z.signCv) drawZoneSign(z); });
slowT = 0; beltSlowT = 0; beltSlowUsed = false; beltBtnMat.color.setHex(0x14e0b0); beltBtnMat.emissiveIntensity = 1; beltBtnHalo.scale.setScalar(1);
score = 0; combo = 1; time = 100; spawnT = 0; held = null; lvl = 1; stage = 1;
streak = 0; streakT = 0; maxStreak = 0; rushT = 30; rushN = 0; rushDelay = 0;
$('streak').classList.remove('on');
demo = {insp:false,truck:false,inspDone:false,truckDone:false,truckIn:0}; inspector.demo = false; hideIntro();
sortedCount = 0; totalProcessed = 0; warnTicker = 0; pz = false;
$('rules').style.display = 'none';
resetFire();
px.set(0, 0, 3); curRotY = 0; liftAnim.active = false; resetInspector(); resetTruck();
FD.on = false; FD.left = 60; FD.near = false; rig.visible = true; fk.position.set(FD.home.x, 0, FD.home.z); fk.rotation.y = Math.PI/2;
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
const titles = { s:'خبير DGR معتمد', a:'مشرف فرز متمكن', b:'فني مستودع واعد', c:'متدرب قيد التأهيل' };
const stars = { s:5, a:4, b:3, c:2 }[grade];
const p = stars / 5;
const dash = (351.86 * (1 - p)).toFixed(2);
const deg = p * 360;
const rad = deg * Math.PI / 180;
const planeX = (70 + 56 * Math.sin(rad)).toFixed(2);
const planeY = (70 - 56 * Math.cos(rad)).toFixed(2);
const starPath = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
const starsHTML = Array.from({ length: 5 }, (_, i) => `<svg class="star${i < stars ? ' lit' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${starPath}"/></svg>`).join('');
const recLine = record ? '<span class="new-record"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2H6v7a6 6 0 0 0 12 0V2ZM4 22h16v-2H4v2Zm7-5.08V20h2v-3.08A8 8 0 0 1 11 16.92Z"/></svg>رقم قياسي جديد!</span>' : '';
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
<h1 class="main-title">انتهت الوردية</h1>
<div class="rank-chip">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
<span>الرتبة:</span><strong>${titles[grade]}</strong>
</div>
</section>
<section class="stats-grid">
<div class="stat-card c-amber">
<svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
<strong class="stat-num">${score}</strong><span class="stat-lbl">النقاط</span>
</div>
<div class="stat-card c-cyan">
<svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>
<strong class="stat-num">${sortedCount}</strong><span class="stat-lbl">طرود مصنّفة</span>
</div>
<div class="stat-card c-emerald">
<svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
<strong class="stat-num">${acc}%</strong><span class="stat-lbl">دقة IATA</span>
<div class="mini-bar"><span style="width:${acc}%"></span></div>
</div>
<div class="stat-card c-orange">
<svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
<strong class="stat-num">${maxStreak}</strong><span class="stat-lbl">أطول سلسلة</span>
</div>
</section>
<div class="records-panel">
<div class="best-badge">
<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2H6v7a6 6 0 0 0 12 0V2ZM4 22h16v-2H4v2Zm7-5.08V20h2v-3.08A8 8 0 0 1 11 16.92Z"/></svg>
<span>أفضل نتيجة: ${Math.max(best, score)}</span>
</div>
${recLine}
<div class="leaderboard-wrap"><span>لوحة المتصدرين:</span><div class="lb-chips">${topHTML(topList)}</div></div>
</div>
<p class="tip-msg">${totalProcessed === 0 ? 'لم تُصنّف أي طرد هذه الوردية — جرّب مرة أخرى!' : acc >= 80 ? 'أداء قوي — حافظ على الدقة مع السرعة في الوردية القادمة.' : 'راجع دليل الفرز السريع ثم عُد لكسر رقمك.'}</p>
<div class="actions-row">
<button id="go" class="btn btn-primary" type="button"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg><span>وردية جديدة</span></button>
<button id="rb2" class="btn btn-secondary" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg><span>الدليل</span></button>
</div>
</div>`;
$('go').onclick = start;
$('rb2').onclick = openRules;
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
$('cp-timer').textContent = '⏱ 20 ث';
$('code-pad').classList.add('on');
toast('🔢 أدخل رقم الطوارئ لتأكيد الإخلاء', '#ffd54a');
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
spawnFloatTag('+' + bonus + ' كود الطوارئ', '#69f0ae');
$('cp-err').textContent = '✅ تم تأكيد الإخلاء +' + bonus;
$('cp-err').style.color = '#69f0ae';
$('cp-disp').textContent = fire.code;
$('fire-banner').classList.remove('on');
awardPosition();
setTimeout(() => finishFire('✅ اكتمل الإخلاء — استؤنفت الوردية'), 1400);
} else {
snd('error');
fire.code = '';
$('cp-disp').textContent = '••••••••';
$('cp-err').textContent = '✖ رقم غير صحيح — حاول مرة أخرى';
$('cp-err').style.color = '#ff8a80';
}
}
function awardPosition(){
if(fire.posAwarded || !gameRules.emergency.inMuster(px.x, px.z)) return;
fire.posAwarded = true;
const p = gameRules.emergency.positionPoints;
score += p; hud();
spawnFloatTag('+' + p + ' موقع صحيح', '#69f0ae');
toast('✔ +' + p + ' لوجودك في منطقة التجمع', '#69f0ae');
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
$('cp-timer').textContent = '⏱ ' + Math.max(0, Math.ceil(fire.codeT)) + ' ث';
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
let hudTicker = 0, frameTotal = 0, frameCount = 0;
const cargoTarget = new THREE.Vector3();
const camTarget = new THREE.Vector3(), camLook = new THREE.Vector3(0,0.9,0.8), camLookT = new THREE.Vector3();
C.position.set(0, 13.2, 15.4);
function loop(now){
requestAnimationFrame(loop);
const rawDt = (now - last) / 1000;
const dt = document.hidden || rawDt > 1 ? 0 : Math.min(rawDt, .5); last = now;
if(run && rawDt > 0 && rawDt < 1){
frameTotal += rawDt; frameCount++;
if(frameCount >= 90){
if(frameTotal / frameCount > .025 && renderScale > .6){ renderScale = Math.max(.6, renderScale - .1); rs(); }
frameTotal = 0; frameCount = 0;
}
}
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
const inputK = 1 - Math.exp(-dt * 16);
inX += (tx - inX) * inputK; inZ += (tz - inZ) * inputK;
let vx = inX, vz = inZ;
let l = Math.hypot(vx, vz);
if(l < .015){ vx = vz = 0; l = 0; }
if(l > 1){ vx /= l; vz /= l; l = 1; }
animSpd += (l - animSpd) * (1 - Math.exp(-dt * 12));
if(fire.active) updateFire(dt);
if(run && !fire.keypad){
if(!fire.active && (stage>=3 || demo.truck)) updateTruck(dt);
const spd = liftAnim.active ? 0 : (held ? 6.2 : 8.2) * gameRules.movementMultiplier(fearT);
// Small collision steps preserve full travel time even when rendering slows down.
const steps = Math.max(1, Math.ceil(dt / (1/60))), stepDt = dt / steps;
if(FD.on){
FD.left = Math.max(0, FD.left - dt);
const dSpd = 7.4;
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
showIntro('<b class="t">⚡ تدفق سريع!</b>ثلاث شحنات متتابعة على الحزام — ركّز وسرّع الفرز.', 2600);
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
if(it.fall){ it.vy -= 32 * dt; it.m.position.y += it.vy * dt; if(it.m.position.y <= it.ty){ it.m.position.y = it.ty; it.fall = false; if(it.st === 'floor') snd('bump'); } }
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
toast((it.data.isHz ? '⚠️ فاتتك مادة خطرة! ' : 'فاتك طرد! ') + (lost ? '−' + lost + ' نقاط' : 'بدون خصم'), '#ff8a5c'); hud(); continue;
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
  beltBtnMat.emissiveIntensity = on ? 0.9 + Math.max(0, Math.sin(now*0.009))*0.5 : 0.04;
  beltBtnMat.color.setHex(on ? 0x14e0b0 : 0x3b4a4a);
  beltBtnRing.material.emissiveIntensity = on ? 0.5 : 0.04;
  beltBtnHalo.material.opacity = on ? 0.08 + Math.max(0, Math.sin(now*0.005))*0.08 : 0;
} else {
  // سر مخفي: وميض هادئ جداً بلا أي علامة على الشاشة
  beltBtnMat.emissiveIntensity = 0.35 + Math.max(0, Math.sin(now*0.0022))*0.45;
  beltBtnRing.material.emissiveIntensity = 0.2 + Math.max(0, Math.sin(now*0.0022))*0.3;
  beltBtnHalo.material.opacity = 0.05 + Math.max(0, Math.sin(now*0.0022))*0.05;
}
hudTicker += dt;
if(hudTicker >= .1){ hudTicker = 0; hud(); }
}
const evacView = fire.active && fire.phase !== 'done' ? -Math.max(0, -px.x) * 0.3 : 0;
C.position.lerp(camTarget.set(px.x * 0.75 + evacView, 13.2, px.z + 12.4), 1 - Math.exp(-dt*9));
camLook.lerp(camLookT.set(px.x * 0.8 + evacView, 0.9, px.z - 2.2), 1 - Math.exp(-dt*12));
C.lookAt(camLook);
R.render(S, C);
}
syncMenu();
requestAnimationFrame(loop);

// ===== تخصيص لون سترة العامل =====
(() => {
const vestMats = []; rig.traverse(o => { if(o.isMesh && o.material && o.material.color && o.material.color.getHex() === C_VEST) vestMats.push(o.material); });
const COLORS = [[0xd4ff00,'أصفر فوسفوري'],[0xff6d00,'برتقالي سلامة'],[0x00e676,'أخضر نيون']];
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
