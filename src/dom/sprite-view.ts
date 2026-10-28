// Draws one sprite frame as a div with a background image, plus an invisible
// hitbox over the pet that takes the pointer. Writes styles only when something
// changed, and snaps everything to whole device pixels.

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
  /** Cursor over the hitbox: "grab", or "grabbing" while dragging. */
  cursor: 'grab' | 'grabbing';
}

export class SpriteView {
  readonly el: HTMLDivElement;
  /** Transparent element over the pet that receives pointer events. */
  readonly hit: HTMLDivElement;
  private last = { frameKey: '', transform: '', size: '', hit: '', cursor: '' };

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

    this.hit = doc.createElement('div');
    const h = this.hit.style;
    h.position = 'absolute';
    h.left = '0';
    h.top = '0';
    h.pointerEvents = 'auto';
    // The pet handles its own drags; page scrolling elsewhere is untouched.
    h.touchAction = 'none';
    h.userSelect = 'none';
    h.setProperty('-webkit-user-select', 'none');
    h.setProperty('-webkit-touch-callout', 'none');
    h.setProperty('-webkit-tap-highlight-color', 'transparent');
    parent.append(this.el, this.hit);
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
    // An animation with its own frame size sits bottom-centred on the usual frame.
    const [w, h] = def.size ?? this.manifest.frameSize;
    const ox = (w - fw) / 2;
    const oy = h - fh;
    const s = this.el.style;

    const size = `${px}:${w}x${h}`;
    if (size !== this.last.size) {
      s.width = `${w * px}px`;
      s.height = `${h * px}px`;
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
    // The usual frame's top-left; the hitbox is always placed against it.
    const left = snap(a.x - anchorX * px);
    const top = snap(a.y - ay * px);
    const transform = `translate3d(${snap(left - ox * px)}px,${snap(top - oy * px)}px,0)${mirrored ? ' scaleX(-1)' : ''}`;
    if (transform !== this.last.transform) {
      s.transform = transform;
      this.last.transform = transform;
    }

    const [hx, hy, hw, hh] = this.manifest.hitbox;
    const hitX = left + (mirrored ? fw - hx - hw : hx) * px;
    const hitKey = `${hitX},${top + hy * px},${hw * px},${hh * px}`;
    if (hitKey !== this.last.hit) {
      const h = this.hit.style;
      h.width = `${hw * px}px`;
      h.height = `${hh * px}px`;
      h.transform = `translate3d(${hitX}px,${top + hy * px}px,0)`;
      this.last.hit = hitKey;
    }
    if (a.cursor !== this.last.cursor) {
      this.hit.style.cursor = a.cursor;
      this.last.cursor = a.cursor;
    }
  }

  remove(): void {
    this.el.remove();
    this.hit.remove();
  }
}
