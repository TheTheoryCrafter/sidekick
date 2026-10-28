import { describe, expect, it } from 'vitest';
import { optionsFromDataset } from '../src/entries/dataset';

describe('optionsFromDataset', () => {
  it('uses the default pets folder when nothing is set', () => {
    expect(optionsFromDataset({}, 'https://cdn/x/pets/')).toEqual({ petsBaseUrl: 'https://cdn/x/pets/' });
  });

  it('reads every supported attribute', () => {
    expect(optionsFromDataset({
      pet: 'cream-cat', pets: 'cream-cat, box-cat ,', petsBase: '/my-pets/', scale: '3',
      surfaces: 'main h2', poopMax: '2', poopTtl: '60000', enabled: 'false', persist: 'false',
      storageKey: 'k', menu: '', idleAfter: '5000', motion: 'reduced', restoreButton: 'bottom-left',
    }, '/pets/')).toEqual({
      petsBaseUrl: '/my-pets/', pet: 'cream-cat', pets: ['cream-cat', 'box-cat'], scale: 3,
      surfaces: 'main h2', poop: { max: 2, ttl: 60000 }, enabled: false, persist: false,
      storageKey: 'k', menu: true, idleAfter: 5000, motion: 'reduced', restoreButton: 'bottom-left',
    });
  });

  it('turns features off with "false"', () => {
    expect(optionsFromDataset({ surfaces: 'false', poop: 'false', menu: 'false' }, '/p/'))
      .toEqual({ petsBaseUrl: '/p/', surfaces: false, poop: false, menu: false });
  });

  it('ignores junk values', () => {
    expect(optionsFromDataset({ scale: 'big', idleAfter: '', motion: 'wild', surfaces: '' }, '/p/'))
      .toEqual({ petsBaseUrl: '/p/' });
  });
});
