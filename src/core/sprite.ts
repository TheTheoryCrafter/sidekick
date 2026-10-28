// Sprite sheet geometry and frame timing. Pure — no DOM.

import type { AnimationDef, PetManifest } from './manifest';

export interface FrameRect { x: number; y: number; w: number; h: number }

/** Where frame `index` of `anim` sits on the sheet, in sheet pixels. */
export function frameRect(manifest: PetManifest, anim: AnimationDef, index: number): FrameRect {
  const [w, h] = anim.size ?? manifest.frameSize;
  const i = Math.max(0, Math.min(anim.frames - 1, Math.floor(index)));
  return { x: ((anim.col ?? 0) + i) * w, y: anim.row * manifest.frameSize[1], w, h };
}

export interface FrameState {
  frame: number;
  /** True once a non-looping animation has shown its last frame for a full frame time. */
  done: boolean;
}

/** Which frame shows `elapsedMs` after the animation started. */
export function frameAt(anim: AnimationDef, elapsedMs: number): FrameState {
  const t = Math.max(0, elapsedMs);
  const ticks = Math.floor((t * anim.fps) / 1000);
  if (anim.loop) return { frame: ticks % anim.frames, done: false };
  return { frame: Math.min(ticks, anim.frames - 1), done: ticks >= anim.frames };
}

/** How long one pass of the animation takes, in ms. */
export function animationDuration(anim: AnimationDef): number {
  return (anim.frames * 1000) / anim.fps;
}
