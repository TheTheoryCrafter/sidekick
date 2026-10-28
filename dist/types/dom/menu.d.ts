export interface MenuItem {
    label: string;
    onSelect: () => void;
}
export declare class Menu {
    private win;
    private stage;
    private el;
    private cleanups;
    constructor(win: Window, stage: HTMLElement);
    get isOpen(): boolean;
    /** Open above (x, y) in viewport px, kept on screen. */
    open(items: MenuItem[], x: number, y: number): void;
    close(): void;
}
/** A small paw in the corner that brings a hidden pet back. */
export declare class RestoreButton {
    private el;
    constructor(win: Window, stage: HTMLElement, onClick: () => void, title: string, corner?: 'bottom-right' | 'bottom-left');
    remove(): void;
}
