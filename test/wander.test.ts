import { describe, expect, it } from 'vitest';
import { validateManifest } from '../src/core/manifest';
import { seededRng, type Rng } from '../src/core/rng';
import { WANDER, startWander, stepWander, type WanderCtx, type WanderState } from '../src/core/wander';
import creamCat from '../pets/cream-cat/manifest.json';

const cat = validateManifest(creamCat).manifest!;
const AMBIENT = cat.roles.ambient as string[];

function ctx(over: Partial<WanderCtx> = {}): WanderCtx {
  return { now: 0, dt: 1 / 60, rng: seededRng(1), manifest: cat, minX: 32, maxX: 968, floorY: 700, walkSpeed: 60, ...over };
}

/** An rng that returns the given values in order, then repeats the last. */
function scripted(...values: number[]): Rng {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
}

function walking(x: number, targetX: number): WanderState {
  return { body: { x, y: 700, facing: 1 }, mode: { kind: 'walk', targetX }, anim: 'walk', animStart: 0 };
}

describe('wander', () => {
  it('starts idle on the floor with an ambient animation', () => {
    const s = startWander(500, ctx());
    expect(s.mode.kind).toBe('idle');
    expect(s.body.y).toBe(700);
    expect(AMBIENT).toContain(s.anim);
    if (s.mode.kind === 'idle') {
      expect(s.mode.until).toBeGreaterThanOrEqual(WANDER.idleMinMs);
      expect(s.mode.until).toBeLessThan(WANDER.idleMaxMs);
    }
  });

  it('clamps the start position into bounds', () => {
    expect(startWander(-100, ctx()).body.x).toBe(32);
  });

  it('walks toward the target at walkSpeed and faces it', () => {
    let s = walking(500, 200);
    s = stepWander(s, ctx({ dt: 0.5 }));
    expect(s.body.x).toBe(470);
    expect(s.body.facing).toBe(-1);
  });

  it('stops exactly at the target and goes idle', () => {
    const s = stepWander(walking(500, 510), ctx({ dt: 0.5, now: 1000 }));
    expect(s.body.x).toBe(510);
    expect(s.mode.kind).toBe('idle');
    expect(AMBIENT).toContain(s.anim);
    expect(s.animStart).toBe(1000);
  });

  it('starts a walk of at least minWalkPx when idle time is up', () => {
    // rng: 0 -> walk (below walkChance), 0.5 -> target, 0 -> move animation
    const idle: WanderState = { body: { x: 500, y: 700, facing: 1 }, mode: { kind: 'idle', until: 100 }, anim: 'idle', animStart: 0 };
    const s = stepWander(idle, ctx({ now: 100, rng: scripted(0, 0.5, 0) }));
    expect(s.mode.kind).toBe('walk');
    expect(s.anim).toBe('walk');
    if (s.mode.kind === 'walk') expect(Math.abs(s.mode.targetX - 500)).toBeGreaterThanOrEqual(WANDER.minWalkPx);
  });

  it('stays idle when there is no room to walk', () => {
    const idle: WanderState = { body: { x: 100, y: 700, facing: 1 }, mode: { kind: 'idle', until: 0 }, anim: 'idle', animStart: 0 };
    const s = stepWander(idle, ctx({ now: 10, minX: 90, maxX: 110, rng: scripted(0) }));
    expect(s.mode.kind).toBe('idle');
  });

  it('replaces a finished one-shot idle animation', () => {
    // yawn: 8 frames @ 8 fps = 1000 ms, does not loop
    const s0: WanderState = { body: { x: 500, y: 700, facing: 1 }, mode: { kind: 'idle', until: 99_999 }, anim: 'yawn', animStart: 0 };
    expect(stepWander(s0, ctx({ now: 500 })).anim).toBe('yawn');
    const s1 = stepWander(s0, ctx({ now: 1000 }));
    expect(s1.animStart).toBe(1000);
    expect(AMBIENT).toContain(s1.anim);
  });

  it('follows the floor and bounds when the viewport changes', () => {
    const s = stepWander(walking(900, 950), ctx({ maxX: 600, floorY: 400 }));
    expect(s.body.y).toBe(400);
    expect(s.body.x).toBeLessThanOrEqual(600);
  });

  it('never leaves the bounds over a long random run', () => {
    let c = ctx({ rng: seededRng(7) });
    let s = startWander(500, c);
    for (let i = 0; i < 60 * 120; i++) {
      c = { ...c, now: i * (1000 / 60) };
      s = stepWander(s, c);
      expect(s.body.x).toBeGreaterThanOrEqual(c.minX);
      expect(s.body.x).toBeLessThanOrEqual(c.maxX);
    }
  });
});
