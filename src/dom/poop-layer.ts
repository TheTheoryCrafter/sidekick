// Poops on the page: placed only where nothing clickable is underneath,
// pinned to the element they landed on (or to the page), cleared by a click,
// and gone after a while.

import type { PetManifest } from '../core/manifest';
import { addPoop, expirePoops, type Poop, type PoopOptions } from '../core/poop';
import { frameAt, frameRect } from '../core/sprite';
import type { SheetInfo } from './sprite-view';

/** Anything a visitor might want to click. Poop never lands on or over these. */
export const INTERACTIVE_SELECTOR = [
  'a[href]', 'button', 'input', 'select', 'textarea', 'label', 'summary', 'details', 'iframe',
  'video', 'audio', '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="tab"]',
  '[role="checkbox"]', '[role="switch"]', '[role="option"]', '[onclick]',
  '[contenteditable]:not([contenteditable="false"])', '[tabindex]:not([tabindex="-1"])',
].join(',');

type Anchor =
  | { kind: 'page'; x: number; y: number }
  | { kind: 'element'; el: Element; dx: number; dy: number };

interface Placed {
  poop: Poop<Anchor>;
  el: HTMLDivElement;
  hit: HTMLDivElement;
  frameKey: string;
  gone: boolean;
}

/** Opaque area of the pile inside its frame, [x, y, w, h] in sheet px. */
type Box = [number, number, number, number];

const FADE_MS = 200;

export class PoopLayer {
  private placed: Placed[] = [];
  private nextId = 1;
  private box: Box;

  constructor(
    private win: Window,
    private stage: HTMLElement,
    /** Poops are drawn under this element (the pet). */
    private below: Element,
    private host: Element,
    private manifest: PetManifest,
    private sheet: SheetInfo,
    private anim: string,
    private opts: PoopOptions,
    private onCleaned: () => void,
  ) {
    const [fw, fh] = manifest.frameSize;
    this.box = [fw * 0.25, fh * 0.5, fw * 0.5, fh * 0.5];
    void this.measureBox();
  }

  get count(): number {
    return this.placed.filter((p) => !p.gone).length;
  }

  get hasRoom(): boolean {
    return this.count < this.opts.max;
  }

  /** Whether a poop at viewport (x, y) would cover nothing clickable. */
  isSafeAt(x: number, y: number, px: number): boolean {
    const r = this.footprint(x, y, px);
    const doc = this.win.document;
    const de = doc.documentElement;
    if (r.left < 0 || r.top < 0 || r.right > de.clientWidth || r.bottom > de.clientHeight) return false;
    const points: [number, number][] = [];
    for (const fx of [0.15, 0.5, 0.85]) for (const fy of [0.15, 0.5, 0.85]) {
      points.push([r.left + r.width * fx, r.top + r.height * fy]);
    }
    // Also what it would sit on, across its whole width: never on top of a button or
    // link, even straddling the gap between two of them.
    const below = Math.min(de.clientHeight - 1, y + 3);
    for (const fx of [0.05, 0.5, 0.95]) points.push([r.left + r.width * fx, below]);
    return points.every(([px_, py]) => {
      const hit = doc.elementsFromPoint(px_, py).find((el) => el !== this.host && !this.host.contains(el));
      return !hit || !hit.closest(INTERACTIVE_SELECTOR);
    });
  }

  /** Drop a poop with its feet at viewport (x, y), pinned to `on` (or the page). */
  drop(x: number, y: number, on: Element | null, now: number, px: number): void {
    // Pin to an element that moves with the page: the surface under the pet, or else
    // the content behind the pile. That follows any scroll container, including sites
    // where <body> scrolls instead of the window.
    const el = on && on.isConnected ? on : this.contentBehind(x, y, px);
    let anchor: Anchor;
    if (el) {
      const r = el.getBoundingClientRect();
      anchor = { kind: 'element', el, dx: x - r.left, dy: y - r.top };
    } else {
      const sc = this.scroll();
      anchor = { kind: 'page', x: x + sc.x, y: y + sc.y };
    }
    const poop: Poop<Anchor> = { id: this.nextId++, born: now, anchor };
    const live = this.placed.filter((p) => !p.gone);
    const { removed } = addPoop(live.map((p) => p.poop), poop, this.opts.max);
    removed.forEach((r) => this.remove(r.id));
    this.placed.push(this.create(poop));
  }

  /** Remove poops past their time. Call with sim time. */
  expire(now: number): void {
    const { removed } = expirePoops(this.placed.filter((p) => !p.gone).map((p) => p.poop), now, this.opts.ttl);
    removed.forEach((r) => this.remove(r.id));
  }

  render(now: number, px: number, dpr: number): void {
    const def = this.manifest.animations[this.anim];
    if (!def) return;
    const [fw, fh] = this.manifest.frameSize;
    const [ax, ay] = this.manifest.anchor;
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    for (const p of this.placed) {
      if (p.gone) continue;
      const pos = this.position(p.poop.anchor);
      if (!pos) {
        // Its element left the page (a route change, say): the poop goes with it.
        this.remove(p.poop.id, false);
        continue;
      }
      const s = p.el.style;
      s.width = `${fw * px}px`;
      s.height = `${fh * px}px`;
      s.backgroundSize = `${this.sheet.width * px}px ${this.sheet.height * px}px`;
      s.transform = `translate3d(${snap(pos.x - ax * px)}px,${snap(pos.y - ay * px)}px,0)`;
      const { frame } = frameAt(def, now - p.poop.born);
      const key = `${frame}:${px}`;
      if (key !== p.frameKey) {
        const r = frameRect(this.manifest, def, frame);
        s.backgroundPosition = `${-r.x * px}px ${-r.y * px}px`;
        const [bx, by, bw, bh] = this.box;
        const h = p.hit.style;
        h.left = `${bx * px}px`;
        h.top = `${by * px}px`;
        h.width = `${bw * px}px`;
        h.height = `${bh * px}px`;
        p.frameKey = key;
      }
    }
  }

  clear(): void {
    for (const p of [...this.placed]) this.remove(p.poop.id, false);
  }

  destroy(): void {
    for (const p of this.placed) p.el.remove();
    this.placed = [];
  }

  /** The innermost page element behind the pile that isn't <html>, <body> or ours. */
  private contentBehind(x: number, y: number, px: number): Element | null {
    const r = this.footprint(x, y, px);
    const doc = this.win.document;
    const stack = doc.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return stack.find((e) => e !== this.host && !this.host.contains(e) && e !== doc.documentElement && e !== doc.body) ?? null;
  }

  /** How far the page has scrolled, whether the window or <body> is the scroller. */
  private scroll(): { x: number; y: number } {
    const doc = this.win.document;
    const b = doc.body;
    return { x: this.win.scrollX + (b ? b.scrollLeft : 0), y: this.win.scrollY + (b ? b.scrollTop : 0) };
  }

  private position(a: Anchor): { x: number; y: number } | null {
    if (a.kind === 'page') {
      const sc = this.scroll();
      return { x: a.x - sc.x, y: a.y - sc.y };
    }
    if (!a.el.isConnected) return null;
    const r = a.el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.left + a.dx, y: r.top + a.dy };
  }

  private footprint(x: number, y: number, px: number) {
    const [ax, ay] = this.manifest.anchor;
    const [bx, by, bw, bh] = this.box;
    const left = x + (bx - ax) * px;
    const top = y + (by - ay) * px;
    return { left, top, width: bw * px, height: bh * px, right: left + bw * px, bottom: top + bh * px };
  }

  private create(poop: Poop<Anchor>): Placed {
    const doc = this.win.document;
    const el = doc.createElement('div');
    const s = el.style;
    s.position = 'absolute';
    s.left = '0';
    s.top = '0';
    s.backgroundImage = `url("${this.sheet.url}")`;
    s.backgroundRepeat = 'no-repeat';
    s.imageRendering = 'pixelated';
    s.pointerEvents = 'none';
    s.transition = `opacity ${FADE_MS}ms ease-out`;

    // Only the pile itself takes clicks, not its whole frame.
    const hit = doc.createElement('div');
    const h = hit.style;
    h.position = 'absolute';
    h.pointerEvents = 'auto';
    h.cursor = 'pointer';
    h.touchAction = 'manipulation';
    h.setProperty('-webkit-tap-highlight-color', 'transparent');
    hit.addEventListener('click', () => {
      if (this.remove(poop.id)) this.onCleaned();
    });
    el.append(hit);
    this.stage.insertBefore(el, this.below);
    return { poop, el, hit, frameKey: '', gone: false };
  }

  /** Fade a poop out (or drop it at once). Returns false if it was already gone. */
  private remove(id: number, fade = true): boolean {
    const p = this.placed.find((x) => x.poop.id === id);
    if (!p || p.gone) return false;
    p.gone = true;
    p.hit.style.pointerEvents = 'none';
    const done = () => {
      p.el.remove();
      this.placed = this.placed.filter((x) => x !== p);
    };
    if (fade) {
      p.el.style.opacity = '0';
      this.win.setTimeout(done, FADE_MS);
    } else {
      done();
    }
    return true;
  }

  /** Find the pile's opaque area so clicks and the safety check match what's drawn. */
  private async measureBox(): Promise<void> {
    const def = this.manifest.animations[this.anim];
    if (!def) return;
    try {
      const img = this.win.document.createElement('img');
      img.src = this.sheet.url;
      await img.decode();
      const cv = this.win.document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const g = cv.getContext('2d', { willReadFrequently: true });
      if (!g) return;
      g.drawImage(img, 0, 0);
      let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
      for (let i = 0; i < def.frames; i++) {
        const r = frameRect(this.manifest, def, i);
        const data = g.getImageData(r.x, r.y, r.w, r.h).data; // throws for a cross-origin sheet
        for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
          if (data[(y * r.w + x) * 4 + 3]! > 0) {
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
          }
        }
      }
      if (x1 >= 0) {
        this.box = [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
        this.placed.forEach((p) => { p.frameKey = ''; });
      }
    } catch {
      // Cross-origin sheet without CORS: keep the estimate.
    }
  }
}
