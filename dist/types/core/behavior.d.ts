/** A fixed number of ms, or a [min, max] range picked at random. */
export type Range = number | readonly [number, number];
/**
 * How the pet moves during a step. Motions are the only behavior written in code.
 * - none: stay put
 * - wander: walk to a random spot nearby
 * - run: dash to a spot far away
 * - follow: walk up to the cursor (skipped when there is no cursor)
 * - jump: leap onto a nearby page element, or down to the floor
 *
 * A rule whose action starts with a motion that can't happen right now
 * (no cursor to follow, nothing in reach to jump to) is skipped.
 */
export type Motion = 'none' | 'wander' | 'run' | 'follow' | 'jump';
export declare const MOTIONS: readonly Motion[];
/** Pet traits a rule can scale its chance by. */
export type TraitName = 'jumpiness' | 'clinginess' | 'appetite';
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
export type ActionInput = {
    id: string;
    steps: ActionStep[];
    interruptible?: boolean;
    next?: string;
} | ({
    id: string;
    interruptible?: boolean;
    next?: string;
} & ActionStep);
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
    /**
     * Scale `chance` by one of the pet's traits: chance × trait × 2, capped at 1.
     * A trait of 0.5 leaves the chance as written.
     */
    scaleBy?: TraitName;
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
    scaleBy?: TraitName;
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
    cursor: {
        x: number;
        y: number;
    } | null;
    /** Whether the pet is standing on a page element rather than the floor. */
    onSurface: boolean;
}
export type ConditionFn = (ctx: ConditionCtx) => boolean;
export declare const DEFAULT_STEP_MS = 3000;
export declare function pickRange(r: Range, rng: () => number): number;
export declare function normalizeAction(input: unknown): {
    action: ActionDef | null;
    warnings: string[];
};
export declare function normalizeRule(input: unknown): {
    rule: RuleDef | null;
    warnings: string[];
};
/** The registry of everything the pet can do and when. */
export declare class Behavior {
    readonly actions: Map<string, ActionDef>;
    readonly conditions: Map<string, ConditionFn>;
    private rules;
    private sorted;
    /** Add or replace an action. Returns warnings; never throws. */
    addAction(input: ActionInput | unknown): string[];
    /** Add or replace a rule (same id replaces). Returns warnings; never throws. */
    addRule(input: RuleInput | unknown): string[];
    removeRule(id: string): boolean;
    addCondition(name: string, fn: ConditionFn): void;
    allRules(): readonly RuleDef[];
    rulesFor(event: string): RuleDef[];
}
