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
     الملف game/models/inspector-mx.glb: walk · idle · look_down · thumbs · head_no.
     واجهة pose({dt, mode, moving}) نفسها التي تستعملها اللعبة مع المفتش القديم. */
  var INSP_ARM_K = 0;   // المجسّم الحالي يحمل أوزاناً صحيحة للذراعين فلا حاجة لإمالتهما؛ تبقى القيمة للتجارب (window.__armk)
  var INSP_H = 3.15;   // ارتفاع المفتش المحلي؛ مجموعة المفتش في اللعبة بمقياس 1.08 فتصير قامته ≈ 3.40 (أطول قليلاً من العامل)
  var INSP_CLIP = { walk: 'walk', idle: 'idle', inspect: 'look_down', verdict_pause: 'head_no', cao_inspect: 'idle', cao_approved: 'thumbs', cao_rejected: 'head_no' };
  /* ===== طبقة ترميم المفتش (قابلة للعكس: ملف GLB الأصلي لا يُمس) =====
     خامة المجسّم صورة أمامية واحدة + ألوان مسطّحة للخلف، فكان الظهر ومؤخرة الرأس ممسوحين وبحواف مسنّنة.
     inspector-resto.jpg لوحتان بنفس إطار الإسقاط: [يسار] الواجهة الأصلية بعد إزالة هالة الخلفية،
     [يمين] ظهر مُعاد بناؤه من نسيج القطعة نفسها (كمّة، شعر قصير، رقبة، ياقة، فست بشريطيه العاكسين، ثوب).
     في المُظلّل نُسقط اللوحتين على وضع الربط (bind pose) ونمزج بينهما حسب اتجاه السطح فتختفي الحواف المسنّنة.
     الذراعان والقدمان خارج نطاق الترميم وتبقى خامتهما الأصلية. */
  var RESTO_GLSL = [
    '#ifdef USE_MAP',
    '  vec4 texelColor = mapTexelToLinear( texture2D( map, vUv ) );',
    '  float rCore = max( 1.0 - smoothstep( 0.98, 1.06, vRP.y ), 1.0 - smoothstep( 0.28, 0.32, abs( vRP.x ) ) );',
    '  rCore *= smoothstep( 0.13, 0.17, vRP.y ) * restoOn;',
    '  vec2 rUV = vec2( clamp( ( 0.576440943 * vRP.x + 0.47269741 ) * 992.0, 0.5, 929.5 ) / 1860.0, 0.49804966 * vRP.y + 0.01822525 );',
    // الرقع الرفيعة المرئية من حافتها تختار mipmap خشناً جداً (متوسط رمادي)؛ نقيّد التدرّج بستة تكسلات للبكسل
    '#if __VERSION__ >= 300',
    '  vec2 rGx = dFdx( rUV ), rGy = dFdy( rUV );',
    '  rGx *= min( 1.0, 0.0052 / max( length( rGx ), 1e-7 ) ); rGy *= min( 1.0, 0.0052 / max( length( rGy ), 1e-7 ) );',
    '  vec4 rF = mapTexelToLinear( textureGrad( restoMap, rUV, rGx, rGy ) );',
    '  vec4 rB = mapTexelToLinear( textureGrad( restoMap, rUV + vec2( 0.5, 0.0 ), rGx, rGy ) );',
    '#else',
    '  vec4 rF = mapTexelToLinear( texture2D( restoMap, rUV ) );',
    '  vec4 rB = mapTexelToLinear( texture2D( restoMap, rUV + vec2( 0.5, 0.0 ) ) );',
    '#endif',
    // أمام/خلف حسب موضع النقطة من محور الجسم (مركز العمق ≈ 0، و−0.02 عند الرأس): حواف الشقوق المائلة لا تلتقط لون الظهر
    '  float wF = smoothstep( -0.06, 0.06, vRP.z + 0.02 * smoothstep( 1.3, 1.45, vRP.y ) );',
    // الوجه الداخلي (المرئي عبر شق) يأخذ لون الجهة التي تنظر منها الكاميرا فيذوب في محيطه
    '  if ( ! gl_FrontFacing ) wF = restoCam;',
    '  texelColor = mix( texelColor, mix( rB, rF, wF ), rCore );',
    '  diffuseColor *= texelColor;',
    '#endif'
  ].join('\n');
  function restoreMaterial(sm, uniforms) {
    sm.onBeforeCompile = function (sh) {
      sh.uniforms.restoMap = uniforms.restoMap; sh.uniforms.restoOn = uniforms.restoOn; sh.uniforms.restoCam = uniforms.restoCam;
      sh.vertexShader = 'varying vec3 vRP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRP = position;');
      sh.fragmentShader = 'uniform sampler2D restoMap;\nuniform float restoOn;\nuniform float restoCam;\nvarying vec3 vRP;\n' + sh.fragmentShader.replace('#include <map_fragment>', RESTO_GLSL);
    };
    sm.customProgramCacheKey = function () { return 'inspector-resto'; };
  }
  function loadResto(url) {
    return new Promise(function (resolve) {
      new THREE.TextureLoader().load(url, function (t) {
        t.flipY = false; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
        resolve(t);
      }, undefined, function () { resolve(null); });   // إن تعذّر التحميل يبقى المجسّم بخامته الأصلية
    });
  }

  function createInspector() {
    var S = { mixer: null, actions: {}, cur: null, loaded: false, root: null, armL: null, armR: null, foreL: null, foreR: null };
    var vA = new THREE.Vector3(), vB = new THREE.Vector3(), vD = new THREE.Vector3(), vT = new THREE.Vector3(), vDown = new THREE.Vector3(0, -1, 0), qW = new THREE.Quaternion(), qA = new THREE.Quaternion(), qP = new THREE.Quaternion();
    function load(url) {
      var restoP = loadResto(url.replace(/[^/]*$/, 'inspector-resto.jpg'));
      return new Promise(function (resolve, reject) {
        if (!THREE.GLTFLoader) return reject(new Error('GLTFLoader missing'));
        new THREE.GLTFLoader().load(url, function (gltf) {
          restoP.then(function (restoTex) {
          try {
            var model = gltf.scene;
            var RU = { restoMap: { value: restoTex }, restoOn: { value: restoTex ? 1 : 0 }, restoCam: { value: 1 } };
            var camL = new THREE.Vector3();
            // جهة الكاميرا في فضاء المجسّم: 1 أمامه، 0 خلفه (تُحدَّث قبل كل رسم)
            function camSide(r, sc, cam) { camL.setFromMatrixPosition(cam.matrixWorld); this.worldToLocal(camL); camL.y -= 1.0; RU.restoCam.value = THREE.MathUtils.smoothstep(camL.z / Math.max(camL.length(), 1e-4), -0.25, 0.25); }
            S.resto = RU;
            model.traverse(function (o) {
              if (o.isMesh || o.isSkinnedMesh) {
                o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
                var m = [].concat(o.material)[0];
                if (m && m.map) { m.map.anisotropy = 4; m.map.needsUpdate = true; }
                var sm = new THREE.MeshStandardMaterial({ map: m && m.map || null, color: 0xffffff, roughness: 0.72, metalness: 0.02, skinning: !!o.isSkinnedMesh });   // r128 يحتاج skinning:true وإلا يبقى الجسم ثابتاً
                if (sm.map) sm.map.encoding = THREE.sRGBEncoding;
                // الشبكة المصدر (بعد تخفيضها) فيها شقوق دقيقة بين الرقع؛ إظهار الوجه الداخلي وتلوينه بلون الموضع نفسه يملؤها بصرياً
                if (sm.map && restoTex) { restoreMaterial(sm, RU); sm.side = THREE.DoubleSide; o.onBeforeRender = camSide; }
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
            model.traverse(function (o) { if (o.name === 'mixamorigLeftArm') S.armL = o; if (o.name === 'mixamorigRightArm') S.armR = o; if (o.name === 'mixamorigLeftForeArm') S.foreL = o; if (o.name === 'mixamorigRightForeArm') S.foreR = o; });
            S.root = root; S.loaded = true;
            resolve(root);
          } catch (e) { reject(e); }
          });
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
      // المجسّم رُقّم بوضع A (ذراعان مفتوحتان قليلاً) فتبقى الذراعان بعيدتين عن الجسم: نُميل كل ذراع نحو الأسفل
      // في الفضاء العالمي (مستقلاً عن محاور العظام) بمقدار يتناسب مع الحركة الحالية.
      var k = window.__armk !== undefined ? window.__armk : (S.cur === 'walk' || S.cur === 'idle' || S.cur === 'head_no' ? INSP_ARM_K : INSP_ARM_K * 0.45);
      if (S.armL && k) { S.root.updateMatrixWorld(true); lowerArm(S.armL, S.foreL, k); lowerArm(S.armR, S.foreR, k); }
    }
    function lowerArm(arm, fore, k) {
      arm.getWorldPosition(vA); fore.getWorldPosition(vB);
      vD.subVectors(vB, vA); if (vD.lengthSq() < 1e-8) return; vD.normalize();
      vT.copy(vD).lerp(vDown, k).normalize();
      qW.setFromUnitVectors(vD, vT);
      arm.getWorldQuaternion(qA);
      arm.parent.getWorldQuaternion(qP);
      arm.quaternion.copy(qP.invert().multiply(qW).multiply(qA));
      arm.updateMatrixWorld(true);
    }
    return { load: load, pose: pose, state: S };
  }

  window.MixamoWorker = { load: load, height: TARGET_H };
  window.MixamoInspector = { create: createInspector };
})();
