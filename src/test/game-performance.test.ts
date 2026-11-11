import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const game = readFileSync('public/game.html', 'utf8');
const ratioSource = game.match(/function renderPixelRatio\(width, height, dpr\)\{([\s\S]*?)\n\}/)?.[1];
if (!ratioSource) throw new Error('Missing resolution calculation');
const ratio = new Function('width', 'height', 'dpr', ratioSource) as (w: number, h: number, d: number) => number;

describe('Game rendering budget', () => {
  it('keeps a high-density desktop within the pixel budget', () => {
    const scale = ratio(1920, 1080, 2);
    expect(1920 * 1080 * scale * scale).toBeLessThanOrEqual(1500001);
  });
  it('never increases a standard-density display above its native resolution', () => {
    expect(ratio(1280, 720, 1)).toBe(1);
  });
});