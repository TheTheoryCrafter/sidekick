// The single-file script-tag build:
//   <script src="https://cdn.jsdelivr.net/npm/sidekick-pet/dist/sidekick.js" data-menu defer></script>
// Starts the pet once the page has loaded (unless data-auto="false") and exposes
// window.Sidekick = { init, get, destroy } for the page's own code.

import { destroy, getInstance, init } from '../index';
import type { SidekickOptions } from '../dom/sidekick';
import { optionsFromDataset } from './dataset';

declare global {
  interface Window {
    Sidekick?: {
      init: typeof init;
      get: typeof getInstance;
      destroy: typeof destroy;
    };
  }
}

const script = (document.currentScript as HTMLScriptElement | null)
  ?? document.querySelector<HTMLScriptElement>('script[src*="sidekick"]');
// Pets ship next to this file, so a CDN copy finds its pets without configuration.
const petsBase = script?.src ? new URL('pets/', script.src).href : '/pets/';
const fromTag = optionsFromDataset(script?.dataset ?? {}, petsBase);

if (!window.Sidekick) {
  window.Sidekick = {
    init: (options: SidekickOptions = {}) => init({ ...fromTag, ...options }),
    get: getInstance,
    destroy,
  };
}

if (script?.dataset.auto !== 'false') {
  const start = () => {
    const pet = window.Sidekick!.init();
    document.dispatchEvent(new CustomEvent('sidekick:ready', { detail: pet }));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
