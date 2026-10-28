export declare const STEP_MS: number;
/** Longer gaps (a stalled tab, a debugger pause) are cut short instead of fast-forwarded. */
export declare const MAX_FRAME_MS = 250;
export interface Advance {
    /** Number of fixed steps to run this frame. */
    steps: number;
    /** Leftover time carried to the next frame. */
    carry: number;
}
export declare function advance(carry: number, frameMs: number, stepMs?: number): Advance;
