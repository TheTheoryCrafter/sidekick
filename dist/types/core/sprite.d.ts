import type { AnimationDef, PetManifest } from './manifest';
export interface FrameRect {
    x: number;
    y: number;
    w: number;
    h: number;
}
/** Where frame `index` of `anim` sits on the sheet, in sheet pixels. */
export declare function frameRect(manifest: PetManifest, anim: AnimationDef, index: number): FrameRect;
export interface FrameState {
    frame: number;
    /** True once a non-looping animation has shown its last frame for a full frame time. */
    done: boolean;
}
/** Which frame shows `elapsedMs` after the animation started. */
export declare function frameAt(anim: AnimationDef, elapsedMs: number): FrameState;
/** How long one pass of the animation takes, in ms. */
export declare function animationDuration(anim: AnimationDef): number;
