import type { Vec } from './physics';
import type { Rng } from './rng';
export interface Surface {
    /** Stable id for the element while it stays on the page. */
    id: number;
    /** Viewport px. The pet's feet may stand anywhere in [left, right] at y = top. */
    left: number;
    right: number;
    top: number;
}
export interface JumpTarget {
    /** Surface to land on, or null for the floor. */
    id: number | null;
    x: number;
    y: number;
}
export interface JumpLimits {
    /** Pet size in CSS px. */
    petW: number;
    petH: number;
    /** Highest the feet may go. */
    minY: number;
    floorY: number;
    minX: number;
    maxX: number;
}
export declare const JUMP: {
    /** Highest jump, in pet heights. */
    readonly maxUp: 4;
    /** Furthest jump sideways, in pet widths. */
    readonly maxSide: 7;
    /** Apex sits this many pet heights above the higher end of the jump. */
    readonly apexRise: 0.6;
};
/**
 * The surface a falling pet lands on between prevY and y at column x, if any:
 * the highest top edge it crossed on the way down.
 */
export declare function landingSurface(prevY: number, y: number, x: number, surfaces: readonly Surface[]): Surface | null;
/** Somewhere new to jump to from (x, y), or null when nothing is in reach. */
export declare function findJumpTarget(from: Vec, on: number | null, surfaces: readonly Surface[], lim: JumpLimits, rng: Rng): JumpTarget | null;
/** Launch velocity for a ballistic jump from `from` to `to` under `gravity` (px/s²). */
export declare function jumpVelocity(from: Vec, to: Vec, apexRise: number, gravity: number, minY?: number): Vec;
