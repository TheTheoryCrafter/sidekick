import { describe, expect, it } from 'vitest';
import { Behavior, normalizeAction, normalizeRule, pickRange } from '../src/core/behavior';
import { DEFAULT_RULES, defaultBehavior, DEFAULT_CONDITIONS, SLEEPY_AFTER_MS } from '../src/core/defaults';
import { validateManifest } from '../src/core/manifest';
import { ROLES_WITHOUT_DEFAULT, roleCandidates } from '../src/core/roles';
import creamCat from '../pets/cream-cat/manifest.json';

describe('normalizeAction', () => {
  it('turns the single-step shorthand into steps', () => {
    const { action, warnings } = normalizeAction({ id: 'sit', role: 'ambient', duration: [1, 2] });
    expect(warnings).toEqual([]);
    expect(action).toEqual({ id: 'sit', steps: [{ role: 'ambient', duration: [1, 2] }], interruptible: true });
  });

  it('keeps valid steps and warns about bad ones', () => {
    const { action, warnings } = normalizeAction({
      id: 'a',
      interruptible: false,
      next: 'b',
      steps: [{ role: 'x', motion: 'fly', duration: 'long' }, { nope: 1 }, { role: 'y', speed: 2, emit: 'poop' }],
    });
    expect(action?.steps).toEqual([{ role: 'x' }, { role: 'y', speed: 2, emit: 'poop' }]);
    expect(action?.interruptible).toBe(false);
    expect(action?.next).toBe('b');
    expect(warnings).toHaveLength(3);
  });

  it('rejects actions without id or steps', () => {
    expect(normalizeAction({ role: 'x' }).action).toBeNull();
    expect(normalizeAction({ id: 'a', steps: [] }).action).toBeNull();
    expect(normalizeAction({ id: 'a', duration: 5 }).action).toBeNull();
  });
});

describe('normalizeRule', () => {
  it('fills defaults: on tick, chance 1, no cooldown, priority 0', () => {
    expect(normalizeRule({ id: 'r', action: 'a' }).rule).toEqual({ id: 'r', action: 'a', on: 'tick', if: [], chance: 1, cooldown: 0, priority: 0 });
  });

  it('clamps chance and accepts a single condition', () => {
    const { rule } = normalizeRule({ id: 'r', action: 'a', on: 'click', if: 'night', chance: 7, cooldown: -5 });
    expect(rule?.chance).toBe(1);
    expect(rule?.cooldown).toBe(0);
    expect(rule?.if).toEqual(['night']);
  });

  it('warns on a non-numeric field and rejects a rule without action', () => {
    expect(normalizeRule({ id: 'r', action: 'a', priority: 'high' }).warnings).toHaveLength(1);
    expect(normalizeRule({ id: 'r' }).rule).toBeNull();
  });
});

describe('Behavior', () => {
  it('orders rules by priority, keeping registration order for ties', () => {
    const b = new Behavior();
    b.addRule({ id: 'low', on: 'idle', action: 'a', priority: 0 });
    b.addRule({ id: 'high', on: 'idle', action: 'a', priority: 5 });
    b.addRule({ id: 'low2', on: 'idle', action: 'a', priority: 0 });
    b.addRule({ id: 'other', on: 'click', action: 'a', priority: 9 });
    expect(b.rulesFor('idle').map((r) => r.id)).toEqual(['high', 'low', 'low2']);
  });

  it('replaces rules and actions with the same id, and removes rules', () => {
    const b = new Behavior();
    b.addRule({ id: 'r', on: 'idle', action: 'a' });
    b.addRule({ id: 'r', on: 'idle', action: 'b', priority: 3 });
    expect(b.rulesFor('idle')).toHaveLength(1);
    expect(b.rulesFor('idle')[0]!.action).toBe('b');
    b.addAction({ id: 'x', role: 'one' });
    b.addAction({ id: 'x', role: 'two' });
    expect(b.actions.get('x')!.steps[0]!.role).toBe('two');
    expect(b.removeRule('r')).toBe(true);
    expect(b.rulesFor('idle')).toEqual([]);
  });

  it('never throws on garbage input', () => {
    const b = new Behavior();
    expect(b.addAction(42).length).toBeGreaterThan(0);
    expect(b.addRule(null).length).toBeGreaterThan(0);
  });
});

describe('pickRange', () => {
  it('returns a fixed number or interpolates a range', () => {
    expect(pickRange(5, () => 0.9)).toBe(5);
    expect(pickRange([10, 20], () => 0.5)).toBe(15);
  });
});

describe('defaults', () => {
  const cat = validateManifest(creamCat).manifest!;
  const b = defaultBehavior();

  it('every rule points at a default action', () => {
    for (const r of DEFAULT_RULES) expect(b.actions.has(r.action), r.id).toBe(true);
  });

  it('every condition used by a rule exists', () => {
    for (const r of b.allRules()) for (const c of r.if) expect(b.conditions.has(c), `${r.id}: ${c}`).toBe(true);
  });

  it('the cream cat has an animation for every role the defaults use', () => {
    for (const a of b.actions.values()) for (const s of a.steps) {
      if (ROLES_WITHOUT_DEFAULT.has(s.role) && s.role !== 'hide') continue; // extras the cat does not have
      expect(roleCandidates(cat, s.role).length, s.role).toBeGreaterThan(0);
    }
  });

  it('sleepy and night conditions', () => {
    const ctx = { now: SLEEPY_AFTER_MS, hour: 12, action: null, lastDone: {}, payload: undefined, cursor: null, onSurface: false };
    expect(DEFAULT_CONDITIONS.sleepy!(ctx)).toBe(true);
    expect(DEFAULT_CONDITIONS.sleepy!({ ...ctx, lastDone: { sleep: 1000 } })).toBe(false);
    expect(DEFAULT_CONDITIONS.night!(ctx)).toBe(false);
    expect(DEFAULT_CONDITIONS.night!({ ...ctx, hour: 23 })).toBe(true);
    expect(DEFAULT_CONDITIONS.night!({ ...ctx, hour: 3 })).toBe(true);
  });
});
