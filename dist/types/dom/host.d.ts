export declare const HOST_TAG = "sidekick-pet";
export interface Host {
    el: HTMLElement;
    /** Fixed, full-viewport layer for the pet. Ignores the pointer. */
    stage: HTMLElement;
    remove(): void;
}
export declare function createHost(doc: Document): Host;
