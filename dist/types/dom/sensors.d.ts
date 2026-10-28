export declare const SENSORS: {
    /** How often to look at the clock and the URL, ms. */
    readonly checkMs: 250;
    /** Away from the tab at least this long before "tab-return" fires, ms. */
    readonly tabAwayMs: 30000;
};
export declare class Sensors {
    private win;
    private emit;
    private idleAfter;
    private idle;
    private lastInput;
    private href;
    private lastCheck;
    private hiddenAt;
    private cleanups;
    constructor(win: Window, emit: (name: string, payload?: unknown) => void, idleAfter: number);
    /** Call often (every frame is fine); it does real work at most every checkMs. */
    tick(): void;
    destroy(): void;
    private visibility;
    private listen;
}
