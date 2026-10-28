// Which links count as ledges: only ones drawn as buttons.
import { describe, expect, it } from 'vitest';
import { colorAlpha, looksLikeButton } from '../src/dom/surfaces';

const style = (o: Partial<Record<'backgroundColor' | 'backgroundImage' | 'borderTopWidth' | 'borderTopStyle' | 'borderTopColor', string>>) => ({
  backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none', borderTopWidth: '0px', borderTopStyle: 'none', borderTopColor: 'rgb(0, 0, 0)', ...o,
});

describe('links as ledges', () => {
  it('reads alpha from computed colours', () => {
    expect(colorAlpha('rgb(253, 91, 2)')).toBe(1);
    expect(colorAlpha('rgba(0, 0, 0, 0.6)')).toBe(0.6);
    expect(colorAlpha('rgba(0, 0, 0, 0)')).toBe(0);
    expect(colorAlpha('transparent')).toBe(0);
    expect(colorAlpha('rgb(0 0 0 / 50%)')).toBe(0.5);
  });

  it('counts a filled button, a bordered tile or a background image; not a plain link', () => {
    expect(looksLikeButton(style({ backgroundColor: 'rgb(253, 91, 2)' }))).toBe(true); // "Dive into the Abyss"
    expect(looksLikeButton(style({ backgroundColor: 'rgba(0, 0, 0, 0.6)', borderTopWidth: '0.8px', borderTopStyle: 'solid', borderTopColor: 'rgba(51, 51, 51, 0.3)' }))).toBe(true); // category tiles
    expect(looksLikeButton(style({ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'rgb(255, 255, 255)' }))).toBe(true);
    expect(looksLikeButton(style({ backgroundImage: 'linear-gradient(red, blue)' }))).toBe(true);
    expect(looksLikeButton(style({}))).toBe(false); // "Learn More", nav links
    expect(looksLikeButton(style({ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'rgba(0, 0, 0, 0)' }))).toBe(false);
    expect(looksLikeButton(style({ borderTopWidth: '2px', borderTopStyle: 'none', borderTopColor: 'rgb(0, 0, 0)' }))).toBe(false);
  });
});
