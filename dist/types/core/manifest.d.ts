export interface AnimationDef {
    /** Row in the sprite sheet (0-based). */
    row: number;
    /** Number of frames, read left to right starting at `col`. */
    frames: number;
    fps: number;
    loop: boolean;
    /** A one-shot that stays on its last frame for the rest of a longer step (a collapse, lying down). */
    hold?: boolean;
    /** First column of the animation (0-based). Defaults to 0. */
    col?: number;
    /**
     * Frame size for this animation when it differs from `frameSize` (art that needs more room,
     * like a cat on a broom). The strip starts at `row` × frame height and `col` × this width,
     * and is drawn with its bottom centre on the pet's anchor.
     */
    size?: [number, number];
    label?: string;
}
/** A role maps to one animation, or to several that are picked at random. */
export type RoleValue = string | string[];
export interface Traits {
    /** Multiplier on walk/run speed. */
    speed: number;
    /** 0..1, how eager the pet is to jump onto page elements. */
    jumpiness: number;
    /** 0..1, how much the pet likes to stay near the cursor. */
    clinginess: number;
}
export interface PetManifest {
    id: string;
    name: string;
    /** Sheet file name, relative to the manifest. */
    sheet: string;
    frameSize: [number, number];
    /** Optional; used to check that animations fit inside the sheet. */
    sheetSize?: [number, number];
    /** Point inside a frame that sits on the ground, in sheet pixels. */
    anchor: [number, number];
    /** Direction the artwork faces. The renderer mirrors it for the other way. */
    facing: 'left' | 'right';
    /** Clickable area inside a frame as [x, y, width, height] in sheet px. Default: the whole frame. */
    hitbox: [number, number, number, number];
    animations: Record<string, AnimationDef>;
    roles: Record<string, RoleValue>;
    traits: Traits;
    /** Size relative to the `scale` option: 0.5 draws 64 px art like 32 px art. Default 1. */
    scale: number;
}
export interface ValidationResult {
    manifest: PetManifest | null;
    errors: string[];
    warnings: string[];
}
export declare const DEFAULT_TRAITS: Traits;
export declare function validateManifest(input: unknown): ValidationResult;
