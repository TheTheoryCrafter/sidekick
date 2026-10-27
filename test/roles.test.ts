import { describe, expect, it } from 'vitest';
import { validateManifest, type PetManifest } from '../src/core/manifest';
import { hasOwnRole, resolveRole, roleCandidates } from '../src/core/roles';
import creamCat from '../pets/cream-cat/manifest.json';

const cat = validateManifest(creamCat).manifest!;

function pet(roles: Record<string, string | string[]>): PetManifest {
  return validateManifest({
    id: 'p',
    sheet: 's.png',
    frameSize: [8, 8],
    animations: { a: { row: 0, frames: 1, fps: 1 }, b: { row: 1, frames: 1, fps: 1 }, c: { row: 2, frames: 1, fps: 1 } },
    roles,
  }).manifest!;
}

describe('roles', () => {
  it('resolves roles the pet defines', () => {
    expect(resolveRole(cat, 'move')).toBe('walk');
    expect(resolveRole(cat, 'poopEntity')).toBe('poop-pile');
  });

  it('picks from a list using the rng', () => {
    expect(resolveRole(cat, 'ambient', () => 0)).toBe('idle');
    expect(resolveRole(cat, 'ambient', () => 0.9999)).toBe('curious');
  });

  it('follows the fallback chain for missing roles', () => {
    // cream cat has no "dblclick": dblclick -> click
    expect(resolveRole(cat, 'dblclick')).toBe('shocked');
    // no "near": near -> hover
    expect(resolveRole(cat, 'near')).toBe('teary');
    // no "fall": fall -> dragged
    expect(resolveRole(cat, 'fall')).toBe('held');
  });

  it('falls back to ambient, then to the first animation', () => {
    expect(roleCandidates(pet({ ambient: 'b' }), 'sleep')).toEqual(['b']);
    expect(roleCandidates(pet({}), 'sleep')).toEqual(['a']);
    expect(roleCandidates(pet({}), 'some-host-role')).toEqual(['a']);
  });

  it('walks multi-step chains', () => {
    // tool-used -> success; jump -> landing
    expect(resolveRole(pet({ success: 'c' }), 'tool-used')).toBe('c');
    expect(resolveRole(pet({ landing: 'b' }), 'jump')).toBe('b');
  });

  it('returns nothing for roles without a default', () => {
    expect(resolveRole(pet({ ambient: 'a' }), 'poopEntity')).toBeNull();
  });

  it('tells own roles from borrowed ones', () => {
    expect(hasOwnRole(cat, 'move')).toBe(true);
    expect(hasOwnRole(cat, 'dblclick')).toBe(false);
  });
});
