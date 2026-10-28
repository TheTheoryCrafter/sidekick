// Role resolution. Behavior code only ever asks for a role ("move", "sleep"),
// never an animation name, so any pet works with any behavior.

import type { PetManifest } from './manifest';
import type { Rng } from './rng';

/**
 * Roles the engine knows about, and what to try when a pet lacks one.
 * Every chain implicitly ends in "ambient" and then the pet's first animation,
 * unless the role is in ROLES_WITHOUT_DEFAULT.
 */
export const ROLE_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  ambient: [],
  move: [],
  zoomies: ['move'],
  sleep: [],
  tired: [],
  hover: [],
  near: ['hover'],
  click: ['hover'],
  dblclick: ['success', 'click'],
  dragged: ['hover', 'click'],
  fall: ['dragged'],
  thrown: ['click'],
  landing: [],
  jump: ['landing'],
  poop: [],
  success: [],
  error: ['click'],
  'tool-used': ['success'],
  hide: [],
  hiding: ['hide'],
};

/** Roles that must not borrow some unrelated animation when missing. */
export const ROLES_WITHOUT_DEFAULT: ReadonlySet<string> = new Set(['poopEntity']);

/** All animation names that could play for a role, after fallbacks. Empty if none. */
export function roleCandidates(manifest: PetManifest, role: string): string[] {
  const seen = new Set<string>();
  const queue = [role];
  while (queue.length) {
    const r = queue.shift()!;
    if (seen.has(r)) continue;
    seen.add(r);
    const value = manifest.roles[r];
    if (value !== undefined) return Array.isArray(value) ? [...value] : [value];
    queue.push(...(ROLE_FALLBACKS[r] ?? []));
  }
  if (ROLES_WITHOUT_DEFAULT.has(role)) return [];
  const ambient = manifest.roles.ambient;
  if (role !== 'ambient' && ambient !== undefined) return Array.isArray(ambient) ? [...ambient] : [ambient];
  const first = Object.keys(manifest.animations)[0];
  return first ? [first] : [];
}

/** Pick the animation to play for a role, or null if the pet has nothing suitable. */
export function resolveRole(manifest: PetManifest, role: string, rng: Rng = Math.random): string | null {
  const c = roleCandidates(manifest, role);
  if (c.length === 0) return null;
  return c[Math.min(c.length - 1, Math.floor(rng() * c.length))]!;
}

/** True when the pet defines the role itself rather than through a fallback. */
export function hasOwnRole(manifest: PetManifest, role: string): boolean {
  return manifest.roles[role] !== undefined;
}
