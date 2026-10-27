import { describe, expect, it } from 'vitest';
import { MAX_FRAME_MS, advance } from '../src/core/clock';
import { seededRng } from '../src/core/rng';

describe('advance', () => {
  it('runs whole steps and carries the rest', () => {
    expect(advance(0, 25, 10)).toEqual({ steps: 2, carry: 5 });
    expect(advance(5, 6, 10)).toEqual({ steps: 1, carry: 1 });
  });

  it('runs no step for a short frame', () => {
    expect(advance(0, 4, 10)).toEqual({ steps: 0, carry: 4 });
  });

  it('caps long gaps instead of fast-forwarding', () => {
    expect(advance(0, 10_000, 10).steps).toBe(MAX_FRAME_MS / 10);
  });

  it('ignores negative frame times', () => {
    expect(advance(3, -50, 10)).toEqual({ steps: 0, carry: 3 });
  });
});

describe('seededRng', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
