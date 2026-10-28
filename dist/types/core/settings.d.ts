export interface Settings {
    enabled: boolean;
    /** Pet id (folder name). */
    pet: string;
    /** Last horizontal position as a share of the window width, 0..1. */
    x?: number;
}
export declare const STORAGE_VERSION = 1;
/** Read what's stored, keeping only fields that make sense. */
export declare function parseSettings(raw: string | null | undefined): Partial<Settings>;
export declare function serializeSettings(s: Settings): string;
/**
 * Starting settings: what the visitor chose last time wins over the site's
 * defaults, except a stored pet the site no longer offers.
 */
export declare function initialSettings(defaults: Settings, stored: Partial<Settings>, offered: readonly string[]): Settings;
