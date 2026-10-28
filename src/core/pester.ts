// Notices when the visitor keeps clicking the pet. Pure: the caller keeps the list
// of recent click times and passes sim time in.

export const PESTER = {
  /** This many clicks or taps... */
  clicks: 5,
  /** ...within this window, ms, upsets the pet. */
  windowMs: 4000,
} as const;

/** Record a click at `now`. Returns the clicks still in the window and whether that was one too many. */
export function recordClick(times: readonly number[], now: number, limits: { clicks: number; windowMs: number } = PESTER): { times: number[]; pestered: boolean } {
  const recent = [...times.filter((t) => now - t < limits.windowMs), now];
  // Start counting afresh after an outburst, so it takes another full round to set it off again.
  return recent.length >= limits.clicks ? { times: [], pestered: true } : { times: recent, pestered: false };
}
