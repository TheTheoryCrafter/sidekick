import type { Surface } from '../core/surfaces';
/** Elements that make good things to stand on. Hosts can add [data-sidekick-surface]. */
export declare const DEFAULT_SURFACE_SELECTOR: string;
export declare const SCAN: {
    /** Rediscover elements this often, ms (route changes, lazy content). */
    readonly rediscoverMs: 2000;
    /** Re-measure at most this often while scrolling or after DOM changes, ms. */
    readonly remeasureMs: 120;
    /** Re-measure at least this often anyway (layout shifts without DOM changes), ms. */
    readonly refreshMs: 1000;
    /** After a DOM change, rediscover elements no sooner than this, ms. */
    readonly rediscoverAfterChangeMs: 250;
    /** Keep at most this many candidates. */
    readonly maxCandidates: 400;
};
interface Limits {
    /** Narrowest surface worth standing on, px. */
    minWidth: number;
    /** Highest top edge allowed (the pet's head must fit above it). */
    minTop: number;
}
export declare class SurfaceScanner {
    private win;
    private selector;
    private host;
    private elements;
    private ids;
    private byId;
    private nextId;
    private cache;
    private discoveredAt;
    private measuredAt;
    private dirty;
    /** The DOM changed since the last discovery (a route change, say). */
    private changed;
    private cleanups;
    constructor(win: Window, selector: string, host: Element);
    destroy(): void;
    /** Current surfaces in viewport px. Cheap to call every frame. */
    list(now: number, lim: Limits): readonly Surface[];
    /** The element behind a surface id, if it is still on the page. */
    elementOf(id: number): Element | null;
    /** Fresh measurement of one surface (the one the pet stands on), or null if it's gone. */
    measureOne(id: number): Surface | null;
    private discover;
    private measure;
}
export {};
