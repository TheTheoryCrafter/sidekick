export declare const PESTER: {
    /** This many clicks or taps... */
    readonly clicks: 5;
    /** ...within this window, ms, upsets the pet. */
    readonly windowMs: 4000;
};
/** Record a click at `now`. Returns the clicks still in the window and whether that was one too many. */
export declare function recordClick(times: readonly number[], now: number, limits?: {
    clicks: number;
    windowMs: number;
}): {
    times: number[];
    pestered: boolean;
};
