/* ===== محرّك وقوف/مشي لشخصية GLB مجهّزة بهيكل عظمي =====
   تختلف عن crew-rig.js: هذا القالب يملك عظاماً فعلياً (52 عظماً) واستخدم
   في عرض مستقل. نعيد استخدام تحريك العظام نفسه ونكيّفه مع مقياس المستودع. */
(function () {
  "use strict";

  var TARGET_H = 3.6;
  var BONES = ['LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot',
    'LeftToeBase', 'RightToeBase', 'LeftShoulder', 'RightShoulder',
    'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand',
    'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'];

  var X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  var q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion(), qI = new THREE.Quaternion();

  function makeRig(model) {
    var bones = {}, rest = {}, pw = {}, low = {}, restPos = {};
    BONES.forEach(function (n) {
      var b = model.getObjectByName(n);
      if (!b) return;
      bones[n] = b;
      rest[n] = b.quaternion.clone();
      restPos[n] = b.position.clone();
      pw[n] = b.parent.getWorldQuaternion(new THREE.Quaternion());
    });

    var wp = function (n) { return model.getObjectByName(n).getWorldPosition(new THREE.Vector3()); };
    var legAng = 0, legSgn = 1;
    if (bones.LeftUpLeg && bones.LeftFoot) {
      var lh = wp('LeftUpLeg'), lf = wp('LeftFoot');
      legAng = Math.atan2(Math.abs(lf.x - lh.x), lh.y - lf.y);
      legSgn = Math.sign(lh.x) || 1;
    }
    ['Left', 'Right'].forEach(function (s) {
      if (!bones[s + 'Arm'] || !bones[s + 'ForeArm']) return;
      var a = wp(s + 'Arm'), d = wp(s + 'ForeArm').sub(a).normalize(), o = Math.sign(a.x) || 1;
      low[s] = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(o * 0.16, -1, 0).normalize());
    });

    function pose(n, qw) {
      var b = bones[n];
      if (!b) return;
      b.quaternion.copy(pw[n]).invert().multiply(qw).multiply(pw[n]).multiply(rest[n]);
    }
    function qx(v) { return new THREE.Quaternion().setFromAxisAngle(X, v); }
    function qy(v) { return new THREE.Quaternion().setFromAxisAngle(Y, v); }
    function qz(v) { return new THREE.Quaternion().setFromAxisAngle(Z, v); }
    function fl(x, e) { return Math.pow(Math.max(0, x), e || 1.4); }

    /* ph طور الخطوة · k شدة الحركة (0 وقوف، 1 مشي) · t زمن للخمول
       cw ثقل الحمل · run مزج الجري · lift قرفصاء الالتقاط (0..1) */
    /* jog: مزج المشي (0) بالهرولة الخفيفة (1) حسب السرعة الفعلية؛ run: الجري السريع (Shift) فوقها.
       اصطلاح الطور: الساق اليسرى في منتصف الارتكاز عند ph=0 وفي منتصف الأرجحة عند ph=π. */
    function applyPose(ph, k, t, cw, run, lift, jog) {
      var mk = Math.min(1, k), sk = Math.pow(mk, 0.6);
      var s = Math.sin(ph), c = Math.cos(ph);
      var still = 1 - mk;
      run = run * mk;
      var j = Math.max(jog || 0, run) * mk * (1 - cw);        // الحمل يفرض مشياً لا هرولة

      /* ===== الساقان: أرجحة الفخذ + ثني الركبة في الأرجحة + امتصاص الصدمة في الارتكاز ===== */
      var A = (0.42 + 0.1 * j + 0.16 * run) * sk * (1 - 0.2 * cw);
      var adj = legAng * (0.5 + 0.2 * Math.min(1, k * 1.5));        // تضييق الوقفة بدل A-pose العريضة
      var fL = -legSgn * adj, fR = legSgn * adj;
      var thL = A * s, thR = -A * s;
      var kAmp = 0.72 + 0.5 * j + 0.4 * run;                  // رفع الركبة: مشي → هرولة → جري
      var kSt = 0.06 + 0.3 * j;                               // انثناء الركبة الحاملة للوزن
      var knL = sk * (0.08 + kAmp * fl(-Math.cos(ph + 0.35)) + kSt * fl(c, 1.2));
      var knR = sk * (0.08 + kAmp * fl(Math.cos(ph + 0.35)) + kSt * fl(-c, 1.2));
      // الفخذ يرتفع أكثر للأمام في الأرجحة عند الهرولة (لا ساق متصلبة)
      thL -= sk * 0.22 * j * fl(-Math.cos(ph + 0.6), 1.5);
      thR -= sk * 0.22 * j * fl(Math.cos(ph + 0.6), 1.5);
      // قرفصاء الالتقاط: الفخذان للأمام والركبتان تنثنيان والجذع ينحني
      var sq = lift * (1 - 0.5 * mk);
      thL -= 0.95 * sq; thR -= 0.95 * sq; knL += 1.5 * sq; knR += 1.5 * sq;
      // انثناء خفيف للركبتين في الوقوف: وقفة حيّة لا عمود مستقيم
      knL += 0.06 * still; knR += 0.06 * still; thL -= 0.03 * still; thR -= 0.03 * still;
      pose('LeftUpLeg', qx(thL).multiply(qz(fL)));
      pose('RightUpLeg', qx(thR).multiply(qz(fR)));
      pose('LeftLeg', qx(knL));
      pose('RightLeg', qx(knR));
      // القدم توازي الأرض + نقر المشط عند الدفع ورفع المقدمة عند ملامسة الكعب
      var rollL = sk * (0.32 * fl(-s - 0.2, 1) - 0.18 * fl(s - 0.55, 1));
      var rollR = sk * (0.32 * fl(s - 0.2, 1) - 0.18 * fl(-s - 0.55, 1));
      pose('LeftFoot', qx(-(thL + knL) * 0.92 + rollL).multiply(qz(-fL)));
      pose('RightFoot', qx(-(thR + knR) * 0.92 + rollR).multiply(qz(-fR)));
      pose('LeftToeBase', qx(-1.1 * Math.max(0, rollL)));
      pose('RightToeBase', qx(-1.1 * Math.max(0, rollR)));

      /* ===== الحوض: هبوط مزدوج في كل دورة + تمايل جانبي + نقل الوزن في الوقوف ===== */
      if (bones.Hips) {
        var hp = restPos.Hips, u = hp.y;
        // المشي: أعلى نقطة فوق الساق الحاملة؛ الهرولة: أعلى نقطة في الطيران عند انفراج الساقين
        var bob = sk * (0.022 * (1 - j) - (0.03 + 0.012 * run) * j) * Math.cos(2 * ph) - (0.012 + 0.02 * j) * sk - 0.2 * sq;
        var breathe = still * 0.004 * Math.sin(t * 1.7);
        var shift = still * 0.012 * Math.sin(t * 0.45);
        bones.Hips.position.set(hp.x + u * (0.016 * sk * s * (1 - 0.5 * j) + shift), hp.y + u * (bob + breathe), hp.z);
      }
      var tw = sk * s * (1 - cw);
      pose('Hips', qy(0.12 * tw).multiply(qz(-0.05 * sk * s * (1 - run * 0.6) - still * 0.025 * Math.sin(t * 0.45))));

      /* ===== الجذع: ميل للأمام مع السرعة، لفّ معاكس للكتفين، تنفّس ===== */
      var ln = 0.04 * mk + 0.08 * j + 0.1 * run - 0.08 * cw + 0.55 * sq;
      var br = still * 0.022 * Math.sin(t * 1.7);
      pose('Spine', qy(-0.06 * tw).multiply(qx(0.38 * ln - br * 0.4)));
      pose('Spine1', qy(-0.07 * tw).multiply(qx(0.33 * ln + br)));
      pose('Spine2', qy(-0.08 * tw).multiply(qx(0.25 * ln + br * 0.6)).multiply(qz(0.03 * sk * s)));

      /* ===== الذراعان: أرجحة معاكسة للساقين، مرفق منثنٍ يزداد في الجري ===== */
      var Aa = (0.4 + 0.06 * j + 0.22 * run) * sk * (1 - cw);
      var aL = -Aa * s, aR = Aa * s;
      var elbow = 0.2 + 0.18 * mk + 0.85 * j + 0.25 * run;   // المرفق ~90° في الهرولة
      var fa = function (v) { return -(elbow + 0.35 * Math.max(0, -v) / Math.max(0.2, Aa + 0.01)) * (1 - cw); };
      var armOut = 0.05 * still + 0.03;
      var reach = 0.95 * cw + 0.75 * sq * (1 - cw);
      var idleArm = still * 0.03 * Math.sin(t * 1.7);
      pose('LeftShoulder', qz(0.04 * aL));
      pose('RightShoulder', qz(0.04 * aR));
      pose('LeftArm', qx(aL - reach + idleArm).multiply(qz(-armOut * legSgn)).multiply(low.Left || qI));
      pose('RightArm', qx(aR - reach + idleArm).multiply(qz(armOut * legSgn)).multiply(low.Right || qI));
      pose('LeftForeArm', qx(fa(aL) - 0.5 * cw - 0.15 * still));
      pose('RightForeArm', qx(fa(aR) - 0.5 * cw - 0.15 * still));
      pose('LeftHand', qx(-0.12 * mk));
      pose('RightHand', qx(-0.12 * mk));

      /* ===== الرأس: يثبت النظر للأمام (يعاكس لفّ الجذع) ويلتفت ببطء في الوقوف ===== */
      var look = still * 0.16 * Math.sin(t * 0.31) * Math.max(0, Math.sin(t * 0.13));
      pose('Neck', qy(0.06 * tw + look * 0.4).multiply(qx(-0.3 * ln)));
      pose('Head', qy(0.08 * tw + look * 0.6).multiply(qx(-0.3 * ln - 0.04 * sk * Math.cos(2 * ph))));
    }

    return { bones: bones, pose: applyPose };
  }

  /* الشعر واللحية: الخصل الرمادية في شبكة الرأس تصبح سوداء، واللحية (مقدمة أسفل الوجه)
     تُمزج قليلاً بلون البشرة فتبدو خفيفة قصيرة لا كثيفة. */
  function blackHair(o) {
    var g = o.geometry, c = g.attributes.color, p = g.attributes.position;
    if (!c || !p) return;
    g.computeBoundingBox();
    var bb = g.boundingBox;
    if (bb.min.y < 1.45) return;                         // شبكات الرأس فقط (لا خطوط السترة الرمادية)
    var arr = c.array, sz = c.itemSize, max = arr instanceof Uint8Array ? 255 : 1;
    var skin = [112 / 255, 48 / 255, 32 / 255], n = 0;
    for (var i = 0; i < c.count; i++) {
      var r = arr[i * sz] / max, gg = arr[i * sz + 1] / max, b = arr[i * sz + 2] / max;
      var hi = Math.max(r, gg, b), lo = Math.min(r, gg, b);
      var y = p.getY(i), z = p.getZ(i);
      // رمادي محايد = شعر/لحية؛ أسفل الوجه (تحت العينين) نلتقط الخصل الفاتحة جداً أيضاً
      var hiMax = y < 1.695 ? 1.01 : 0.8;
      if (hi - lo > 0.16 || hi < 0.22 || hi > hiMax) continue;
      if (b > r * 1.25) continue;                                // ليس الخوذة الزرقاء
      var v = 0.05 + (hi - 0.22) * 0.12;                         // أسود مع تدرّج خفيف يحفظ ملمس الخصل
      var beard = z > -0.04 ? Math.max(0, Math.min(1, (1.705 - y) / 0.035)) : 0;
      var mix = 0.2 * beard;
      var out = [v * 1.05, v * 0.92, v * 0.85].map(function (x, k) { return x * (1 - mix) + skin[k] * mix; });
      arr[i * sz] = out[0] * max; arr[i * sz + 1] = out[1] * max; arr[i * sz + 2] = out[2] * max;
      n++;
    }
    if (n) c.needsUpdate = true;
  }

  /* مظهر أوضح: كل جزء من المجسّم شبكة مستقلة بلون رؤوس، نميّزها باللون ونضبط خامتها */
  function polish(model) {
    model.traverse(function (o) {
      if (o.isMesh) blackHair(o);
      if (!o.isMesh || !o.geometry.attributes.color) return;
      var c = o.geometry.attributes.color, n = Math.min(c.count, 4000), r = 0, g = 0, b = 0;
      for (var i = 0; i < n; i++) { r += c.getX(i); g += c.getY(i); b += c.getZ(i); }
      r /= n; g /= n; b /= n;
      var mx = Math.max(r, g, b, 1e-6);
      if (mx > 1.01) { r /= 255; g /= 255; b /= 255; }
      var m = o.material.clone(); o.material = m;
      var lum = (r + g + b) / 3;
      if (g > 0.45 && g > b * 2.2) {                 // سترة عاكسة: لون فلوري يتوهج قليلاً
        m.roughness = 0.5; m.emissive = new THREE.Color(0x8fc400); m.emissiveIntensity = 0.12;
      } else if (b > r * 1.8 && b > 0.5) {          // خوذة: بلاستيك لامع
        m.roughness = 0.3; m.metalness = 0.05;
      } else if (lum > 0.75) {                      // قميص أبيض: قماش
        m.roughness = 0.85;
      } else if (lum < 0.03) {                      // حذاء: جلد
        m.roughness = 0.4; m.metalness = 0.12;
      } else if (lum < 0.12) {                      // بنطال عمل: قماش خشن
        m.roughness = 0.92;
      } else {                                      // بشرة
        m.roughness = 0.58;
      }
      m.needsUpdate = true;
    });
  }

  function load(url, onProgress) {
    return new Promise(function (resolve, reject) {
      if (!THREE.GLTFLoader) return reject(new Error('GLTFLoader missing'));
      new THREE.GLTFLoader().load(url, function (gltf) {
        try {
          var model = gltf.scene;
          model.traverse(function (o) {
            if (o.isMesh || o.isSkinnedMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              o.frustumCulled = false;
            }
          });
          model.updateMatrixWorld(true);
          var box = new THREE.Box3().setFromObject(model);
          var h = Math.max(0.1, box.max.y - box.min.y), sc = TARGET_H / h;
          model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
          var root = new THREE.Group();
          root.scale.setScalar(sc);
          root.add(model);
          root.updateMatrixWorld(true);

          polish(model);
          var rig = makeRig(model);
          var handL = model.getObjectByName('LeftHand'), handR = model.getObjectByName('RightHand');
          var hv = new THREE.Vector3();
          var st = { t: 0, k: 0, sp: 0, cw: 0, lf: 0, jg: 0 };
          var inst = {
            root: root, height: TARGET_H,
            /* مركز الكفّين في إحداثيات العالم: يثبّت الصندوق بين اليدين
               مهما كان طول الذراعين أو مقدار ثني الجذع. الرسغ أعلى من راحة
               الكف، والصندوق أعرض من الكف، فننزل المركز ليجلس بين الكفّين
               بدل أن يغطي الوجه. */
            holdPoint: function (out) {
              if (!handL || !handR) return null;
              if (!out) out = new THREE.Vector3();
              handL.getWorldPosition(out); handR.getWorldPosition(hv);
              return out.add(hv).multiplyScalar(0.5).setY(out.y - 0.2);
            },
            pose: function (p) {
              var dt = Math.min(p.dt || 0.016, 0.05);
              st.t += dt;
              // انتقال ناعم بين الوقوف والمشي والجري والحمل والالتقاط بدل القفز المفاجئ
              st.k += ((p.moving ? 1 : 0) - st.k) * Math.min(1, dt * 9);
              st.sp += ((p.moving && p.sprint ? 1 : 0) - st.sp) * Math.min(1, dt * 6);
              st.cw += ((p.held ? 1 : 0) - st.cw) * Math.min(1, dt * 12);
              st.lf += ((p.lift || 0) - st.lf) * Math.min(1, dt * 20);
              st.jg += (jogFor(p.speed, p.held) - st.jg) * Math.min(1, dt * 5);
              rig.pose(p.phase || 0, st.k, st.t, st.cw, st.sp, st.lf, st.jg);
            }
          };
          resolve(inst);
        } catch (e) { reject(e); }
      }, onProgress, reject);
    });
  }

  /* سرعة اللعبة (وحدة/ث) → مزج الهرولة: تحت 4 مشي، فوق 7 هرولة كاملة؛ الحمل دائماً مشي */
  function jogFor(speed, held) {
    if (held || !speed) return 0;
    return Math.max(0, Math.min(1, (speed - 4) / 3));
  }
  /* طول دورة الخطوتين بوحدات العالم: الطور يتقدم بالمسافة المقطوعة فعلاً فلا تنزلق القدمان،
     والإيقاع يبقى طبيعياً (~3 خطوات/ث في الهرولة) بدل التسارع الثابت السابق. */
  function cycleLength(speed, held, sprint) {
    var j = jogFor(speed, held);
    return (held ? 3.9 : 3.7 + 1.6 * j) + (sprint && !held ? 1.1 : 0);
  }

  window.Character3D = { load: load, height: TARGET_H, cycleLength: cycleLength };
})();
