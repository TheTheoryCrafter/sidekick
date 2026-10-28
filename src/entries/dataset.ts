// data-* attributes on the <script> tag → options. Pure, so it is unit-tested.

import type { SidekickOptions } from '../dom/sidekick';

type Data = Readonly<Record<string, string | undefined>>;

/** Present without a value, or "true", means true. "false" means false. */
function bool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  return v !== 'false' && v !== '0';
}

function num(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const list = (v: string | undefined) => v?.split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Supported: data-pet, data-pets ("a,b"), data-pets-base, data-scale,
 * data-surfaces ("false" or a selector), data-poop ("false"), data-poop-max,
 * data-poop-ttl (ms), data-enabled, data-persist, data-storage-key, data-menu,
 * data-idle-after (ms), data-motion ("auto" | "reduced" | "full"),
 * data-restore-button ("bottom-right" | "bottom-left").
 */
export function optionsFromDataset(d: Data, defaultPetsBase: string): SidekickOptions {
  const o: SidekickOptions = { petsBaseUrl: d.petsBase || defaultPetsBase };
  if (d.pet) o.pet = d.pet;
  const pets = list(d.pets);
  if (pets?.length) o.pets = pets;
  const scale = num(d.scale);
  if (scale !== undefined) o.scale = scale;
  if (d.surfaces !== undefined) o.surfaces = d.surfaces === 'false' ? false : d.surfaces || undefined;
  if (o.surfaces === undefined) delete o.surfaces;

  const poop = bool(d.poop);
  const max = num(d.poopMax);
  const ttl = num(d.poopTtl);
  if (poop === false) o.poop = false;
  else if (max !== undefined || ttl !== undefined) o.poop = { ...(max !== undefined ? { max } : {}), ...(ttl !== undefined ? { ttl } : {}) };

  const enabled = bool(d.enabled);
  if (enabled !== undefined) o.enabled = enabled;
  const persist = bool(d.persist);
  if (persist !== undefined) o.persist = persist;
  if (d.storageKey) o.storageKey = d.storageKey;
  const menu = bool(d.menu);
  if (menu !== undefined) o.menu = menu;
  if (d.restoreButton === 'bottom-left' || d.restoreButton === 'bottom-right') o.restoreButton = d.restoreButton;
  const idle = num(d.idleAfter);
  if (idle !== undefined) o.idleAfter = idle;
  if (d.motion === 'auto' || d.motion === 'reduced' || d.motion === 'full') o.motion = d.motion;
  return o;
}
