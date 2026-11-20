/* ===== هيكل عظمي إجرائي لشخصية المفتش الجديد (GLB) =====
   نموذج base_2.glb مجسّم مفتش متكامل (قبعة، رأس، سترة، شارة، بنطال، حذاء، يدين).
   نبني هنا 9 عظام متوافقة مع أبعاد النموذج (1.9م) ونتيح تحريكه بمشية فحص واثقة. */
(function () {
  "use strict";

  var B = { hips: 0, torso: 1, armL: 2, armR: 3, head: 4, legL: 5, legR: 6, shinL: 7, shinR: 8 };

  // [الأب, x, y, z] — أبعاد المفتش بارتفاع ~1.9م
  var REST = [
    [-1, 0, 0.94, 0],       // 0: hips
    [0, 0, 0, 0],           // 1: torso
    [1, -0.32, 0.55, 0],    // 2: armL
    [1, 0.32, 0.55, 0],     // 3: armR
    [1, 0, 0.65, 0],        // 4: head
    [0, -0.16, -0.05, 0],   // 5: legL
    [0, 0.16, -0.05, 0],    // 6: legR
    [5, 0, -0.45, 0],       // 7: shinL
    [6, 0, -0.45, 0],       // 8: shinR
  ];

  var KNEE = 0.50, KNEE_BAND = 0.08, ARM_X = 0.22, HEAD_Y = 1.60, HIP_Y = 0.94;

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

  function createRig() {
    var S = { root: null, bones: [], skel: null, loaded: false, t: 0, cur: null, parts: 0 };

    function load(url) {
      return new Promise(function (resolve, reject) {
        if (!THREE.GLTFLoader) return reject(new Error("GLTFLoader missing"));
        new THREE.GLTFLoader().load(url, function (gltf) {
          try {
            var src = gltf.scene;
            src.updateMatrixWorld(true);
            var bb = new THREE.Box3().setFromObject(src);
            var root = new THREE.Group();
            root.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);

            var bones = buildBones();
            root.add(bones[0]);
            root.updateMatrixWorld(true);
            var skel = new THREE.Skeleton(bones);

            var flat = [];
            src.traverse(function (o) { if (o.isMesh) flat.push(o); });

            // مواد PBR ملونة ومفصلة لشخصية المفتش العربي الرسمي
            var matVest = new THREE.MeshStandardMaterial({
              color: 0x1b2838, // سديرية كحلية رسمية
              roughness: 0.60,
              metalness: 0.05,
              skinning: true
            });
            var matThobe = new THREE.MeshStandardMaterial({
              color: 0xf5f7fb, // ثوب أبيض ناصع وغترة بيضاء
              roughness: 0.65,
              metalness: 0.02,
              skinning: true
            });
            var matSkin = new THREE.MeshStandardMaterial({
              color: 0xc88054, // بشرة عربية حنطية دافئة
              roughness: 0.55,
              metalness: 0.02,
              skinning: true
            });
            var matGold = new THREE.MeshStandardMaterial({
              color: 0xfbbf24, // نجمة التفتيش الذهبية اللامعة والكركوشة
              roughness: 0.20,
              metalness: 0.85,
              skinning: true
            });
            var matHair = new THREE.MeshStandardMaterial({
              color: 0x241710, // الشارب والحاجبين بلون بني داكن
              roughness: 0.70,
              metalness: 0.02,
              skinning: true
            });
            var matSandals = new THREE.MeshStandardMaterial({
              color: 0x321d14, // صندل جلدي بني داكن
              roughness: 0.65,
              metalness: 0.05,
              skinning: true
            });

            for (var i = 0; i < flat.length; i++) {
              var part = flat[i];
              var geo = part.geometry;
              if (!skinAttribs(geo)) continue;

              var mat;
              var n = part.name || "";
              if (n === "root1") {
                mat = matThobe;
              } else if (n === "root2" || n === "root3") {
                mat = matSandals;
              } else if (n === "root4" || n === "root5") {
                mat = matSkin;
              } else if (n === "root0" || (geo.index && geo.index.count === 365040)) {
                geo.clearGroups();
                geo.addGroup(0, 151161, 0);     // 0: Vest (Navy)
                geo.addGroup(151161, 126285, 1); // 1: Thobe (Turban, sleeves, placket)
                geo.addGroup(277446, 68196, 2);  // 2: Skin (Face, head, neck)
                geo.addGroup(345642, 17847, 3);  // 3: Gold (Star badge, tassel)
                geo.addGroup(363489, 1551, 4);   // 4: Hair (Mustache, eyebrows)
                mat = [matVest, matThobe, matSkin, matGold, matHair];
              } else {
                mat = matThobe;
              }

              var sm = new THREE.SkinnedMesh(geo, mat);
              sm.castShadow = true;
              sm.receiveShadow = true;
              sm.frustumCulled = false;
              root.add(sm);
              sm.bind(skel);
            }

            S.root = root;
            S.bones = bones;
            S.skel = skel;
            S.loaded = true;
            S.parts = flat.length;
            resolve(root);
          } catch (e) { reject(e); }
        }, undefined, reject);
      });
    }

    function lrp(cur, target, k) { return cur + (target - cur) * k; }

    function pose(p) {
      if (!S.loaded) return;
      var dt = Math.min(p.dt || 0.016, 0.05);
      var k = Math.min(1, dt * 14);
      S.t += dt;
      var ph = p.phase || (S.t * 5);
      var sw = Math.sin(ph), cw = Math.cos(ph);
      var amp = p.sprint ? 0.75 : 0.55;
      var mv = p.moving ? 1 : 0;
      var idle = Math.sin(S.t * 2.0) * 0.03;

      var tgt = {
        hipsY: mv ? -Math.abs(cw) * 0.03 * (0.6 + amp) : idle * 0.3,
        hipsRotY: mv ? sw * 0.08 : 0,
        torsoY: mv ? -sw * 0.12 : idle * 0.2,
        torsoX: mv ? 0.04 : 0,
        headY: mv ? sw * 0.05 : idle * 0.5,
        headX: 0,
        armLX: mv ? -sw * amp * 0.75 : idle * 0.4,
        armRX: mv ? sw * amp * 0.75 : -idle * 0.4,
        armLZ: 0.06,
        armRZ: -0.06,
        legLX: mv ? sw * amp : 0,
        legRX: mv ? -sw * amp : 0,
        shinLX: mv ? Math.max(0, -cw) * amp * 1.3 + 0.04 : 0.02,
        shinRX: mv ? Math.max(0, cw) * amp * 1.3 + 0.04 : 0.02,
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

    return { load: load, pose: pose, state: S, height: 1.905, bones: B };
  }

  window.InspectorRig = { create: createRig };
})();
