import type { SidekickOptions } from '../dom/sidekick';
type Data = Readonly<Record<string, string | undefined>>;
/**
 * Supported: data-pet, data-pets ("a,b"), data-pets-base, data-scale,
 * data-surfaces ("false" or a selector), data-poop ("false"), data-poop-max,
 * data-poop-ttl (ms), data-enabled, data-persist, data-storage-key, data-menu,
 * data-idle-after (ms), data-motion ("auto" | "reduced" | "full"),
 * data-restore-button ("bottom-right" | "bottom-left").
 */
export declare function optionsFromDataset(d: Data, defaultPetsBase: string): SidekickOptions;
export {};
