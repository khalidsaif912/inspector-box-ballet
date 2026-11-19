/* ===== محرّك وقوف/مشي لشخصية GLB مجهّزة بهيكل عظمي =====
   تختلف عن crew-rig.js: هذا القالب يملك عظاماً فعلياً (52 عظماً) واستخدم
   في عرض مستقل. نعيد استخدام تحريك العظام نفسه ونكيّفه مع مقياس المستودع. */
(function () {
  "use strict";

  var TARGET_H = 3.6;
  var BONES = ['LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot',
    'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'Hips', 'Spine', 'Spine1',
    'Spine2', 'Neck', 'Head'];

  var X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  var q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();

  function makeRig(model) {
    var bones = {}, rest = {}, pw = {}, low = {};
    BONES.forEach(function (n) {
      var b = model.getObjectByName(n);
      if (!b) return;
      bones[n] = b;
      rest[n] = b.quaternion.clone();
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
      low[s] = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(o * 0.12, -1, 0).normalize());
    });

    function pose(n, qw) {
      var b = bones[n];
      if (!b) return;
      b.quaternion.copy(pw[n]).invert().multiply(qw).multiply(pw[n]).multiply(rest[n]);
    }

    // cw = ثقل الحمل: يوقف تأرجح الذراعين ويرفعهما للأمام
    function applyPose(ph, k, idle, cw) {
      var A = 0.40 * Math.pow(k, 0.6) * (1 - 0.2 * cw), Aa = 0.30 * Math.pow(k, 0.6) * (1 - cw);
      var s = Math.sin(ph), ax = function (v) { return q1.setFromAxisAngle(X, v); };
      var adj = legAng * 0.8 * Math.min(1, k * 1.5), fL = -legSgn * adj, fR = legSgn * adj;
      var rz = function (v) { return q2.setFromAxisAngle(Z, v); };
      var thL = A * s, thR = -A * s, fl = function (x) { return Math.pow(Math.max(0, x), 1.4); };
      var knL = k * (0.08 + 0.55 * fl(-Math.cos(ph + 0.35)));
      var knR = k * (0.08 + 0.55 * fl(Math.cos(ph + 0.35)));
      pose('LeftUpLeg', ax(thL).multiply(rz(fL)));
      pose('RightUpLeg', ax(thR).multiply(rz(fR)));
      pose('LeftLeg', ax(knL));
      pose('RightLeg', ax(knR));
      pose('LeftFoot', ax(-0.6 * (thL + knL)).multiply(rz(-fL)));
      pose('RightFoot', ax(-0.6 * (thR + knR)).multiply(rz(-fR)));
      var aL = -Aa * s, aR = Aa * s, fa = function (v) { return -0.25 - k * 0.3 * Math.max(0, -v) / 0.3; };
      pose('LeftArm', ax(aL + idle - 0.95 * cw).multiply(low.Left));
      pose('RightArm', ax(aR - idle - 0.95 * cw).multiply(low.Right));
      pose('LeftForeArm', ax(fa(aL) - 0.5 * cw));
      pose('RightForeArm', ax(fa(aR) - 0.5 * cw));
      var ln = 0.05 * k - 0.07 * cw, tw = k * s * (1 - cw);
      pose('Hips', q1.setFromAxisAngle(Y, 0.06 * tw));
      pose('Spine', q1.setFromAxisAngle(Y, -0.05 * tw).multiply(q2.setFromAxisAngle(X, 0.4 * ln)));
      pose('Spine1', q1.setFromAxisAngle(Y, -0.04 * tw).multiply(q2.setFromAxisAngle(X, 0.35 * ln)));
      pose('Spine2', q1.setFromAxisAngle(Y, -0.04 * tw).multiply(q2.setFromAxisAngle(X, 0.25 * ln)));
      pose('Neck', ax(-0.3 * ln));
      pose('Head', ax(-0.3 * ln));
    }

    return { bones: bones, pose: applyPose };
  }

  function load(url) {
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

          var rig = makeRig(model);
          var handL = model.getObjectByName('LeftHand'), handR = model.getObjectByName('RightHand');
          var hv = new THREE.Vector3();
          var st = { t: 0, k: 0 };
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
              st.k += ((p.moving ? 1 : 0) - st.k) * Math.min(1, dt * 10);
              rig.pose(p.phase || 0, Math.min(1.15, st.k * (p.sprint ? 1.18 : 1)),
                Math.sin(st.t * 1.8) * 0.03 * (1 - st.k), p.held ? 1 : 0);
            }
          };
          resolve(inst);
        } catch (e) { reject(e); }
      }, undefined, reject);
    });
  }

  window.Character3D = { load: load, height: TARGET_H };
})();
