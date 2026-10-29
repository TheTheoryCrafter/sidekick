// Page elements the pet can stand on, as one-way platforms (their top edges).
// Pure — the DOM layer measures elements and hands in plain rectangles.

import type { Vec } from './physics';
import type { Rng } from './rng';

export interface Surface {
  /** Stable id for the element while it stays on the page. */
  id: number;
  /** Viewport px. The pet's feet may stand anywhere in [left, right] at y = top. */
  left: number;
  right: number;
  top: number;
}

export interface JumpTarget {
  /** Surface to land on, or null for the floor. */
  id: number | null;
  x: number;
  y: number;
}

export interface JumpLimits {
  /** Pet size in CSS px. */
  petW: number;
  petH: number;
  /** Highest the feet may go. */
  minY: number;
  floorY: number;
  minX: number;
  maxX: number;
}

export const JUMP = {
  /** Highest jump, in pet heights. */
  maxUp: 4,
  /** Furthest jump sideways, in pet widths. */
  maxSide: 7,
  /** Apex sits this many pet heights above the higher end of the jump. */
  apexRise: 0.6,
} as const;

/**
 * The surface a falling pet lands on between prevY and y at column x, if any:
 * the highest top edge it crossed on the way down.
 */
export function landingSurface(prevY: number, y: number, x: number, surfaces: readonly Surface[]): Surface | null {
  if (y <= prevY) return null;
  let best: Surface | null = null;
  for (const s of surfaces) {
    if (x < s.left || x > s.right) continue;
    if (prevY > s.top + 0.5 || y < s.top) continue;
    if (!best || s.top < best.top) best = s;
  }
  return best;
}

/**
 * Somewhere new to jump to from (x, y), or null when nothing is in reach. When some of the
 * reachable surfaces are in `prefer` (ledges that just scrolled into view), one of those wins.
 */
export function findJumpTarget(
  from: Vec, on: number | null, surfaces: readonly Surface[], lim: JumpLimits, rng: Rng, prefer?: readonly number[],
): JumpTarget | null {
  const maxUp = lim.petH * JUMP.maxUp;
  const maxSide = lim.petW * JUMP.maxSide;
  const options: JumpTarget[] = [];

  for (const s of surfaces) {
    if (s.id === on) continue;
    if (s.top < lim.minY || s.top > lim.floorY - 4) continue;
    if (from.y - s.top > maxUp) continue;
    // Land as close as possible to straight across, a little way in from the edges.
    const inset = Math.min(lim.petW / 2, (s.right - s.left) / 2);
    const lo = Math.max(s.left + inset, lim.minX);
    const hi = Math.min(s.right - inset, lim.maxX);
    if (hi < lo) continue;
    const x = Math.min(hi, Math.max(lo, from.x + (rng() - 0.5) * lim.petW));
    if (Math.abs(x - from.x) > maxSide) continue;
    if (Math.abs(x - from.x) < 4 && Math.abs(s.top - from.y) < 8) continue;
    options.push({ id: s.id, x, y: s.top });
  }

  // Up on something: hopping down to the floor is always an option.
  if (on !== null && from.y < lim.floorY - 4) {
    const dir = rng() < 0.5 ? -1 : 1;
    const x = Math.min(lim.maxX, Math.max(lim.minX, from.x + dir * lim.petW * (1 + rng() * 2)));
    options.push({ id: null, x, y: lim.floorY });
  }

  if (options.length === 0) return null;
  const preferred = prefer && prefer.length ? options.filter((o) => o.id !== null && prefer.includes(o.id)) : [];
  const pool = preferred.length ? preferred : options;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]!;
}

/** Launch velocity for a ballistic jump from `from` to `to` under `gravity` (px/s²). */
export function jumpVelocity(from: Vec, to: Vec, apexRise: number, gravity: number, minY = -Infinity): Vec {
  const apexY = Math.max(minY, Math.min(from.y, to.y) - apexRise);
  const up = Math.max(1, from.y - apexY);
  const down = Math.max(1, to.y - apexY);
  const vy = -Math.sqrt(2 * gravity * up);
  const t = Math.sqrt((2 * up) / gravity) + Math.sqrt((2 * down) / gravity);
  return { x: (to.x - from.x) / t, y: vy };
}
