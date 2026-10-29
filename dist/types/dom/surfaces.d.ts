import type { Surface } from '../core/surfaces';
/** Elements that make good things to stand on. Hosts can add [data-sidekick-surface]. */
export declare const DEFAULT_SURFACE_SELECTOR: string;
/**
 * Text and links whose box is invisible: the pet would stand on thin air above the words.
 * They count only when drawn as a box (see drawsABox) or opted in with data-sidekick-surface.
 */
export declare const NEEDS_A_BOX: ReadonlySet<string>;
/** Alpha of a computed CSS colour ("rgb(…)", "rgba(…)", "transparent"); 1 if unsure. */
export declare function colorAlpha(color: string): number;
/** Drawn as a box: its own visible fill, background image or top border (a button-style link, a callout). */
export declare function drawsABox(style: Pick<CSSStyleDeclaration, 'backgroundColor' | 'backgroundImage' | 'borderTopWidth' | 'borderTopStyle' | 'borderTopColor'>): boolean;
/**
 * Containers that are often just layout or background: the pet stands on them only when they
 * look like a card (see looksLikeCard) or opt in with data-sidekick-surface.
 */
export declare const NEEDS_A_CARD: ReadonlySet<string>;
type CardStyle = Pick<CSSStyleDeclaration, 'backgroundColor' | 'borderTopWidth' | 'borderTopStyle' | 'borderTopColor' | 'boxShadow' | 'position' | 'opacity'>;
/** Parsed rgb of a computed colour, or null. */
export declare function colorRgb(color: string): [number, number, number] | null;
/**
 * A box drawn as a card: a visible top border, a shadow, or a fill that stands out from
 * what is behind it. Never a background: gradients alone don't count, a box as wide as the
 * page counts only with a visible top border line, and a fixed or absolute box covering much
 * of the screen (an overlay) never does.
 */
export declare function looksLikeCard(style: CardStyle, box: {
    width: number;
    height: number;
    viewportWidth: number;
    viewportHeight: number;
    behind: string;
}): boolean;
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
    private isBoxed;
    private isCard;
    /** The nearest mostly opaque background colour behind an element, from its ancestors. */
    private colourBehind;
    private measure;
}
export {};
