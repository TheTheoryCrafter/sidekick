import { type ActionDef, type Behavior, type RuleDef } from './behavior';
import type { PetManifest } from './manifest';
import { type Vec } from './physics';
import type { Rng } from './rng';
import { type Surface } from './surfaces';
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
    /** Surface the pet stands on, or null for the floor. Only meaningful on the ground. */
    on: number | null;
    /** Velocity while in the air, px/s. */
    vel: Vec;
    /** Whether the current flight started with a throw. */
    thrown: boolean;
    /** Whether the current flight is a deliberate jump (part of an action). */
    jumping: boolean;
    /**
     * A surface the pet just lost its footing on, not to be landed on again until
     * `until` (sim ms). Stops a land/fall loop on a surface whose measurements disagree,
     * e.g. a stale edge of an element a framework has just removed.
     */
    skipLand?: {
        id: number;
        until: number;
    } | null;
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
    /** Pet size in CSS px. */
    petW: number;
    petH: number;
    /** Walk speed in CSS px per second. */
    walkSpeed: number;
    /** Visitor's local hour, for conditions. */
    hour: number;
    /** Cursor in viewport px, or null. */
    cursor: Vec | null;
    /** Page elements the pet can stand on, in viewport px. */
    surfaces: readonly Surface[];
    /**
     * Reduced motion: the pet never moves on its own (no walking, running, following
     * or jumping). Animations, reactions and dragging still work.
     */
    calm: boolean;
}
export type BrainEffect = {
    type: 'action-start';
    action: string;
    rule: string | null;
} | {
    type: 'action-end';
    action: string;
    interrupted: boolean;
} | {
    type: 'emit';
    name: string;
    action: string;
} | {
    type: 'event';
    name: string;
    rule: string | null;
    payload?: unknown;
};
export interface BrainResult {
    state: BrainState;
    effects: BrainEffect[];
}
export declare const BRAIN: {
    readonly tickMs: 1000;
    /** After falling off a surface, ignore it for landing this long, ms. */
    readonly skipLandMs: 400;
    readonly minWanderPx: 80;
    /** A run goes at least this share of the walkable width. */
    readonly minRunShare: 0.4;
    readonly runSpeed: 3;
    /** "follow" stops this far from the cursor. */
    readonly followStopPx: 40;
    /** Release speed (px/s) above which a drop counts as a throw. */
    readonly throwSpeed: 500;
};
/** Played when no rule picks anything. */
export declare const FALLBACK_ACTION: ActionDef;
/** Random target at least `min` px from x inside [lo, hi], or null if there's no room. */
export declare function pickTarget(x: number, min: number, lo: number, hi: number, rng: Rng): number | null;
export declare function createBrain(x: number, ctx: BrainCtx): BrainState;
/**
 * The rule that fires for `event` right now, if any. Rolls `chance` only for
 * rules that otherwise match. Nothing fires while the pet is held or flying.
 */
export declare function chooseRule(s: BrainState, event: string, ctx: BrainCtx, payload?: unknown): RuleDef | null;
/** Handle an event from outside (host emit, clicks...). */
export declare function dispatch(s: BrainState, event: string, ctx: BrainCtx, payload?: unknown): BrainResult;
/**
 * Start an action directly, ignoring rules. Unknown ids are ignored.
 * At the default priority 0 any event rule can still interrupt it.
 */
export declare function play(s: BrainState, actionId: string, ctx: BrainCtx, priority?: number): BrainResult;
/** The pointer picked the pet up. Whatever it was doing stops. */
export declare function grab(s: BrainState, ctx: BrainCtx): BrainResult;
/** Move a held pet so its feet are at (x, y), turning with the drag. */
export declare function holdAt(s: BrainState, x: number, y: number, ctx: BrainCtx): BrainState;
/** The pointer let go. The pet flies with `vel` (px/s) and lands under gravity. */
export declare function release(s: BrainState, vel: Vec, ctx: BrainCtx): BrainResult;
/** Advance one simulation step. */
export declare function stepBrain(prev: BrainState, ctx: BrainCtx): BrainResult;
