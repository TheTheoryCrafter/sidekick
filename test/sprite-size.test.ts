// Animations with their own frame size (the cream cat's broom).
import { describe, expect, it } from 'vitest';
import { validateManifest } from '../src/core/manifest';
import { frameRect } from '../src/core/sprite';
import creamCat from '../pets/cream-cat/manifest.json';

describe('per-animation frame size', () => {
  it('the broom row is 48×64 frames starting at row 30', () => {
    const v = validateManifest(creamCat);
    expect(v.warnings).toEqual([]);
    const m = v.manifest!;
    const broom = m.animations.broom!;
    expect(broom.size).toEqual([48, 64]);
    expect(frameRect(m, broom, 0)).toEqual({ x: 0, y: 960, w: 48, h: 64 });
    expect(frameRect(m, broom, 5)).toEqual({ x: 240, y: 960, w: 48, h: 64 });
    expect(frameRect(m, m.animations.idle!, 1)).toEqual({ x: 32, y: 0, w: 32, h: 32 });
  });

  it('a size that runs off the sheet, or is not whole pixels, drops the animation', () => {
    const base = { id: 'p', sheet: 's.png', frameSize: [32, 32], sheetSize: [128, 64], animations: { a: { row: 0, frames: 1, fps: 1 } } };
    const tall = validateManifest({ ...base, animations: { ...base.animations, b: { row: 1, frames: 1, fps: 1, size: [32, 64] } } });
    expect(Object.keys(tall.manifest!.animations)).toEqual(['a']);
    const wide = validateManifest({ ...base, animations: { ...base.animations, b: { row: 0, frames: 3, fps: 1, size: [48, 32] } } });
    expect(Object.keys(wide.manifest!.animations)).toEqual(['a']);
    const odd = validateManifest({ ...base, animations: { ...base.animations, b: { row: 0, frames: 1, fps: 1, size: [40.5, 32] } } });
    expect(odd.warnings.join()).toContain('"size"');
    const ok = validateManifest({ ...base, animations: { ...base.animations, b: { row: 0, frames: 2, fps: 1, size: [64, 64] } } });
    expect(ok.manifest!.animations.b!.size).toEqual([64, 64]);
  });
});
