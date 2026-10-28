import { describe, expect, it } from 'vitest';
import { PESTER, recordClick } from '../src/core/pester';

/** Feed clicks at the given times, returning when "pestered" fired. */
function run(times: number[]): number[] {
  let recent: number[] = [];
  const fired: number[] = [];
  for (const t of times) {
    const r = recordClick(recent, t);
    recent = r.times;
    if (r.pestered) fired.push(t);
  }
  return fired;
}

describe('pestering', () => {
  it('fires on the fifth click within 4 s', () => {
    expect(PESTER).toEqual({ clicks: 5, windowMs: 4000 });
    expect(run([0, 500, 1000, 1500, 2000])).toEqual([2000]);
  });

  it('ignores clicks spread out over time', () => {
    expect(run([0, 1500, 3000, 4500, 6000, 7500, 9000])).toEqual([]);
  });

  it('needs a whole new round after an outburst', () => {
    expect(run([0, 100, 200, 300, 400, 500, 600, 700, 800, 900])).toEqual([400, 900]);
  });
});
