// Turns pointer events (mouse, pen, touch) into pet gestures: hover, click,
// double-click, tap, drag and throw, plus where the cursor is.

import { throwVelocity, type PointerSample, type Vec } from '../core/physics';

export interface PointerHandlers {
  hover(): void;
  click(kind: 'click' | 'dblclick' | 'tap'): void;
  /** A drag started at `at` (where the pointer went down). */
  grab(at: Vec): void;
  drag(to: Vec): void;
  /** Let go, with the pointer's velocity in px/s. */
  release(vel: Vec): void;
  /** Mouse/pen position in the viewport, or null once it leaves the page. */
  cursor(pos: Vec | null): void;
}

export const GESTURE = {
  /** Movement before a press becomes a drag, px. */
  dragMouse: 5,
  dragTouch: 10,
  /** Longest press that still counts as a click, ms. */
  clickMs: 500,
  /** Two clicks closer than this make a double-click, ms. */
  doubleMs: 350,
} as const;

interface Press { id: number; type: string; x: number; y: number; t: number }

export class PointerInput {
  private press: Press | null = null;
  private dragging = false;
  private samples: PointerSample[] = [];
  private lastClick = { t: -Infinity, type: '' };
  private cleanups: (() => void)[] = [];

  constructor(private win: Window, private hit: HTMLElement, private h: PointerHandlers) {
    this.on(hit, 'pointerenter', (e) => {
      if (e.pointerType !== 'touch' && !this.press) h.hover();
    });
    this.on(hit, 'pointerdown', (e) => this.down(e));
    this.on(hit, 'pointermove', (e) => this.move(e));
    this.on(hit, 'pointerup', (e) => this.up(e));
    this.on(hit, 'pointercancel', () => this.cancel());
    this.on(hit, 'lostpointercapture', () => this.cancel());
    this.on(hit, 'contextmenu', (e) => e.preventDefault());

    // The page-wide listeners are passive: they watch the cursor and never block scrolling.
    this.on(win, 'pointermove', (e) => {
      if (e.pointerType !== 'touch') h.cursor({ x: e.clientX, y: e.clientY });
    }, { passive: true });
    this.on(win.document, 'mouseout', (e) => {
      if (!(e as MouseEvent).relatedTarget) h.cursor(null);
    }, { passive: true });
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  destroy(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  private down(e: PointerEvent): void {
    if (!e.isPrimary || e.button !== 0 || this.press) return;
    e.preventDefault(); // no text selection or native image drag
    try { this.hit.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    this.press = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, t: e.timeStamp };
    this.samples = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
  }

  private move(e: PointerEvent): void {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    this.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (this.samples.length > 12) this.samples.shift();
    if (!this.dragging) {
      const limit = p.type === 'touch' ? GESTURE.dragTouch : GESTURE.dragMouse;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < limit) return;
      this.dragging = true;
      this.h.grab({ x: p.x, y: p.y });
    }
    this.h.drag({ x: e.clientX, y: e.clientY });
  }

  private up(e: PointerEvent): void {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    if (this.dragging) {
      this.h.release(throwVelocity(this.samples, e.timeStamp));
    } else if (e.timeStamp - p.t <= GESTURE.clickMs) {
      const isDouble = e.timeStamp - this.lastClick.t <= GESTURE.doubleMs && this.lastClick.type === p.type;
      this.lastClick = isDouble ? { t: -Infinity, type: '' } : { t: e.timeStamp, type: p.type };
      this.h.click(isDouble ? 'dblclick' : p.type === 'touch' ? 'tap' : 'click');
    }
    this.reset();
  }

  private cancel(): void {
    if (!this.press) return;
    if (this.dragging) this.h.release({ x: 0, y: 0 });
    this.reset();
  }

  private reset(): void {
    this.press = null;
    this.dragging = false;
    this.samples = [];
  }

  private on<E extends Event = PointerEvent>(target: EventTarget, type: string, fn: (e: E) => void, opts?: AddEventListenerOptions): void {
    const listener = fn as EventListener;
    target.addEventListener(type, listener, opts);
    this.cleanups.push(() => target.removeEventListener(type, listener, opts));
  }
}
