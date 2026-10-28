// Which text and links count as ledges: only ones drawn as a box.
import { describe, expect, it } from 'vitest';
import { NEEDS_A_BOX, colorAlpha, drawsABox } from '../src/dom/surfaces';

const style = (o: Partial<Record<'backgroundColor' | 'backgroundImage' | 'borderTopWidth' | 'borderTopStyle' | 'borderTopColor', string>>) => ({
  backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none', borderTopWidth: '0px', borderTopStyle: 'none', borderTopColor: 'rgb(0, 0, 0)', ...o,
});

describe('text and links as ledges', () => {
  it('plain text and links need a visible box; media, buttons and forms do not', () => {
    for (const tag of ['A', 'H1', 'H3', 'P', 'LI', 'BLOCKQUOTE']) expect(NEEDS_A_BOX.has(tag), tag).toBe(true);
    for (const tag of ['IMG', 'BUTTON', 'INPUT', 'SECTION', 'SVG']) expect(NEEDS_A_BOX.has(tag), tag).toBe(false);
  });


  it('reads alpha from computed colours', () => {
    expect(colorAlpha('rgb(253, 91, 2)')).toBe(1);
    expect(colorAlpha('rgba(0, 0, 0, 0.6)')).toBe(0.6);
    expect(colorAlpha('rgba(0, 0, 0, 0)')).toBe(0);
    expect(colorAlpha('transparent')).toBe(0);
    expect(colorAlpha('rgb(0 0 0 / 50%)')).toBe(0.5);
  });

  it('counts a filled button, a bordered tile or a background image; not a plain link', () => {
    expect(drawsABox(style({ backgroundColor: 'rgb(253, 91, 2)' }))).toBe(true); // "Dive into the Abyss"
    expect(drawsABox(style({ backgroundColor: 'rgba(0, 0, 0, 0.6)', borderTopWidth: '0.8px', borderTopStyle: 'solid', borderTopColor: 'rgba(51, 51, 51, 0.3)' }))).toBe(true); // category tiles
    expect(drawsABox(style({ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'rgb(255, 255, 255)' }))).toBe(true);
    expect(drawsABox(style({ backgroundImage: 'linear-gradient(red, blue)' }))).toBe(true);
    expect(drawsABox(style({}))).toBe(false); // "Learn More", nav links
    expect(drawsABox(style({ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'rgba(0, 0, 0, 0)' }))).toBe(false);
    expect(drawsABox(style({ borderTopWidth: '2px', borderTopStyle: 'none', borderTopColor: 'rgb(0, 0, 0)' }))).toBe(false);
  });
});
