// React wrapper: <Sidekick /> mounts the page's pet, useSidekick() controls it
// from anywhere (a profile menu, say). SSR-safe and StrictMode-safe.
// The "use client" directive is added to the built file for Next.js.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getInstance, init, watchInstance } from './index';
import type { Sidekick as SidekickInstance, SidekickEvent, SidekickOptions } from './index';

export type { SidekickOptions, SidekickEvent, PetDefinition, PetRef } from './index';

export interface SidekickProps extends SidekickOptions {
  /** Everything the pet does (actions, events). */
  onEvent?: (e: SidekickEvent) => void;
}

/** Components currently mounting <Sidekick />. The pet goes away when the last one unmounts. */
let mounted = 0;

/**
 * Puts the pet on the page. Render it once near the root (outside your
 * routes, so it survives navigation). Options are read on first mount only.
 */
export function Sidekick(props: SidekickProps): null {
  const onEvent = useRef(props.onEvent);
  onEvent.current = props.onEvent;
  const first = useRef(props);

  useEffect(() => {
    mounted++;
    const { onEvent: _ignored, ...options } = first.current;
    const pet = init(options);
    const off = pet?.on((e) => onEvent.current?.(e));
    return () => {
      off?.();
      mounted--;
      // StrictMode unmounts and remounts at once: only tear down if nobody came back.
      setTimeout(() => {
        if (mounted === 0) getInstance()?.destroy();
      }, 0);
    };
  }, []);

  return null;
}

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

interface Snapshot { ready: boolean; enabled: boolean; pet: string | null; pets: string[] }

const SERVER: Snapshot = { ready: false, enabled: false, pet: null, pets: [] };
let cached: Snapshot = SERVER;

function snapshot(): Snapshot {
  const pet = getInstance();
  const next: Snapshot = pet
    ? { ready: true, ...pet.getSettings(), pets: pet.getPets() }
    : SERVER;
  // useSyncExternalStore needs the same object back while nothing changed.
  if (next.ready === cached.ready && next.enabled === cached.enabled && next.pet === cached.pet && next.pets.join() === cached.pets.join()) {
    return cached;
  }
  cached = next;
  return cached;
}

function subscribe(onChange: () => void): () => void {
  let offSettings = getInstance()?.subscribe(onChange);
  const offWatch = watchInstance(() => {
    offSettings?.();
    offSettings = getInstance()?.subscribe(onChange);
    onChange();
  });
  return () => {
    offWatch();
    offSettings?.();
  };
}

const controls = {
  enable: () => getInstance()?.enable(),
  disable: () => getInstance()?.disable(),
  toggle: () => getInstance()?.toggle(),
  setPet: (id: string) => getInstance()?.setPet(id) ?? Promise.resolve(),
  emit: (name: string, payload?: unknown) => getInstance()?.emit(name, payload),
};

/** Read and change the pet's settings from any component. Re-renders on change. */
export function useSidekick(): SidekickControls {
  const s = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  return { ...s, ...controls, instance: getInstance() };
}
