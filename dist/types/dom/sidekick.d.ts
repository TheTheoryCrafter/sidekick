import { type ActionInput, type ConditionFn, type RuleDef, type RuleInput } from '../core/behavior';
import { type BrainEffect } from '../core/brain';
import type { Surface } from '../core/surfaces';
/**
 * A pet given as data instead of a folder URL, e.g. the bundled
 * `import creamCat from "sidekick-pet/pets/cream-cat"`.
 */
export interface PetDefinition {
    id: string;
    /** The manifest object (same shape as manifest.json). */
    manifest: unknown;
    /** URL of the sprite sheet (a file URL or a data: URL). */
    sheetUrl: string;
}
/** A pet folder name under `petsBaseUrl`, or a pet given as data. */
export type PetRef = string | PetDefinition;
export interface SidekickOptions {
    /** The pet to show first. Default "cream-cat". */
    pet?: PetRef;
    /** Pets the visitor may switch between (built-in menu, setPet). Default: just `pet`. */
    pets?: PetRef[];
    /** URL of the folder that holds pet folders. Default "/pets/". */
    petsBaseUrl?: string;
    /** Folder URLs for pets that live somewhere else, by id. Wins over `petsBaseUrl`. */
    petUrls?: Record<string, string>;
    /** Whole-number size multiplier. Default 2. */
    scale?: number;
    /** Fixes the random sequence, for demos and tests. */
    seed?: number;
    /**
     * CSS selector for page elements the pet may stand on and jump between,
     * or false to keep it on the floor. Elements inside [data-sidekick-ignore]
     * are always skipped. Default: headings, paragraphs, images, buttons, cards...
     */
    surfaces?: string | false;
    /**
     * Whether the pet poops now and then, or limits: at most `max` poops at once
     * (default 5), each gone after `ttl` ms of activity (default 15 seconds).
     * Clicking a poop clears it. Default true.
     */
    poop?: boolean | {
        max?: number;
        ttl?: number;
    };
    /** Whether the pet starts switched on. The visitor's saved choice wins. Default true. */
    enabled?: boolean;
    /** Remember on/off, pet and position in localStorage. Default true. */
    persist?: boolean;
    /** localStorage key. Default "sidekick:v1". */
    storageKey?: string;
    /** Show a small built-in menu on right-click / long-press, and a button to bring the pet back. Default false. */
    menu?: boolean;
    /** Corner for the button that brings a hidden pet back (with `menu`). Default "bottom-right". */
    restoreButton?: 'bottom-right' | 'bottom-left';
    /** ms without input before the "visitor-idle" event. Default 60000. */
    idleAfter?: number;
    /**
     * "auto" follows the visitor's prefers-reduced-motion setting, "reduced" always keeps
     * the pet from moving on its own, "full" ignores the setting. Default "auto".
     */
    motion?: 'auto' | 'reduced' | 'full';
}
export type SidekickStatus = 'loading' | 'running' | 'paused' | 'disabled' | 'error' | 'destroyed';
/** What listeners registered with on() receive. */
export type SidekickEvent = BrainEffect;
/** The visitor's choices, as passed to subscribe() listeners. */
export interface SidekickSettings {
    enabled: boolean;
    pet: string;
}
export interface SidekickDebug {
    status: SidekickStatus;
    pet: string;
    scale: number;
    simTime: number;
    timeScale: number;
    anim?: string;
    action?: string;
    step?: number;
    priority?: number;
    rule?: string | null;
    stepEndsIn?: number | null;
    x?: number;
    y?: number;
    facing?: 1 | -1;
    /** On the ground, held by the pointer, or flying. */
    mode?: 'ground' | 'held' | 'air';
    cursorNear?: boolean;
    /** ms until each cooling-down rule may fire again. */
    cooldowns?: Record<string, number>;
    lastDone?: Record<string, number>;
    poops?: number;
    rules: readonly RuleDef[];
    actions: string[];
}
/** Where the page's single instance lives, on `window`. */
export declare const INSTANCE: unique symbol;
/** Fired on `window` when the page's instance is created or destroyed (any bundle copy). */
export declare const INSTANCE_EVENT = "sidekick:instance";
export declare const clampScale: (n: unknown) => number;
export declare class Sidekick {
    private win;
    private opts;
    private poopOpts;
    /** Pets given as data, by id. */
    private petDefs;
    private calm;
    private rng;
    private behavior;
    private settings;
    private store;
    private host;
    private menu;
    private restore;
    private m;
    /** Bumped on every mount/unmount so a slow pet load can't mount a stale pet. */
    private generation;
    private petCache;
    private state;
    private simTime;
    private timeScale;
    private status;
    private listeners;
    private settingsListeners;
    private pending;
    private cursor;
    private cursorNear;
    /** Feet minus pointer at the start of a drag, so the pet doesn't jump to the pointer. */
    private grabOffset;
    private globalCleanups;
    constructor(win: Window, options?: SidekickOptions);
    /** Show the pet (and remember the choice). */
    enable(): void;
    /** Hide the pet (and remember the choice). Its poops go with it. */
    disable(): void;
    toggle(): void;
    isEnabled(): boolean;
    /** Switch to another pet from `pets`. Resolves once it is on screen (or right away when hidden). */
    setPet(id: string): Promise<void>;
    /** Current choices: on/off and pet. */
    getSettings(): SidekickSettings;
    /** Pets the visitor can choose from. */
    getPets(): string[];
    /** Listen to on/off and pet changes (from the API, the menu, or another tab). */
    subscribe(listener: (s: SidekickSettings) => void): () => void;
    /** Send an event to the pet's rules, e.g. emit('tool-completed'). Ignored while hidden. */
    emit(name: string, payload?: unknown): void;
    /**
     * Start an action now, ignoring rules. Rules with at least `priority`
     * (default 0) can still interrupt it.
     */
    play(actionId: string, priority?: number): void;
    /** Add or replace an action. Returns warnings (empty when all is well). */
    registerAction(action: ActionInput): string[];
    /** Add or replace a rule. Returns warnings (empty when all is well). */
    registerRule(rule: RuleInput): string[];
    removeRule(id: string): boolean;
    /** Add or replace a named condition that rules can list in `if`. */
    registerCondition(name: string, fn: ConditionFn): void;
    /** Listen to what the pet does. Returns an unsubscribe function. */
    on(listener: (e: SidekickEvent) => void): () => void;
    /** Remove every poop from the page. */
    clearPoops(): void;
    setScale(scale: number): void;
    /** Debug only: run simulated time faster (1–60×). */
    setTimeScale(n: number): void;
    debug(): SidekickDebug;
    /** Debug only: the surfaces the pet currently sees, and the one it stands on. */
    debugSurfaces(): {
        surfaces: Surface[];
        on: number | null;
    };
    /** Remove the pet and everything it added to the page. */
    destroy(): void;
    private mount;
    private unmount;
    private showDisabled;
    private loadPet;
    private watchMotion;
    private fetchPet;
    private loadSheet;
    private syncVisibility;
    private saveX;
    private save;
    private notify;
    /** Another tab changed the settings: follow along without writing back. */
    private applyExternal;
    private openMenu;
    private pixelSize;
    /** The `scale` option times the pet's own size factor. */
    private petScale;
    private ctx;
    /** Surfaces for the brain, with the one underfoot measured fresh so the pet rides scrolling exactly. */
    private surfaces;
    private step;
    /** Emit "near" when the cursor comes close, once per approach. */
    private checkNear;
    /** Where the next poop would go, in viewport px. */
    private nextPoopSpot;
    private poopSpotIsGood;
    /** The poop step finished: drop the pile if the spot is (still) safe. */
    private dropPoop;
    private apply;
    private warn;
    private render;
}
