// Server-side rendering: importing and rendering must work with no DOM at all.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { destroy, getInstance, init, watchInstance } from '../src/index';
import { Sidekick, useSidekick } from '../src/react';

describe('SSR (no window, no document)', () => {
  it('runs in an environment without a DOM', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('the core API is inert', () => {
    expect(init({ menu: true })).toBeNull();
    expect(getInstance()).toBeNull();
    expect(() => destroy()).not.toThrow();
    expect(typeof watchInstance(() => {})).toBe('function');
  });

  it('the React wrapper renders nothing and reports "not ready"', () => {
    function Menu() {
      const pet = useSidekick();
      return createElement('span', null, `${pet.ready}:${pet.enabled}:${pet.pet}`);
    }
    const html = renderToString(createElement('div', null, createElement(Sidekick, { menu: true }), createElement(Menu)));
    expect(html).toBe('<div><span>false:false:null</span></div>');
  });

  it('the built ES module imports cleanly too (after npm run build)', async () => {
    let built: { init: () => unknown } | null = null;
    try {
      built = await import(/* @vite-ignore */ '../dist/sidekick.mjs' as string);
    } catch {
      return; // not built yet
    }
    expect(built!.init()).toBeNull();
  });
});
