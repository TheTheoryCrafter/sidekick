// The overlay host: one custom element with a Shadow DOM, attached to <html>.
// All styling goes through CSSOM properties so a strict CSP never blocks it.

export const HOST_TAG = 'sidekick-pet';

export interface Host {
  el: HTMLElement;
  /** Fixed, full-viewport layer for the pet. Ignores the pointer. */
  stage: HTMLElement;
  remove(): void;
}

export function createHost(doc: Document): Host {
  // A custom tag keeps the host clear of site rules like `div { ... }`.
  const el = doc.createElement(HOST_TAG);
  el.setAttribute('aria-hidden', 'true');
  // Inline !important beats any site rule, even `* { ... !important }`.
  const host: Record<string, string> = {
    all: 'initial',
    position: 'fixed',
    left: '0',
    top: '0',
    width: '0',
    height: '0',
    overflow: 'visible',
    'z-index': '2147483000',
    'pointer-events': 'none',
  };
  for (const [k, v] of Object.entries(host)) el.style.setProperty(k, v, 'important');

  const root = el.attachShadow({ mode: 'open' });
  const stage = doc.createElement('div');
  const ss = stage.style;
  ss.position = 'fixed';
  ss.inset = '0';
  ss.overflow = 'hidden';
  ss.pointerEvents = 'none';
  ss.contain = 'layout paint style';
  root.append(stage);

  // After <body>, not inside it: frameworks that hydrate or re-render <body>
  // (Next.js, Nuxt...) never see an unexpected child.
  doc.documentElement.append(el);
  return { el, stage, remove: () => el.remove() };
}
