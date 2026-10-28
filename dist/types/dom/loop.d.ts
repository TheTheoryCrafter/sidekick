export declare class Loop {
    private win;
    private step;
    private render;
    private raf;
    private lastTs;
    private carry;
    constructor(win: Window, step: (dtMs: number) => void, render: () => void);
    get running(): boolean;
    start(): void;
    stop(): void;
    private frame;
}
