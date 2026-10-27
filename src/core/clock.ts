// Fixed-timestep accumulator. The simulation always advances in equal steps,
// whatever the display refresh rate, so behavior is the same on 60 Hz and 144 Hz.

export const STEP_MS = 1000 / 60;
/** Longer gaps (a stalled tab, a debugger pause) are cut short instead of fast-forwarded. */
export const MAX_FRAME_MS = 250;

export interface Advance {
  /** Number of fixed steps to run this frame. */
  steps: number;
  /** Leftover time carried to the next frame. */
  carry: number;
}

export function advance(carry: number, frameMs: number, stepMs = STEP_MS): Advance {
  const total = carry + Math.min(Math.max(0, frameMs), MAX_FRAME_MS);
  const steps = Math.floor(total / stepMs);
  return { steps, carry: total - steps * stepMs };
}
