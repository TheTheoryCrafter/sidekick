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
].join(',');

export const SCAN = {
  /** Rediscover elements this often, ms (route changes, lazy content). */
  rediscoverMs: 2000,
  /** Re-measure at most this often while scrolling, ms. */
  remeasureMs: 120,
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
  private cleanups: (() => void)[] = [];

  constructor(private win: Window, private selector: string, private host: Element) {
    const mark = () => { this.dirty = true; };
    for (const [target, type] of [[win, 'scroll'], [win, 'resize']] as const) {
      // Capture so scrolling inside overflow containers counts too.
      target.addEventListener(type, mark, { passive: true, capture: true });
      this.cleanups.push(() => target.removeEventListener(type, mark, { capture: true }));
    }
  }

  destroy(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  /** Current surfaces in viewport px. Cheap to call every frame. */
  list(now: number, lim: Limits): readonly Surface[] {
    if (now - this.discoveredAt >= SCAN.rediscoverMs) {
      this.discover();
      this.discoveredAt = now;
      this.dirty = true;
    }
    if (this.dirty && now - this.measuredAt >= SCAN.remeasureMs) {
      this.cache = this.measure(lim);
      this.measuredAt = now;
      this.dirty = false;
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

  private measure(lim: Limits): Surface[] {
    const doc = this.win.document;
    const vw = doc.documentElement.clientWidth;
    const vh = doc.documentElement.clientHeight;
    const out: Surface[] = [];
    for (const el of this.elements) {
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
