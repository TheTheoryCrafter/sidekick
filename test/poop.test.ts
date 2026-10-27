import { describe, expect, it } from 'vitest';
import { DEFAULT_POOP, addPoop, expirePoops, normalizePoopOptions, poopSpot, type Poop } from '../src/core/poop';

const p = (id: number, born = 0): Poop<string> => ({ id, born, anchor: `a${id}` });

describe('poopSpot', () => {
  it('lands behind the pet', () => {
    expect(poopSpot(500, 700, 1, 100)).toEqual({ x: 440, y: 700 });
    expect(poopSpot(500, 700, -1, 100)).toEqual({ x: 560, y: 700 });
  });
});

describe('addPoop', () => {
  it('keeps up to max, removing the oldest first', () => {
    let list: Poop<string>[] = [];
    const removed: number[] = [];
    for (let i = 1; i <= 7; i++) {
      const r = addPoop(list, p(i), 5);
      list = r.list;
      removed.push(...r.removed.map((x) => x.id));
    }
    expect(list.map((x) => x.id)).toEqual([3, 4, 5, 6, 7]);
    expect(removed).toEqual([1, 2]);
  });
});

describe('expirePoops', () => {
  it('removes poops older than ttl', () => {
    const r = expirePoops([p(1, 0), p(2, 500), p(3, 900)], 1000, 500);
    expect(r.list.map((x) => x.id)).toEqual([3]);
    expect(r.removed.map((x) => x.id)).toEqual([1, 2]);
  });
});

describe('normalizePoopOptions', () => {
  it('defaults, overrides, and turns off', () => {
    expect(normalizePoopOptions(undefined)).toEqual(DEFAULT_POOP);
    expect(normalizePoopOptions(true)).toEqual(DEFAULT_POOP);
    expect(normalizePoopOptions({ max: 2, ttl: 60_000 })).toEqual({ max: 2, ttl: 60_000 });
    expect(normalizePoopOptions({ max: 0, ttl: 5 })).toEqual(DEFAULT_POOP);
    expect(normalizePoopOptions(false)).toBeNull();
  });
});
