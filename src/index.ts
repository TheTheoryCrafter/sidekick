// Public entry. Importing this module has no side effects and touches no
// browser globals, so it is safe to import during server-side rendering.

import { INSTANCE, INSTANCE_EVENT, Sidekick, type SidekickOptions } from './dom/sidekick';

export { Sidekick } from './dom/sidekick';
export type {
  SidekickOptions, SidekickStatus, SidekickDebug, SidekickEvent, SidekickSettings, PetDefinition, PetRef,
} from './dom/sidekick';
export { validateManifest } from './core/manifest';
export type { PetManifest, AnimationDef, Traits } from './core/manifest';
export type { ActionInput, ActionStep, Motion, RuleInput, ConditionFn, ConditionCtx, Range, TraitName } from './core/behavior';
export { DEFAULT_ACTIONS, DEFAULT_RULES } from './core/defaults';

type Global = Window & { [INSTANCE]?: Sidekick };

/**
 * Start the pet, or return the one already running on this page (its options
 * are kept; later options are ignored). Returns null where there is no DOM
 * (server-side rendering).
 */
export function init(options: SidekickOptions = {}): Sidekick | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const g = window as Global;
  const existing = g[INSTANCE];
  if (existing) return existing;
  const pet = new Sidekick(window, options);
  g[INSTANCE] = pet;
  window.dispatchEvent(new Event(INSTANCE_EVENT));
  return pet;
}

/** The running pet, if any. */
export function getInstance(): Sidekick | null {
  if (typeof window === 'undefined') return null;
  return (window as Global)[INSTANCE] ?? null;
}

/** Stop the pet and remove it from the page. */
export function destroy(): void {
  getInstance()?.destroy();
}

/**
 * Call `fn` whenever the page's pet is created or destroyed, even by another
 * copy of the library (say, a script tag next to a bundled import). Returns an
 * unsubscribe function.
 */
export function watchInstance(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(INSTANCE_EVENT, fn);
  return () => window.removeEventListener(INSTANCE_EVENT, fn);
}
