/* ===== هيكل عظمي إجرائي لشخصية GLB ثابتة =====
   الملف airport-crew.glb مجسّم واحد بلا skin ولا animations. نبني هنا 9 عظام
   (حوض، جذع، رأس، كتفان، فخذان، ركبتان) ونوزّع رؤوس الهندسة عليها حسب مواضعها،
   ثم نحوّل كل قطعة إلى SkinnedMesh فيُحرَّك الجسد بمشي حقيقي بلا Blender. */
(function () {
  "use strict";

  var B = { hips: 0, torso: 1, armL: 2, armR: 3, head: 4, legL: 5, legR: 6, shinL: 7, shinR: 8, footL: 9, footR: 10 };
  // [الأب, x, y, z] — القالب 1.855م وقدماه عند y=0
  var REST = [
    [-1, 0, 0.94, 0],
    [0, 0, 0, 0],
    [1, -0.215, 0.54, 0],
    [1, 0.215, 0.54, 0],
    [1, 0, 0.62, 0],
    [0, -0.105, -0.04, 0],
    [0, 0.105, -0.04, 0],
    [5, 0, -0.4, 0],
    [6, 0, -0.4, 0],
    [7, 0, -0.38, 0],
    [8, 0, -0.38, 0],
  ];

  var KNEE = 0.5, KNEE_BAND = 0.07, HEAD_Y = 1.57, HIP_Y = 0.94;
  // عظما الكاحل: بدونهما يلتصق القدم بالساق فينقلب كلما انثنت الركبة
  var ANKLE = 0.13, ANKLE_BAND = 0.05;
  var HIP_BAND = 0.08;
  var ARM_BOTTOM = 0.7; // أدنى ارتفاع لليد في القالب (الأذرع تتدلى لأسفل وللخارج)
  var TARGET_H = 3.6;
  // اليد في المجسّم مفتوحة والأصابع مفرودة للخارج؛ نضمّها نحو محور الذراع
  // ليبدو الكف مسترخياً ملاصقاً للجسم بدل أن يكون مفتوحاً بعيداً.
  var HAND_TOP = 1.02, HAND_BOT = 0.9, HAND_IN = 0.5;

  // عظمتان كحد أقصى لكل رأس، بمزج حول الكتف والركبة لمنع التمزق
  function armLimit(y) { return 0.275 - (y - 0.9) * 0.18; }
  function weight(x, y, id, wt) {
    if (y >= HEAD_Y) { id[0] = B.head; wt[0] = 1; return; }
    var ax = x < 0 ? -x : x;
    if (y >= ARM_BOTTOM) {
      var t = armLimit(y);
      var aw = (ax - (t - 0.035)) / 0.07;
      if (aw > 0) {
        if (aw > 1) aw = 1;
        id[0] = x < 0 ? B.armL : B.armR; wt[0] = aw;
        if (aw < 1) { id[1] = B.torso; wt[1] = 1 - aw; }
        return;
      }
    }
    if (y < HIP_Y) {
      var side = x < 0 ? B.legL : B.legR;
      var shin = x < 0 ? B.shinL : B.shinR;
      var foot = x < 0 ? B.footL : B.footR;
      // حزام لين عند الحوض حتى لا يتمزق الوسط عند تبادل الساقين
      if (y > HIP_Y - HIP_BAND) {
        var th = (y - (HIP_Y - HIP_BAND)) / HIP_BAND;
        id[0] = side; wt[0] = 1 - th; id[1] = B.torso; wt[1] = th;
        return;
      }
      if (y < ANKLE - ANKLE_BAND) { id[0] = foot; wt[0] = 1; return; }
      if (y < ANKLE + ANKLE_BAND) {
        var tf = (y - (ANKLE - ANKLE_BAND)) / (2 * ANKLE_BAND);
        id[0] = foot; wt[0] = 1 - tf; id[1] = shin; wt[1] = tf;
        return;
      }
      if (y > KNEE + KNEE_BAND) { id[0] = side; wt[0] = 1; return; }
      if (y < KNEE - KNEE_BAND) { id[0] = shin; wt[0] = 1; return; }
      var t = (y - (KNEE - KNEE_BAND)) / (2 * KNEE_BAND);
      id[0] = side; wt[0] = t; id[1] = shin; wt[1] = 1 - t;
      return;
    }
    id[0] = B.torso; wt[0] = 1;
  }

  function newState() { return { root: null, bones: [], skel: null, loaded: false, t: 0, cur: null, parts: 0 }; }
  /* S = نسخة اللاعب (أول تحميل). كل تحميل إضافي (سائق الرافعة) يحصل على
     حالته وعظامه المستقلة حتى لا تتحرك نسخة مكان أخرى. */
  var S = newState();

  function slimHands(geo) {
    var P = geo.attributes.position;
    if (!P) return;
    for (var i = 0; i < P.count; i++) {
      var y = P.getY(i), x = P.getX(i);
      if (y > HAND_TOP || y < 0.75) continue;
      if ((x < 0 ? -x : x) < 0.24) continue;
      var t = (HAND_TOP - y) / (HAND_TOP - HAND_BOT);
      if (t > 1) t = 1;
      if (t <= 0) continue;
      // محور الذراع في القالب: الكتف عند (0.215, 1.48) والكف عند (0.4, 0.79)
      var axis = (x < 0 ? -1 : 1) * (0.215 + (1.48 - y) * 0.268);
      P.setX(i, axis + (x - axis) * (1 - HAND_IN * t));
    }
    P.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  /* skinIndex/skinWeight يجب أن تكون 4 مكوّنات: WebGL يملأ المكوّنات الغائبة
     بـ (0,0,0,1) — أي وزن 1 لعظم إضافي — فتتضاعف الإزاحة ويختفي المجسّم. */
  function skinAttribs(geo) {
    var P = geo.attributes.position;
    if (!P) return false;
    var n = P.count;
    var si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    var id = [0, 0], wt = [0, 0];
    for (var i = 0; i < n; i++) {
      id[0] = id[1] = 0; wt[0] = wt[1] = 0;
      weight(P.getX(i), P.getY(i), id, wt);
      si[i * 4] = id[0]; si[i * 4 + 1] = id[1];
      sw[i * 4] = wt[0]; sw[i * 4 + 1] = wt[1];
    }
    geo.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
    geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    return true;
  }

  function buildBones() {
    var bones = [];
    for (var i = 0; i < REST.length; i++) bones.push(new THREE.Bone());
    for (var j = 0; j < REST.length; j++) {
      var r = REST[j];
      bones[j].position.set(r[1], r[2], r[3]);
      if (r[0] >= 0) bones[r[0]].add(bones[j]);
    }
    return bones;
  }

  function load(url) {
    return new Promise(function (resolve, reject) {
      if (!THREE.GLTFLoader) return reject(new Error("GLTFLoader missing"));
      new THREE.GLTFLoader().load(url, function (gltf) {
        try {
          var src = gltf.scene;
          src.updateMatrixWorld(true);
          // توسيط أفقي وإلصاق القدمين بالأرض ثم تكبير القالب ليطابق مقياس المستودع
          var bb = new THREE.Box3().setFromObject(src);
          var bhh = Math.max(0.1, bb.max.y - bb.min.y);
          var kk = TARGET_H / bhh;
          var root = new THREE.Group();
          root.scale.setScalar(kk);
          root.position.set(-(bb.min.x + bb.max.x) / 2 * kk, -bb.min.y * kk, -(bb.min.z + bb.max.z) / 2 * kk);

          var bones = buildBones();
          root.add(bones[0]);
          root.updateMatrixWorld(true);
          var skel = new THREE.Skeleton(bones);

          var flat = [];
          src.traverse(function (o) { if (o.isMesh) flat.push(o); });

          for (var i = 0; i < flat.length; i++) {
            var part = flat[i];
            var geo = part.geometry;
            slimHands(geo);
            if (!skinAttribs(geo)) continue;
            var mat = Array.isArray(part.material) ? part.material[0] : part.material;
            if (mat) { mat.skinning = true; mat.roughness = Math.max(0.4, mat.roughness || 0.7); }
            var sm = new THREE.SkinnedMesh(geo, mat);
            sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false;
            root.add(sm);
            sm.bind(skel);
          }

          var st = newState();
          st.root = root; st.bones = bones; st.skel = skel; st.loaded = true; st.parts = flat.length;
          if (!S.loaded) {
            S.root = root; S.bones = bones; S.skel = skel; S.loaded = true; S.parts = st.parts;
          }
          resolve({ root: root, state: st, height: TARGET_H, pose: function (p) { poseFor(st, p); } });
        } catch (e) { reject(e); }
      }, undefined, reject);
    });
  }

  function lrp(cur, target, k) { return cur + (target - cur) * k; }

  /* نصف موجة لثني الركبة: تبدأ بعد رفع القدم وتنتهي قبل ملامستها الأرض،
     فيبقى الساق المرتكسة مستقيمة والقدم لا تغرز في الأرض. */
  function kneeHump(ph, off) {
    var w = (ph - off) % (Math.PI * 2);
    if (w < 0) w += Math.PI * 2;
    if (w < 1.7 || w > 4.4) return 0;
    return Math.sin(Math.PI * (w - 1.7) / 2.7);
  }

  /* p: {dt, phase, moving, sprint, held, lift, sit} */
  function poseFor(st, p) {
    if (!st.loaded) return;
    var dt = Math.min(p.dt || 0.016, 0.05);
    var k = Math.min(1, dt * 16);
    st.t += dt;
    var lift = p.lift || 0;
    var idle = Math.sin(st.t * 1.6) * 0.02;
    var tgt;

    if (p.sit) {
      // جالس: فخذان للأمام وأسفل، ساقان شبه عموديتان، الذراعان إلى المقود
      tgt = {
        hipsY: idle * 0.3, hipsRotY: 0, hipsRotZ: 0,
        torsoY: 0, torsoX: 0.12 + lift * 0.1,
        headY: idle * 2, headX: -0.05,
        armLX: -0.62, armRX: -0.62, armLZ: 0.13, armRZ: -0.13,
        legLX: -1.05, legRX: -1.05, shinLX: 0.92, shinRX: 0.92,
        footLX: 0.06, footRX: 0.06
      };
    } else {
      var ph = p.phase || 0;
      var mv = p.moving ? 1 : 0;
      var amp = p.sprint ? 0.7 : p.held ? 0.45 : 0.6;
      var sL = Math.sin(ph);
      // انثناء الركبة في نصف المشية الهوائية فقط (الساق تعبر من الخلف للأمام)
      var kneeL = 0.08 + mv * 0.85 * kneeHump(ph, 0);
      var kneeR = 0.08 + mv * 0.85 * kneeHump(ph, Math.PI);
      var reach = p.held ? 0.95 : 0;
      tgt = {
        // أعلى نقطة فوق القدم المرتكسة، وأخفضها عند تبادل القدمين
        hipsY: mv ? -0.115 * Math.abs(sL) : idle * 0.4,
        hipsRotY: mv ? sL * 0.07 : 0,
        hipsRotZ: mv ? sL * 0.025 : 0,
        torsoY: mv ? -sL * 0.1 : idle * 0.5,
        torsoX: (mv ? (p.sprint ? 0.14 : 0.09) : 0) + lift * 0.18,
        headY: mv ? sL * 0.04 : idle,
        headX: lift * -0.14,
        // الذراع المعاكسة للفخذ: اليسرى للأمام مع اليمنى للخلف
        armLX: (mv ? -sL * amp * 0.75 : idle * 0.6) - lift * 0.6 - reach,
        armRX: (mv ? sL * amp * 0.75 : -idle * 0.6) - lift * 0.6 - reach,
        armLZ: 0.2 - reach * 0.2,
        armRZ: -0.2 + reach * 0.2,
        legLX: mv ? sL * amp : 0,
        legRX: mv ? -sL * amp : 0,
        shinLX: kneeL,
        shinRX: kneeR,
        footLX: mv ? 0.26 * sL : 0,
        footRX: mv ? -0.26 * sL : 0
      };
    }

    var c = st.cur || (st.cur = {});
    for (var key in tgt) c[key] = c[key] === undefined ? tgt[key] : lrp(c[key], tgt[key], k);

    var b = st.bones;
    b[B.hips].position.y = 0.94 + c.hipsY;
    b[B.hips].rotation.set(0, c.hipsRotY, c.hipsRotZ || 0);
    b[B.torso].rotation.set(c.torsoX, c.torsoY, 0);
    b[B.head].rotation.set(c.headX, c.headY, 0);
    b[B.armL].rotation.set(c.armLX, 0, c.armLZ);
    b[B.armR].rotation.set(c.armRX, 0, c.armRZ);
    b[B.legL].rotation.set(c.legLX, 0, 0);
    b[B.legR].rotation.set(c.legRX, 0, 0);
    b[B.shinL].rotation.set(c.shinLX, 0, 0);
    b[B.shinR].rotation.set(c.shinRX, 0, 0);
    /* الكاحل يعوّض دوران الفخذ+الساق فيبقى القدم أفقياً، ثم نضيف لفّة
       بسيطة (كعب يرتفع عند الدفع) فلا يبدو القدم مجدافاً يتبع الساق. */
    b[B.footL].rotation.set(-(c.legLX + c.shinLX) + (c.footLX || 0), 0, 0);
    b[B.footR].rotation.set(-(c.legRX + c.shinRX) + (c.footRX || 0), 0, 0);
  }

  function pose(p) { poseFor(S, p); }

  window.CrewRig = { load: load, pose: pose, state: S, height: TARGET_H, bones: B };
})();
