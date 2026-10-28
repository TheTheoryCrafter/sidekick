import type { Sidekick as SidekickInstance, SidekickEvent, SidekickOptions } from './index';
export type { SidekickOptions, SidekickEvent, PetDefinition, PetRef } from './index';
export interface SidekickProps extends SidekickOptions {
    /** Everything the pet does (actions, events). */
    onEvent?: (e: SidekickEvent) => void;
}
/**
 * Puts the pet on the page. Render it once near the root (outside your
 * routes, so it survives navigation). Options are read on first mount only.
 */
export declare function Sidekick(props: SidekickProps): null;
export interface SidekickControls {
    /** The pet instance exists (it may still be loading). */
    ready: boolean;
    enabled: boolean;
    /** Current pet id, or null before the pet exists. */
    pet: string | null;
    pets: string[];
    enable(): void;
    disable(): void;
    toggle(): void;
    setPet(id: string): Promise<void>;
    emit(name: string, payload?: unknown): void;
    /** The underlying instance, for everything else (registerRule, on...). */
    instance: SidekickInstance | null;
}
/** Read and change the pet's settings from any component. Re-renders on change. */
export declare function useSidekick(): SidekickControls;
