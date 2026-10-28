export interface IdleState {
    /** Real time of the last input, ms. */
    last: number;
    idle: boolean;
}
export type IdleEvent = 'visitor-idle' | 'visitor-return' | null;
export declare const createIdle: (now: number) => IdleState;
/** The visitor did something. */
export declare function noteActivity(s: IdleState, now: number): {
    state: IdleState;
    event: IdleEvent;
};
/** Check whether the visitor has gone quiet for `after` ms. */
export declare function checkIdle(s: IdleState, now: number, after: number): {
    state: IdleState;
    event: IdleEvent;
};
