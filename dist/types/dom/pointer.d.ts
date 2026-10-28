import { type Vec } from '../core/physics';
export interface PointerHandlers {
    hover(): void;
    click(kind: 'click' | 'dblclick' | 'tap'): void;
    /** A drag started at `at` (where the pointer went down). */
    grab(at: Vec): void;
    drag(to: Vec): void;
    /** Let go, with the pointer's velocity in px/s. */
    release(vel: Vec): void;
    /** Mouse/pen position in the viewport, or null once it leaves the page. */
    cursor(pos: Vec | null): void;
    /** Right-click or long-press on the pet. Without it, both do nothing. */
    menu?(at: Vec): void;
}
export declare const GESTURE: {
    /** Movement before a press becomes a drag, px. */
    readonly dragMouse: 5;
    readonly dragTouch: 10;
    /** Longest press that still counts as a click, ms. */
    readonly clickMs: 500;
    /** Two clicks closer than this make a double-click, ms. */
    readonly doubleMs: 350;
    /** Holding still this long opens the menu, ms. */
    readonly longPressMs: 550;
};
export declare class PointerInput {
    private win;
    private hit;
    private h;
    private press;
    private dragging;
    private samples;
    private lastClick;
    private longPress;
    /** The current press opened the menu, so it is not a click or a drag. */
    private pressOpenedMenu;
    private cleanups;
    constructor(win: Window, hit: HTMLElement, h: PointerHandlers);
    get isDragging(): boolean;
    destroy(): void;
    private down;
    private move;
    private up;
    private cancel;
    private cancelLongPress;
    private reset;
    private on;
}
