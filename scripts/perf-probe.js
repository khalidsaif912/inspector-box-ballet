/*
 * مستكشف أداء للعبة Inspector Box Ballet (Three.js r128).
 * لا يُنشر: موجود خارج public/ ولا يُحمَّل من الصفحة.
 *
 * الاستخدام اليدوي:
 *   1) npm run dev -- --port 5183 --strictPort
 *   2) افتح http://localhost:5183/game.html
 *   3) الصق محتوى هذا الملف في الكونسول ثم:
 *        __perfProbe()            // قياس واحد بعد إطار
 *        await __perfProbe.fps()  // متوسط الإطارات خلال ثانيتين
 *
 * الاستخدام الآلي: يُحقن عبر CDP ثم يُستدعى __perfProbe().
 * كل القيم مقروءة من renderer.info أو من اجتياز المشهد — لا أرقام مقدّرة.
 */
(function installPerfProbe(root) {
  function sceneCounts(scene) {
    const counts = {
      meshes: 0,
      visibleMeshes: 0,
      shadowCasters: 0,
      shadowReceivers: 0,
      geometries: new Set(),
      materials: new Set(),
      instanced: 0,
    };
    scene.traverse(function (o) {
      if (o.isMesh || o.isInstancedMesh) {
        counts.meshes++;
        if (o.visible) counts.visibleMeshes++;
        if (o.castShadow) counts.shadowCasters++;
        if (o.receiveShadow) counts.shadowReceivers++;
        if (o.isInstancedMesh) counts.instanced++;
        if (o.geometry) counts.geometries.add(o.geometry.uuid);
        if (o.material) {
          const list = Array.isArray(o.material) ? o.material : [o.material];
          list.forEach(function (m) {
            counts.materials.add(m.uuid);
          });
        }
      }
    });
    return counts;
  }

  function lightCounts(scene) {
    const lights = {};
    let total = 0;
    scene.traverse(function (o) {
      if (!o.isLight) return;
      total++;
      const type = o.type || "Light";
      lights[type] = (lights[type] || 0) + 1;
    });
    return { total: total, byType: lights };
  }

  function probe() {
    if (typeof R === "undefined" || typeof S === "undefined") {
      return { error: "renderer/scene not found — is game.js loaded?" };
    }
    const info = R.info;
    const scene = sceneCounts(S);
    const lights = lightCounts(S);
    return {
      when: new Date().toISOString(),
      render: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        lines: info.render.lines,
        points: info.render.points,
        frame: info.render.frame,
      },
      memory: {
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs ? info.programs.length : null,
      },
      scene: {
        meshes: scene.meshes,
        visibleMeshes: scene.visibleMeshes,
        instanced: scene.instanced,
        shadowCasters: scene.shadowCasters,
        shadowReceivers: scene.shadowReceivers,
        uniqueGeometries: scene.geometries.size,
        uniqueMaterials: scene.materials.size,
        lights: lights.total,
        lightsByType: lights.byType,
      },
      game: {
        stage: typeof stage === "undefined" ? null : stage,
        running: typeof run === "undefined" ? null : run,
        liveItems: typeof items === "undefined" ? null : items.length,
        drawRange: R.getDrawingBufferSize
          ? (function () {
              const v = R.getDrawingBufferSize(new (window.THREE ? THREE.Vector2 : Object)());
              return v && v.x !== undefined ? v.x + "x" + v.y : null;
            })()
          : null,
      },
    };
  }

  probe.fps = function fpsProbe(ms) {
    const duration = ms || 2000;
    return new Promise(function (resolve) {
      let frames = 0;
      const start = performance.now();
      function tick() {
        frames++;
        if (performance.now() - start < duration) requestAnimationFrame(tick);
        else {
          const seconds = (performance.now() - start) / 1000;
          resolve({
            frames: frames,
            seconds: +seconds.toFixed(2),
            fps: +(frames / seconds).toFixed(1),
          });
        }
      }
      requestAnimationFrame(tick);
    });
  };

  root.__perfProbe = probe;
})(typeof window !== "undefined" ? window : globalThis);
