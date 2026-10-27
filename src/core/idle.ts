// Visitor presence: "visitor-idle" after a stretch without input, then
// "visitor-return" on the next input. Pure; the page layer feeds it real time.

export interface IdleState {
  /** Real time of the last input, ms. */
  last: number;
  idle: boolean;
}

export type IdleEvent = 'visitor-idle' | 'visitor-return' | null;

export const createIdle = (now: number): IdleState => ({ last: now, idle: false });

/** The visitor did something. */
export function noteActivity(s: IdleState, now: number): { state: IdleState; event: IdleEvent } {
  return { state: { last: now, idle: false }, event: s.idle ? 'visitor-return' : null };
}

/** Check whether the visitor has gone quiet for `after` ms. */
export function checkIdle(s: IdleState, now: number, after: number): { state: IdleState; event: IdleEvent } {
  if (s.idle || now - s.last < after) return { state: s, event: null };
  return { state: { ...s, idle: true }, event: 'visitor-idle' };
}
