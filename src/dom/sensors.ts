// Built-in events from the page: the visitor going quiet and coming back,
// route changes, copying, and returning to the tab after a while.

import { checkIdle, createIdle, noteActivity, type IdleState } from '../core/idle';

export const SENSORS = {
  /** How often to look at the clock and the URL, ms. */
  checkMs: 250,
  /** Away from the tab at least this long before "tab-return" fires, ms. */
  tabAwayMs: 30_000,
} as const;

const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;

export class Sensors {
  private idle: IdleState;
  private lastInput: number;
  private href: string;
  private lastCheck = -Infinity;
  private hiddenAt: number | null = null;
  private cleanups: (() => void)[] = [];

  constructor(private win: Window, private emit: (name: string, payload?: unknown) => void, private idleAfter: number) {
    const now = win.performance.now();
    this.idle = createIdle(now);
    this.lastInput = now;
    this.href = win.location.href;

    const onInput = () => { this.lastInput = this.win.performance.now(); };
    for (const type of ACTIVITY) this.listen(win, type, onInput, { passive: true, capture: true });
    this.listen(win.document, 'copy', () => this.emit('copy'), { passive: true });
    this.listen(win.document, 'visibilitychange', () => this.visibility(), { passive: true });
  }

  /** Call often (every frame is fine); it does real work at most every checkMs. */
  tick(): void {
    const now = this.win.performance.now();
    if (now - this.lastCheck < SENSORS.checkMs) return;
    this.lastCheck = now;

    if (this.lastInput > this.idle.last) {
      const r = noteActivity(this.idle, this.lastInput);
      this.idle = r.state;
      if (r.event) this.emit(r.event);
    }
    const r = checkIdle(this.idle, now, this.idleAfter);
    this.idle = r.state;
    if (r.event) this.emit(r.event);

    // Single-page apps change the URL without reloading; polling needs no history patching.
    const href = this.win.location.href;
    if (href !== this.href) {
      const from = this.href;
      this.href = href;
      this.emit('page-change', { from, to: href });
    }
  }

  destroy(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  private visibility(): void {
    const now = this.win.performance.now();
    if (this.win.document.hidden) {
      this.hiddenAt = now;
      return;
    }
    if (this.hiddenAt !== null && now - this.hiddenAt >= SENSORS.tabAwayMs) {
      this.emit('tab-return', { away: Math.round(now - this.hiddenAt) });
    }
    this.hiddenAt = null;
    this.lastInput = now;
  }

  private listen(target: EventTarget, type: string, fn: () => void, opts: AddEventListenerOptions): void {
    target.addEventListener(type, fn, opts);
    this.cleanups.push(() => target.removeEventListener(type, fn, opts));
  }
}
