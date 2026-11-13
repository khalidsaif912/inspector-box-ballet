(function (root) {
  const isExplosive = (division) => division === "1" || division.startsWith("1.");
  const is1_4S = (division) => division === "1.4S";
  const isLithium = (item) => item.imp === "RLI";

  // X pairs from IATA DGR Table 9.3.A (2023). Class 1 (except 1.4S) and lithium
  // batteries (UN 3480/3090) are handled separately because their rows have exceptions.
  const segregationPairs = new Set([
    "2.1+9",
    "3+5.1",
    "3+8",
    "3+9",
    "4.1+5.1",
    "4.1+9",
    "4.2+5.1",
    "4.3+8",
    "5.1+8",
    "5.1+9",
    "5.2+9",
  ]);
  const classOneSegregatesFrom = new Set([
    "2.1",
    "2.2",
    "2.3",
    "3",
    "4.1",
    "4.2",
    "4.3",
    "5.1",
    "5.2",
    "8",
  ]);

  const rules = {
    startAt: 12,
    speed: 14,
    turnDuration: 1.5,
    turnRadius: 2,
    fodZoneX: 4.5,
    fodReward: 50,
    fearDuration: 4,
    fearSpeed: 0.6,
    reset() {
      return {
        elapsed: 0,
        active: false,
        done: false,
        x: -36,
        lane: 3,
        turn: 0,
        turned: false,
        dropped: false,
        hit: false,
      };
    },
    advance(state, dt, playerZ) {
      const result = { drop: false, entered: false };
      if (state.done) return result;
      state.elapsed += dt;
      if (!state.active) {
        if (state.elapsed < rules.startAt) return result;
        state.active = true;
        state.lane = Math.max(-2, Math.min(6, playerZ));
        result.entered = true;
      }
      if (state.x < 0) state.x = Math.min(0, state.x + rules.speed * dt);
      else if (!state.turned) {
        state.turn = Math.min(rules.turnDuration, state.turn + dt);
        if (!state.dropped && state.turn >= rules.turnDuration / 2) {
          state.dropped = true;
          result.drop = true;
        }
        if (state.turn >= rules.turnDuration) state.turned = true;
      } else state.x += rules.speed * dt;
      if (state.x > 37) {
        state.done = true;
        state.active = false;
      }
      return result;
    },
    position(state) {
      const angle = (state.turn / rules.turnDuration) * Math.PI * 2;
      return {
        x: state.x + (state.x === 0 && !state.turned ? Math.sin(angle) * rules.turnRadius : 0),
        z:
          state.lane +
          (state.x === 0 && !state.turned ? (1 - Math.cos(angle)) * rules.turnRadius : 0),
        yaw: Math.PI / 2 + (state.x === 0 && !state.turned ? angle : 0),
      };
    },
    touches(ax, az, bx, bz, px, pz) {
      const dx = bx - ax,
        dz = bz - az,
        length = dx * dx + dz * dz;
      const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length)) : 0;
      return Math.hypot(px - ax - dx * t, pz - az - dz * t) < 1.65;
    },
    reward(isFod, zone) {
      return isFod && zone === "fod" ? rules.fodReward : 0;
    },
    movementMultiplier(remaining) {
      return remaining > 0 ? rules.fearSpeed : 1;
    },
    conflict(a, b) {
      const da = a && a.div,
        db = b && b.div;
      if (!da || !db || da === db) return false;
      if (is1_4S(da) || is1_4S(db)) {
        const other = is1_4S(da) ? db : da;
        return isExplosive(other);
      }
      if (isExplosive(da) || isExplosive(db)) {
        const other = isExplosive(da) ? db : da;
        if (isExplosive(other)) return true;
        if (other === "9") return isLithium(isExplosive(da) ? b : a);
        return classOneSegregatesFrom.has(other);
      }
      const key = da < db ? da + "+" + db : db + "+" + da;
      if (!segregationPairs.has(key)) return false;
      if (da === "9" && !isLithium(a)) return false;
      if (db === "9" && !isLithium(b)) return false;
      return true;
    },
  };
  const emergency = {
    code: "35242888",
    musterX: 31,
    musterZ: 3.2,
    musterHX: 2.4,
    musterHZ: 2,
    codePoints: 50,
    positionPoints: 10,
    correct(value) {
      return String(value) === emergency.code;
    },
    inMuster(x, z) {
      return (
        Math.abs(x - emergency.musterX) <= emergency.musterHX &&
        Math.abs(z - emergency.musterZ) <= emergency.musterHZ
      );
    },
  };
  rules.emergency = emergency;
  // أسرار اللعبة: الرافعة تحمل الطرود — قواعد مشتركة صرفة بلا واجهة
  const forklift = {
    reach: 3.3,
    forkOffset: 1.95,
    carryY: 0.88,
    nearest(list, x, z) {
      let best = null,
        bd = forklift.reach;
      for (const it of list) {
        const d = Math.hypot(it.x - x, it.z - z);
        if (d < bd) {
          bd = d;
          best = it;
        }
      }
      return best;
    },
    forkX(x, yaw) {
      return x + Math.sin(yaw) * forklift.forkOffset;
    },
    forkZ(z, yaw) {
      return z + Math.cos(yaw) * forklift.forkOffset;
    },
  };
  rules.forklift = forklift;
  root.WarehouseRules = rules;
})(globalThis);
