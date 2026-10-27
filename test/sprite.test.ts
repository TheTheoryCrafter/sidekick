import { describe, expect, it } from 'vitest';
import { validateManifest } from '../src/core/manifest';
import { animationDuration, frameAt, frameRect } from '../src/core/sprite';
import creamCat from '../pets/cream-cat/manifest.json';

const cat = validateManifest(creamCat).manifest!;
const walk = cat.animations.walk!; // row 25, 8 frames, 10 fps, loops
const yawn = cat.animations.yawn!; // row 4, 8 frames, 8 fps, once

describe('frameRect', () => {
  it('maps frames to sheet pixels', () => {
    expect(frameRect(cat, walk, 0)).toEqual({ x: 0, y: 800, w: 32, h: 32 });
    expect(frameRect(cat, walk, 3)).toEqual({ x: 96, y: 800, w: 32, h: 32 });
  });

  it('clamps out-of-range frames', () => {
    expect(frameRect(cat, walk, 99).x).toBe(7 * 32);
    expect(frameRect(cat, walk, -1).x).toBe(0);
  });

  it('honours a start column', () => {
    expect(frameRect(cat, { row: 1, col: 2, frames: 2, fps: 1, loop: true }, 1)).toEqual({ x: 96, y: 32, w: 32, h: 32 });
  });
});

describe('frameAt', () => {
  it('advances at fps and wraps when looping', () => {
    expect(frameAt(walk, 0)).toEqual({ frame: 0, done: false });
    expect(frameAt(walk, 99)).toEqual({ frame: 0, done: false });
    expect(frameAt(walk, 100)).toEqual({ frame: 1, done: false });
    expect(frameAt(walk, 850)).toEqual({ frame: 0, done: false });
  });

  it('holds the last frame and reports done when not looping', () => {
    expect(animationDuration(yawn)).toBe(1000);
    expect(frameAt(yawn, 999)).toEqual({ frame: 7, done: false });
    expect(frameAt(yawn, 1000)).toEqual({ frame: 7, done: true });
    expect(frameAt(yawn, 5000)).toEqual({ frame: 7, done: true });
  });

  it('treats negative time as the start', () => {
    expect(frameAt(walk, -50).frame).toBe(0);
  });
});
