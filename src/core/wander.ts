// Milestone 1 brain: idle for a while, walk somewhere, repeat.
// Pure: every input comes in through `WanderCtx`. The data-driven behavior
// engine (M2) replaces the decision part; the body and animation bookkeeping stay.

import type { PetManifest } from './manifest';
import { between, type Rng } from './rng';
import { resolveRole } from './roles';
import { frameAt } from './sprite';

export interface PetBody {
  /** Feet position (the manifest anchor), in viewport CSS pixels. */
  x: number;
  y: number;
  /** 1 = facing right, -1 = facing left. */
  facing: 1 | -1;
}

export type WanderMode =
  | { kind: 'idle'; until: number }
  | { kind: 'walk'; targetX: number };

export interface WanderState {
  body: PetBody;
  mode: WanderMode;
  /** Animation currently playing, and the sim time it started. */
  anim: string;
  animStart: number;
}

export interface WanderCtx {
  /** Simulation time in ms. Stops while the tab is hidden. */
  now: number;
  /** Step length in seconds. */
  dt: number;
  rng: Rng;
  manifest: PetManifest;
  /** Allowed range for body.x (keeps the sprite on screen). */
  minX: number;
  maxX: number;
  floorY: number;
  /** Walk speed in CSS px per second, already scaled by traits and size. */
  walkSpeed: number;
}

export const WANDER = {
  idleMinMs: 3000,
  idleMaxMs: 9000,
  walkChance: 0.6,
  minWalkPx: 80,
} as const;

const clamp = (v: number, lo: number, hi: number) => (hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));

function play(s: WanderState, anim: string | null, now: number, restart = false): WanderState {
  if (!anim || (anim === s.anim && !restart)) return s;
  return { ...s, anim, animStart: now };
}

function startIdle(s: WanderState, ctx: WanderCtx): WanderState {
  const until = ctx.now + between(ctx.rng, WANDER.idleMinMs, WANDER.idleMaxMs);
  return play({ ...s, mode: { kind: 'idle', until } }, resolveRole(ctx.manifest, 'ambient', ctx.rng), ctx.now, true);
}

/** Pick a walk target at least `minWalkPx` away, or null when there isn't room. */
function pickTarget(x: number, ctx: WanderCtx): number | null {
  const left = x - WANDER.minWalkPx - ctx.minX;
  const right = ctx.maxX - (x + WANDER.minWalkPx);
  const room = Math.max(0, left) + Math.max(0, right);
  if (room <= 0) return null;
  const r = ctx.rng() * room;
  return r < Math.max(0, left) ? ctx.minX + r : x + WANDER.minWalkPx + (r - Math.max(0, left));
}

export function startWander(x: number, ctx: WanderCtx): WanderState {
  const s: WanderState = {
    body: { x: clamp(x, ctx.minX, ctx.maxX), y: ctx.floorY, facing: ctx.rng() < 0.5 ? -1 : 1 },
    mode: { kind: 'idle', until: 0 },
    anim: '',
    animStart: ctx.now,
  };
  return startIdle(s, ctx);
}

export function stepWander(prev: WanderState, ctx: WanderCtx): WanderState {
  // The viewport can shrink under the pet; keep it on the floor and on screen.
  let s: WanderState = {
    ...prev,
    body: { ...prev.body, x: clamp(prev.body.x, ctx.minX, ctx.maxX), y: ctx.floorY },
  };

  if (s.mode.kind === 'walk') {
    const target = clamp(s.mode.targetX, ctx.minX, ctx.maxX);
    const dx = target - s.body.x;
    const stepPx = ctx.walkSpeed * ctx.dt;
    if (Math.abs(dx) <= stepPx) {
      s = { ...s, body: { ...s.body, x: target } };
      return startIdle(s, ctx);
    }
    const dir = dx > 0 ? 1 : -1;
    return { ...s, body: { ...s.body, x: s.body.x + dir * stepPx, facing: dir } };
  }

  if (ctx.now >= s.mode.until) {
    const target = ctx.rng() < WANDER.walkChance ? pickTarget(s.body.x, ctx) : null;
    if (target === null) return startIdle(s, ctx);
    const facing = target > s.body.x ? 1 : -1;
    return play({ ...s, mode: { kind: 'walk', targetX: target }, body: { ...s.body, facing } }, resolveRole(ctx.manifest, 'move', ctx.rng), ctx.now, true);
  }

  // One-shot idle animations (yawn, doze...) shouldn't freeze on their last frame.
  const def = ctx.manifest.animations[s.anim];
  if (def && !def.loop && frameAt(def, ctx.now - s.animStart).done) {
    return play(s, resolveRole(ctx.manifest, 'ambient', ctx.rng), ctx.now, true);
  }
  return s;
}
