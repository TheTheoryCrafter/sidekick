// Draws one sprite frame as a div with a background image. Writes styles only
// when something changed, and snaps everything to whole device pixels.

import type { PetManifest } from '../core/manifest';
import { frameAt, frameRect } from '../core/sprite';

export interface SheetInfo { url: string; width: number; height: number }

export interface DrawArgs {
  anim: string;
  /** ms since the animation started */
  elapsed: number;
  /** Feet position in viewport CSS px. */
  x: number;
  y: number;
  facing: 1 | -1;
  scale: number;
  dpr: number;
}

export class SpriteView {
  readonly el: HTMLDivElement;
  private last = { frameKey: '', transform: '', size: '' };

  constructor(doc: Document, parent: HTMLElement, private manifest: PetManifest, private sheet: SheetInfo) {
    this.el = doc.createElement('div');
    const s = this.el.style;
    s.position = 'absolute';
    s.left = '0';
    s.top = '0';
    s.backgroundImage = `url("${sheet.url}")`;
    s.backgroundRepeat = 'no-repeat';
    s.imageRendering = 'pixelated';
    s.pointerEvents = 'none';
    s.willChange = 'transform';
    parent.append(this.el);
  }

  /** Size of one sheet pixel in CSS px: a whole number of device pixels. */
  static pixelSize(scale: number, dpr: number): number {
    return Math.max(1, Math.round(scale * dpr)) / dpr;
  }

  draw(a: DrawArgs): void {
    const def = this.manifest.animations[a.anim];
    if (!def) return;
    const px = SpriteView.pixelSize(a.scale, a.dpr);
    const snap = (v: number) => Math.round(v * a.dpr) / a.dpr;
    const [fw, fh] = this.manifest.frameSize;
    const [ax, ay] = this.manifest.anchor;
    const s = this.el.style;

    const size = `${px}`;
    if (size !== this.last.size) {
      s.width = `${fw * px}px`;
      s.height = `${fh * px}px`;
      s.backgroundSize = `${this.sheet.width * px}px ${this.sheet.height * px}px`;
      this.last.size = size;
      this.last.frameKey = '';
    }

    const { frame } = frameAt(def, a.elapsed);
    const frameKey = `${a.anim}:${frame}`;
    if (frameKey !== this.last.frameKey) {
      const r = frameRect(this.manifest, def, frame);
      s.backgroundPosition = `${-r.x * px}px ${-r.y * px}px`;
      this.last.frameKey = frameKey;
    }

    const mirrored = (a.facing === 1) !== (this.manifest.facing === 'right');
    const anchorX = mirrored ? fw - ax : ax;
    const left = snap(a.x - anchorX * px);
    const top = snap(a.y - ay * px);
    const transform = `translate3d(${left}px,${top}px,0)${mirrored ? ' scaleX(-1)' : ''}`;
    if (transform !== this.last.transform) {
      s.transform = transform;
      this.last.transform = transform;
    }
  }

  remove(): void {
    this.el.remove();
  }
}
