export interface PoopOptions {
    /** Most poops on the page at once; dropping one more removes the oldest. */
    max: number;
    /** ms of simulated time before a poop disappears on its own. */
    ttl: number;
}
export declare const DEFAULT_POOP: PoopOptions;
export interface Poop<A = unknown> {
    id: number;
    /** Sim time it was dropped. */
    born: number;
    /** Where it is pinned: the DOM layer's anchor (a page position or an element). */
    anchor: A;
}
/** Where a poop lands: behind the pet (on the tail side), at its feet. */
export declare function poopSpot(x: number, y: number, facing: 1 | -1, petW: number): {
    x: number;
    y: number;
};
/** Add a poop, dropping the oldest ones beyond `max`. */
export declare function addPoop<A>(list: readonly Poop<A>[], poop: Poop<A>, max: number): {
    list: Poop<A>[];
    removed: Poop<A>[];
};
/** Split poops into those still fresh and those past `ttl`. */
export declare function expirePoops<A>(list: readonly Poop<A>[], now: number, ttl: number): {
    list: Poop<A>[];
    removed: Poop<A>[];
};
export declare function normalizePoopOptions(input: unknown): PoopOptions | null;
