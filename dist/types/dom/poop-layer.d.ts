import type { PetManifest } from '../core/manifest';
import { type PoopOptions } from '../core/poop';
import type { SheetInfo } from './sprite-view';
/** Anything a visitor might want to click. Poop never lands on or over these. */
export declare const INTERACTIVE_SELECTOR: string;
export declare class PoopLayer {
    private win;
    private stage;
    /** Poops are drawn under this element (the pet). */
    private below;
    private host;
    private manifest;
    private sheet;
    private anim;
    private opts;
    private onCleaned;
    private placed;
    private nextId;
    private box;
    constructor(win: Window, stage: HTMLElement, 
    /** Poops are drawn under this element (the pet). */
    below: Element, host: Element, manifest: PetManifest, sheet: SheetInfo, anim: string, opts: PoopOptions, onCleaned: () => void);
    get count(): number;
    get hasRoom(): boolean;
    /** Whether a poop at viewport (x, y) would cover nothing clickable. */
    isSafeAt(x: number, y: number, px: number): boolean;
    /** Drop a poop with its feet at viewport (x, y), pinned to `on` (or the page). */
    drop(x: number, y: number, on: Element | null, now: number, px: number): void;
    /** Remove poops past their time. Call with sim time. */
    expire(now: number): void;
    render(now: number, px: number, dpr: number): void;
    clear(): void;
    destroy(): void;
    /** The innermost page element behind the pile that isn't <html>, <body> or ours. */
    private contentBehind;
    /** How far the page has scrolled, whether the window or <body> is the scroller. */
    private scroll;
    private position;
    private footprint;
    private create;
    /** Fade a poop out (or drop it at once). Returns false if it was already gone. */
    private remove;
    /** Find the pile's opaque area so clicks and the safety check match what's drawn. */
    private measureBox;
}
