// What the visitor's browser remembers about the pet. Pure parsing so a
// corrupted or foreign value in localStorage can never break the page.

export interface Settings {
  enabled: boolean;
  /** Pet id (folder name). */
  pet: string;
  /** Last horizontal position as a share of the window width, 0..1. */
  x?: number;
}

export const STORAGE_VERSION = 1;

/** Read what's stored, keeping only fields that make sense. */
export function parseSettings(raw: string | null | undefined): Partial<Settings> {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== 'object' || data === null || (data as { v?: unknown }).v !== STORAGE_VERSION) return {};
  const d = data as Record<string, unknown>;
  const out: Partial<Settings> = {};
  if (typeof d.enabled === 'boolean') out.enabled = d.enabled;
  if (typeof d.pet === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(d.pet)) out.pet = d.pet;
  if (typeof d.x === 'number' && d.x >= 0 && d.x <= 1) out.x = d.x;
  return out;
}

export function serializeSettings(s: Settings): string {
  return JSON.stringify({ v: STORAGE_VERSION, enabled: s.enabled, pet: s.pet, ...(s.x === undefined ? {} : { x: Math.round(s.x * 1000) / 1000 }) });
}

/**
 * Starting settings: what the visitor chose last time wins over the site's
 * defaults, except a stored pet the site no longer offers.
 */
export function initialSettings(defaults: Settings, stored: Partial<Settings>, offered: readonly string[]): Settings {
  const pet = stored.pet && offered.includes(stored.pet) ? stored.pet : defaults.pet;
  return { enabled: stored.enabled ?? defaults.enabled, pet, ...(stored.x === undefined ? {} : { x: stored.x }) };
}
