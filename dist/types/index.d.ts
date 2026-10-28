import { Sidekick, type SidekickOptions } from './dom/sidekick';
export { Sidekick } from './dom/sidekick';
export type { SidekickOptions, SidekickStatus, SidekickDebug, SidekickEvent, SidekickSettings, PetDefinition, PetRef, } from './dom/sidekick';
export { validateManifest } from './core/manifest';
export type { PetManifest, AnimationDef, Traits } from './core/manifest';
export type { ActionInput, ActionStep, Motion, RuleInput, ConditionFn, ConditionCtx, Range, TraitName } from './core/behavior';
export { DEFAULT_ACTIONS, DEFAULT_RULES } from './core/defaults';
/**
 * Start the pet, or return the one already running on this page (its options
 * are kept; later options are ignored). Returns null where there is no DOM
 * (server-side rendering).
 */
export declare function init(options?: SidekickOptions): Sidekick | null;
/** The running pet, if any. */
export declare function getInstance(): Sidekick | null;
/** Stop the pet and remove it from the page. */
export declare function destroy(): void;
/**
 * Call `fn` whenever the page's pet is created or destroyed, even by another
 * copy of the library (say, a script tag next to a bundled import). Returns an
 * unsubscribe function.
 */
export declare function watchInstance(fn: () => void): () => void;
