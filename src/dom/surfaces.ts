// Finds page elements the pet can stand on and measures their top edges.
// Element discovery is slow-ish and runs rarely; measuring is cheap and runs
// when the page scrolls or resizes, or on demand for the surface underfoot.

import type { Surface } from '../core/surfaces';

/** Elements that make good things to stand on. Hosts can add [data-sidekick-surface]. */
export const DEFAULT_SURFACE_SELECTOR = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'img', 'picture', 'video', 'canvas', 'svg',
  'button', 'input', 'textarea', 'select', 'pre', 'blockquote', 'table', 'figure', 'hr',
  'li', 'dt', 'dd', 'form', 'fieldset', 'nav', 'header', 'footer', 'aside', 'article',
  'section', '[role="button"]', '[data-sidekick-surface]',
  // Links count only when they look like buttons (see drawsABox).
  'a',
  // Plain boxes count only when they look like cards (see looksLikeCard).
  'div',
].join(',');

/**
 * Text and links whose box is invisible: the pet would stand on thin air above the words.
 * They count only when drawn as a box (see drawsABox) or opted in with data-sidekick-surface.
 */
export const NEEDS_A_BOX: ReadonlySet<string> = new Set([
  'A', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'DT', 'DD', 'BLOCKQUOTE', 'PRE',
]);

/** Alpha of a computed CSS colour ("rgb(…)", "rgba(…)", "transparent"); 1 if unsure. */
export function colorAlpha(color: string): number {
  if (color === 'transparent') return 0;
  const m = /^rgba?\(([^)]*)\)$/.exec(color.trim());
  if (!m) return 1;
  const parts = m[1]!.split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 4) return 1;
  const a = parts[3]!;
  return a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
}

/** Drawn as a box: its own visible fill, background image or top border (a button-style link, a callout). */
export function drawsABox(style: Pick<CSSStyleDeclaration, 'backgroundColor' | 'backgroundImage' | 'borderTopWidth' | 'borderTopStyle' | 'borderTopColor'>): boolean {
  if (colorAlpha(style.backgroundColor) > 0.05) return true;
  if (style.backgroundImage && style.backgroundImage !== 'none') return true;
  const border = parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none' && style.borderTopStyle !== 'hidden';
  return border && colorAlpha(style.borderTopColor) > 0.05;
}

/**
 * Containers that are often just layout or background: the pet stands on them only when they
 * look like a card (see looksLikeCard) or opt in with data-sidekick-surface.
 */
export const NEEDS_A_CARD: ReadonlySet<string> = new Set([
  'DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'NAV', 'FORM', 'FIELDSET',
]);

type CardStyle = Pick<CSSStyleDeclaration, 'backgroundColor' | 'borderTopWidth' | 'borderTopStyle' | 'borderTopColor' | 'boxShadow' | 'position' | 'opacity'>;

/** Parsed rgb of a computed colour, or null. */
export function colorRgb(color: string): [number, number, number] | null {
  const m = /^rgba?\(([^)]*)\)$/.exec(color.trim());
  if (!m) return null;
  const p = m[1]!.split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
  return p.length === 3 && p.every((n) => Number.isFinite(n)) ? (p as [number, number, number]) : null;
}

/**
 * A box drawn as a card: a visible top border, a shadow, or a fill that stands out from
 * what is behind it. Never a background: gradients alone don't count, a box as wide as the
 * page counts only with a visible top border line, and a fixed or absolute box covering much
 * of the screen (an overlay) never does.
 */
export function looksLikeCard(style: CardStyle, box: { width: number; height: number; viewportWidth: number; viewportHeight: number; behind: string }): boolean {
  if (parseFloat(style.opacity) < 0.5) return false;
  const area = (box.width * box.height) / Math.max(1, box.viewportWidth * box.viewportHeight);
  if ((style.position === 'fixed' || style.position === 'absolute') && area > 0.4) return false;
  const topLine = parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none' && style.borderTopStyle !== 'hidden' && colorAlpha(style.borderTopColor) > 0.05;
  if (box.width >= box.viewportWidth * 0.95) return topLine;
  if (topLine) return true;
  if (style.boxShadow && style.boxShadow !== 'none') return true;
  const own = colorRgb(style.backgroundColor), back = colorRgb(box.behind);
  if (!own || colorAlpha(style.backgroundColor) <= 0.05) return false;
  if (!back) return true;
  return Math.abs(own[0] - back[0]) + Math.abs(own[1] - back[1]) + Math.abs(own[2] - back[2]) > 24;
}

export const SCAN = {
  /** Rediscover elements this often, ms (route changes, lazy content). */
  rediscoverMs: 2000,
  /** Re-measure at most this often while scrolling or after DOM changes, ms. */
  remeasureMs: 120,
  /** Re-measure at least this often anyway (layout shifts without DOM changes), ms. */
  refreshMs: 1000,
  /** After a DOM change, rediscover elements no sooner than this, ms. */
  rediscoverAfterChangeMs: 250,
  /** Keep at most this many candidates. */
  maxCandidates: 400,
} as const;

interface Limits {
  /** Narrowest surface worth standing on, px. */
  minWidth: number;
  /** Highest top edge allowed (the pet's head must fit above it). */
  minTop: number;
}

export class SurfaceScanner {
  private elements: Element[] = [];
  private ids = new WeakMap<Element, number>();
  private byId = new Map<number, Element>();
  private nextId = 1;
  private cache: Surface[] = [];
  private discoveredAt = -Infinity;
  private measuredAt = -Infinity;
  private dirty = true;
  /** The DOM changed since the last discovery (a route change, say). */
  private changed = false;
  private cleanups: (() => void)[] = [];

  constructor(private win: Window, private selector: string, private host: Element) {
    const mark = () => { this.dirty = true; };
    for (const [target, type] of [[win, 'scroll'], [win, 'resize']] as const) {
      // Capture so scrolling inside overflow containers counts too.
      target.addEventListener(type, mark, { passive: true, capture: true });
      this.cleanups.push(() => target.removeEventListener(type, mark, { capture: true }));
    }
    // Frameworks swap page content without scrolling or resizing. The callback only
    // sets flags; the work happens on the next list() call, throttled.
    const Observer = (win as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver;
    if (Observer) {
      const mo = new Observer((records) => {
        if (records.every((r) => host.contains(r.target))) return; // our own pet and poops
        this.changed = true;
        this.dirty = true;
      });
      mo.observe(win.document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
      this.cleanups.push(() => mo.disconnect());
    }
  }

  destroy(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  /** Current surfaces in viewport px. Cheap to call every frame. */
  list(now: number, lim: Limits): readonly Surface[] {
    const sinceDiscover = now - this.discoveredAt;
    if (sinceDiscover >= SCAN.rediscoverMs || (this.changed && sinceDiscover >= SCAN.rediscoverAfterChangeMs)) {
      this.discover();
      this.discoveredAt = now;
      this.changed = false;
      this.dirty = true;
    }
    const sinceMeasure = now - this.measuredAt;
    if ((this.dirty && sinceMeasure >= SCAN.remeasureMs) || sinceMeasure >= SCAN.refreshMs) {
      this.cache = this.measure(lim);
      this.measuredAt = now;
      this.dirty = false;
    } else if (this.changed) {
      // Between measurements, never hand out an element that has left the page.
      this.cache = this.cache.filter((s) => this.byId.get(s.id)?.isConnected);
    }
    return this.cache;
  }

  /** The element behind a surface id, if it is still on the page. */
  elementOf(id: number): Element | null {
    const el = this.byId.get(id);
    return el && el.isConnected ? el : null;
  }

  /** Fresh measurement of one surface (the one the pet stands on), or null if it's gone. */
  measureOne(id: number): Surface | null {
    const el = this.byId.get(id);
    if (!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { id, left: r.left, right: r.right, top: r.top };
  }

  private discover(): void {
    const doc = this.win.document;
    let found: Element[];
    try {
      found = Array.from(doc.querySelectorAll(this.selector));
    } catch {
      found = []; // invalid selector from options
    }
    this.elements = found
      .filter((el) => !this.host.contains(el) && !el.closest('[data-sidekick-ignore]'))
      .filter((el) => el.matches('[data-sidekick-surface],[role="button"]') ||
        (NEEDS_A_BOX.has(el.tagName) ? this.isBoxed(el) : NEEDS_A_CARD.has(el.tagName) ? this.isCard(el) : true))
      .slice(0, SCAN.maxCandidates);
    this.byId.clear();
    for (const el of this.elements) {
      let id = this.ids.get(el);
      if (id === undefined) {
        id = this.nextId++;
        this.ids.set(el, id);
      }
      this.byId.set(id, el);
    }
  }

  private isBoxed(el: Element): boolean {
    try {
      return drawsABox(this.win.getComputedStyle(el));
    } catch {
      return false;
    }
  }

  private isCard(el: Element): boolean {
    try {
      const doc = this.win.document;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      return looksLikeCard(this.win.getComputedStyle(el), {
        width: r.width, height: r.height,
        viewportWidth: doc.documentElement.clientWidth, viewportHeight: doc.documentElement.clientHeight,
        behind: this.colourBehind(el),
      });
    } catch {
      return false;
    }
  }

  /** The nearest mostly opaque background colour behind an element, from its ancestors. */
  private colourBehind(el: Element): string {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const bg = this.win.getComputedStyle(p).backgroundColor;
      if (colorAlpha(bg) > 0.5) return bg;
    }
    return 'rgb(255, 255, 255)';
  }

  private measure(lim: Limits): Surface[] {
    const doc = this.win.document;
    const vw = doc.documentElement.clientWidth;
    const vh = doc.documentElement.clientHeight;
    const out: Surface[] = [];
    for (const el of this.elements) {
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 4 || r.top < lim.minTop || r.top > vh - 4) continue;
      const left = Math.max(0, r.left);
      const right = Math.min(vw, r.right);
      if (right - left < lim.minWidth) continue;
      if (!isShown(el)) continue;
      if (!topIsExposed(doc, el, left, right, r.top, this.host)) continue;
      out.push({ id: this.ids.get(el)!, left, right, top: r.top });
    }
    // Nested wrappers often share one top edge; keep one of each.
    out.sort((a, b) => a.top - b.top || a.left - b.left);
    return out.filter((s, i) => {
      const p = out[i - 1];
      return !p || Math.abs(p.top - s.top) > 1 || Math.abs(p.left - s.left) > 1 || Math.abs(p.right - s.right) > 1;
    });
  }
}

function isShown(el: Element): boolean {
  const check = (el as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility;
  return check ? check.call(el, { opacityProperty: true, visibilityProperty: true }) : true;
}

/** Whether the element's top edge is actually visible, not under a sticky header or a modal. */
function topIsExposed(doc: Document, el: Element, left: number, right: number, top: number, host: Element): boolean {
  const y = top + 1;
  for (const x of [left + (right - left) * 0.25, left + (right - left) * 0.75]) {
    const hit = doc.elementFromPoint(x, y);
    if (!hit || hit === host || el === hit || el.contains(hit) || hit.contains(el)) return true;
  }
  return false;
}
