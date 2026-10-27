// The Sidekick instance: loads a pet, owns the host, the loop and the brain.

import { Behavior, type ActionInput, type ConditionFn, type RuleDef, type RuleInput } from '../core/behavior';
import {
  createBrain, dispatch, grab, holdAt, play, release, stepBrain,
  type BrainCtx, type BrainEffect, type BrainResult, type BrainState,
} from '../core/brain';
import type { Vec } from '../core/physics';
import { defaultBehavior } from '../core/defaults';
import { validateManifest, type PetManifest } from '../core/manifest';
import { seededRng, type Rng } from '../core/rng';
import { createHost, type Host } from './host';
import { Loop } from './loop';
import { PointerInput } from './pointer';
import { DEFAULT_SURFACE_SELECTOR, SurfaceScanner } from './surfaces';
import { PoopLayer } from './poop-layer';
import { normalizePoopOptions, poopSpot, type PoopOptions } from '../core/poop';
import { resolveRole } from '../core/roles';
import type { Surface } from '../core/surfaces';
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
  /**
   * CSS selector for page elements the pet may stand on and jump between,
   * or false to keep it on the floor. Elements inside [data-sidekick-ignore]
   * are always skipped. Default: headings, paragraphs, images, buttons, cards...
   */
  surfaces?: string | false;
  /**
   * Whether the pet poops now and then, or limits: at most `max` poops at once
   * (default 5), each gone after `ttl` ms of activity (default 10 minutes).
   * Clicking a poop clears it. Default true.
   */
  poop?: boolean | { max?: number; ttl?: number };
}

export type SidekickStatus = 'loading' | 'running' | 'paused' | 'error' | 'destroyed';

/** What listeners registered with on() receive. */
export type SidekickEvent = BrainEffect;

export interface SidekickDebug {
  status: SidekickStatus;
  pet: string;
  scale: number;
  simTime: number;
  timeScale: number;
  anim?: string;
  action?: string;
  step?: number;
  priority?: number;
  rule?: string | null;
  stepEndsIn?: number | null;
  x?: number;
  y?: number;
  facing?: 1 | -1;
  /** On the ground, held by the pointer, or flying. */
  mode?: 'ground' | 'held' | 'air';
  cursorNear?: boolean;
  /** ms until each cooling-down rule may fire again. */
  cooldowns?: Record<string, number>;
  lastDone?: Record<string, number>;
  rules: readonly RuleDef[];
  actions: string[];
}

/** Base walk speed in sheet pixels per second. */
const WALK_SHEET_PX_PER_S = 30;
/** "near" fires when the cursor comes within this many frame widths of the pet's middle. */
const NEAR_FRAMES = 2.5;
/** ...and re-arms once it is this much further away again. */
const NEAR_HYSTERESIS = 1.4;
/** Events emitted before the pet has loaded are kept, up to this many. */
const MAX_PENDING_EVENTS = 10;

const LOG = '[sidekick]';

/** Where the page's single instance lives, on `window`. */
export const INSTANCE = Symbol.for('sidekick');

export const clampScale = (n: unknown): number => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(8, Math.max(1, v)) : 2;
};

export class Sidekick {
  private opts: Required<Omit<SidekickOptions, 'seed' | 'poop'>>;
  private poopOpts: PoopOptions | null;
  private poops: PoopLayer | null = null;
  private rng: Rng;
  private behavior: Behavior = defaultBehavior();
  private host: Host | null = null;
  private view: SpriteView | null = null;
  private loop: Loop | null = null;
  private manifest: PetManifest | null = null;
  private state: BrainState | null = null;
  private simTime = 0;
  private timeScale = 1;
  private status: SidekickStatus = 'loading';
  private cleanups: (() => void)[] = [];
  private listeners = new Set<(e: SidekickEvent) => void>();
  private pending: [string, unknown][] = [];
  private input: PointerInput | null = null;
  private scanner: SurfaceScanner | null = null;
  private cursor: Vec | null = null;
  private cursorNear = false;
  /** Feet minus pointer at the start of a drag, so the pet doesn't jump to the pointer. */
  private grabOffset: Vec = { x: 0, y: 0 };

  constructor(private win: Window, options: SidekickOptions = {}) {
    this.opts = {
      pet: options.pet ?? 'cream-cat',
      petsBaseUrl: withSlash(options.petsBaseUrl ?? '/pets/'),
      scale: clampScale(options.scale ?? 2),
      surfaces: options.surfaces === undefined ? DEFAULT_SURFACE_SELECTOR : options.surfaces,
    };
    this.poopOpts = normalizePoopOptions(options.poop);
    this.rng = options.seed === undefined ? Math.random : seededRng(options.seed);
    void this.start();
  }

  // ---- Public API ---------------------------------------------------------

  /** Send an event to the pet's rules, e.g. emit('tool-completed'). */
  emit(name: string, payload?: unknown): void {
    if (typeof name !== 'string' || !name) return;
    if (!this.state) {
      if (this.pending.length < MAX_PENDING_EVENTS) this.pending.push([name, payload]);
      return;
    }
    this.apply(dispatch(this.state, name, this.ctx(0), payload));
  }

  /**
   * Start an action now, ignoring rules. Rules with at least `priority`
   * (default 0) can still interrupt it.
   */
  play(actionId: string, priority = 0): void {
    if (this.state) this.apply(play(this.state, actionId, this.ctx(0), priority));
  }

  /** Add or replace an action. Returns warnings (empty when all is well). */
  registerAction(action: ActionInput): string[] {
    return this.warn(this.behavior.addAction(action));
  }

  /** Add or replace a rule. Returns warnings (empty when all is well). */
  registerRule(rule: RuleInput): string[] {
    return this.warn(this.behavior.addRule(rule));
  }

  removeRule(id: string): boolean {
    return this.behavior.removeRule(id);
  }

  /** Add or replace a named condition that rules can list in `if`. */
  registerCondition(name: string, fn: ConditionFn): void {
    this.behavior.addCondition(name, fn);
  }

  /** Listen to what the pet does. Returns an unsubscribe function. */
  on(listener: (e: SidekickEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Remove every poop from the page. */
  clearPoops(): void {
    this.poops?.clear();
  }

  setScale(scale: number): void {
    this.opts.scale = clampScale(scale);
  }

  /** Debug only: run simulated time faster (1–60×). */
  setTimeScale(n: number): void {
    this.timeScale = Math.min(60, Math.max(1, Number(n) || 1));
  }

  debug(): SidekickDebug {
    const s = this.state;
    const a = s?.action;
    const now = this.simTime;
    return {
      status: this.status,
      pet: this.opts.pet,
      scale: this.opts.scale,
      simTime: Math.round(now),
      timeScale: this.timeScale,
      rules: this.behavior.allRules(),
      actions: [...this.behavior.actions.keys()],
      ...(s
        ? {
            anim: s.anim,
            action: a?.id,
            step: a?.step,
            priority: a?.priority,
            rule: a?.rule,
            stepEndsIn: a?.deadline == null ? null : Math.max(0, Math.round(a.deadline - now)),
            x: Math.round(s.body.x),
            y: Math.round(s.body.y),
            facing: s.body.facing,
            mode: s.mode,
            cursorNear: this.cursorNear,
            cooldowns: Object.fromEntries(
              Object.entries(s.cooldowns).filter(([, t]) => t > now).map(([k, t]) => [k, Math.round(t - now)]),
            ),
            lastDone: Object.fromEntries(Object.entries(s.lastDone).map(([k, t]) => [k, Math.round(now - t)])),
          }
        : {}),
    };
  }

  /** Debug only: the surfaces the pet currently sees, and the one it stands on. */
  debugSurfaces(): { surfaces: Surface[]; on: number | null } {
    if (!this.manifest || !this.state) return { surfaces: [], on: null };
    return { surfaces: this.ctx(0).surfaces.slice(), on: this.state.mode === 'ground' ? this.state.on : null };
  }

  destroy(): void {
    this.status = 'destroyed';
    this.loop?.stop();
    this.input?.destroy();
    this.input = null;
    this.scanner?.destroy();
    this.scanner = null;
    this.poops?.destroy();
    this.poops = null;
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.listeners.clear();
    this.view?.remove();
    this.host?.remove();
    this.loop = this.view = this.host = null;
    const g = this.win as Window & { [INSTANCE]?: Sidekick };
    if (g[INSTANCE] === this) delete g[INSTANCE];
  }

  // ---- Internals ----------------------------------------------------------

  private async start(): Promise<void> {
    try {
      const { manifest, sheet } = await this.loadPet(this.opts.pet);
      if (this.status === 'destroyed') return;
      const doc = this.win.document;
      this.manifest = manifest;
      this.host = createHost(doc);
      this.view = new SpriteView(doc, this.host.stage, manifest, sheet);
      if (this.opts.surfaces) this.scanner = new SurfaceScanner(this.win, this.opts.surfaces, this.host.el);
      const pile = resolveRole(manifest, 'poopEntity', () => 0);
      if (this.poopOpts && pile) {
        this.poops = new PoopLayer(this.win, this.host.stage, this.view.el, this.host.el, manifest, sheet, pile,
          this.poopOpts, () => this.emit('poop-cleaned'));
      }
      this.behavior.addCondition('poop-spot', () => this.poopSpotIsGood());
      this.input = new PointerInput(this.win, this.view.hit, {
        hover: () => this.emit('hover'),
        click: (kind) => this.emit(kind),
        cursor: (pos) => { this.cursor = pos; },
        grab: (at) => {
          if (!this.state) return;
          this.grabOffset = { x: this.state.body.x - at.x, y: this.state.body.y - at.y };
          this.apply(grab(this.state, this.ctx(0)));
        },
        drag: (to) => {
          if (this.state) this.state = holdAt(this.state, to.x + this.grabOffset.x, to.y + this.grabOffset.y, this.ctx(0));
        },
        release: (vel) => {
          if (this.state) this.apply(release(this.state, vel, this.ctx(0)));
        },
      });
      const c = this.ctx(0);
      this.state = createBrain(c.minX + this.rng() * (c.maxX - c.minX), c);
      this.loop = new Loop(this.win, (dt) => this.step(dt), () => this.render());
      this.listen(doc, 'visibilitychange', () => this.syncVisibility());
      this.syncVisibility();
      const queued = this.pending;
      this.pending = [];
      queued.forEach(([n, p]) => this.emit(n, p));
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

  private ctx(dtMs: number): BrainCtx {
    const m = this.manifest!;
    const px = this.pixelSize();
    const de = this.win.document.documentElement;
    // Keep the whole sprite on screen whichever way it faces.
    const margin = Math.max(m.anchor[0], m.frameSize[0] - m.anchor[0]) * px;
    const minY = m.anchor[1] * px;
    return {
      now: this.simTime,
      dt: dtMs / 1000,
      rng: this.rng,
      manifest: m,
      behavior: this.behavior,
      minX: margin,
      minY,
      maxX: de.clientWidth - margin,
      floorY: de.clientHeight,
      petW: m.frameSize[0] * px,
      petH: m.frameSize[1] * px,
      walkSpeed: WALK_SHEET_PX_PER_S * px * m.traits.speed,
      hour: new Date().getHours(),
      cursor: this.cursor,
      surfaces: this.surfaces(minY, m.hitbox[2] * px),
    };
  }

  /** Surfaces for the brain, with the one underfoot measured fresh so the pet rides scrolling exactly. */
  private surfaces(minTop: number, minWidth: number): Surface[] {
    if (!this.scanner) return [];
    const list = this.scanner.list(this.win.performance.now(), { minTop, minWidth });
    const on = this.state?.mode === 'ground' ? this.state.on : null;
    if (on === null) return list as Surface[];
    const fresh = this.scanner.measureOne(on);
    const others = list.filter((s) => s.id !== on);
    return fresh ? [...others, fresh] : others;
  }

  private step(dtMs: number): void {
    if (!this.state) return;
    const dt = dtMs * this.timeScale;
    this.simTime += dt;
    this.apply(stepBrain(this.state, this.ctx(dt)));
    this.checkNear();
    this.poops?.expire(this.simTime);
  }

  /** Where the next poop would go, in viewport px. */
  private nextPoopSpot(): { x: number; y: number } | null {
    const s = this.state;
    if (!s || !this.manifest || s.mode !== 'ground') return null;
    return poopSpot(s.body.x, s.body.y, s.body.facing, this.manifest.frameSize[0] * this.pixelSize());
  }

  private poopSpotIsGood(): boolean {
    const spot = this.nextPoopSpot();
    return !!spot && !!this.poops && this.poops.hasRoom && this.poops.isSafeAt(spot.x, spot.y, this.pixelSize());
  }

  /** The poop step finished: drop the pile if the spot is (still) safe. */
  private dropPoop(): void {
    const spot = this.nextPoopSpot();
    if (!spot || !this.poops || !this.poops.isSafeAt(spot.x, spot.y, this.pixelSize())) return;
    const on = this.state!.on;
    this.poops.drop(spot.x, spot.y, on === null ? null : this.scanner?.elementOf(on) ?? null, this.simTime);
  }

  /** Emit "near" when the cursor comes close, once per approach. */
  private checkNear(): void {
    const s = this.state;
    if (!s || !this.manifest) return;
    if (!this.cursor || s.mode !== 'ground') {
      this.cursorNear = false;
      return;
    }
    const px = this.pixelSize();
    const [fw, fh] = this.manifest.frameSize;
    const d = Math.hypot(this.cursor.x - s.body.x, this.cursor.y - (s.body.y - (fh * px) / 2));
    const r = fw * px * NEAR_FRAMES;
    if (!this.cursorNear && d < r) {
      this.cursorNear = true;
      this.emit('near');
    } else if (this.cursorNear && d > r * NEAR_HYSTERESIS) {
      this.cursorNear = false;
    }
  }

  private apply(r: BrainResult): void {
    this.state = r.state;
    for (const e of r.effects) {
      if (e.type === 'emit' && e.name === 'poop') this.dropPoop();
      for (const fn of this.listeners) {
        try {
          fn(e);
        } catch (err) {
          console.error(LOG, 'listener failed:', err);
        }
      }
    }
  }

  private warn(warnings: string[]): string[] {
    warnings.forEach((w) => console.warn(LOG, w));
    return warnings;
  }

  private render(): void {
    const s = this.state;
    if (!s || !this.view) return;
    this.poops?.render(this.simTime, this.pixelSize(), this.win.devicePixelRatio || 1);
    this.view.draw({
      anim: s.anim,
      elapsed: this.simTime - s.animStart,
      x: s.body.x,
      y: s.body.y,
      facing: s.body.facing,
      scale: this.opts.scale,
      dpr: this.win.devicePixelRatio || 1,
      cursor: this.input?.isDragging ? 'grabbing' : 'grab',
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
