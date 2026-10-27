// Public entry. Importing this module has no side effects and touches no
// browser globals, so it is safe to import during server-side rendering.

import { INSTANCE, Sidekick, type SidekickOptions } from './dom/sidekick';

export { Sidekick } from './dom/sidekick';
export type { SidekickOptions, SidekickStatus, SidekickDebug } from './dom/sidekick';
export { validateManifest } from './core/manifest';
export type { PetManifest, AnimationDef, Traits } from './core/manifest';

type Global = Window & { [INSTANCE]?: Sidekick };

/**
 * Start the pet, or return the one already running on this page.
 * Returns null where there is no DOM (server-side rendering).
 */
export function init(options: SidekickOptions = {}): Sidekick | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const g = window as Global;
  const existing = g[INSTANCE];
  if (existing) return existing;
  const pet = new Sidekick(window, options);
  g[INSTANCE] = pet;
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
