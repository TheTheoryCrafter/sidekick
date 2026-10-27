// The brain runs actions step by step and asks the rules what to do next.
// Pure: state in, state and effects out. Time and randomness are injected.

import { DEFAULT_STEP_MS, pickRange, type ActionDef, type Behavior, type ConditionCtx, type RuleDef } from './behavior';
import type { PetManifest } from './manifest';
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
  floorY: number;
  /** Walk speed in CSS px per second. */
  walkSpeed: number;
  /** Visitor's local hour, for conditions. */
  hour: number;
}

export type BrainEffect =
  | { type: 'action-start'; action: string; rule: string | null }
  | { type: 'action-end'; action: string; interrupted: boolean }
  | { type: 'emit'; name: string; action: string }
  | { type: 'event'; name: string; rule: string | null };

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

export function createBrain(x: number, ctx: BrainCtx): BrainState {
  return {
    body: { x: clamp(x, ctx.minX, ctx.maxX), y: ctx.floorY, facing: ctx.rng() < 0.5 ? -1 : 1 },
    action: null,
    anim: resolveRole(ctx.manifest, 'ambient', ctx.rng) ?? '',
    animStart: ctx.now,
    cooldowns: {},
    lastDone: {},
    nextTick: ctx.now + BRAIN.tickMs,
  };
}

function conditionCtx(s: BrainState, ctx: BrainCtx, payload: unknown): ConditionCtx {
  return { now: ctx.now, hour: ctx.hour, action: s.action?.id ?? null, lastDone: s.lastDone, payload };
}

/** The rule that fires for `event` right now, if any. Rolls `chance` only for rules that otherwise match. */
export function chooseRule(s: BrainState, event: string, ctx: BrainCtx, payload?: unknown): RuleDef | null {
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

function beginStep(s: BrainState, def: ActionDef, index: number, ctx: BrainCtx): BrainState {
  const step = def.steps[index]!;
  const motion = step.motion ?? 'none';
  let targetX: number | null = null;
  let speed = 0;
  if (motion === 'wander' || motion === 'run') {
    const min = motion === 'run' ? Math.max(BRAIN.minWanderPx, (ctx.maxX - ctx.minX) * BRAIN.minRunShare) : BRAIN.minWanderPx;
    targetX = pickTarget(s.body.x, min, ctx.minX, ctx.maxX, ctx.rng);
    speed = ctx.walkSpeed * (step.speed ?? (motion === 'run' ? BRAIN.runSpeed : 1));
  }
  const animated = setAnim(s, step.role, ctx);
  const animDef = ctx.manifest.animations[animated.anim];
  let deadline: number | null = null;
  if (step.duration !== undefined) deadline = ctx.now + pickRange(step.duration, ctx.rng);
  else if (motion !== 'none' && targetX === null) deadline = ctx.now; // nowhere to go: skip
  else if (motion === 'none' && (!animDef || animDef.loop)) deadline = ctx.now + DEFAULT_STEP_MS;

  const facing: 1 | -1 = targetX === null ? s.body.facing : targetX > s.body.x ? 1 : -1;
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

function fire(s: BrainState, event: string, ctx: BrainCtx, fx: BrainEffect[], payload?: unknown): BrainState {
  const rule = chooseRule(s, event, ctx, payload);
  if (event !== 'idle' && event !== 'tick') fx.push({ type: 'event', name: event, rule: rule?.id ?? null });
  if (!rule) {
    return event === 'idle' ? startAction(s, FALLBACK_ACTION, 0, null, ctx, fx) : s;
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
  return { state: def ? startAction(s, def, priority, null, ctx, fx) : s, effects: fx };
}

/** Advance one simulation step. */
export function stepBrain(prev: BrainState, ctx: BrainCtx): BrainResult {
  const fx: BrainEffect[] = [];
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
    const target = clamp(run.targetX, ctx.minX, ctx.maxX);
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
