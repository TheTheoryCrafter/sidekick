import { describe, expect, it } from 'vitest';
import { validateManifest } from '../src/core/manifest';
import creamCat from '../pets/cream-cat/manifest.json';

const minimal = {
  id: 'test-pet',
  sheet: 'sheet.png',
  frameSize: [32, 32],
  animations: { sit: { row: 0, frames: 2, fps: 4, loop: true } },
};

describe('validateManifest', () => {
  it('accepts the cream cat with no errors', () => {
    const r = validateManifest(creamCat);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.manifest?.id).toBe('cream-cat');
    expect(Object.keys(r.manifest!.animations)).toHaveLength(Object.keys(creamCat.animations).length);
  });

  it('fills defaults for optional fields', () => {
    const m = validateManifest(minimal).manifest!;
    expect(m.name).toBe('test-pet');
    expect(m.anchor).toEqual([16, 32]);
    expect(m.facing).toBe('right');
    expect(m.traits).toEqual({ speed: 1, jumpiness: 0.2, clinginess: 0.5 });
    expect(m.roles).toEqual({});
    expect(m.animations.sit!.col).toBe(0);
  });

  it('rejects input that cannot render anything', () => {
    expect(validateManifest(null).manifest).toBeNull();
    expect(validateManifest({ ...minimal, id: 'Bad Id' }).errors[0]).toMatch(/id/);
    expect(validateManifest({ ...minimal, frameSize: [32] }).errors[0]).toMatch(/frameSize/);
    expect(validateManifest({ ...minimal, animations: {} }).errors[0]).toMatch(/No usable/);
  });

  it('drops bad animations with a warning instead of failing', () => {
    const r = validateManifest({
      ...minimal,
      sheetSize: [64, 64],
      animations: {
        ...minimal.animations,
        tooWide: { row: 0, frames: 3, fps: 4 },
        tooLow: { row: 2, frames: 1, fps: 4 },
        noFps: { row: 1, frames: 1, fps: 0 },
      },
    });
    expect(r.errors).toEqual([]);
    expect(Object.keys(r.manifest!.animations)).toEqual(['sit']);
    expect(r.warnings).toHaveLength(3);
  });

  it('treats a missing "loop" as looping', () => {
    const m = validateManifest({ ...minimal, animations: { a: { row: 0, frames: 1, fps: 1 } } }).manifest!;
    expect(m.animations.a!.loop).toBe(true);
  });

  it('drops role entries that point at unknown animations', () => {
    const r = validateManifest({
      ...minimal,
      roles: { ambient: ['sit', 'ghost'], move: 'ghost', sleep: 7 },
    });
    expect(r.manifest!.roles).toEqual({ ambient: ['sit'] });
    expect(r.warnings.some((w) => w.includes('"ghost"'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('Role "sleep" dropped'))).toBe(true);
  });

  it('clamps traits and ignores invalid facing', () => {
    const r = validateManifest({ ...minimal, facing: 'up', traits: { jumpiness: 4, speed: -1 } });
    expect(r.manifest!.facing).toBe('right');
    expect(r.manifest!.traits.jumpiness).toBe(1);
    expect(r.manifest!.traits.speed).toBe(1);
    expect(r.warnings.some((w) => w.includes('facing'))).toBe(true);
  });
});
