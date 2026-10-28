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
    expect(extrasOf(load('cream-cat'))).toEqual(['broom', 'hide', 'poopEntity', 'snack']);
    for (const d of DOGS) expect(extrasOf(load(d)), d).toEqual(['bark', 'sniff']);
    expect(extrasOf(load('panda'))).toEqual(['snack', 'think', 'wave', 'yoga']);
  });

  it('pet sizes: the cat one crisp step below scale 2, dogs bigger than it, the panda about its size', () => {
    expect(load('cream-cat').scale).toBe(0.7);
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

  it('broom zoomies: the cat flies fast on its broom; pets without one never try', () => {
    const cat = load('cream-cat');
    const ctx = ctxFor(cat, { rng: () => 0.5 });
    const s = play(createBrain(100, ctx), 'broom-zoomies', ctx).state;
    expect(s.anim).toBe('broom');
    expect(s.action!.speed).toBe(240); // walk speed 60 × 4
    expect(Math.abs(s.action!.targetX! - 100)).toBeGreaterThanOrEqual(400);
    const rule = ctx.behavior.rulesFor('idle').find((r) => r.id === 'broom-zoomies')!;
    expect([rule.chance, rule.cooldown, rule.priority]).toEqual([0.05, 120_000, 39]);
    expect(roleCandidates(load('husky'), 'broom')).toEqual([]);
  });

  it('the cat snacks in its free time, half as often as the panda', () => {
    const cat = load('cream-cat');
    const ctx = ctxFor(cat);
    const s = play(createBrain(500, ctx), 'snack', ctx).state;
    expect(s.anim).toBe('eat');
    const rule = ctx.behavior.rulesFor('idle').find((r) => r.id === 'snack')!;
    expect(rule.scaleBy).toBe('appetite');
    const effective = (m: PetManifest) => Math.min(1, rule.chance * m.traits.appetite * 2);
    expect(effective(cat)).toBeCloseTo(0.06);
    expect(effective(load('panda'))).toBeCloseTo(0.12);
    // Leans in (0.75 s), munches until the 5–8 s step ends, lifts its head, then licks its paw.
    const seen: string[] = [];
    let t = s;
    for (let now = 0; now < 7000; now += 1000 / 60) {
      t = stepBrain(t, { ...ctx, now }).state;
      if (seen[seen.length - 1] !== t.anim) seen.push(t.anim);
      if (now > 900 && now < 4900) expect(t.anim, `${Math.round(now)} ms`).toBe('eat-munch');
    }
    expect(seen).toEqual(['eat', 'eat-munch', 'eat-finish', 'groom']);
    expect(t.action?.id).toBe('snack');
  });

  it('"next" is validated: an unknown follow-up is dropped with a warning', () => {
    const v = validateManifest({ id: 'p', sheet: 's.png', frameSize: [32, 32], animations: { a: { row: 0, frames: 2, fps: 4, loop: false, next: 'nope' }, b: { row: 1, frames: 1, fps: 1, loop: false, next: 'a' } } });
    expect(v.manifest!.animations.a!.next).toBeUndefined();
    expect(v.manifest!.animations.b!.next).toBe('a');
    expect(v.warnings.join()).toContain('"nope"');
  });

  it('eating after a tool finishes ends by lifting its head; a dog just idles a moment', () => {
    const ctx = ctxFor(load('cream-cat'));
    let s = play(createBrain(500, ctx), 'eat', ctx).state;
    const seen: string[] = [];
    // 4 s at the bowl, then 1.5 s for "full" (the shortest of each range).
    for (let now = 0; now < 5400; now += 1000 / 60) {
      s = stepBrain(s, { ...ctx, now }).state;
      if (seen[seen.length - 1] !== s.anim) seen.push(s.anim);
    }
    expect(seen).toEqual(['eat', 'eat-munch', 'eat-finish', 'groom']);
    expect(s.action?.id).toBe('eat');
    const husky = load('husky');
    expect(roleCandidates(husky, 'full')).toEqual(roleCandidates(husky, 'ambient'));
  });

  it('too many clicks make the cat cry, and more clicks do not cut it short', () => {
    const ctx = ctxFor(load('cream-cat'));
    const crying = dispatch(play(createBrain(500, ctx), 'startle', ctx).state, 'pestered', ctx).state;
    expect(crying.action?.id).toBe('cry');
    expect(crying.anim).toBe('cry');
    expect(dispatch(crying, 'click', ctx).state.action?.id).toBe('cry');
    expect(roleCandidates(load('panda'), 'upset')).toEqual(['cry']);
    // Dogs fall back to their after-a-throw snarl.
    expect(roleCandidates(load('husky'), 'upset')).toEqual(['attack']);
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
