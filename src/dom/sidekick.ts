// The Sidekick instance: loads a pet, owns the host, the loop and the brain.

import { validateManifest, type PetManifest } from '../core/manifest';
import { seededRng, type Rng } from '../core/rng';
import { startWander, stepWander, type WanderCtx, type WanderState } from '../core/wander';
import { createHost, type Host } from './host';
import { Loop } from './loop';
import { SpriteView, type SheetInfo } from './sprite-view';

export interface SidekickOptions {
  /** Pet folder name under `petsBaseUrl`. Default "cream-cat". */
  pet?: string;
  /** URL of the folder that holds pet folders. Default "/pets/". */
  petsBaseUrl?: string;
  /** Whole-number size multiplier. Default 2. */
  scale?: number;
  /** Fixes the random sequence, for demos and tests. */
  seed?: number;
}

export type SidekickStatus = 'loading' | 'running' | 'paused' | 'error' | 'destroyed';

export interface SidekickDebug {
  status: SidekickStatus;
  pet: string;
  scale: number;
  simTime: number;
  anim?: string;
  mode?: string;
  x?: number;
  y?: number;
  facing?: 1 | -1;
}

/** Base walk speed in sheet pixels per second. */
const WALK_SHEET_PX_PER_S = 30;

const LOG = '[sidekick]';

/** Where the page's single instance lives, on `window`. */
export const INSTANCE = Symbol.for('sidekick');

export const clampScale = (n: unknown): number => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(8, Math.max(1, v)) : 2;
};

export class Sidekick {
  private opts: Required<Omit<SidekickOptions, 'seed'>>;
  private rng: Rng;
  private host: Host | null = null;
  private view: SpriteView | null = null;
  private loop: Loop | null = null;
  private manifest: PetManifest | null = null;
  private state: WanderState | null = null;
  private simTime = 0;
  private status: SidekickStatus = 'loading';
  private cleanups: (() => void)[] = [];

  constructor(private win: Window, options: SidekickOptions = {}) {
    this.opts = {
      pet: options.pet ?? 'cream-cat',
      petsBaseUrl: withSlash(options.petsBaseUrl ?? '/pets/'),
      scale: clampScale(options.scale ?? 2),
    };
    this.rng = options.seed === undefined ? Math.random : seededRng(options.seed);
    void this.start();
  }

  setScale(scale: number): void {
    this.opts.scale = clampScale(scale);
  }

  debug(): SidekickDebug {
    const s = this.state;
    return {
      status: this.status,
      pet: this.opts.pet,
      scale: this.opts.scale,
      simTime: Math.round(this.simTime),
      ...(s ? { anim: s.anim, mode: s.mode.kind, x: Math.round(s.body.x), y: Math.round(s.body.y), facing: s.body.facing } : {}),
    };
  }

  destroy(): void {
    this.status = 'destroyed';
    this.loop?.stop();
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.view?.remove();
    this.host?.remove();
    this.loop = this.view = this.host = null;
    const g = this.win as Window & { [INSTANCE]?: Sidekick };
    if (g[INSTANCE] === this) delete g[INSTANCE];
  }

  private async start(): Promise<void> {
    try {
      const { manifest, sheet } = await this.loadPet(this.opts.pet);
      if (this.status === 'destroyed') return;
      const doc = this.win.document;
      this.manifest = manifest;
      this.host = createHost(doc);
      this.view = new SpriteView(doc, this.host.stage, manifest, sheet);
      const c = this.ctx(0);
      this.state = startWander(c.minX + this.rng() * (c.maxX - c.minX), c);
      this.loop = new Loop(this.win, (dt) => this.step(dt), () => this.render());
      this.listen(doc, 'visibilitychange', () => this.syncVisibility());
      this.syncVisibility();
    } catch (err) {
      if (this.status === 'destroyed') return;
      this.status = 'error';
      console.error(LOG, err);
    }
  }

  private async loadPet(id: string): Promise<{ manifest: PetManifest; sheet: SheetInfo }> {
    const base = `${this.opts.petsBaseUrl}${encodeURIComponent(id)}/`;
    const res = await this.win.fetch(`${base}manifest.json`);
    if (!res.ok) throw new Error(`Could not load pet "${id}" (${res.status}).`);
    const v = validateManifest(await res.json());
    v.warnings.forEach((w) => console.warn(LOG, `${id}:`, w));
    if (!v.manifest) throw new Error(`Pet "${id}" has an invalid manifest: ${v.errors.join(' ')}`);
    const img = this.win.document.createElement('img');
    img.src = new URL(v.manifest.sheet, new URL(base, this.win.location.href)).href;
    await img.decode();
    return { manifest: v.manifest, sheet: { url: img.src, width: img.naturalWidth, height: img.naturalHeight } };
  }

  private syncVisibility(): void {
    if (!this.loop || this.status === 'destroyed') return;
    if (this.win.document.hidden) {
      this.loop.stop();
      this.status = 'paused';
    } else {
      this.loop.start();
      this.status = 'running';
    }
  }

  private pixelSize(): number {
    return SpriteView.pixelSize(this.opts.scale, this.win.devicePixelRatio || 1);
  }

  private ctx(dtMs: number): WanderCtx {
    const m = this.manifest!;
    const px = this.pixelSize();
    const de = this.win.document.documentElement;
    // Keep the whole sprite on screen whichever way it faces.
    const margin = Math.max(m.anchor[0], m.frameSize[0] - m.anchor[0]) * px;
    return {
      now: this.simTime,
      dt: dtMs / 1000,
      rng: this.rng,
      manifest: m,
      minX: margin,
      maxX: de.clientWidth - margin,
      floorY: de.clientHeight,
      walkSpeed: WALK_SHEET_PX_PER_S * px * m.traits.speed,
    };
  }

  private step(dtMs: number): void {
    if (!this.state) return;
    this.simTime += dtMs;
    this.state = stepWander(this.state, this.ctx(dtMs));
  }

  private render(): void {
    const s = this.state;
    if (!s || !this.view) return;
    this.view.draw({
      anim: s.anim,
      elapsed: this.simTime - s.animStart,
      x: s.body.x,
      y: s.body.y,
      facing: s.body.facing,
      scale: this.opts.scale,
      dpr: this.win.devicePixelRatio || 1,
    });
  }

  private listen(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.cleanups.push(() => target.removeEventListener(type, fn));
  }
}

function withSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
