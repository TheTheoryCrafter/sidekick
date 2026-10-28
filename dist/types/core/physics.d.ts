export interface Vec {
    x: number;
    y: number;
}
export interface AirBounds {
    minX: number;
    maxX: number;
    /** Feet can't go above this (keeps the head on screen). */
    minY: number;
    /** The floor: feet land here. */
    floorY: number;
}
export declare const PHYSICS: {
    /** px/s² */
    readonly gravity: 2600;
    /** Share of speed kept when bouncing off a wall or the ceiling. */
    readonly wallBounce: 0.45;
    /** Share of vertical speed kept when bouncing off the floor. */
    readonly floorBounce: 0.3;
    /** Below this downward speed (px/s) the pet lands instead of bouncing. */
    readonly landSpeed: 700;
    /** Share of horizontal speed kept per floor bounce. */
    readonly floorFriction: 0.6;
    /** Throws are capped at this speed (px/s). */
    readonly maxThrow: 2600;
    /** Pointer history used to measure a throw, ms. */
    readonly throwWindowMs: 90;
};
export interface AirResult {
    pos: Vec;
    vel: Vec;
    /** Set on the step the pet comes to rest on the floor: the downward speed at impact. */
    landed: number | null;
}
/** One step of free flight. With `bounce` off, the pet lands on the first floor contact (deliberate jumps). */
export declare function stepAir(pos: Vec, vel: Vec, dt: number, b: AirBounds, bounce?: boolean): AirResult;
export interface PointerSample {
    t: number;
    x: number;
    y: number;
}
/** Release velocity from recent pointer samples (oldest first), capped at maxThrow. */
export declare function throwVelocity(samples: readonly PointerSample[], now: number): Vec;
