/* ===== هيكل عظمي إجرائي لشخصية GLB ثابتة =====
   الملف airport-crew.glb مجسّم واحد بلا skin ولا animations. نبني هنا 9 عظام
   (حوض، جذع، رأس، كتفان، فخذان، ركبتان) ونوزّع رؤوس الهندسة عليها حسب مواضعها،
   ثم نحوّل كل قطعة إلى SkinnedMesh فيُحرَّك الجسد بمشي حقيقي بلا Blender. */
(function () {
  "use strict";

  var B = { hips: 0, torso: 1, armL: 2, armR: 3, head: 4, legL: 5, legR: 6, shinL: 7, shinR: 8 };
  // [الأب, x, y, z] — القالب 1.855م وقدماه عند y=0
  var REST = [
    [-1, 0, 0.94, 0],
    [0, 0, 0, 0],
    [1, -0.235, 0.54, 0],
    [1, 0.235, 0.54, 0],
    [1, 0, 0.62, 0],
    [0, -0.105, -0.04, 0],
    [0, 0.105, -0.04, 0],
    [5, 0, -0.4, 0],
    [6, 0, -0.4, 0],
  ];

  var KNEE = 0.5, KNEE_BAND = 0.07, ARM_X = 0.205, HEAD_Y = 1.57, HIP_Y = 0.94;

  // عظمتان كحد أقصى لكل رأس، بمزج حول الركبة لمنع التمزق
  function weight(x, y, id, wt) {
    if (y >= HEAD_Y) { id[0] = B.head; wt[0] = 1; return; }
    if (Math.abs(x) >= ARM_X && y >= 0.85) { id[0] = x < 0 ? B.armL : B.armR; wt[0] = 1; return; }
    if (y < HIP_Y) {
      var side = x < 0 ? B.legL : B.legR;
      var shin = x < 0 ? B.shinL : B.shinR;
      if (y > KNEE + KNEE_BAND) { id[0] = side; wt[0] = 1; return; }
      if (y < KNEE - KNEE_BAND) { id[0] = shin; wt[0] = 1; return; }
      var t = (y - (KNEE - KNEE_BAND)) / (2 * KNEE_BAND);
      id[0] = side; wt[0] = t; id[1] = shin; wt[1] = 1 - t;
      return;
    }
    id[0] = B.torso; wt[0] = 1;
  }

  var S = { root: null, bones: [], skel: null, loaded: false, t: 0, cur: null, parts: 0 };

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
          // توسيط أفقي وإلصاق القدمين بالأرض: على الجذر فقط كي تبقى العظام متحاذية
          var bb = new THREE.Box3().setFromObject(src);
          var root = new THREE.Group();
          root.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);

          var bones = buildBones();
          root.add(bones[0]);
          root.updateMatrixWorld(true);
          var skel = new THREE.Skeleton(bones);

          var flat = [];
          src.traverse(function (o) { if (o.isMesh) flat.push(o); });

          for (var i = 0; i < flat.length; i++) {
            var part = flat[i];
            var geo = part.geometry;
            if (!skinAttribs(geo)) continue;
            var mat = Array.isArray(part.material) ? part.material[0] : part.material;
            if (mat) { mat.skinning = true; mat.roughness = Math.max(0.4, mat.roughness || 0.7); }
            var sm = new THREE.SkinnedMesh(geo, mat);
            sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false;
            root.add(sm);
            sm.bind(skel);
          }

          S.root = root; S.bones = bones; S.skel = skel; S.loaded = true; S.parts = flat.length;
          resolve(root);
        } catch (e) { reject(e); }
      }, undefined, reject);
    });
  }

  function lrp(cur, target, k) { return cur + (target - cur) * k; }

  /* p: {dt, phase, moving, sprint, held, lift} */
  function pose(p) {
    if (!S.loaded) return;
    var dt = Math.min(p.dt || 0.016, 0.05);
    var k = Math.min(1, dt * 14);
    S.t += dt;
    var ph = p.phase || 0;
    var sw = Math.sin(ph), cw = Math.cos(ph);
    var amp = p.held ? 0.45 : p.sprint ? 0.8 : 0.62;
    var mv = p.moving ? 1 : 0;
    var idle = Math.sin(S.t * 1.7) * 0.02;
    var lift = p.lift || 0;

    var tgt = {
      hipsY: mv ? -Math.abs(cw) * 0.03 * (0.6 + amp) : idle * 0.4,
      hipsRotY: mv ? sw * 0.1 : 0,
      torsoY: mv ? -sw * 0.14 : idle * 0.4,
      torsoX: (mv ? (p.sprint ? 0.1 : 0.05) : 0) + lift * 0.18,
      headY: mv ? sw * 0.07 : idle,
      headX: lift * -0.14,
      armLX: mv ? -sw * amp * 0.85 - lift * 0.95 : idle * 0.6,
      armRX: mv ? sw * amp * 0.85 - lift * 0.95 : -idle * 0.6,
      armLZ: 0.07 + (p.held ? 0.1 : 0),
      armRZ: -0.07 - (p.held ? 0.1 : 0),
      legLX: mv ? sw * amp : 0,
      legRX: mv ? -sw * amp : 0,
      shinLX: mv ? Math.max(0, -cw) * amp * 1.45 + 0.05 : 0.02,
      shinRX: mv ? Math.max(0, cw) * amp * 1.45 + 0.05 : 0.02,
    };

    var c = S.cur || (S.cur = {});
    for (var key in tgt) c[key] = c[key] === undefined ? tgt[key] : lrp(c[key], tgt[key], k);

    var b = S.bones;
    b[B.hips].position.y = 0.94 + c.hipsY;
    b[B.hips].rotation.set(0, c.hipsRotY, 0);
    b[B.torso].rotation.set(c.torsoX, c.torsoY, 0);
    b[B.head].rotation.set(c.headX, c.headY, 0);
    b[B.armL].rotation.set(c.armLX, 0, c.armLZ);
    b[B.armR].rotation.set(c.armRX, 0, c.armRZ);
    b[B.legL].rotation.set(c.legLX, 0, 0);
    b[B.legR].rotation.set(c.legRX, 0, 0);
    b[B.shinL].rotation.set(c.shinLX, 0, 0);
    b[B.shinR].rotation.set(c.shinRX, 0, 0);
  }

  window.CrewRig = { load: load, pose: pose, state: S, height: 1.855, bones: B };
})();
