// The brain runs actions step by step and asks the rules what to do next.
// It also owns the pet's body: on the ground, held by the pointer, or in the air.
// Pure: state in, state and effects out. Time, randomness and input are injected.

import { DEFAULT_STEP_MS, pickRange, type ActionDef, type ActionStep, type Behavior, type ConditionCtx, type RuleDef } from './behavior';
import type { PetManifest } from './manifest';
import { stepAir, type Vec } from './physics';
import type { Rng } from './rng';
import { resolveRole } from './roles';
import { frameAt } from './sprite';

export interface PetBody {
  /** Feet position (the manifest anchor), in viewport CSS px. */
  x: number;
  y: number;
  /** 1 = facing right, -1 = facing left. */
  facing: 1 | -1;
}

export type BodyMode = 'ground' | 'held' | 'air';

export interface RunningAction {
  id: string;
  step: number;
  stepStart: number;
  /** Sim time the step ends at, if timed. */
  deadline: number | null;
  /** Where the step is moving to, if it moves. */
  targetX: number | null;
  /** CSS px per second for the motion. */
  speed: number;
  priority: number;
  /** Rule that started it, or null for play() and fallbacks. */
  rule: string | null;
}

export interface BrainState {
  body: PetBody;
  mode: BodyMode;
  /** Velocity while in the air, px/s. */
  vel: Vec;
  /** Whether the current flight started with a throw. */
  thrown: boolean;
  action: RunningAction | null;
  /** Animation playing, and the sim time it started. */
  anim: string;
  animStart: number;
  /** Sim time each rule may fire again. */
  cooldowns: Record<string, number>;
  /** Sim time each action last finished. */
  lastDone: Record<string, number>;
  nextTick: number;
}

export interface BrainCtx {
  /** Simulation time, ms. */
  now: number;
  /** Step length, seconds. */
  dt: number;
  rng: Rng;
  manifest: PetManifest;
  behavior: Behavior;
  minX: number;
  maxX: number;
  /** Highest the feet may go (keeps the head on screen). */
  minY: number;
  floorY: number;
  /** Walk speed in CSS px per second. */
  walkSpeed: number;
  /** Visitor's local hour, for conditions. */
  hour: number;
  /** Cursor in viewport px, or null. */
  cursor: Vec | null;
}

export type BrainEffect =
  | { type: 'action-start'; action: string; rule: string | null }
  | { type: 'action-end'; action: string; interrupted: boolean }
  | { type: 'emit'; name: string; action: string }
  | { type: 'event'; name: string; rule: string | null; payload?: unknown };

export interface BrainResult {
  state: BrainState;
  effects: BrainEffect[];
}

export const BRAIN = {
  tickMs: 1000,
  minWanderPx: 80,
  /** A run goes at least this share of the walkable width. */
  minRunShare: 0.4,
  runSpeed: 3,
  /** "follow" stops this far from the cursor. */
  followStopPx: 40,
  /** Release speed (px/s) above which a drop counts as a throw. */
  throwSpeed: 500,
} as const;

/** Played when no rule picks anything. */
export const FALLBACK_ACTION: ActionDef = {
  id: '__fallback',
  steps: [{ role: 'ambient', duration: [3000, 8000] }],
  interruptible: true,
};

const clamp = (v: number, lo: number, hi: number) => (hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));

/** Random target at least `min` px from x inside [lo, hi], or null if there's no room. */
export function pickTarget(x: number, min: number, lo: number, hi: number, rng: Rng): number | null {
  const left = Math.max(0, x - min - lo);
  const right = Math.max(0, hi - (x + min));
  const room = left + right;
  if (room <= 0) return null;
  const r = rng() * room;
  return r < left ? lo + r : x + min + (r - left);
}

/** Where "follow" walks to: next to the cursor on the pet's side, or null when already there. */
function followTarget(x: number, ctx: BrainCtx): number | null {
  if (!ctx.cursor) return null;
  const side = x <= ctx.cursor.x ? -1 : 1;
  const t = clamp(ctx.cursor.x + side * BRAIN.followStopPx, ctx.minX, ctx.maxX);
  return Math.abs(t - x) < 1 ? null : t;
}

export function createBrain(x: number, ctx: BrainCtx): BrainState {
  return {
    body: { x: clamp(x, ctx.minX, ctx.maxX), y: ctx.floorY, facing: ctx.rng() < 0.5 ? -1 : 1 },
    mode: 'ground',
    vel: { x: 0, y: 0 },
    thrown: false,
    action: null,
    anim: resolveRole(ctx.manifest, 'ambient', ctx.rng) ?? '',
    animStart: ctx.now,
    cooldowns: {},
    lastDone: {},
    nextTick: ctx.now + BRAIN.tickMs,
  };
}

function conditionCtx(s: BrainState, ctx: BrainCtx, payload: unknown): ConditionCtx {
  return { now: ctx.now, hour: ctx.hour, action: s.action?.id ?? null, lastDone: s.lastDone, payload, cursor: ctx.cursor };
}

/**
 * The rule that fires for `event` right now, if any. Rolls `chance` only for
 * rules that otherwise match. Nothing fires while the pet is held or flying.
 */
export function chooseRule(s: BrainState, event: string, ctx: BrainCtx, payload?: unknown): RuleDef | null {
  if (s.mode !== 'ground') return null;
  const cur = s.action;
  const curDef = cur ? ctx.behavior.actions.get(cur.id) : undefined;
  const cctx = conditionCtx(s, ctx, payload);
  for (const rule of ctx.behavior.rulesFor(event)) {
    if (!ctx.behavior.actions.has(rule.action)) continue;
    if ((s.cooldowns[rule.id] ?? -Infinity) > ctx.now) continue;
    if (rule.during && !(cur && rule.during.includes(cur.id))) continue;
    if (rule.notDuring && cur && rule.notDuring.includes(cur.id)) continue;
    if (cur && (curDef?.interruptible === false || rule.priority < cur.priority)) continue;
    if (!rule.if.every((name) => ctx.behavior.conditions.get(name)?.(cctx) ?? false)) continue;
    if (ctx.rng() >= rule.chance) continue;
    return rule;
  }
  return null;
}

function setAnim(s: BrainState, role: string, ctx: BrainCtx): BrainState {
  const anim = resolveRole(ctx.manifest, role, ctx.rng);
  // A role the pet can't show (e.g. poopEntity) keeps the current animation.
  return anim ? { ...s, anim, animStart: ctx.now } : s;
}

function stepTarget(step: ActionStep, x: number, ctx: BrainCtx): number | null {
  switch (step.motion) {
    case 'wander':
      return pickTarget(x, BRAIN.minWanderPx, ctx.minX, ctx.maxX, ctx.rng);
    case 'run':
      return pickTarget(x, Math.max(BRAIN.minWanderPx, (ctx.maxX - ctx.minX) * BRAIN.minRunShare), ctx.minX, ctx.maxX, ctx.rng);
    case 'follow':
      return followTarget(x, ctx);
    default:
      return null;
  }
}

function beginStep(s: BrainState, def: ActionDef, index: number, ctx: BrainCtx): BrainState {
  const step = def.steps[index]!;
  const moving = (step.motion ?? 'none') !== 'none';
  const targetX = stepTarget(step, s.body.x, ctx);
  const speed = moving ? ctx.walkSpeed * (step.speed ?? (step.motion === 'run' ? BRAIN.runSpeed : 1)) : 0;

  const animated = setAnim(s, step.role, ctx);
  const animDef = ctx.manifest.animations[animated.anim];
  let deadline: number | null = null;
  if (step.duration !== undefined) deadline = ctx.now + pickRange(step.duration, ctx.rng);
  else if (moving && targetX === null) deadline = ctx.now; // nowhere to go: skip
  else if (!moving && (!animDef || animDef.loop)) deadline = ctx.now + DEFAULT_STEP_MS;

  let facing = s.body.facing;
  if (targetX !== null) facing = targetX > s.body.x ? 1 : -1;
  else if (step.face && ctx.cursor && Math.abs(ctx.cursor.x - s.body.x) > 1) {
    const toward: 1 | -1 = ctx.cursor.x > s.body.x ? 1 : -1;
    facing = step.face === 'cursor' ? toward : (-toward as 1 | -1);
  }
  return {
    ...animated,
    body: { ...animated.body, facing },
    action: { ...animated.action!, step: index, stepStart: ctx.now, deadline, targetX, speed },
  };
}

function startAction(s: BrainState, def: ActionDef, priority: number, rule: string | null, ctx: BrainCtx, fx: BrainEffect[]): BrainState {
  if (s.action) fx.push({ type: 'action-end', action: s.action.id, interrupted: true });
  fx.push({ type: 'action-start', action: def.id, rule });
  const base: BrainState = {
    ...s,
    action: { id: def.id, step: 0, stepStart: ctx.now, deadline: null, targetX: null, speed: 0, priority, rule },
  };
  return beginStep(base, def, 0, ctx);
}

function endAction(s: BrainState, fx: BrainEffect[]): BrainState {
  if (!s.action) return s;
  fx.push({ type: 'action-end', action: s.action.id, interrupted: true });
  return { ...s, action: null };
}

function fire(s: BrainState, event: string, ctx: BrainCtx, fx: BrainEffect[], payload?: unknown): BrainState {
  const rule = chooseRule(s, event, ctx, payload);
  if (event !== 'idle' && event !== 'tick') {
    fx.push({ type: 'event', name: event, rule: rule?.id ?? null, ...(payload !== undefined ? { payload } : {}) });
  }
  if (!rule) {
    return event === 'idle' && s.mode === 'ground' ? startAction(s, FALLBACK_ACTION, 0, null, ctx, fx) : s;
  }
  const withCooldown = rule.cooldown > 0 ? { ...s, cooldowns: { ...s.cooldowns, [rule.id]: ctx.now + rule.cooldown } } : s;
  return startAction(withCooldown, ctx.behavior.actions.get(rule.action)!, rule.priority, rule.id, ctx, fx);
}

function defOf(id: string, ctx: BrainCtx): ActionDef | undefined {
  return id === FALLBACK_ACTION.id ? FALLBACK_ACTION : ctx.behavior.actions.get(id);
}

/** Handle an event from outside (host emit, clicks...). */
export function dispatch(s: BrainState, event: string, ctx: BrainCtx, payload?: unknown): BrainResult {
  const fx: BrainEffect[] = [];
  return { state: fire(s, event, ctx, fx, payload), effects: fx };
}

/**
 * Start an action directly, ignoring rules. Unknown ids are ignored.
 * At the default priority 0 any event rule can still interrupt it.
 */
export function play(s: BrainState, actionId: string, ctx: BrainCtx, priority = 0): BrainResult {
  const fx: BrainEffect[] = [];
  const def = ctx.behavior.actions.get(actionId);
  if (!def || s.mode !== 'ground') return { state: s, effects: fx };
  return { state: startAction(s, def, priority, null, ctx, fx), effects: fx };
}

/** The pointer picked the pet up. Whatever it was doing stops. */
export function grab(s: BrainState, ctx: BrainCtx): BrainResult {
  const fx: BrainEffect[] = [];
  let next = endAction(s, fx);
  next = setAnim({ ...next, mode: 'held', vel: { x: 0, y: 0 }, thrown: false }, 'dragged', ctx);
  fx.push({ type: 'event', name: 'drag-start', rule: null });
  return { state: next, effects: fx };
}

/** Move a held pet so its feet are at (x, y), turning with the drag. */
export function holdAt(s: BrainState, x: number, y: number, ctx: BrainCtx): BrainState {
  if (s.mode !== 'held') return s;
  const nx = clamp(x, ctx.minX, ctx.maxX);
  const ny = clamp(y, ctx.minY, ctx.floorY);
  const dx = nx - s.body.x;
  const facing: 1 | -1 = Math.abs(dx) > 2 ? (dx > 0 ? 1 : -1) : s.body.facing;
  return { ...s, body: { x: nx, y: ny, facing } };
}

/** The pointer let go. The pet flies with `vel` (px/s) and lands under gravity. */
export function release(s: BrainState, vel: Vec, ctx: BrainCtx): BrainResult {
  const fx: BrainEffect[] = [];
  if (s.mode !== 'held') return { state: s, effects: fx };
  const thrown = Math.hypot(vel.x, vel.y) >= BRAIN.throwSpeed;
  fx.push({ type: 'event', name: thrown ? 'throw' : 'drop', rule: null, payload: { vx: Math.round(vel.x), vy: Math.round(vel.y) } });
  const next = setAnim({ ...s, mode: 'air', vel, thrown }, 'fall', ctx);
  return { state: next, effects: fx };
}

/** Advance one simulation step. */
export function stepBrain(prev: BrainState, ctx: BrainCtx): BrainResult {
  const fx: BrainEffect[] = [];

  if (prev.mode === 'held') return { state: prev, effects: fx };

  if (prev.mode === 'air') {
    const r = stepAir({ x: prev.body.x, y: prev.body.y }, prev.vel, ctx.dt,
      { minX: ctx.minX, maxX: ctx.maxX, minY: ctx.minY, floorY: ctx.floorY });
    const facing: 1 | -1 = Math.abs(r.vel.x) > 30 ? (r.vel.x > 0 ? 1 : -1) : prev.body.facing;
    let s: BrainState = { ...prev, body: { x: r.pos.x, y: r.pos.y, facing }, vel: r.vel };
    if (r.landed === null) return { state: s, effects: fx };
    s = { ...s, mode: 'ground', vel: { x: 0, y: 0 }, thrown: false, nextTick: ctx.now + BRAIN.tickMs };
    s = fire(s, 'land', ctx, fx, { impact: Math.round(r.landed), thrown: prev.thrown });
    if (!s.action) s = fire(s, 'idle', ctx, fx);
    return { state: s, effects: fx };
  }

  let s: BrainState = { ...prev, body: { ...prev.body, x: clamp(prev.body.x, ctx.minX, ctx.maxX), y: ctx.floorY } };

  if (ctx.now >= s.nextTick) {
    s = { ...s, nextTick: ctx.now + BRAIN.tickMs };
    s = fire(s, 'tick', ctx, fx);
  }

  const run = s.action;
  const def = run && defOf(run.id, ctx);
  if (!run || !def) return { state: fire({ ...s, action: null }, 'idle', ctx, fx), effects: fx };

  const step = def.steps[run.step]!;
  let done = run.deadline !== null && ctx.now >= run.deadline;

  if (!done && run.targetX !== null) {
    // "follow" keeps chasing a moving cursor; it ends when it catches up or loses it.
    const target = step.motion === 'follow' ? followTarget(s.body.x, ctx) : clamp(run.targetX, ctx.minX, ctx.maxX);
    if (target === null) {
      done = true;
    } else {
      const dx = target - s.body.x;
      const px = run.speed * ctx.dt;
      if (Math.abs(dx) <= px) {
        s = { ...s, body: { ...s.body, x: target } };
        done = true;
      } else {
        const dir = dx > 0 ? 1 : -1;
        s = { ...s, body: { ...s.body, x: s.body.x + dir * px, facing: dir } };
      }
    }
  }

  const animDef = ctx.manifest.animations[s.anim];
  const animDone = !!animDef && !animDef.loop && frameAt(animDef, ctx.now - s.animStart).done;
  if (!done && animDone) {
    // A one-shot animation ends an untimed, unmoving step. Otherwise pick the role
    // again so the pet doesn't freeze on a last frame.
    if (run.deadline === null && run.targetX === null) done = true;
    else s = setAnim(s, step.role, ctx);
  }

  if (!done) return { state: s, effects: fx };

  if (step.emit) fx.push({ type: 'emit', name: step.emit, action: run.id });
  if (run.step + 1 < def.steps.length) return { state: beginStep(s, def, run.step + 1, ctx), effects: fx };

  fx.push({ type: 'action-end', action: run.id, interrupted: false });
  s = { ...s, action: null, lastDone: { ...s.lastDone, [run.id]: ctx.now } };
  const chained = def.next ? ctx.behavior.actions.get(def.next) : undefined;
  s = chained ? startAction(s, chained, run.priority, run.rule, ctx, fx) : fire(s, 'idle', ctx, fx);
  return { state: s, effects: fx };
}
