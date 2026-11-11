(function (root) {
  const rules = {
    startAt: 12, speed: 14, turnDuration: 1.5, turnRadius: 2,
    fodZoneX: 4.5, fodReward: 50, fearDuration: 4, fearSpeed: 0.6,
    reset() { return { elapsed: 0, active: false, done: false, x: -36, lane: 3, turn: 0, turned: false, dropped: false, hit: false }; },
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
        if (!state.dropped && state.turn >= rules.turnDuration / 2) { state.dropped = true; result.drop = true; }
        if (state.turn >= rules.turnDuration) state.turned = true;
      } else state.x += rules.speed * dt;
      if (state.x > 37) { state.done = true; state.active = false; }
      return result;
    },
    position(state) {
      const angle = state.turn / rules.turnDuration * Math.PI * 2;
      return { x: state.x + (state.x === 0 && !state.turned ? Math.sin(angle) * rules.turnRadius : 0),
        z: state.lane + (state.x === 0 && !state.turned ? (1 - Math.cos(angle)) * rules.turnRadius : 0),
        yaw: Math.PI / 2 + (state.x === 0 && !state.turned ? angle : 0) };
    },
    touches(ax, az, bx, bz, px, pz) {
      const dx = bx - ax, dz = bz - az, length = dx * dx + dz * dz;
      const t = length ? Math.max(0, Math.min(1, ((px-ax)*dx+(pz-az)*dz)/length)) : 0;
      return Math.hypot(px-ax-dx*t, pz-az-dz*t) < 1.65;
    },
    reward(isFod, zone) { return isFod && zone === 'fod' ? rules.fodReward : 0; },
    movementMultiplier(remaining) { return remaining > 0 ? rules.fearSpeed : 1; }
  };
  root.WarehouseRules = rules;
})(globalThis);
