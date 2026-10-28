// The optional built-in menu (right-click or long-press the pet) and the small
// button that brings a hidden pet back. For sites without their own controls.
// Pointer-only by design: the whole overlay is aria-hidden, so sites that need
// accessible controls use the API from their own UI instead.

export interface MenuItem {
  label: string;
  onSelect: () => void;
}

interface Palette { bg: string; fg: string; hover: string; border: string; shadow: string }

const LIGHT: Palette = { bg: '#ffffff', fg: '#1f2328', hover: '#f0f1f3', border: 'rgba(0,0,0,.12)', shadow: '0 6px 24px rgba(0,0,0,.18)' };
const DARK: Palette = { bg: '#24272e', fg: '#e8eaed', hover: '#33373f', border: 'rgba(255,255,255,.14)', shadow: '0 6px 24px rgba(0,0,0,.5)' };

function palette(win: Window): Palette {
  try {
    return win.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
  } catch {
    return LIGHT;
  }
}

function baseText(s: CSSStyleDeclaration, p: Palette): void {
  s.font = '13px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  s.color = p.fg;
  s.letterSpacing = 'normal';
  s.textTransform = 'none';
  s.userSelect = 'none';
  s.setProperty('-webkit-user-select', 'none');
}

export class Menu {
  private el: HTMLDivElement | null = null;
  private cleanups: (() => void)[] = [];

  constructor(private win: Window, private stage: HTMLElement) {}

  get isOpen(): boolean {
    return this.el !== null;
  }

  /** Open above (x, y) in viewport px, kept on screen. */
  open(items: MenuItem[], x: number, y: number): void {
    this.close();
    if (items.length === 0) return;
    const doc = this.win.document;
    const p = palette(this.win);
    const el = doc.createElement('div');
    const s = el.style;
    s.position = 'absolute';
    s.left = '0';
    s.top = '0';
    s.minWidth = '160px';
    s.padding = '4px';
    s.background = p.bg;
    s.border = `1px solid ${p.border}`;
    s.borderRadius = '8px';
    s.boxShadow = p.shadow;
    s.pointerEvents = 'auto';
    s.touchAction = 'manipulation';
    baseText(s, p);

    for (const item of items) {
      const row = doc.createElement('div');
      const r = row.style;
      r.padding = '8px 10px';
      r.borderRadius = '5px';
      r.cursor = 'pointer';
      r.whiteSpace = 'nowrap';
      row.textContent = item.label;
      row.addEventListener('pointerenter', () => { r.background = p.hover; });
      row.addEventListener('pointerleave', () => { r.background = 'transparent'; });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
        item.onSelect();
      });
      el.append(row);
    }
    this.stage.append(el);
    this.el = el;

    // Position after layout so its size is known.
    const de = doc.documentElement;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.min(Math.max(8, x - w / 2), de.clientWidth - w - 8);
    const top = y - h - 8 >= 8 ? y - h - 8 : Math.min(y + 8, de.clientHeight - h - 8);
    s.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;

    const outside = (e: Event) => {
      if (!e.composedPath().includes(el)) this.close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    };
    const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) => {
      this.win.addEventListener(type, fn, { capture: true, passive: true });
      this.cleanups.push(() => this.win.removeEventListener(type, fn, { capture: true }));
    };
    // Let the opening gesture finish before listening for outside presses.
    this.win.setTimeout(() => {
      if (this.el !== el) return;
      on('pointerdown', outside);
      on('keydown', key);
      on('scroll', () => this.close());
      on('resize', () => this.close());
    }, 0);
  }

  close(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.el?.remove();
    this.el = null;
  }
}

/** A small paw in the corner that brings a hidden pet back. */
export class RestoreButton {
  private el: HTMLDivElement;

  constructor(win: Window, stage: HTMLElement, onClick: () => void, title: string, corner: 'bottom-right' | 'bottom-left' = 'bottom-right') {
    const doc = win.document;
    const p = palette(win);
    const el = doc.createElement('div');
    const s = el.style;
    s.position = 'absolute';
    if (corner === 'bottom-left') s.left = '12px';
    else s.right = '12px';
    s.bottom = '12px';
    s.width = '32px';
    s.height = '32px';
    s.borderRadius = '50%';
    s.display = 'flex';
    s.alignItems = 'center';
    s.justifyContent = 'center';
    s.background = p.bg;
    s.border = `1px solid ${p.border}`;
    s.boxShadow = p.shadow;
    s.cursor = 'pointer';
    s.pointerEvents = 'auto';
    s.opacity = '0.55';
    s.transition = 'opacity 150ms ease-out';
    s.fontSize = '16px';
    s.lineHeight = '1';
    el.title = title;
    el.textContent = '🐾';
    el.addEventListener('pointerenter', () => { s.opacity = '1'; });
    el.addEventListener('pointerleave', () => { s.opacity = '0.55'; });
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    stage.append(el);
    this.el = el;
  }

  remove(): void {
    this.el.remove();
  }
}
