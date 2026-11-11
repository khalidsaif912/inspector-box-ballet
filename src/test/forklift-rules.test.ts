import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const context: Record<string, any> = {};
runInNewContext(readFileSync('public/game-rules.js', 'utf8'), context);
const rules = context['WarehouseRules'];

describe('Reckless forklift', () => {
  it('crosses only once per shift', () => {
    const state = rules.reset(); let entries = 0;
    for (let i = 0; i < 2000; i++) if (rules.advance(state, .05, 3).entered) entries++;
    expect(entries).toBe(1); expect(state.done).toBe(true);
    expect(rules.reset().done).toBe(false);
  });
  it('makes exactly one full turn and drops one foreign object', () => {
    const state = rules.reset(); let drops = 0;
    for (let i = 0; i < 1000; i++) if (rules.advance(state, .05, 3).drop) drops++;
    expect(state.turn).toBe(rules.turnDuration); expect(state.turned).toBe(true); expect(drops).toBe(1);
  });
  it('detects collisions along a fast crossing, not just its endpoints', () => {
    expect(rules.touches(-4, 3, 4, 3, 0, 3)).toBe(true);
    expect(rules.touches(-4, 3, 4, 3, 0, 7)).toBe(false);
  });
  it('slows the worker temporarily and restores normal movement', () => {
    expect(rules.movementMultiplier(rules.fearDuration)).toBeLessThan(1);
    expect(rules.movementMultiplier(0)).toBe(1);
  });
  it('places the FOD collection area at its configured position', () => {
    expect(rules.fodZoneX).toBe(4.5);
  });
  it('awards extra points only for FOD delivered to its own area', () => {
    expect(rules.reward(true, 'fod')).toBe(50);
    expect(rules.reward(true, 'cold')).toBe(0);
    expect(rules.reward(false, 'fod')).toBe(0);
  });
});