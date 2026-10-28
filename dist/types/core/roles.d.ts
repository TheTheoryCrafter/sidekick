import type { PetManifest } from './manifest';
import type { Rng } from './rng';
/**
 * Roles the engine knows about, and what to try when a pet lacks one.
 * Every chain implicitly ends in "ambient" and then the pet's first animation,
 * unless the role is in ROLES_WITHOUT_DEFAULT.
 */
export declare const ROLE_FALLBACKS: Readonly<Record<string, readonly string[]>>;
/** Roles that must not borrow some unrelated animation when missing. */
export declare const ROLES_WITHOUT_DEFAULT: ReadonlySet<string>;
/** All animation names that could play for a role, after fallbacks. Empty if none. */
export declare function roleCandidates(manifest: PetManifest, role: string): string[];
/** Pick the animation to play for a role, or null if the pet has nothing suitable. */
export declare function resolveRole(manifest: PetManifest, role: string, rng?: Rng): string | null;
/** True when the pet defines the role itself rather than through a fallback. */
export declare function hasOwnRole(manifest: PetManifest, role: string): boolean;
