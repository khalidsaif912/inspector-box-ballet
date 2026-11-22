/* ===== عامل المستودع (Mixamo): مجسّم بهيكل عظمي + حركات حقيقية مسجّلة =====
   الملف game/models/mixamo-worker.glb يضم الشخصية وخمس حركات "In Place":
   idle · jog · run · carry_idle · carry_jog. اللعبة تحرّك الجسم، وهنا نختار الحركة
   ونمزج بينها بسلاسة ونضبط سرعة تشغيلها على سرعة المشي الفعلية فلا تنزلق القدمان. */
(function () {
  "use strict";

  var TARGET_H = 3.1;   // قامة الشخصية: متناسبة مع الرافعة والطرود والرفوف
  // سرعة اللعبة (وحدة/ث) التي تطابق كل حركة عند سرعة تشغيل 1.0
  var NATURAL = { jog: 7.05, run: 9.55, carry_jog: 5.35 };   // سرعات الحركة الأصلية × (3.1/3.6) لأن الجسم أصغر
  var FADE = 0.22;

  function load(url, onProgress) {
    return new Promise(function (resolve, reject) {
      if (!THREE.GLTFLoader) return reject(new Error('GLTFLoader missing'));
      new THREE.GLTFLoader().load(url, function (gltf) {
        try {
          var model = gltf.scene;
          model.traverse(function (o) {
            if (o.isMesh || o.isSkinnedMesh) {
              o.castShadow = true;
              o.frustumCulled = false;
              var mats = [].concat(o.material);
              // أغلب الأجزاء تتشارك مادة واحدة (خامة الجسم)، فلا نلوّن جزءاً بعينه هنا
              mats.forEach(function (m) {
                if ('metalness' in m) m.metalness = 0;
                if ('roughness' in m) m.roughness = 0.75;
                if (m.emissive) m.emissive.setHex(0x000000);
                if (m.map && m.color) m.color.setHex(0xffffff);   // FBX يصدّر لوناً رمادياً 0.8 يعتّم الخامة
                if (/Eyelashes|Hair/.test(o.name)) { m.alphaTest = 0.4; m.side = THREE.DoubleSide; }
                m.needsUpdate = true;
              });
            }
          });
          /* ألوان الملابس: الأجزاء تتشارك خامة الجسم، فنعطي كل قطعة نسخة مادة خاصة تستبدل
             لون الخامة باللون المطلوب مع إبقاء ظلال الطيّات (من سطوع الخامة) وخريطة التضاريس.
             القيم بالفضاء الخطي: قميص أبيض · بنطال كحلي · حذاء أسود. */
          var OUTFIT = [
            { re: /Shirt/, rgb: '0.86, 0.86, 0.86', lo: 0.72, rough: 0.85 },
            { re: /Pants/, rgb: '0.0065, 0.010, 0.032', lo: 0.6, rough: 0.9 },
            { re: /Boots/, rgb: '0.018, 0.018, 0.02', lo: 0.55, rough: 0.42 }
          ];
          model.traverse(function (o) {
            if (!o.isMesh) return;
            OUTFIT.forEach(function (c, i) {
              if (!c.re.test(o.name)) return;
              var m = o.material.clone();
              m.color.setHex(0xffffff); m.roughness = c.rough;
              m.onBeforeCompile = function (sh) {
                sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', [
                  '#ifdef USE_MAP',
                  '  vec4 texelColor = mapTexelToLinear( texture2D( map, vUv ) );',
                  '  float lum = dot( texelColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );',
                  '  diffuseColor.rgb *= vec3( ' + c.rgb + ' ) * ( ' + c.lo + ' + ' + (1 - c.lo).toFixed(2) + ' * smoothstep( 0.0, 0.06, lum ) );',
                  '#endif'
                ].join('\n'));
              };
              m.customProgramCacheKey = function () { return 'outfit-' + i; };
              o.material = m;
            });
          });
          model.updateMatrixWorld(true);
          var box = new THREE.Box3().setFromObject(model);
          var h = Math.max(0.1, box.max.y - box.min.y), sc = TARGET_H / h;
          model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
          var root = new THREE.Group();
          root.scale.setScalar(sc);
          root.add(model);
          root.updateMatrixWorld(true);

          var mixer = new THREE.AnimationMixer(model);
          var actions = {};
          (gltf.animations || []).forEach(function (clip) {
            // نُبقي الحركة في مكانها: نزيل أي إزاحة أفقية للحوض قد تبقى في المقطع
            clip.tracks.forEach(function (t) {
              if (/Hips\.position$/.test(t.name)) {
                var v = t.values, x0 = v[0], z0 = v[2];
                for (var i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
              }
            });
            var a = mixer.clipAction(clip);
            a.enabled = true; a.setEffectiveWeight(0); a.play();
            actions[clip.name] = a;
          });
          if (!actions.idle) throw new Error('mixamo-worker.glb: idle clip missing');

          /* وضع الجلوس (قيادة الرافعة): نُبقي حركة الوقوف الحيّة ثم نلوي الفخذين والركبتين والذراعين فوقها.
             الزوايا قابلة للضبط من اللعبة عبر inst.sitCfg. */
          var sb = {};
          model.traverse(function (o) {
            var m = /(Left|Right)(UpLeg|Leg|Foot|Arm|ForeArm|Hand)$/.exec(o.name);
            if (m && o.isBone) sb[m[1] + m[2]] = o;
          });
          var AX = new THREE.Vector3(1, 0, 0), qs = new THREE.Quaternion();
          var sitCfg = { thigh: -1.5, knee: 1.5, foot: -0.1, arm: 1.2, fore: -0.6, armAxis: [0, 0, 1], foreAxis: [0, 1, 0], armIn: 0.8, armInAxis: [0, 1, 0], foreIn: 0, foreInAxis: [0, 0, 1] };
          function turn(b, ang, ax) { if (b) { qs.setFromAxisAngle(ax ? new THREE.Vector3(ax[0], ax[1], ax[2]) : AX, ang); b.quaternion.multiply(qs); } }
          function applySit() {
            ['Left', 'Right'].forEach(function (h) {
              turn(sb[h + 'UpLeg'], sitCfg.thigh); turn(sb[h + 'Leg'], sitCfg.knee); turn(sb[h + 'Foot'], sitCfg.foot);
              var sg = h === 'Left' ? 1 : -1;
              turn(sb[h + 'Arm'], sg * sitCfg.arm, sitCfg.armAxis); if (sitCfg.armIn) turn(sb[h + 'Arm'], sg * sitCfg.armIn, sitCfg.armInAxis); if (sitCfg.foreIn) turn(sb[h + 'ForeArm'], sg * sitCfg.foreIn, sitCfg.foreInAxis); turn(sb[h + 'ForeArm'], sg * sitCfg.fore, sitCfg.foreAxis);
            });
          }
          var cur = 'idle';
          actions.idle.setEffectiveWeight(1);
          // ارتفاع الحوض الفعلي (بعد المقياس) ليُوضع الحوض على وسادة المقعد بدقة
          var hipsB = null; model.traverse(function (o) { if (/Hips$/.test(o.name) && o.isBone) hipsB = o; });
          var hipsH = 0;
          if (hipsB) { mixer.update(0); root.updateMatrixWorld(true); hipsH = hipsB.getWorldPosition(new THREE.Vector3()).y; }
          var handL = null, handR = null;
          model.traverse(function (o) {
            if (/LeftHand$/.test(o.name)) handL = o;
            if (/RightHand$/.test(o.name)) handR = o;
          });
          var hv = new THREE.Vector3();

          function want(p) {
            var moving = p.moving && (p.speed || 0) > 0.6;
            if (p.sit) return 'idle';
            if (p.held) return moving && actions.carry_jog ? 'carry_jog' : (actions.carry_idle ? 'carry_idle' : 'idle');
            if (!moving) return 'idle';
            if (p.sprint && actions.run) return 'run';
            return actions.jog ? 'jog' : 'idle';
          }

          var inst = {
            root: root, height: TARGET_H, sitCfg: sitCfg, hipsHeight: hipsH,
            holdPoint: function (out) {
              if (!handL || !handR) return null;
              if (!out) out = new THREE.Vector3();
              handL.getWorldPosition(out); handR.getWorldPosition(hv);
              return out.add(hv).multiplyScalar(0.5);
            },
            pose: function (p) {
              var dt = Math.min(p.dt || 0.016, 0.05);
              var next = want(p);
              if (next !== cur) {
                var from = actions[cur], to = actions[next];
                to.reset(); to.setEffectiveWeight(1);
                // الدورة الجديدة تبدأ من نفس موضع القدم تقريباً لتفادي التعثر عند الانتقال جري↔هرولة
                if (from && NATURAL[cur] && NATURAL[next]) to.time = (from.time / from.getClip().duration) * to.getClip().duration;
                to.crossFadeFrom(from, FADE, true);
                cur = next;
              }
              var a = actions[cur];
              a.setEffectiveTimeScale(NATURAL[cur] ? Math.max(0.55, Math.min(1.6, (p.speed || NATURAL[cur]) / NATURAL[cur])) : 1);
              mixer.update(dt);
              if (p.sit) applySit();
            }
          };
          resolve(inst);
        } catch (e) { reject(e); }
      }, onProgress, reject);
    });
  }

  /* ===== المفتش (Mixamo): نفس مجسّم المفتش بعد ترقيمه آلياً + حركات مسجّلة =====
     الملف game/models/inspector-mx.glb: walk · idle · look_down · look_around · thumbs · head_no.
     واجهة pose({dt, mode, moving}) نفسها التي تستعملها اللعبة مع المفتش القديم. */
  var INSP_H = 2.92;   // ارتفاع المفتش المحلي؛ مجموعة المفتش في اللعبة بمقياس 1.08 فتصير قامته ≈ 3.15
  var INSP_CLIP = { walk: 'walk', idle: 'idle', inspect: 'look_down', verdict_pause: 'head_no', cao_inspect: 'look_around', cao_approved: 'thumbs', cao_rejected: 'head_no' };
  function createInspector() {
    var S = { mixer: null, actions: {}, cur: null, loaded: false, root: null };
    function load(url) {
      return new Promise(function (resolve, reject) {
        if (!THREE.GLTFLoader) return reject(new Error('GLTFLoader missing'));
        new THREE.GLTFLoader().load(url, function (gltf) {
          try {
            var model = gltf.scene;
            model.traverse(function (o) {
              if (o.isMesh || o.isSkinnedMesh) {
                o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
                var m = [].concat(o.material)[0];
                if (m && m.map) { m.map.magFilter = THREE.NearestFilter; m.map.minFilter = THREE.NearestFilter; m.map.generateMipmaps = false; m.map.needsUpdate = true; }
                var sm = new THREE.MeshStandardMaterial({ map: m && m.map || null, color: 0xffffff, roughness: 0.72, metalness: 0.02 });
                if (sm.map) sm.map.encoding = THREE.sRGBEncoding;
                o.material = sm;
              }
            });
            model.updateMatrixWorld(true);
            var box = new THREE.Box3().setFromObject(model);
            var h = Math.max(0.1, box.max.y - box.min.y), sc = INSP_H / h;
            model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
            var root = new THREE.Group();
            root.scale.setScalar(sc);
            root.add(model);
            root.updateMatrixWorld(true);
            var mixer = new THREE.AnimationMixer(model);
            (gltf.animations || []).forEach(function (clip) {
              clip.tracks.forEach(function (t) {
                if (/Hips\.position$/.test(t.name)) { var v = t.values, x0 = v[0], z0 = v[2]; for (var i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } }
              });
              var a = mixer.clipAction(clip);
              a.enabled = true; a.setEffectiveWeight(0); a.play();
              S.actions[clip.name] = a;
            });
            if (!S.actions.idle) throw new Error('inspector-mx.glb: idle clip missing');
            S.mixer = mixer; S.cur = 'idle'; S.actions.idle.setEffectiveWeight(1);
            S.root = root; S.loaded = true;
            resolve(root);
          } catch (e) { reject(e); }
        }, undefined, reject);
      });
    }
    function pose(p) {
      if (!S.loaded) return;
      var dt = Math.min(p.dt || 0.016, 0.05);
      var mode = p.mode || (p.moving ? 'walk' : 'idle');
      var next = INSP_CLIP[mode] || 'idle';
      if (!S.actions[next]) next = 'idle';
      if (next !== S.cur) {
        var from = S.actions[S.cur], to = S.actions[next];
        to.reset(); to.setEffectiveWeight(1); to.crossFadeFrom(from, 0.25, true);
        S.cur = next;
      }
      S.actions[S.cur].setEffectiveTimeScale(S.cur === 'walk' ? (p.speed ? p.speed / 2.5 : 1.4) : 1);
      S.mixer.update(dt);
    }
    return { load: load, pose: pose };
  }

  window.MixamoWorker = { load: load, height: TARGET_H };
  window.MixamoInspector = { create: createInspector };
})();
