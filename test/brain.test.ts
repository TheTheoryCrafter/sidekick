import { describe, expect, it } from 'vitest';
import { Behavior } from '../src/core/behavior';
import {
  BRAIN, FALLBACK_ACTION, createBrain, dispatch, grab, holdAt, pickTarget, play, release, stepBrain,
  type BrainCtx, type BrainEffect, type BrainState,
} from '../src/core/brain';
import { defaultBehavior } from '../src/core/defaults';
import { validateManifest } from '../src/core/manifest';
import { seededRng, type Rng } from '../src/core/rng';
import creamCat from '../pets/cream-cat/manifest.json';

// Tiny test pet: "loop" loops; "once" is 4 frames at 4 fps = 1000 ms, one-shot.
const pet = validateManifest({
  id: 'test',
  sheet: 's.png',
  frameSize: [8, 8],
  animations: {
    loop: { row: 0, frames: 2, fps: 4, loop: true },
    once: { row: 1, frames: 4, fps: 4, loop: false },
  },
  roles: { ambient: 'loop', move: 'loop', zoomies: 'loop', oneshot: 'once' },
}).manifest!;

const zero: Rng = () => 0;

/** An rng returning the given values in order, then the last one forever. */
function scripted(...values: number[]): Rng {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
}

function makeCtx(behavior: Behavior, over: Partial<BrainCtx> = {}): BrainCtx {
  return { now: 0, dt: 1 / 60, rng: zero, manifest: pet, behavior, minX: 0, maxX: 1000, minY: 50, floorY: 600, walkSpeed: 60, hour: 12, cursor: null, ...over };
}

function idleState(x = 500): BrainState {
  return {
    body: { x, y: 600, facing: 1 }, mode: 'ground', vel: { x: 0, y: 0 }, thrown: false,
    action: null, anim: 'loop', animStart: 0, cooldowns: {}, lastDone: {}, nextTick: Infinity,
  };
}

/** Run the brain for `ms` of sim time from ctx.now, collecting effects. */
function run(s: BrainState, ctx: BrainCtx, ms: number): { state: BrainState; effects: BrainEffect[]; now: number } {
  const effects: BrainEffect[] = [];
  const stepMs = 1000 / 60;
  let now = ctx.now;
  const end = ctx.now + ms;
  while (now < end) {
    now += stepMs;
    const r = stepBrain(s, { ...ctx, now, dt: stepMs / 1000 });
    s = r.state;
    effects.push(...r.effects);
  }
  return { state: s, effects, now };
}

function behaviorWith(...setup: ((b: Behavior) => void)[]): Behavior {
  const b = new Behavior();
  b.addAction({ id: 'a', role: 'ambient', duration: 1000 });
  b.addAction({ id: 'b', role: 'ambient', duration: 1000 });
  setup.forEach((f) => f(b));
  return b;
}

const starts = (fx: BrainEffect[]) => fx.filter((e) => e.type === 'action-start').map((e) => (e as { action: string }).action);

describe('createBrain', () => {
  it('puts the pet on the floor, inside bounds, with nothing running', () => {
    const s = createBrain(-50, makeCtx(new Behavior()));
    expect(s.body).toMatchObject({ x: 0, y: 600 });
    expect(s.action).toBeNull();
    expect(s.anim).toBe('loop');
  });
});

describe('choosing what to do when idle', () => {
  const b = behaviorWith((b) => {
    b.addRule({ id: 'ra', on: 'idle', action: 'a', chance: 0.5, priority: 10 });
    b.addRule({ id: 'rb', on: 'idle', action: 'b', chance: 1, priority: 0 });
  });

  it('tries higher priority first and rolls its chance', () => {
    expect(stepBrain(idleState(), makeCtx(b, { rng: scripted(0.4) })).state.action?.id).toBe('a');
    expect(stepBrain(idleState(), makeCtx(b, { rng: scripted(0.6, 0) })).state.action?.id).toBe('b');
  });

  it('plays the fallback when no rule matches', () => {
    expect(stepBrain(idleState(), makeCtx(new Behavior())).state.action?.id).toBe(FALLBACK_ACTION.id);
  });

  it('skips rules whose action does not exist', () => {
    const b2 = behaviorWith((b) => b.addRule({ id: 'ghost', on: 'idle', action: 'nope', priority: 99 }));
    expect(stepBrain(idleState(), makeCtx(b2)).state.action?.id).toBe(FALLBACK_ACTION.id);
  });

  it('respects cooldowns', () => {
    const b2 = behaviorWith((b) => {
      b.addRule({ id: 'ra', on: 'idle', action: 'a', cooldown: 5000, priority: 1 });
      b.addRule({ id: 'rb', on: 'idle', action: 'b' });
    });
    const r1 = stepBrain(idleState(), makeCtx(b2, { now: 100 }));
    expect(r1.state.action?.id).toBe('a');
    expect(r1.state.cooldowns.ra).toBe(5100);
    const r2 = stepBrain({ ...r1.state, action: null }, makeCtx(b2, { now: 2000 }));
    expect(r2.state.action?.id).toBe('b');
    const r3 = stepBrain({ ...r1.state, action: null }, makeCtx(b2, { now: 5100 }));
    expect(r3.state.action?.id).toBe('a');
  });

  it('checks conditions, treating unknown ones as false', () => {
    const b2 = behaviorWith((b) => {
      b.addRule({ id: 'ra', on: 'idle', action: 'a', if: ['flag'], priority: 2 });
      b.addRule({ id: 'unknown', on: 'idle', action: 'a', if: 'missing', priority: 1 });
      b.addRule({ id: 'rb', on: 'idle', action: 'b' });
    });
    let flag = false;
    b2.addCondition('flag', () => flag);
    expect(stepBrain(idleState(), makeCtx(b2)).state.action?.id).toBe('b');
    flag = true;
    expect(stepBrain(idleState(), makeCtx(b2)).state.action?.id).toBe('a');
  });

  it('passes now, hour, action and lastDone to conditions', () => {
    let seen: unknown;
    const b2 = behaviorWith((b) => {
      b.addCondition('spy', (c) => { seen = c; return false; });
      b.addRule({ id: 'r', on: 'idle', action: 'a', if: 'spy' });
    });
    stepBrain({ ...idleState(), lastDone: { a: 5 } }, makeCtx(b2, { now: 42, hour: 23 }));
    expect(seen).toMatchObject({ now: 42, hour: 23, action: null, lastDone: { a: 5 }, cursor: null });
  });
});

describe('events and interruption', () => {
  const b = behaviorWith((b) => {
    b.addAction({ id: 'stubborn', role: 'ambient', duration: 5000, interruptible: false });
    b.addRule({ id: 'low', on: 'poke', action: 'b', priority: 10 });
    b.addRule({ id: 'high', on: 'shout', action: 'b', priority: 60 });
    b.addRule({ id: 'only-during-a', on: 'tap', action: 'b', during: ['a'], priority: 100 });
    b.addRule({ id: 'never-during-a', on: 'pat', action: 'b', notDuring: ['a'], priority: 100 });
  });
  const running = (id: string, priority: number): BrainState => ({
    ...idleState(),
    action: { id, step: 0, stepStart: 0, deadline: 1000, targetX: null, speed: 0, priority, rule: null },
  });

  it('a lower priority rule cannot interrupt', () => {
    const r = dispatch(running('a', 50), 'poke', makeCtx(b));
    expect(r.state.action?.id).toBe('a');
    expect(r.effects).toEqual([{ type: 'event', name: 'poke', rule: null }]);
  });

  it('a higher priority rule interrupts and reports it', () => {
    const r = dispatch(running('a', 50), 'shout', makeCtx(b));
    expect(r.state.action).toMatchObject({ id: 'b', priority: 60, rule: 'high' });
    expect(r.effects).toEqual([
      { type: 'event', name: 'shout', rule: 'high' },
      { type: 'action-end', action: 'a', interrupted: true },
      { type: 'action-start', action: 'b', rule: 'high' },
    ]);
  });

  it('non-interruptible actions ignore every rule', () => {
    expect(dispatch(running('stubborn', 0), 'shout', makeCtx(b)).state.action?.id).toBe('stubborn');
  });

  it('honours during and notDuring', () => {
    expect(dispatch(idleState(), 'tap', makeCtx(b)).state.action).toBeNull();
    expect(dispatch(running('a', 0), 'tap', makeCtx(b)).state.action?.id).toBe('b');
    expect(dispatch(running('a', 0), 'pat', makeCtx(b)).state.action?.id).toBe('a');
    expect(dispatch(idleState(), 'pat', makeCtx(b)).state.action?.id).toBe('b');
  });

  it('passes the event payload to conditions', () => {
    const b2 = behaviorWith((b) => {
      b.addCondition('big', (c) => (c.payload as { size: number }).size > 3);
      b.addRule({ id: 'r', on: 'drop', action: 'a', if: 'big' });
    });
    expect(dispatch(idleState(), 'drop', makeCtx(b2), { size: 1 }).state.action).toBeNull();
    expect(dispatch(idleState(), 'drop', makeCtx(b2), { size: 5 }).state.action?.id).toBe('a');
  });

  it('tick rules are checked once a second', () => {
    const b2 = behaviorWith((b) => b.addRule({ id: 't', action: 'a' }));
    const fx = run({ ...idleState(), nextTick: 0, action: { id: 'b', step: 0, stepStart: 0, deadline: 99_999, targetX: null, speed: 0, priority: -1, rule: null } }, makeCtx(b2), 2500);
    // Fires at once, then every second while 'a' (1000 ms) keeps finishing.
    expect(starts(fx.effects).filter((a) => a === 'a').length).toBeGreaterThanOrEqual(2);
  });
});

describe('running actions', () => {
  it('runs steps in order, emits, then ends and goes idle', () => {
    const b = behaviorWith((b) => {
      b.addAction({ id: 'seq', steps: [{ role: 'ambient', duration: 500, emit: 'half' }, { role: 'ambient', duration: 500 }] });
      b.addRule({ id: 'rest', on: 'idle', action: 'b' });
    });
    const p = play(idleState(), 'seq', makeCtx(b));
    expect(p.effects).toEqual([{ type: 'action-start', action: 'seq', rule: null }]);
    const r = run(p.state, makeCtx(b), 1100);
    expect(r.effects.map((e) => e.type)).toEqual(['emit', 'action-end', 'action-start']);
    expect(r.effects[0]).toEqual({ type: 'emit', name: 'half', action: 'seq' });
    expect(r.state.action?.id).toBe('b');
    expect(r.state.lastDone.seq).toBeGreaterThanOrEqual(1000);
  });

  it('chains into `next` with the same priority', () => {
    const b = behaviorWith((b) => b.addAction({ id: 'first', role: 'ambient', duration: 100, next: 'a' }));
    const r = run(play(idleState(), 'first', makeCtx(b), 77).state, makeCtx(b), 200);
    expect(r.state.action).toMatchObject({ id: 'a', priority: 77 });
  });

  it('an untimed one-shot step ends when its animation finishes', () => {
    const b = behaviorWith((b) => b.addAction({ id: 'shot', role: 'oneshot' }));
    const p = play(idleState(), 'shot', makeCtx(b));
    expect(p.state.anim).toBe('once');
    expect(run(p.state, makeCtx(b), 950).state.action?.id).toBe('shot');
    expect(run(p.state, makeCtx(b), 1050).state.action?.id).not.toBe('shot');
  });

  it('a timed step restarts a finished one-shot animation instead of freezing', () => {
    const b = behaviorWith((b) => b.addAction({ id: 'long', role: 'oneshot', duration: 3000 }));
    const r = run(play(idleState(), 'long', makeCtx(b)).state, makeCtx(b), 1500);
    expect(r.state.action?.id).toBe('long');
    expect(r.state.animStart).toBeGreaterThan(900);
  });

  it('a looping untimed step lasts the default time', () => {
    const b = behaviorWith((b) => b.addAction({ id: 'loopy', role: 'ambient' }));
    expect(play(idleState(), 'loopy', makeCtx(b)).state.action?.deadline).toBe(3000);
  });

  it('wander walks to a target at least minWanderPx away, facing it, then ends', () => {
    const b = behaviorWith((b) => b.addAction({ id: 'walk', role: 'move', motion: 'wander' }));
    const p = play(idleState(500), 'walk', makeCtx(b, { rng: scripted(0.9) }));
    const target = p.state.action!.targetX!;
    expect(Math.abs(target - 500)).toBeGreaterThanOrEqual(BRAIN.minWanderPx);
    expect(p.state.body.facing).toBe(target > 500 ? 1 : -1);
    const r = run(p.state, makeCtx(b), (Math.abs(target - 500) / 60) * 1000 + 100);
    expect(r.state.body.x).toBeCloseTo(target, 5);
    expect(r.state.action?.id).not.toBe('walk');
  });

  it('run goes far and fast', () => {
    const b = behaviorWith((b) => b.addAction({ id: 'dash', role: 'zoomies', motion: 'run' }));
    const p = play(idleState(100), 'dash', makeCtx(b, { rng: scripted(0.5) }));
    expect(Math.abs(p.state.action!.targetX! - 100)).toBeGreaterThanOrEqual(400);
    expect(p.state.action!.speed).toBe(180);
  });

  it('a moving step with no room ends straight away', () => {
    const b = behaviorWith((b) => b.addAction({ id: 'walk', role: 'move', motion: 'wander' }));
    const p = play(idleState(50), 'walk', makeCtx(b, { minX: 0, maxX: 100 }));
    expect(p.state.action!.targetX).toBeNull();
    expect(stepBrain(p.state, makeCtx(b, { minX: 0, maxX: 100, now: 16 })).state.action?.id).not.toBe('walk');
  });

  it('play defaults to priority 0, so events can interrupt it', () => {
    const b = behaviorWith((b) => b.addRule({ id: 'e', on: 'ev', action: 'b', priority: 0 }));
    const p = play(idleState(), 'a', makeCtx(b));
    expect(p.state.action?.priority).toBe(0);
    expect(dispatch(p.state, 'ev', makeCtx(b)).state.action?.id).toBe('b');
  });

  it('play ignores unknown actions', () => {
    const r = play(idleState(), 'nope', makeCtx(new Behavior()));
    expect(r.state.action).toBeNull();
    expect(r.effects).toEqual([]);
  });
});

describe('cursor', () => {
  it('face: cursor and away turn the pet at step start', () => {
    const b = behaviorWith((b) => {
      b.addAction({ id: 'look', role: 'ambient', face: 'cursor' });
      b.addAction({ id: 'snub', role: 'ambient', face: 'away' });
    });
    const left = { x: 100, y: 500 };
    expect(play(idleState(500), 'look', makeCtx(b, { cursor: left })).state.body.facing).toBe(-1);
    expect(play(idleState(500), 'snub', makeCtx(b, { cursor: left })).state.body.facing).toBe(1);
    expect(play(idleState(500), 'look', makeCtx(b)).state.body.facing).toBe(1); // no cursor: unchanged
  });

  it('follow walks up beside a moving cursor and stops', () => {
    const b = behaviorWith((b) => b.addAction({ id: 'come', role: 'move', motion: 'follow' }));
    const p = play(idleState(100), 'come', makeCtx(b, { cursor: { x: 400, y: 500 } }));
    expect(p.state.action!.targetX).toBe(400 - BRAIN.followStopPx);
    // The cursor moves further right while it walks.
    const r = run(p.state, makeCtx(b, { cursor: { x: 600, y: 500 } }), 20_000);
    expect(r.state.body.x).toBeCloseTo(600 - BRAIN.followStopPx, 5);
    expect(r.state.action?.id).not.toBe('come');
  });

  it('follow is skipped without a cursor', () => {
    const b = behaviorWith((b) => b.addAction({ id: 'come', role: 'move', motion: 'follow' }));
    expect(play(idleState(100), 'come', makeCtx(b)).state.action!.deadline).toBe(0);
  });
});

describe('drag, drop and throw', () => {
  const b = behaviorWith((b) => {
    b.addAction({ id: 'landed', role: 'ambient', duration: 500 });
    b.addAction({ id: 'cross', role: 'ambient', duration: 500 });
    b.addCondition('thrown', (c) => !!(c.payload as { thrown: boolean }).thrown);
    b.addRule({ id: 'land-thrown', on: 'land', if: 'thrown', priority: 2, action: 'cross' });
    b.addRule({ id: 'land', on: 'land', priority: 1, action: 'landed' });
    b.addRule({ id: 'busy', on: 'error', priority: 99, action: 'a' });
  });
  const ctx = makeCtx(b);

  it('grab stops the running action and plays "dragged"', () => {
    const playing = play(idleState(), 'a', ctx).state;
    const r = grab(playing, ctx);
    expect(r.state.mode).toBe('held');
    expect(r.state.action).toBeNull();
    expect(r.effects).toEqual([
      { type: 'action-end', action: 'a', interrupted: true },
      { type: 'event', name: 'drag-start', rule: null },
    ]);
  });

  it('a held pet follows holdAt within bounds, turns with the drag, and ignores rules and time', () => {
    let s = grab(idleState(500), ctx).state;
    s = holdAt(s, 300, 200, ctx);
    expect(s.body).toEqual({ x: 300, y: 200, facing: -1 });
    s = holdAt(s, 5000, -100, ctx);
    expect(s.body).toMatchObject({ x: 1000, y: 50, facing: 1 });
    expect(dispatch(s, 'error', ctx).state.action).toBeNull();
    expect(run(s, ctx, 2000).state.body).toEqual(s.body);
  });

  it('a gentle release is a drop: falls, lands, fires "land"', () => {
    const held = holdAt(grab(idleState(), ctx).state, 500, 560, ctx);
    const r1 = release(held, { x: 0, y: 0 }, ctx);
    expect(r1.state.mode).toBe('air');
    expect(r1.effects[0]).toMatchObject({ type: 'event', name: 'drop' });
    const r2 = run(r1.state, ctx, 1000);
    expect(r2.state.mode).toBe('ground');
    expect(r2.state.body.y).toBe(600);
    const land = r2.effects.find((e) => e.type === 'event' && e.name === 'land');
    expect(land).toMatchObject({ rule: 'land', payload: { thrown: false } });
  });

  it('a fast release is a throw, and the landing knows it', () => {
    const held = holdAt(grab(idleState(), ctx).state, 500, 300, ctx);
    const r1 = release(held, { x: 1500, y: -800 }, ctx);
    expect(r1.effects[0]).toMatchObject({ type: 'event', name: 'throw', payload: { vx: 1500, vy: -800 } });
    expect(r1.state.thrown).toBe(true);
    const r2 = run(r1.state, ctx, 5000);
    expect(r2.state.mode).toBe('ground');
    expect(r2.effects.find((e) => e.type === 'event' && e.name === 'land')).toMatchObject({ rule: 'land-thrown' });
    expect(r2.state.body.x).toBeGreaterThanOrEqual(0);
    expect(r2.state.body.x).toBeLessThanOrEqual(1000);
  });

  it('play is ignored while held or flying', () => {
    const held = grab(idleState(), ctx).state;
    expect(play(held, 'a', ctx).state.action).toBeNull();
  });

  it('release does nothing unless held', () => {
    expect(release(idleState(), { x: 900, y: 0 }, ctx).state.mode).toBe('ground');
  });
});

describe('pickTarget', () => {
  it('keeps the minimum distance and stays in bounds', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 500; i++) {
      const t = pickTarget(300, 80, 0, 1000, rng)!;
      expect(Math.abs(t - 300)).toBeGreaterThanOrEqual(80);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1000);
    }
    expect(pickTarget(50, 80, 0, 100, rng)).toBeNull();
  });
});

describe('default behavior with the cream cat', () => {
  it('runs for ten simulated minutes inside bounds, doing a variety of things', () => {
    const cat = validateManifest(creamCat).manifest!;
    const ctx = makeCtx(defaultBehavior(), { manifest: cat, rng: seededRng(11) });
    const s = createBrain(500, ctx);
    const r = run(s, ctx, 10 * 60_000);
    const seen = new Set(starts(r.effects));
    for (const a of ['sit', 'walk', 'sleep']) expect(seen, a).toContain(a);
    expect(r.state.body.x).toBeGreaterThanOrEqual(0);
    expect(r.state.body.x).toBeLessThanOrEqual(1000);
  });

  it('wakes up for a host event', () => {
    const cat = validateManifest(creamCat).manifest!;
    const ctx = makeCtx(defaultBehavior(), { manifest: cat });
    const sleeping = play(createBrain(500, ctx), 'sleep', ctx, 50).state;
    const r = dispatch(sleeping, 'tool-completed', ctx);
    expect(r.state.action?.id).toBe('eat');
    expect(r.state.anim).toBe('eat');
  });
});
