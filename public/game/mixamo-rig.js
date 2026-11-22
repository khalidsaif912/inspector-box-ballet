/* ===== عامل المستودع (Mixamo): مجسّم بهيكل عظمي + حركات حقيقية مسجّلة =====
   الملف game/models/mixamo-worker.glb يضم الشخصية وخمس حركات "In Place":
   idle · jog · run · carry_idle · carry_jog. اللعبة تحرّك الجسم، وهنا نختار الحركة
   ونمزج بينها بسلاسة ونضبط سرعة تشغيلها على سرعة المشي الفعلية فلا تنزلق القدمان. */
(function () {
  "use strict";

  var TARGET_H = 3.6;
  // سرعة اللعبة (وحدة/ث) التي تطابق كل حركة عند سرعة تشغيل 1.0
  var NATURAL = { jog: 8.2, run: 11.1, carry_jog: 6.2 };
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

          var cur = 'idle';
          actions.idle.setEffectiveWeight(1);
          var handL = null, handR = null;
          model.traverse(function (o) {
            if (/LeftHand$/.test(o.name)) handL = o;
            if (/RightHand$/.test(o.name)) handR = o;
          });
          var hv = new THREE.Vector3();

          function want(p) {
            var moving = p.moving && (p.speed || 0) > 0.6;
            if (p.held) return moving && actions.carry_jog ? 'carry_jog' : (actions.carry_idle ? 'carry_idle' : 'idle');
            if (!moving) return 'idle';
            if (p.sprint && actions.run) return 'run';
            return actions.jog ? 'jog' : 'idle';
          }

          var inst = {
            root: root, height: TARGET_H,
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
            }
          };
          resolve(inst);
        } catch (e) { reject(e); }
      }, onProgress, reject);
    });
  }

  window.MixamoWorker = { load: load, height: TARGET_H };
})();
