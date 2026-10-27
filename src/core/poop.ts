// Poop bookkeeping: where a poop goes, how many may stay, and when they expire.
// Pure — the DOM layer places, draws and removes the elements.

export interface PoopOptions {
  /** Most poops on the page at once; dropping one more removes the oldest. */
  max: number;
  /** ms of simulated time before a poop disappears on its own. */
  ttl: number;
}

export const DEFAULT_POOP: PoopOptions = { max: 5, ttl: 10 * 60_000 };

export interface Poop<A = unknown> {
  id: number;
  /** Sim time it was dropped. */
  born: number;
  /** Where it is pinned: the DOM layer's anchor (a page position or an element). */
  anchor: A;
}

/** Where a poop lands: behind the pet (on the tail side), at its feet. */
export function poopSpot(x: number, y: number, facing: 1 | -1, petW: number): { x: number; y: number } {
  return { x: x - facing * petW * 0.6, y };
}

/** Add a poop, dropping the oldest ones beyond `max`. */
export function addPoop<A>(list: readonly Poop<A>[], poop: Poop<A>, max: number): { list: Poop<A>[]; removed: Poop<A>[] } {
  const all = [...list, poop];
  const extra = Math.max(0, all.length - Math.max(0, max));
  return { list: all.slice(extra), removed: all.slice(0, extra) };
}

/** Split poops into those still fresh and those past `ttl`. */
export function expirePoops<A>(list: readonly Poop<A>[], now: number, ttl: number): { list: Poop<A>[]; removed: Poop<A>[] } {
  const keep: Poop<A>[] = [];
  const removed: Poop<A>[] = [];
  for (const p of list) (now - p.born >= ttl ? removed : keep).push(p);
  return { list: keep, removed };
}

export function normalizePoopOptions(input: unknown): PoopOptions | null {
  if (input === false) return null;
  const o = typeof input === 'object' && input !== null ? (input as Partial<Record<keyof PoopOptions, unknown>>) : {};
  const num = (v: unknown, d: number, min: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min ? v : d);
  return { max: Math.floor(num(o.max, DEFAULT_POOP.max, 1)), ttl: num(o.ttl, DEFAULT_POOP.ttl, 1000) };
}
