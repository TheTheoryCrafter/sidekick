// Falling, bouncing and throwing. Pure — CSS px and seconds throughout.

export interface Vec { x: number; y: number }

export interface AirBounds {
  minX: number;
  maxX: number;
  /** Feet can't go above this (keeps the head on screen). */
  minY: number;
  /** The floor: feet land here. */
  floorY: number;
}

export const PHYSICS = {
  /** px/s² */
  gravity: 2600,
  /** Share of speed kept when bouncing off a wall or the ceiling. */
  wallBounce: 0.45,
  /** Share of vertical speed kept when bouncing off the floor. */
  floorBounce: 0.3,
  /** Below this downward speed (px/s) the pet lands instead of bouncing. */
  landSpeed: 700,
  /** Share of horizontal speed kept per floor bounce. */
  floorFriction: 0.6,
  /** Throws are capped at this speed (px/s). */
  maxThrow: 2600,
  /** Pointer history used to measure a throw, ms. */
  throwWindowMs: 90,
} as const;

export interface AirResult {
  pos: Vec;
  vel: Vec;
  /** Set on the step the pet comes to rest on the floor: the downward speed at impact. */
  landed: number | null;
}

/** One step of free flight with bounces. */
export function stepAir(pos: Vec, vel: Vec, dt: number, b: AirBounds): AirResult {
  let vx = vel.x;
  let vy = vel.y + PHYSICS.gravity * dt;
  let x = pos.x + vx * dt;
  let y = pos.y + vy * dt;

  if (x < b.minX) { x = b.minX; vx = Math.abs(vx) * PHYSICS.wallBounce; }
  else if (x > b.maxX) { x = b.maxX; vx = -Math.abs(vx) * PHYSICS.wallBounce; }

  if (y < b.minY) { y = b.minY; vy = Math.abs(vy) * PHYSICS.wallBounce; }

  if (y >= b.floorY) {
    const impact = Math.max(0, vy);
    y = b.floorY;
    if (impact < PHYSICS.landSpeed) return { pos: { x, y }, vel: { x: 0, y: 0 }, landed: impact };
    vy = -impact * PHYSICS.floorBounce;
    vx *= PHYSICS.floorFriction;
  }
  return { pos: { x, y }, vel: { x: vx, y: vy }, landed: null };
}

export interface PointerSample { t: number; x: number; y: number }

/** Release velocity from recent pointer samples (oldest first), capped at maxThrow. */
export function throwVelocity(samples: readonly PointerSample[], now: number): Vec {
  const recent = samples.filter((s) => now - s.t <= PHYSICS.throwWindowMs);
  if (recent.length < 2) return { x: 0, y: 0 };
  const a = recent[0]!;
  const z = recent[recent.length - 1]!;
  const dt = (z.t - a.t) / 1000;
  if (dt <= 0) return { x: 0, y: 0 };
  let vx = (z.x - a.x) / dt;
  let vy = (z.y - a.y) / dt;
  const speed = Math.hypot(vx, vy);
  if (speed > PHYSICS.maxThrow) {
    vx *= PHYSICS.maxThrow / speed;
    vy *= PHYSICS.maxThrow / speed;
  }
  return { x: vx, y: vy };
}
