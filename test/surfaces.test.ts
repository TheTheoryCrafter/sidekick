import { describe, expect, it } from 'vitest';
import { PHYSICS, stepAir } from '../src/core/physics';
import { seededRng } from '../src/core/rng';
import { JUMP, findJumpTarget, jumpVelocity, landingSurface, type JumpLimits, type Surface } from '../src/core/surfaces';

const lim: JumpLimits = { petW: 64, petH: 64, minY: 64, floorY: 800, minX: 32, maxX: 968 };

describe('landingSurface', () => {
  const shelves: Surface[] = [
    { id: 1, left: 100, right: 300, top: 500 },
    { id: 2, left: 100, right: 300, top: 600 },
    { id: 3, left: 400, right: 600, top: 500 },
  ];

  it('lands on the highest top edge crossed while falling', () => {
    expect(landingSurface(480, 650, 200, shelves)?.id).toBe(1);
    expect(landingSurface(550, 650, 200, shelves)?.id).toBe(2);
  });

  it('ignores surfaces outside the column, below, or when rising', () => {
    expect(landingSurface(480, 520, 350, shelves)).toBeNull();
    expect(landingSurface(480, 499, 200, shelves)).toBeNull();
    expect(landingSurface(520, 480, 200, shelves)).toBeNull();
  });

  it('counts touching the edge exactly', () => {
    expect(landingSurface(490, 500, 200, shelves)?.id).toBe(1);
  });
});

describe('findJumpTarget', () => {
  it('finds a reachable surface and lands inside it', () => {
    const s: Surface[] = [{ id: 7, left: 300, right: 500, top: 650 }];
    const t = findJumpTarget({ x: 350, y: 800 }, null, s, lim, () => 0.5)!;
    expect(t.id).toBe(7);
    expect(t.y).toBe(650);
    expect(t.x).toBeGreaterThanOrEqual(332);
    expect(t.x).toBeLessThanOrEqual(468);
  });

  it('skips surfaces too high, too far, off-screen, or the one it stands on', () => {
    const s: Surface[] = [
      { id: 1, left: 300, right: 500, top: 800 - 64 * JUMP.maxUp - 10 }, // too high
      { id: 2, left: 900, right: 960, top: 700 },                       // too far sideways
      { id: 3, left: 300, right: 500, top: 40 },                        // above minY
      { id: 4, left: 300, right: 500, top: 700 },                       // standing on it
    ];
    expect(findJumpTarget({ x: 100, y: 800 }, null, s.slice(0, 3), lim, () => 0.5)).toBeNull();
    expect(findJumpTarget({ x: 400, y: 700 }, 4, [s[3]!], lim, () => 0.5)?.id).toBeNull(); // floor only
  });

  it('offers the floor when up on something, and nothing when already on the floor', () => {
    const t = findJumpTarget({ x: 400, y: 600 }, 9, [], lim, () => 0.9)!;
    expect(t).toMatchObject({ id: null, y: 800 });
    expect(Math.abs(t.x - 400)).toBeGreaterThanOrEqual(64);
    expect(findJumpTarget({ x: 400, y: 800 }, null, [], lim, () => 0.5)).toBeNull();
  });

  it('keeps targets inside the walkable range', () => {
    const rng = seededRng(5);
    const s: Surface[] = [{ id: 1, left: 0, right: 120, top: 700 }, { id: 2, left: 900, right: 1000, top: 700 }];
    for (let i = 0; i < 200; i++) {
      const t = findJumpTarget({ x: 60 + (i % 2) * 880, y: 800 }, null, s, lim, rng);
      if (!t) continue;
      expect(t.x).toBeGreaterThanOrEqual(lim.minX);
      expect(t.x).toBeLessThanOrEqual(lim.maxX);
    }
  });
});

describe('jumpVelocity', () => {
  function simulate(from: { x: number; y: number }, to: { x: number; y: number }) {
    let pos = from;
    let vel = jumpVelocity(from, to, 40, PHYSICS.gravity);
    let peak = from.y;
    for (let i = 0; i < 600; i++) {
      const prev = pos.y;
      const r = stepAir(pos, vel, 1 / 240, { minX: -1e6, maxX: 1e6, minY: -1e6, floorY: 1e6 });
      pos = r.pos; vel = r.vel; peak = Math.min(peak, pos.y);
      if (vel.y > 0 && prev <= to.y && pos.y >= to.y) return { x: pos.x, peak };
    }
    throw new Error('never came down');
  }

  it('lands on the target going up', () => {
    const r = simulate({ x: 100, y: 800 }, { x: 300, y: 600 });
    expect(r.x).toBeCloseTo(300, -1);
    expect(r.peak).toBeLessThan(600);
  });

  it('lands on the target going down', () => {
    const r = simulate({ x: 300, y: 500 }, { x: 150, y: 800 });
    expect(r.x).toBeCloseTo(150, -1);
    expect(r.peak).toBeLessThan(500);
  });

  it('never aims the apex above minY', () => {
    const v = jumpVelocity({ x: 0, y: 100 }, { x: 0, y: 100 }, 80, PHYSICS.gravity, 60);
    // Rises only 40 px: v² = 2 g h
    expect(v.y * v.y).toBeCloseTo(2 * PHYSICS.gravity * 40);
  });
});

describe('stepAir without bounce', () => {
  it('lands on first floor contact however hard', () => {
    const r = stepAir({ x: 0, y: 790 }, { x: 0, y: 3000 }, 1 / 60, { minX: -1, maxX: 1, minY: 0, floorY: 800 }, false);
    expect(r.landed).toBeGreaterThan(PHYSICS.landSpeed);
    expect(r.pos.y).toBe(800);
  });
});
