import { type Settings } from '../core/settings';
export declare const DEFAULT_STORAGE_KEY = "sidekick:v1";
export declare class SettingsStore {
    private win;
    private key;
    private enabled;
    private cleanup;
    constructor(win: Window, key: string, enabled: boolean);
    read(): Partial<Settings>;
    write(s: Settings): void;
    /** Changes made in another tab of the same site. */
    onExternalChange(fn: (s: Partial<Settings>) => void): void;
    destroy(): void;
}
