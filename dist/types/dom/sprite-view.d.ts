import type { PetManifest } from '../core/manifest';
export interface SheetInfo {
    url: string;
    width: number;
    height: number;
}
export interface DrawArgs {
    anim: string;
    /** ms since the animation started */
    elapsed: number;
    /** Feet position in viewport CSS px. */
    x: number;
    y: number;
    facing: 1 | -1;
    scale: number;
    dpr: number;
    /** Cursor over the hitbox: "grab", or "grabbing" while dragging. */
    cursor: 'grab' | 'grabbing';
}
export declare class SpriteView {
    private manifest;
    private sheet;
    readonly el: HTMLDivElement;
    /** Transparent element over the pet that receives pointer events. */
    readonly hit: HTMLDivElement;
    private last;
    constructor(doc: Document, parent: HTMLElement, manifest: PetManifest, sheet: SheetInfo);
    /** Size of one sheet pixel in CSS px: a whole number of device pixels. */
    static pixelSize(scale: number, dpr: number): number;
    draw(a: DrawArgs): void;
    remove(): void;
}
