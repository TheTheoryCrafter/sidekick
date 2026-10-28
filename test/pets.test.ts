// The bundled pets: manifests are clean, and the extras each one has drive its behavior.
import { describe, expect, it } from 'vitest';
import { createBrain, dispatch, play, stepBrain, type BrainCtx, type BrainState } from '../src/core/brain';
import { defaultBehavior } from '../src/core/defaults';
import { validateManifest, type PetManifest } from '../src/core/manifest';
import { ROLES_WITHOUT_DEFAULT, hasOwnRole, roleCandidates } from '../src/core/roles';
import { frameAt } from '../src/core/sprite';
import creamCat from '../pets/cream-cat/manifest.json';
import dalmatian from '../pets/dalmatian/manifest.json';
import goldenRetriever from '../pets/golden-retriever/manifest.json';
import husky from '../pets/husky/manifest.json';
import labrador from '../pets/labrador/manifest.json';
import panda from '../pets/panda/manifest.json';
import rottweiler from '../pets/rottweiler/manifest.json';

const RAW: Record<string, unknown> = { 'cream-cat': creamCat, dalmatian, 'golden-retriever': goldenRetriever, husky, labrador, panda, rottweiler };

const DOGS = ['dalmatian', 'husky', 'labrador', 'rottweiler', 'golden-retriever'];
const PETS = ['cream-cat', ...DOGS, 'panda'];
const load = (id: string): PetManifest => {
  const v = validateManifest(RAW[id]);
  expect(v.errors, id).toEqual([]);
  expect(v.warnings, id).toEqual([]);
  return v.manifest!;
};
const ctxFor = (m: PetManifest, over: Partial<BrainCtx> = {}): BrainCtx => ({
  now: 0, dt: 1 / 60, rng: () => 0, manifest: m, behavior: defaultBehavior(), minX: 0, maxX: 1000, minY: 50, floorY: 600,
  petW: 64, petH: 64, walkSpeed: 60, hour: 12, cursor: null, surfaces: [], calm: !hasOwnRole(m, 'move'), ...over,
});
const extrasOf = (m: PetManifest) => [...ROLES_WITHOUT_DEFAULT].filter((r) => roleCandidates(m, r).length > 0).sort();

describe('bundled pets', () => {
  it.each(PETS)('%s: valid, and every role the defaults need resolves', (id) => {
    const m = load(id);
    for (const a of defaultBehavior().actions.values()) for (const s of a.steps) {
      if (!ROLES_WITHOUT_DEFAULT.has(s.role)) expect(roleCandidates(m, s.role).length, `${id} ${s.role}`).toBeGreaterThan(0);
    }
  });

  it('each pet has its own extras', () => {
    expect(extrasOf(load('cream-cat'))).toEqual(['hide', 'poopEntity']);
    for (const d of DOGS) expect(extrasOf(load(d)), d).toEqual(['bark', 'sniff']);
    expect(extrasOf(load('panda'))).toEqual(['full', 'snack', 'think', 'wave', 'yoga']);
  });

  it('64 px pets are scaled down: dogs a little bigger than the 32 px cat, the panda about its size', () => {
    expect(load('cream-cat').scale).toBe(1);
    for (const id of DOGS) expect(load(id).scale, id).toBe(0.75);
    expect(load('panda').scale).toBe(0.5);
  });

  it('the panda has no walk, so it stays put', () => {
    const m = load('panda');
    expect(hasOwnRole(m, 'move')).toBe(false);
    const ctx = ctxFor(m);
    let s: BrainState = createBrain(500, ctx);
    const started = new Set<string>();
    for (let now = 0; now < 5 * 60_000; now += 1000 / 60) {
      const r = stepBrain(s, { ...ctx, now, rng: Math.random });
      s = r.state;
      r.effects.forEach((e) => e.type === 'action-start' && started.add(e.action));
    }
    expect(s.body.x).toBe(500);
    expect([...started].some((a) => ['think', 'yoga', 'snack'].includes(a))).toBe(true);
    for (const a of ['walk', 'zoomies', 'jump', 'sniff', 'hide', 'poop']) expect(started.has(a), a).toBe(false);
  });

  it('a dog sniffs and barks in its free time, and never hides or poops', () => {
    const m = load('labrador');
    const ctx = ctxFor(m);
    let s: BrainState = createBrain(500, ctx);
    const started = new Set<string>();
    for (let now = 0; now < 5 * 60_000; now += 1000 / 60) {
      const r = stepBrain(s, { ...ctx, now, rng: Math.random });
      s = r.state;
      r.effects.forEach((e) => e.type === 'action-start' && started.add(e.action));
    }
    for (const a of ['walk', 'sniff']) expect(started.has(a), a).toBe(true);
    for (const a of ['hide', 'poop', 'think', 'yoga', 'snack']) expect(started.has(a), a).toBe(false);
  });

  it('a collapse (hold) stays on its last frame for the rest of the faint', () => {
    const m = load('husky');
    const ctx = ctxFor(m);
    let s = play(createBrain(500, ctx), 'faint', ctx).state;
    expect(s.anim).toBe('die');
    const die = m.animations.die!;
    for (let now = 0; now < 3900; now += 1000 / 60) s = stepBrain(s, { ...ctx, now }).state;
    expect(s.action?.id).toBe('faint');
    expect(s.anim).toBe('die');
    expect(s.animStart).toBe(0);
    expect(frameAt(die, 3900 - s.animStart).frame).toBe(die.frames - 1);
  });

  it('the panda waves when the page changes; the cat just looks', () => {
    for (const [id, expected] of [['panda', 'wave'], ['cream-cat', 'look'], ['husky', 'look']] as const) {
      const ctx = ctxFor(load(id), { rng: () => 0 });
      const sitting = play(createBrain(500, ctx), 'sit', ctx).state;
      expect(dispatch(sitting, 'page-change', ctx).state.action?.id, id).toBe(expected);
    }
  });
});
