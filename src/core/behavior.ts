// Actions, rules and conditions: the pet's behavior as plain data.
// Pure — no DOM. A host site can add to or override any of it at runtime.

/** A fixed number of ms, or a [min, max] range picked at random. */
export type Range = number | readonly [number, number];

/**
 * How the pet moves during a step. Motions are the only behavior written in code.
 * - none: stay put
 * - wander: walk to a random spot nearby
 * - run: dash to a spot far away
 * - follow: walk up to the cursor (skipped when there is no cursor)
 */
export type Motion = 'none' | 'wander' | 'run' | 'follow';
export const MOTIONS: readonly Motion[] = ['none', 'wander', 'run', 'follow'];

export interface ActionStep {
  /** Role to animate (never an animation name). */
  role: string;
  motion?: Motion;
  /**
   * How long the step lasts. Without it, a moving step ends on arrival, a one-shot
   * animation ends when it finishes, and a looping one plays for DEFAULT_STEP_MS.
   */
  duration?: Range;
  /** Speed multiplier for the motion. Default 1 for wander and follow, 3 for run. */
  speed?: number;
  /** Turn toward or away from the cursor when the step starts. */
  face?: 'cursor' | 'away';
  /** Name sent to listeners when this step ends (e.g. "poop" to drop a poop). */
  emit?: string;
}

export interface ActionDef {
  id: string;
  steps: ActionStep[];
  /** Whether a rule may cut this action short. Default true. */
  interruptible: boolean;
  /** Action to chain into when this one finishes. */
  next?: string;
}

/** An action as authored: either `steps`, or the fields of a single step inline. */
export type ActionInput =
  | { id: string; steps: ActionStep[]; interruptible?: boolean; next?: string }
  | ({ id: string; interruptible?: boolean; next?: string } & ActionStep);

export interface RuleDef {
  id: string;
  /** Action to start when the rule fires. */
  action: string;
  /**
   * Event that triggers the rule. Built in: "idle" (the pet is free to choose what
   * to do next) and "tick" (once a second). Anything else comes from emit().
   */
  on: string;
  /** Condition names that must all hold. */
  if: string[];
  /** Probability of firing when everything else matches, 0..1. */
  chance: number;
  /** ms before this rule may fire again. */
  cooldown: number;
  /**
   * Rules are tried highest priority first. It is also the started action's priority:
   * a rule may interrupt a running action only with an equal or higher priority.
   */
  priority: number;
  /** Only fire while one of these actions is running. */
  during?: string[];
  /** Never fire while one of these actions is running. */
  notDuring?: string[];
}

export interface RuleInput {
  id: string;
  action: string;
  /** Defaults to "tick", so a rule with only a condition is checked every second. */
  on?: string;
  if?: string | string[];
  chance?: number;
  cooldown?: number;
  priority?: number;
  during?: string[];
  notDuring?: string[];
}

export interface ConditionCtx {
  /** Simulation time, ms. */
  now: number;
  /** Visitor's local hour, 0–23. */
  hour: number;
  /** Running action id, or null. */
  action: string | null;
  /** Sim time each action last finished. */
  lastDone: Readonly<Record<string, number>>;
  /** Payload of the event being handled, if any. */
  payload: unknown;
  /** Cursor position in viewport px, or null when unknown (touch, cursor left the page). */
  cursor: { x: number; y: number } | null;
}

export type ConditionFn = (ctx: ConditionCtx) => boolean;

export const DEFAULT_STEP_MS = 3000;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isRange = (v: unknown): v is Range =>
  (typeof v === 'number' && v >= 0) ||
  (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && n >= 0) && v[0] <= v[1]);
const strList = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : undefined;

export function pickRange(r: Range, rng: () => number): number {
  return typeof r === 'number' ? r : r[0] + rng() * (r[1] - r[0]);
}

function normalizeStep(raw: unknown, where: string, warn: (m: string) => void): ActionStep | null {
  if (!isObj(raw) || typeof raw.role !== 'string' || !raw.role) {
    warn(`${where}: a step needs a "role".`);
    return null;
  }
  const step: ActionStep = { role: raw.role };
  if (raw.motion !== undefined) {
    if (MOTIONS.includes(raw.motion as Motion)) step.motion = raw.motion as Motion;
    else warn(`${where}: unknown motion "${String(raw.motion)}", using "none".`);
  }
  if (raw.duration !== undefined) {
    if (isRange(raw.duration)) step.duration = raw.duration;
    else warn(`${where}: "duration" must be ms or [min, max]; ignoring it.`);
  }
  if (typeof raw.speed === 'number' && raw.speed > 0) step.speed = raw.speed;
  if (raw.face === 'cursor' || raw.face === 'away') step.face = raw.face;
  else if (raw.face !== undefined) warn(`${where}: "face" must be "cursor" or "away"; ignoring it.`);
  if (typeof raw.emit === 'string' && raw.emit) step.emit = raw.emit;
  return step;
}

export function normalizeAction(input: unknown): { action: ActionDef | null; warnings: string[] } {
  const warnings: string[] = [];
  if (!isObj(input) || typeof input.id !== 'string' || !input.id) {
    return { action: null, warnings: ['An action needs an "id".'] };
  }
  const where = `Action "${input.id}"`;
  const rawSteps = Array.isArray(input.steps) ? input.steps : [input];
  const steps = rawSteps
    .map((s, i) => normalizeStep(s, rawSteps.length > 1 ? `${where} step ${i}` : where, (m) => warnings.push(m)))
    .filter((s): s is ActionStep => s !== null);
  if (steps.length === 0) return { action: null, warnings: [...warnings, `${where} dropped: no valid steps.`] };
  return {
    action: {
      id: input.id,
      steps,
      interruptible: input.interruptible !== false,
      ...(typeof input.next === 'string' && input.next ? { next: input.next } : {}),
    },
    warnings,
  };
}

export function normalizeRule(input: unknown): { rule: RuleDef | null; warnings: string[] } {
  const warnings: string[] = [];
  if (!isObj(input) || typeof input.id !== 'string' || !input.id) {
    return { rule: null, warnings: ['A rule needs an "id".'] };
  }
  const where = `Rule "${input.id}"`;
  if (typeof input.action !== 'string' || !input.action) {
    return { rule: null, warnings: [`${where} dropped: it needs an "action".`] };
  }
  const num = (key: string, dflt: number, lo = -Infinity, hi = Infinity): number => {
    const v = input[key];
    if (v === undefined) return dflt;
    if (typeof v === 'number' && Number.isFinite(v)) return Math.min(hi, Math.max(lo, v));
    warnings.push(`${where}: "${key}" must be a number; using ${dflt}.`);
    return dflt;
  };
  const conds = typeof input.if === 'string' ? [input.if] : strList(input.if) ?? [];
  const during = strList(input.during);
  const notDuring = strList(input.notDuring);
  return {
    rule: {
      id: input.id,
      action: input.action,
      on: typeof input.on === 'string' && input.on ? input.on : 'tick',
      if: conds,
      chance: num('chance', 1, 0, 1),
      cooldown: num('cooldown', 0, 0),
      priority: num('priority', 0),
      ...(during ? { during } : {}),
      ...(notDuring ? { notDuring } : {}),
    },
    warnings,
  };
}

/** The registry of everything the pet can do and when. */
export class Behavior {
  readonly actions = new Map<string, ActionDef>();
  readonly conditions = new Map<string, ConditionFn>();
  private rules = new Map<string, RuleDef>();
  private sorted: RuleDef[] | null = null;

  /** Add or replace an action. Returns warnings; never throws. */
  addAction(input: ActionInput | unknown): string[] {
    const { action, warnings } = normalizeAction(input);
    if (action) this.actions.set(action.id, action);
    return warnings;
  }

  /** Add or replace a rule (same id replaces). Returns warnings; never throws. */
  addRule(input: RuleInput | unknown): string[] {
    const { rule, warnings } = normalizeRule(input);
    if (rule) {
      this.rules.set(rule.id, rule);
      this.sorted = null;
    }
    return warnings;
  }

  removeRule(id: string): boolean {
    this.sorted = null;
    return this.rules.delete(id);
  }

  addCondition(name: string, fn: ConditionFn): void {
    this.conditions.set(name, fn);
  }

  allRules(): readonly RuleDef[] {
    if (!this.sorted) {
      // Highest priority first; equal priorities keep registration order.
      this.sorted = [...this.rules.values()].sort((a, b) => b.priority - a.priority);
    }
    return this.sorted;
  }

  rulesFor(event: string): RuleDef[] {
    return this.allRules().filter((r) => r.on === event);
  }
}
