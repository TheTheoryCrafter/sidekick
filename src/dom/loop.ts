// requestAnimationFrame driver around the fixed-step clock.

import { STEP_MS, advance } from '../core/clock';

export class Loop {
  private raf = 0;
  private lastTs = -1;
  private carry = 0;

  constructor(private win: Window, private step: (dtMs: number) => void, private render: () => void) {}

  get running(): boolean {
    return this.raf !== 0;
  }

  start(): void {
    if (this.raf) return;
    // Resume from now: time spent stopped is never simulated.
    this.lastTs = -1;
    this.raf = this.win.requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.raf) this.win.cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame = (ts: number): void => {
    const { steps, carry } = advance(this.carry, this.lastTs < 0 ? 0 : ts - this.lastTs);
    this.lastTs = ts;
    this.carry = carry;
    for (let i = 0; i < steps; i++) this.step(STEP_MS);
    this.render();
    this.raf = this.win.requestAnimationFrame(this.frame);
  };
}
