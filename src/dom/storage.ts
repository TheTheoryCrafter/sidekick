// localStorage for the visitor's settings. Every access is guarded: storage can
// be missing, full, or blocked (private mode, sandboxed iframes, cookie settings).

import { parseSettings, serializeSettings, type Settings } from '../core/settings';

export const DEFAULT_STORAGE_KEY = 'sidekick:v1';

export class SettingsStore {
  private cleanup: (() => void) | null = null;

  constructor(private win: Window, private key: string, private enabled: boolean) {}

  read(): Partial<Settings> {
    if (!this.enabled) return {};
    try {
      return parseSettings(this.win.localStorage.getItem(this.key));
    } catch {
      return {};
    }
  }

  write(s: Settings): void {
    if (!this.enabled) return;
    try {
      this.win.localStorage.setItem(this.key, serializeSettings(s));
    } catch {
      // Storage full or blocked: the setting just won't survive a reload.
    }
  }

  /** Changes made in another tab of the same site. */
  onExternalChange(fn: (s: Partial<Settings>) => void): void {
    if (!this.enabled || this.cleanup) return;
    const listener = (e: StorageEvent) => {
      if (e.key === this.key) fn(parseSettings(e.newValue));
    };
    this.win.addEventListener('storage', listener);
    this.cleanup = () => this.win.removeEventListener('storage', listener);
  }

  destroy(): void {
    this.cleanup?.();
    this.cleanup = null;
  }
}
