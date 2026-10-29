// Which text and links count as ledges: only ones drawn as a box.
import { describe, expect, it } from 'vitest';
import { NEEDS_A_BOX, NEEDS_A_CARD, colorAlpha, colorRgb, drawsABox, looksLikeCard } from '../src/dom/surfaces';

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

describe('cards as ledges', () => {
  const card = (o: Partial<Record<'backgroundColor' | 'borderTopWidth' | 'borderTopStyle' | 'borderTopColor' | 'boxShadow' | 'position' | 'opacity', string>>) => ({
    backgroundColor: 'rgba(0, 0, 0, 0)', borderTopWidth: '0px', borderTopStyle: 'none', borderTopColor: 'rgb(0, 0, 0)',
    boxShadow: 'none', position: 'static', opacity: '1', ...o,
  });
  const box = (o: Partial<{ width: number; height: number; behind: string }> = {}) => ({ width: 307, height: 358, viewportWidth: 1016, viewportHeight: 800, behind: 'rgb(0, 0, 0)', ...o });

  it('counts a card: theorycrafter\'s dark card on black, a bordered box, a shadowed box', () => {
    expect(looksLikeCard(card({ backgroundColor: 'rgb(34, 34, 34)', borderTopWidth: '0.8px', borderTopStyle: 'solid', borderTopColor: 'rgba(51, 51, 51, 0.3)', boxShadow: 'rgba(0,0,0,0.1) 0px 4px 6px' }), box())).toBe(true);
    expect(looksLikeCard(card({ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: 'rgb(220, 220, 220)' }), box({ behind: 'rgb(255, 255, 255)' }))).toBe(true);
    expect(looksLikeCard(card({ boxShadow: 'rgba(0, 0, 0, 0.2) 0px 2px 8px 0px' }), box())).toBe(true);
    expect(looksLikeCard(card({ backgroundColor: 'rgb(250, 240, 230)' }), box({ behind: 'rgb(255, 255, 255)' }))).toBe(true);
  });

  it('skips backgrounds: plain layout boxes, a fill like what is behind, full-width bands, overlays', () => {
    expect(looksLikeCard(card({}), box())).toBe(false);
    expect(looksLikeCard(card({ backgroundColor: 'rgb(5, 5, 5)' }), box())).toBe(false); // black on black
    expect(looksLikeCard(card({ backgroundColor: 'rgb(0, 0, 0)' }), box({ width: 1016, height: 562, behind: 'rgb(17, 17, 17)' }))).toBe(false); // a section band
    expect(looksLikeCard(card({ backgroundColor: 'rgb(47, 47, 47)', boxShadow: 'rgba(0,0,0,.3) 0 1px 2px' }), box({ width: 1016, height: 72 }))).toBe(false); // a full-width header
    expect(looksLikeCard(card({ backgroundColor: 'rgba(0, 0, 0, 0.6)', position: 'fixed' }), box({ width: 1016, height: 800 }))).toBe(false); // an overlay
    expect(looksLikeCard(card({ backgroundColor: 'rgb(34, 34, 34)', opacity: '0.2' }), box())).toBe(false);
  });

  it('a full-width box counts only for a real top border line', () => {
    expect(looksLikeCard(card({ borderTopWidth: '0.8px', borderTopStyle: 'solid', borderTopColor: 'rgb(51, 51, 51)' }), box({ width: 984, height: 81 }))).toBe(true);
  });

  it('containers need to look like a card; text and links need a box', () => {
    for (const tag of ['DIV', 'SECTION', 'HEADER', 'FOOTER', 'ARTICLE']) expect(NEEDS_A_CARD.has(tag), tag).toBe(true);
    expect(NEEDS_A_CARD.has('BUTTON')).toBe(false);
    expect(colorRgb('rgba(34, 34, 34, 0.5)')).toEqual([34, 34, 34]);
  });
});
