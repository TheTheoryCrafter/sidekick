import { Behavior, type ActionInput, type ConditionFn, type RuleInput } from './behavior';
export declare const SLEEPY_AFTER_MS: number;
export declare const DEFAULT_ACTIONS: ActionInput[];
export declare const DEFAULT_RULES: RuleInput[];
export declare const DEFAULT_CONDITIONS: Record<string, ConditionFn>;
/** A Behavior loaded with the defaults. Warnings would mean a bug in this file. */
export declare function defaultBehavior(): Behavior;
