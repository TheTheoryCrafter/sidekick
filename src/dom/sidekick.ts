// The Sidekick instance. It owns the host element for its whole life, and
// mounts or unmounts the pet itself (sprite, input, loop, sensors...) as the
// visitor turns it on and off or switches pets.

import { Behavior, type ActionInput, type ConditionFn, type RuleDef, type RuleInput } from '../core/behavior';
import {
  createBrain, dispatch, grab, holdAt, play, release, stepBrain,
  type BrainCtx, type BrainEffect, type BrainResult, type BrainState,
} from '../core/brain';
import { defaultBehavior } from '../core/defaults';
import { validateManifest, type PetManifest } from '../core/manifest';
import type { Vec } from '../core/physics';
import { normalizePoopOptions, poopSpot, type PoopOptions } from '../core/poop';
import { seededRng, type Rng } from '../core/rng';
import { recordClick } from '../core/pester';
import { hasOwnRole, resolveRole } from '../core/roles';
import { initialSettings, type Settings } from '../core/settings';
import type { Surface } from '../core/surfaces';
import { createHost, type Host } from './host';
import { Loop } from './loop';
import { Menu, RestoreButton, type MenuItem } from './menu';
import { PointerInput } from './pointer';
import { PoopLayer } from './poop-layer';
import { Sensors } from './sensors';
import { SpriteView, type SheetInfo } from './sprite-view';
import { DEFAULT_STORAGE_KEY, SettingsStore } from './storage';
import { DEFAULT_SURFACE_SELECTOR, SurfaceScanner } from './surfaces';

/**
 * Scrolling down reveals ledges: ones that appear within `afterScrollMs` of scrolling down
 * count; tell the rules at most every `everyMs`, and prefer them for `preferMs`.
 */
const REVEAL = { afterScrollMs: 2000, everyMs: 1000, preferMs: 2500 } as const;

/**
 * A pet given as data instead of a folder URL, e.g. the bundled
 * `import creamCat from "sidekick-pet/pets/cream-cat"`.
 */
export interface PetDefinition {
  id: string;
  /** The manifest object (same shape as manifest.json). */
  manifest: unknown;
  /** URL of the sprite sheet (a file URL or a data: URL). */
  sheetUrl: string;
}

/** A pet folder name under `petsBaseUrl`, or a pet given as data. */
export type PetRef = string | PetDefinition;

export interface SidekickOptions {
  /** The pet to show first. Default "cream-cat". */
  pet?: PetRef;
  /** Pets the visitor may switch between (built-in menu, setPet). Default: just `pet`. */
  pets?: PetRef[];
  /** URL of the folder that holds pet folders. Default "/pets/". */
  petsBaseUrl?: string;
  /** Folder URLs for pets that live somewhere else, by id. Wins over `petsBaseUrl`. */
  petUrls?: Record<string, string>;
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
   * (default 5), each gone after `ttl` ms of activity (default 15 seconds).
   * Clicking a poop clears it. Default true.
   */
  poop?: boolean | { max?: number; ttl?: number };
  /** Whether the pet starts switched on. The visitor's saved choice wins. Default true. */
  enabled?: boolean;
  /** Remember on/off, pet and position in localStorage. Default true. */
  persist?: boolean;
  /** localStorage key. Default "sidekick:v1". */
  storageKey?: string;
  /** Show a small built-in menu on right-click / long-press, and a button to bring the pet back. Default false. */
  menu?: boolean;
  /** Corner for the button that brings a hidden pet back (with `menu`). Default "bottom-right". */
  restoreButton?: 'bottom-right' | 'bottom-left';
  /** ms without input before the "visitor-idle" event. Default 60000. */
  idleAfter?: number;
  /**
   * "auto" follows the visitor's prefers-reduced-motion setting, "reduced" always keeps
   * the pet from moving on its own, "full" ignores the setting. Default "auto".
   */
  motion?: 'auto' | 'reduced' | 'full';
}

export type SidekickStatus = 'loading' | 'running' | 'paused' | 'disabled' | 'error' | 'destroyed';

/** What listeners registered with on() receive. */
export type SidekickEvent = BrainEffect;

/** The visitor's choices, as passed to subscribe() listeners. */
export interface SidekickSettings {
  enabled: boolean;
  pet: string;
}

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
  poops?: number;
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
/** Fired on `window` when the page's instance is created or destroyed (any bundle copy). */
export const INSTANCE_EVENT = 'sidekick:instance';

export const clampScale = (n: unknown): number => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(8, Math.max(1, v)) : 2;
};

interface LoadedPet { manifest: PetManifest; sheet: SheetInfo }

/** Everything that exists only while the pet is on screen. */
interface Mounted {
  manifest: PetManifest;
  view: SpriteView;
  input: PointerInput;
  loop: Loop;
  sensors: Sensors;
  scanner: SurfaceScanner | null;
  poops: PoopLayer | null;
  cleanups: (() => void)[];
}

export class Sidekick {
  private opts: {
    pets: string[];
    petsBaseUrl: string;
    petUrls: Record<string, string>;
    scale: number;
    surfaces: string | false;
    menu: boolean;
    restoreButton: 'bottom-right' | 'bottom-left';
    idleAfter: number;
  };
  private poopOpts: PoopOptions | null;
  /** Pets given as data, by id. */
  private petDefs = new Map<string, PetDefinition>();
  private calm = false;
  /** Sim times of recent clicks on the pet, to notice pestering. */
  private clickTimes: number[] = [];
  /** Ledges seen in the last step, the scroll position then, and ledges just revealed. */
  private seen = new Set<number>();
  private scrollY = 0;
  private lastScrollDown = -Infinity;
  private lastReveal = -Infinity;
  private fresh: { ids: number[]; until: number } | null = null;
  private rng: Rng;
  private behavior: Behavior = defaultBehavior();
  private settings: Settings;
  private store: SettingsStore;
  private host: Host | null;
  private menu: Menu | null = null;
  private restore: RestoreButton | null = null;
  private m: Mounted | null = null;
  /** Bumped on every mount/unmount so a slow pet load can't mount a stale pet. */
  private generation = 0;
  private petCache = new Map<string, Promise<LoadedPet>>();
  private state: BrainState | null = null;
  private simTime = 0;
  private timeScale = 1;
  private status: SidekickStatus = 'loading';
  private listeners = new Set<(e: SidekickEvent) => void>();
  private settingsListeners = new Set<(s: SidekickSettings) => void>();
  private pending: [string, unknown][] = [];
  private cursor: Vec | null = null;
  private cursorNear = false;
  /** Feet minus pointer at the start of a drag, so the pet doesn't jump to the pointer. */
  private grabOffset: Vec = { x: 0, y: 0 };
  private globalCleanups: (() => void)[] = [];

  constructor(private win: Window, options: SidekickOptions = {}) {
    const refId = (r: PetRef) => {
      if (typeof r === 'string') return r;
      this.petDefs.set(r.id, r);
      return r.id;
    };
    const pet = refId(options.pet ?? options.pets?.[0] ?? 'cream-cat');
    const pets = [...new Set([pet, ...(options.pets ?? []).map(refId)])];
    this.opts = {
      pets,
      petsBaseUrl: withSlash(options.petsBaseUrl ?? '/pets/'),
      petUrls: Object.fromEntries(Object.entries(options.petUrls ?? {}).map(([k, v]) => [k, withSlash(v)])),
      scale: clampScale(options.scale ?? 2),
      surfaces: options.surfaces === undefined ? DEFAULT_SURFACE_SELECTOR : options.surfaces,
      menu: options.menu === true,
      restoreButton: options.restoreButton === 'bottom-left' ? 'bottom-left' : 'bottom-right',
      idleAfter: typeof options.idleAfter === 'number' && options.idleAfter >= 1000 ? options.idleAfter : 60_000,
    };
    this.poopOpts = normalizePoopOptions(options.poop);
    this.rng = options.seed === undefined ? Math.random : seededRng(options.seed);
    this.store = new SettingsStore(win, options.storageKey ?? DEFAULT_STORAGE_KEY, options.persist !== false);
    this.settings = initialSettings({ enabled: options.enabled !== false, pet }, this.store.read(), pets);
    this.behavior.addCondition('poop-spot', () => this.poopSpotIsGood());
    this.watchMotion(options.motion ?? 'auto');

    this.host = createHost(win.document);
    if (this.opts.menu) this.menu = new Menu(win, this.host.stage);
    this.store.onExternalChange((s) => this.applyExternal(s));
    // Save where the pet is when the visitor leaves or switches tabs.
    const save = () => this.save();
    win.addEventListener('pagehide', save);
    this.globalCleanups.push(() => win.removeEventListener('pagehide', save));

    if (this.settings.enabled) void this.mount();
    else this.showDisabled();
  }

  // ---- Public API ---------------------------------------------------------

  /** Show the pet (and remember the choice). */
  enable(): void {
    if (this.status === 'destroyed' || this.settings.enabled) return;
    this.settings = { ...this.settings, enabled: true };
    this.save();
    this.notify();
    void this.mount();
  }

  /** Hide the pet (and remember the choice). Its poops go with it. */
  disable(): void {
    if (this.status === 'destroyed' || !this.settings.enabled) return;
    this.unmount();
    this.settings = { ...this.settings, enabled: false };
    this.save();
    this.notify();
    this.showDisabled();
  }

  toggle(): void {
    if (this.settings.enabled) this.disable();
    else this.enable();
  }

  isEnabled(): boolean {
    return this.settings.enabled;
  }

  /** Switch to another pet from `pets`. Resolves once it is on screen (or right away when hidden). */
  async setPet(id: string): Promise<void> {
    if (this.status === 'destroyed' || id === this.settings.pet) return;
    if (!this.opts.pets.includes(id)) {
      console.warn(LOG, `Pet "${id}" is not in the "pets" option; ignoring setPet.`);
      return;
    }
    const wasOn = !!this.m;
    if (wasOn) this.unmount();
    this.settings = { ...this.settings, pet: id };
    this.save();
    this.notify();
    if (wasOn || this.settings.enabled) await this.mount();
  }

  /** Current choices: on/off and pet. */
  getSettings(): SidekickSettings {
    return { enabled: this.settings.enabled, pet: this.settings.pet };
  }

  /** Pets the visitor can choose from. */
  getPets(): string[] {
    return [...this.opts.pets];
  }

  /** Listen to on/off and pet changes (from the API, the menu, or another tab). */
  subscribe(listener: (s: SidekickSettings) => void): () => void {
    this.settingsListeners.add(listener);
    return () => this.settingsListeners.delete(listener);
  }

  /** Send an event to the pet's rules, e.g. emit('tool-completed'). Ignored while hidden. */
  emit(name: string, payload?: unknown): void {
    if (typeof name !== 'string' || !name || !this.settings.enabled) return;
    if (!this.state || !this.m) {
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
    if (this.state && this.m) this.apply(play(this.state, actionId, this.ctx(0), priority));
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
    this.m?.poops?.clear();
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
      pet: this.settings.pet,
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
            poops: this.m?.poops?.count ?? 0,
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
    if (!this.m || !this.state) return { surfaces: [], on: null };
    return { surfaces: this.ctx(0).surfaces.slice(), on: this.state.mode === 'ground' ? this.state.on : null };
  }

  /** Remove the pet and everything it added to the page. */
  destroy(): void {
    if (this.status === 'destroyed') return;
    this.save();
    this.unmount();
    this.status = 'destroyed';
    this.globalCleanups.forEach((fn) => fn());
    this.globalCleanups = [];
    this.store.destroy();
    this.menu?.close();
    this.restore?.remove();
    this.host?.remove();
    this.host = null;
    this.listeners.clear();
    this.settingsListeners.clear();
    const g = this.win as Window & { [INSTANCE]?: Sidekick };
    if (g[INSTANCE] === this) {
      delete g[INSTANCE];
      this.win.dispatchEvent(new Event(INSTANCE_EVENT));
    }
  }

  // ---- Mounting -----------------------------------------------------------

  private async mount(): Promise<void> {
    if (!this.host || this.m) return;
    const gen = ++this.generation;
    this.status = 'loading';
    this.restore?.remove();
    this.restore = null;
    const petId = this.settings.pet;
    let pet: LoadedPet;
    try {
      pet = await this.loadPet(petId);
    } catch (err) {
      if (gen === this.generation) {
        this.status = 'error';
        console.error(LOG, err);
      }
      return;
    }
    if (gen !== this.generation || !this.host || !this.settings.enabled || this.settings.pet !== petId) return;

    const { manifest, sheet } = pet;
    const win = this.win;
    const doc = win.document;
    const view = new SpriteView(doc, this.host.stage, manifest, sheet);
    const scanner = this.opts.surfaces ? new SurfaceScanner(win, this.opts.surfaces, this.host.el) : null;
    const pile = resolveRole(manifest, 'poopEntity', () => 0);
    const poops = this.poopOpts && pile
      ? new PoopLayer(win, this.host.stage, view.el, this.host.el, manifest, sheet, pile, this.poopOpts, () => this.emit('poop-cleaned'))
      : null;
    const input = new PointerInput(win, view.hit, {
      hover: () => this.emit('hover'),
      click: (kind) => {
        this.emit(kind);
        // Every press counts: the second of a quick pair arrives as "dblclick" alone.
        const r = recordClick(this.clickTimes, this.simTime);
        this.clickTimes = r.times;
        if (r.pestered) this.emit('pestered');
      },
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
      ...(this.menu ? { menu: () => this.openMenu() } : {}),
    });
    const sensors = new Sensors(win, (name, payload) => this.emit(name, payload), this.opts.idleAfter);
    const loop = new Loop(win, (dt) => this.step(dt), () => this.render());
    const cleanups: (() => void)[] = [];
    const onVisibility = () => {
      this.syncVisibility();
      if (doc.hidden) this.save();
    };
    doc.addEventListener('visibilitychange', onVisibility);
    cleanups.push(() => doc.removeEventListener('visibilitychange', onVisibility));

    this.m = { manifest, view, input, loop, sensors, scanner, poops, cleanups };
    const c = this.ctx(0);
    const x = this.settings.x === undefined ? c.minX + this.rng() * (c.maxX - c.minX) : this.settings.x * doc.documentElement.clientWidth;
    this.state = createBrain(x, c);
    this.syncVisibility();

    const queued = this.pending;
    this.pending = [];
    queued.forEach(([n, p]) => this.emit(n, p));
  }

  private unmount(): void {
    this.generation++;
    this.pending = [];
    this.menu?.close();
    const m = this.m;
    if (!m) return;
    this.saveX();
    m.loop.stop();
    m.cleanups.forEach((fn) => fn());
    m.input.destroy();
    m.sensors.destroy();
    m.scanner?.destroy();
    m.poops?.destroy();
    m.view.remove();
    this.m = null;
    this.state = null;
    this.cursorNear = false;
    if (this.status !== 'destroyed') this.status = 'disabled';
  }

  private showDisabled(): void {
    this.status = 'disabled';
    if (this.menu && this.host && !this.restore) {
      this.restore = new RestoreButton(this.win, this.host.stage, () => this.enable(), 'Bring the pet back', this.opts.restoreButton);
    }
  }

  private loadPet(id: string): Promise<LoadedPet> {
    let p = this.petCache.get(id);
    if (!p) {
      p = this.fetchPet(id);
      // A failed load may succeed later (offline, flaky network): don't cache it.
      p.catch(() => this.petCache.delete(id));
      this.petCache.set(id, p);
    }
    return p;
  }

  private watchMotion(mode: 'auto' | 'reduced' | 'full'): void {
    if (mode !== 'auto') {
      this.calm = mode === 'reduced';
      return;
    }
    let mq: MediaQueryList;
    try {
      mq = this.win.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    this.calm = mq.matches;
    const onChange = () => { this.calm = mq.matches; };
    mq.addEventListener?.('change', onChange);
    this.globalCleanups.push(() => mq.removeEventListener?.('change', onChange));
  }

  private async fetchPet(id: string): Promise<LoadedPet> {
    const def = this.petDefs.get(id);
    if (def) {
      const v = validateManifest(def.manifest);
      v.warnings.forEach((w) => console.warn(LOG, `${id}:`, w));
      if (!v.manifest) throw new Error(`Pet "${id}" has an invalid manifest: ${v.errors.join(' ')}`);
      return { manifest: v.manifest, sheet: await this.loadSheet(def.sheetUrl) };
    }
    const base = this.opts.petUrls[id] ?? `${this.opts.petsBaseUrl}${encodeURIComponent(id)}/`;
    const res = await this.win.fetch(`${base}manifest.json`);
    if (!res.ok) throw new Error(`Could not load pet "${id}" (${res.status}).`);
    const v = validateManifest(await res.json());
    v.warnings.forEach((w) => console.warn(LOG, `${id}:`, w));
    if (!v.manifest) throw new Error(`Pet "${id}" has an invalid manifest: ${v.errors.join(' ')}`);
    return { manifest: v.manifest, sheet: await this.loadSheet(new URL(v.manifest.sheet, new URL(base, this.win.location.href)).href) };
  }

  private async loadSheet(url: string): Promise<SheetInfo> {
    const img = this.win.document.createElement('img');
    img.src = url;
    await img.decode();
    return { url: img.src, width: img.naturalWidth, height: img.naturalHeight };
  }

  private syncVisibility(): void {
    if (!this.m) return;
    if (this.win.document.hidden) {
      this.m.loop.stop();
      this.status = 'paused';
    } else {
      this.m.loop.start();
      this.status = 'running';
    }
  }

  // ---- Settings -----------------------------------------------------------

  private saveX(): void {
    if (!this.state) return;
    const w = this.win.document.documentElement.clientWidth;
    if (w > 0) this.settings = { ...this.settings, x: Math.min(1, Math.max(0, this.state.body.x / w)) };
  }

  private save(): void {
    this.saveX();
    this.store.write(this.settings);
  }

  private notify(): void {
    const s = this.getSettings();
    for (const fn of this.settingsListeners) {
      try {
        fn(s);
      } catch (err) {
        console.error(LOG, 'subscriber failed:', err);
      }
    }
  }

  /** Another tab changed the settings: follow along without writing back. */
  private applyExternal(s: Partial<Settings>): void {
    if (this.status === 'destroyed') return;
    const pet = s.pet && this.opts.pets.includes(s.pet) ? s.pet : this.settings.pet;
    const enabled = s.enabled ?? this.settings.enabled;
    if (pet === this.settings.pet && enabled === this.settings.enabled) return;
    const remount = !!this.m && pet !== this.settings.pet;
    if (remount || !enabled) this.unmount();
    this.settings = { ...this.settings, pet, enabled };
    this.notify();
    if (enabled) {
      if (!this.m) void this.mount();
    } else {
      this.showDisabled();
    }
  }

  // ---- Menu ---------------------------------------------------------------

  private openMenu(): void {
    if (!this.menu || !this.state || !this.m) return;
    const items: MenuItem[] = [];
    const poops = this.m.poops?.count ?? 0;
    if (this.state.action?.id !== 'sleep') items.push({ label: 'Take a nap', onSelect: () => this.play('sleep', 50) });
    else items.push({ label: 'Wake up', onSelect: () => this.play('sit', 60) });
    if (poops > 0) items.push({ label: `Clean up (${poops})`, onSelect: () => this.clearPoops() });
    for (const id of this.opts.pets) {
      if (id !== this.settings.pet) items.push({ label: `Switch to ${prettyName(id)}`, onSelect: () => void this.setPet(id) });
    }
    items.push({ label: 'Hide pet', onSelect: () => this.disable() });
    const px = this.pixelSize();
    const [, fh] = this.m.manifest.frameSize;
    this.menu.open(items, this.state.body.x, this.state.body.y - fh * px);
  }

  // ---- Simulation ---------------------------------------------------------

  private pixelSize(): number {
    return SpriteView.pixelSize(this.petScale(), this.win.devicePixelRatio || 1);
  }

  /** The `scale` option times the pet's own size factor. */
  private petScale(): number {
    return this.opts.scale * (this.m?.manifest.scale ?? 1);
  }

  private ctx(dtMs: number): BrainCtx {
    const m = this.m!.manifest;
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
      // A pet with no walk of its own (the panda) stays put, like reduced motion.
      calm: this.calm || !hasOwnRole(m, 'move'),
      ...(this.fresh && this.fresh.until > this.simTime ? { preferSurfaces: this.fresh.ids } : {}),
    };
  }

  /** Surfaces for the brain, with the one underfoot measured fresh so the pet rides scrolling exactly. */
  private surfaces(minTop: number, minWidth: number): Surface[] {
    const scanner = this.m?.scanner;
    if (!scanner) return [];
    const list = scanner.list(this.win.performance.now(), { minTop, minWidth });
    const on = this.state?.mode === 'ground' ? this.state.on : null;
    if (on === null) return list as Surface[];
    const fresh = scanner.measureOne(on);
    const others = list.filter((s) => s.id !== on);
    return fresh ? [...others, fresh] : others;
  }

  private step(dtMs: number): void {
    if (!this.state || !this.m) return;
    const dt = dtMs * this.timeScale;
    this.simTime += dt;
    const ctx = this.ctx(dt);
    this.noticeReveals(ctx.surfaces);
    this.apply(stepBrain(this.state!, this.fresh && this.fresh.until > this.simTime ? { ...ctx, preferSurfaces: this.fresh.ids } : ctx));
    this.checkNear();
    this.m?.sensors.tick();
    this.m?.poops?.expire(this.simTime);
  }

  /**
   * After scrolling down, ledges that came into view are remembered for a moment (a jump then
   * prefers them) and "scroll-reveal" is emitted, at most once a second.
   */
  private noticeReveals(list: readonly Surface[]): void {
    const doc = this.win.document;
    const y = this.win.scrollY + (doc.body ? doc.body.scrollTop : 0);
    if (y > this.scrollY + 1) this.lastScrollDown = this.simTime;
    this.scrollY = y;
    const added = list.filter((s) => !this.seen.has(s.id)).map((s) => s.id);
    this.seen = new Set(list.map((s) => s.id));
    // Ledges are re-measured a moment after a scroll, and pages often fade content in, so
    // anything that turns up shortly after scrolling down counts as revealed by it.
    const recentlyDown = this.simTime - this.lastScrollDown < REVEAL.afterScrollMs;
    if (!recentlyDown || !added.length || this.simTime - this.lastReveal < REVEAL.everyMs) return;
    this.lastReveal = this.simTime;
    this.fresh = { ids: added, until: this.simTime + REVEAL.preferMs };
    this.emit('scroll-reveal', { count: added.length });
  }

  /** Emit "near" when the cursor comes close, once per approach. */
  private checkNear(): void {
    const s = this.state;
    if (!s || !this.m) return;
    if (!this.cursor || s.mode !== 'ground') {
      this.cursorNear = false;
      return;
    }
    const px = this.pixelSize();
    const [fw, fh] = this.m.manifest.frameSize;
    const d = Math.hypot(this.cursor.x - s.body.x, this.cursor.y - (s.body.y - (fh * px) / 2));
    const r = fw * px * NEAR_FRAMES;
    if (!this.cursorNear && d < r) {
      this.cursorNear = true;
      this.emit('near');
    } else if (this.cursorNear && d > r * NEAR_HYSTERESIS) {
      this.cursorNear = false;
    }
  }

  /** Where the next poop would go, in viewport px. */
  private nextPoopSpot(): { x: number; y: number } | null {
    const s = this.state;
    if (!s || !this.m || s.mode !== 'ground') return null;
    return poopSpot(s.body.x, s.body.y, s.body.facing, this.m.manifest.frameSize[0] * this.pixelSize());
  }

  private poopSpotIsGood(): boolean {
    const spot = this.nextPoopSpot();
    const poops = this.m?.poops;
    return !!spot && !!poops && poops.hasRoom && poops.isSafeAt(spot.x, spot.y, this.pixelSize());
  }

  /** The poop step finished: drop the pile if the spot is (still) safe. */
  private dropPoop(): void {
    const spot = this.nextPoopSpot();
    const poops = this.m?.poops;
    if (!spot || !poops || !poops.isSafeAt(spot.x, spot.y, this.pixelSize())) return;
    const on = this.state!.on;
    poops.drop(spot.x, spot.y, on === null ? null : this.m?.scanner?.elementOf(on) ?? null, this.simTime, this.pixelSize());
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
    const m = this.m;
    if (!s || !m) return;
    m.poops?.render(this.simTime, this.pixelSize(), this.win.devicePixelRatio || 1);
    m.view.draw({
      anim: s.anim,
      elapsed: this.simTime - s.animStart,
      x: s.body.x,
      y: s.body.y,
      facing: s.body.facing,
      scale: this.petScale(),
      dpr: this.win.devicePixelRatio || 1,
      cursor: m.input.isDragging ? 'grabbing' : 'grab',
    });
  }
}

function withSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

/** "cream-cat" → "Cream cat" for menu labels. */
function prettyName(id: string): string {
  const s = id.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
