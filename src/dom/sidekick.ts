// The Sidekick instance: loads a pet, owns the host, the loop and the brain.

import { Behavior, type ActionInput, type ConditionFn, type RuleDef, type RuleInput } from '../core/behavior';
import { createBrain, dispatch, play, stepBrain, type BrainCtx, type BrainEffect, type BrainResult, type BrainState } from '../core/brain';
import { defaultBehavior } from '../core/defaults';
import { validateManifest, type PetManifest } from '../core/manifest';
import { seededRng, type Rng } from '../core/rng';
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
  /** ms until each cooling-down rule may fire again. */
  cooldowns?: Record<string, number>;
  lastDone?: Record<string, number>;
  rules: readonly RuleDef[];
  actions: string[];
}

/** Base walk speed in sheet pixels per second. */
const WALK_SHEET_PX_PER_S = 30;
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
  private opts: Required<Omit<SidekickOptions, 'seed'>>;
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

  constructor(private win: Window, options: SidekickOptions = {}) {
    this.opts = {
      pet: options.pet ?? 'cream-cat',
      petsBaseUrl: withSlash(options.petsBaseUrl ?? '/pets/'),
      scale: clampScale(options.scale ?? 2),
    };
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
            cooldowns: Object.fromEntries(
              Object.entries(s.cooldowns).filter(([, t]) => t > now).map(([k, t]) => [k, Math.round(t - now)]),
            ),
            lastDone: Object.fromEntries(Object.entries(s.lastDone).map(([k, t]) => [k, Math.round(now - t)])),
          }
        : {}),
    };
  }

  destroy(): void {
    this.status = 'destroyed';
    this.loop?.stop();
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
    return {
      now: this.simTime,
      dt: dtMs / 1000,
      rng: this.rng,
      manifest: m,
      behavior: this.behavior,
      minX: margin,
      maxX: de.clientWidth - margin,
      floorY: de.clientHeight,
      walkSpeed: WALK_SHEET_PX_PER_S * px * m.traits.speed,
      hour: new Date().getHours(),
    };
  }

  private step(dtMs: number): void {
    if (!this.state) return;
    const dt = dtMs * this.timeScale;
    this.simTime += dt;
    this.apply(stepBrain(this.state, this.ctx(dt)));
  }

  private apply(r: BrainResult): void {
    this.state = r.state;
    for (const e of r.effects) {
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
