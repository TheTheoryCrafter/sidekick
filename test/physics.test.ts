import { describe, expect, it } from 'vitest';
import { PHYSICS, stepAir, throwVelocity, type AirBounds, type Vec } from '../src/core/physics';

const B: AirBounds = { minX: 0, maxX: 1000, minY: 60, floorY: 800 };
const DT = 1 / 60;

function fly(pos: Vec, vel: Vec, maxSteps = 2000) {
  let landed: number | null = null;
  let steps = 0;
  let bounces = 0;
  let prevVy = vel.y;
  while (landed === null && steps < maxSteps) {
    const r = stepAir(pos, vel, DT, B);
    if (prevVy > 0 && r.vel.y < 0 && r.pos.y === B.floorY) bounces++;
    pos = r.pos; vel = r.vel; landed = r.landed; prevVy = vel.y; steps++;
    expect(pos.x).toBeGreaterThanOrEqual(B.minX);
    expect(pos.x).toBeLessThanOrEqual(B.maxX);
    expect(pos.y).toBeGreaterThanOrEqual(B.minY);
    expect(pos.y).toBeLessThanOrEqual(B.floorY);
  }
  return { pos, vel, landed, steps, bounces };
}

describe('stepAir', () => {
  it('applies gravity', () => {
    const r = stepAir({ x: 500, y: 100 }, { x: 0, y: 0 }, DT, B);
    expect(r.vel.y).toBeCloseTo(PHYSICS.gravity * DT);
    expect(r.pos.y).toBeGreaterThan(100);
    expect(r.landed).toBeNull();
  });

  it('a short drop lands without bouncing and reports the impact speed', () => {
    const r = fly({ x: 500, y: 780 }, { x: 0, y: 0 });
    expect(r.landed).not.toBeNull();
    expect(r.landed!).toBeLessThan(PHYSICS.landSpeed);
    expect(r.bounces).toBe(0);
    expect(r.pos.y).toBe(B.floorY);
    expect(r.vel).toEqual({ x: 0, y: 0 });
  });

  it('a long fall bounces before it lands', () => {
    const r = fly({ x: 500, y: 60 }, { x: 0, y: 0 });
    expect(r.bounces).toBeGreaterThanOrEqual(1);
    expect(r.landed).not.toBeNull();
  });

  it('bounces off walls, losing speed', () => {
    const r = stepAir({ x: 995, y: 400 }, { x: 1200, y: 0 }, DT, B);
    expect(r.pos.x).toBe(1000);
    expect(r.vel.x).toBeCloseTo(-1200 * PHYSICS.wallBounce);
    const l = stepAir({ x: 5, y: 400 }, { x: -1200, y: 0 }, DT, B);
    expect(l.pos.x).toBe(0);
    expect(l.vel.x).toBeGreaterThan(0);
  });

  it('bounces off the ceiling', () => {
    const r = stepAir({ x: 500, y: 65 }, { x: 0, y: -2000 }, DT, B);
    expect(r.pos.y).toBe(B.minY);
    expect(r.vel.y).toBeGreaterThan(0);
  });

  it('a hard throw always comes to rest inside the bounds', () => {
    for (const v of [{ x: 2600, y: -2600 }, { x: -2600, y: 500 }, { x: 0, y: -2600 }]) {
      expect(fly({ x: 500, y: 400 }, v).landed).not.toBeNull();
    }
  });
});

describe('throwVelocity', () => {
  it('measures speed over the recent window only', () => {
    const v = throwVelocity([
      { t: 0, x: 0, y: 0 },       // too old, ignored
      { t: 920, x: 100, y: 100 },
      { t: 1000, x: 180, y: 60 },
    ], 1000);
    expect(v.x).toBeCloseTo(1000);
    expect(v.y).toBeCloseTo(-500);
  });

  it('is zero without enough samples', () => {
    expect(throwVelocity([{ t: 0, x: 0, y: 0 }], 10)).toEqual({ x: 0, y: 0 });
    expect(throwVelocity([{ t: 0, x: 0, y: 0 }, { t: 10, x: 50, y: 0 }], 500)).toEqual({ x: 0, y: 0 });
  });

  it('caps the speed', () => {
    const v = throwVelocity([{ t: 0, x: 0, y: 0 }, { t: 10, x: 1000, y: 0 }], 10);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(PHYSICS.maxThrow);
  });
});
