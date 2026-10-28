// Keeps the README's examples honest: they must typecheck (npm run typecheck)
// and the data ones must validate. Update both together.
import { describe, expect, it } from 'vitest';
import { Behavior } from '../src/core/behavior';
import { validateManifest } from '../src/core/manifest';
import { roleCandidates } from '../src/core/roles';
import { DEFAULT_ACTIONS, DEFAULT_RULES, type Sidekick, type SidekickOptions } from '../src/index';
import type { SidekickControls } from '../src/react';

const readmeManifest = {
  id: 'my-dog',
  name: 'My dog',
  sheet: 'my-dog-sheet.png',
  frameSize: [32, 32],
  sheetSize: [256, 192],
  anchor: [16, 32],
  facing: 'right',
  hitbox: [4, 6, 24, 26],
  animations: {
    sit: { row: 0, frames: 6, fps: 6, loop: true },
    walk: { row: 1, frames: 8, fps: 10, loop: true },
    sleep: { row: 2, frames: 4, fps: 3, loop: true },
    yawn: { row: 3, frames: 8, fps: 8, loop: false },
    pile: { row: 4, frames: 4, fps: 4, loop: true },
  },
  roles: { ambient: ['sit', 'yawn'], move: 'walk', sleep: 'sleep', tired: 'yawn', poopEntity: 'pile' },
  traits: { speed: 1, jumpiness: 0.3, clinginess: 0.5 },
};

// Typechecked only: the README's calls against the real API.
export function readmeApiExamples(pet: Sidekick, controls: SidekickControls): void {
  const options: SidekickOptions = {
    pet: 'cream-cat', pets: ['cream-cat'], petsBaseUrl: '/pets/', petUrls: { other: '/x/' }, scale: 2,
    surfaces: false, poop: { max: 5, ttl: 15000 }, enabled: true, persist: true, storageKey: 'sidekick:v1',
    menu: true, restoreButton: 'bottom-left', idleAfter: 60000, motion: 'auto', seed: 1,
  };
  void options;
  pet.registerAction({
    id: 'party',
    steps: [
      { role: 'zoomies', motion: 'run', speed: 4 },
      { role: 'success', duration: 2000 },
      { role: 'zoomies', motion: 'run', emit: 'party-over' },
    ],
  });
  pet.registerAction({ id: 'stare', role: 'near', face: 'cursor', duration: 3000 });
  pet.registerRule({
    id: 'party-time', on: 'party', action: 'party', chance: 0.8, cooldown: 10_000, priority: 65,
    if: ['night'], notDuring: ['sleep'],
  });
  pet.emit('party');
  pet.registerCondition('weekend', ({ now, hour, action, lastDone, payload, cursor, onSurface }) => {
    void [now, hour, action, lastDone, payload, cursor, onSurface];
    return [0, 6].includes(new Date().getDay());
  });
  pet.removeRule('zoomies');
  pet.on((e) => {
    if (e.type === 'action-start') void [e.action, e.rule];
    if (e.type === 'event') void [e.name, e.rule, e.payload];
  });
  const off = pet.subscribe(({ enabled, pet: id }) => void [enabled, id]);
  off();
  void pet.setPet('cream-cat');
  controls.toggle();
  controls.emit('tool-completed');
  void controls.instance?.on(() => {});
}

describe('README examples', () => {
  it('the example manifest is valid and resolves its roles', () => {
    const v = validateManifest(readmeManifest);
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
    const m = v.manifest!;
    expect(roleCandidates(m, 'zoomies')).toEqual(['walk']); // zoomies -> move
    expect(roleCandidates(m, 'click')).toEqual(['sit', 'yawn']); // -> hover -> ambient
    expect(roleCandidates(m, 'poopEntity')).toEqual(['pile']);
  });

  it('the example actions and rules register without warnings', () => {
    const b = new Behavior();
    expect(b.addAction({ id: 'party', steps: [{ role: 'zoomies', motion: 'run', speed: 4 }, { role: 'success', duration: 2000 }, { role: 'zoomies', motion: 'run', emit: 'party-over' }] })).toEqual([]);
    expect(b.addAction({ id: 'stare', role: 'near', face: 'cursor', duration: 3000 })).toEqual([]);
    expect(b.addRule({ id: 'party-time', on: 'party', action: 'party', chance: 0.8, cooldown: 10_000, priority: 65, if: ['night'], notDuring: ['sleep'] })).toEqual([]);
  });

  it('the README default-behavior tables list every default action', () => {
    const ids = DEFAULT_ACTIONS.map((a) => a.id).sort();
    expect(ids).toEqual([
      'approach', 'bark', 'broom-zoomies', 'celebrate', 'eat', 'faint', 'grumble', 'happy', 'hide', 'jump', 'land', 'look',
      'notice', 'poop', 'shy', 'sit', 'sleep', 'snack', 'sniff', 'startle', 'think', 'wake', 'walk', 'wave',
      'yoga', 'zoomies',
    ]);
    expect(DEFAULT_RULES.length).toBeGreaterThan(20);
  });
});
