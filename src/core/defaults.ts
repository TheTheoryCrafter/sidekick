// The behavior every pet starts with. Plain data: hosts can override any
// action or rule by registering one with the same id.

import { Behavior, type ActionInput, type ConditionFn, type RuleInput } from './behavior';

export const SLEEPY_AFTER_MS = 3 * 60_000;

export const DEFAULT_ACTIONS: ActionInput[] = [
  { id: 'sit', role: 'ambient', duration: [3000, 8000] },
  { id: 'walk', role: 'move', motion: 'wander' },
  {
    id: 'zoomies',
    steps: [
      { role: 'zoomies', motion: 'run' },
      { role: 'zoomies', motion: 'run' },
      { role: 'ambient', duration: 1500 },
    ],
  },
  {
    id: 'sleep',
    steps: [
      { role: 'tired' },
      { role: 'sleep', duration: [20_000, 45_000] },
    ],
  },
  { id: 'hide', role: 'hide' },
  { id: 'jump', role: 'jump', motion: 'jump' },
  // The pile appears when the step ends (the "poop" emit), behind the pet.
  { id: 'poop', role: 'poop', emit: 'poop', interruptible: false },
  { id: 'eat', role: 'tool-used' },
  { id: 'celebrate', role: 'success', duration: 2500 },
  { id: 'faint', role: 'error', duration: 4000 },

  // Reactions to the visitor.
  { id: 'startle', role: 'click', duration: 1000 },
  { id: 'happy', role: 'dblclick', duration: 2000 },
  { id: 'shy', role: 'hover' },
  { id: 'notice', role: 'near', face: 'cursor' },
  { id: 'approach', steps: [{ role: 'move', motion: 'follow' }, { role: 'near', face: 'cursor' }] },
  { id: 'land', role: 'landing' },
  { id: 'grumble', steps: [{ role: 'landing' }, { role: 'thrown', duration: 2000 }] },

  // Reactions to the page.
  { id: 'wake', role: 'tired' },
  { id: 'look', role: 'near' },
];

export const DEFAULT_RULES: RuleInput[] = [
  // Free time: tried highest priority first, the first whose chance roll succeeds wins.
  { id: 'sleep-at-night', on: 'idle', if: ['night', 'sleepy'], chance: 0.6, priority: 51, action: 'sleep' },
  { id: 'sleep-when-sleepy', on: 'idle', if: 'sleepy', chance: 0.3, priority: 50, action: 'sleep' },
  { id: 'zoomies', on: 'idle', chance: 0.06, cooldown: 90_000, priority: 40, action: 'zoomies' },
  { id: 'jump', on: 'idle', chance: 0.5, scaleBy: 'jumpiness', cooldown: 6000, priority: 35, action: 'jump' },
  // "poop-spot" is supplied by the page layer: poop is on, the pet has a pile sprite,
  // there is room for another, and nothing clickable is under the spot.
  { id: 'poop', on: 'idle', if: 'poop-spot', chance: 0.05, cooldown: 90_000, priority: 33, action: 'poop' },
  { id: 'hide', on: 'idle', chance: 0.05, cooldown: 120_000, priority: 30, action: 'hide' },
  { id: 'walk', on: 'idle', chance: 0.55, priority: 10, action: 'walk' },
  { id: 'sit', on: 'idle', chance: 1, priority: 0, action: 'sit' },

  // The visitor. Clicks beat everything except landing; hover and near are gentle.
  { id: 'land-after-throw', on: 'land', if: 'thrown', priority: 95, action: 'grumble' },
  { id: 'land', on: 'land', priority: 90, action: 'land' },
  { id: 'dblclick', on: 'dblclick', priority: 85, action: 'happy' },
  { id: 'click', on: 'click', priority: 80, cooldown: 300, action: 'startle' },
  { id: 'tap', on: 'tap', priority: 80, cooldown: 300, action: 'startle' },
  { id: 'hover', on: 'hover', priority: 20, chance: 0.7, cooldown: 10_000, notDuring: ['sleep'], action: 'shy' },
  { id: 'near-approach', on: 'near', priority: 15, chance: 0.3, scaleBy: 'clinginess', cooldown: 20_000, notDuring: ['sleep'], action: 'approach' },
  { id: 'near-notice', on: 'near', priority: 15, chance: 0.6, cooldown: 12_000, notDuring: ['sleep'], action: 'notice' },

  // Built-in page events.
  { id: 'visitor-idle', on: 'visitor-idle', priority: 45, chance: 0.8, notDuring: ['sleep'], action: 'sleep' },
  { id: 'visitor-return-wake', on: 'visitor-return', priority: 55, during: ['sleep'], action: 'wake' },
  { id: 'visitor-return', on: 'visitor-return', priority: 30, chance: 0.5, action: 'notice' },
  { id: 'tab-return', on: 'tab-return', priority: 40, chance: 0.8, action: 'happy' },
  { id: 'page-change', on: 'page-change', priority: 30, chance: 0.8, cooldown: 2000, notDuring: ['sleep'], action: 'look' },
  { id: 'copy', on: 'copy', priority: 30, cooldown: 5000, notDuring: ['sleep'], action: 'eat' },

  // Events from the host site.
  { id: 'tool-completed', on: 'tool-completed', priority: 60, cooldown: 3000, action: 'eat' },
  { id: 'success', on: 'success', priority: 60, cooldown: 3000, action: 'celebrate' },
  { id: 'error', on: 'error', priority: 70, cooldown: 3000, action: 'faint' },
  { id: 'poop-cleaned', on: 'poop-cleaned', priority: 25, chance: 0.5, cooldown: 5000, notDuring: ['sleep'], action: 'celebrate' },
];

export const DEFAULT_CONDITIONS: Record<string, ConditionFn> = {
  /** Awake for a while since the last nap (or since the pet appeared). */
  sleepy: ({ now, lastDone }) => now - (lastDone.sleep ?? 0) >= SLEEPY_AFTER_MS,
  /** 22:00–06:00 in the visitor's time zone. */
  night: ({ hour }) => hour >= 22 || hour < 6,
  /** Replaced by the page layer, which can see what's under the pet. */
  'poop-spot': () => false,
  /** For "land": the pet was thrown rather than set down. */
  thrown: ({ payload }) => !!(payload as { thrown?: boolean } | undefined)?.thrown,
};

/** A Behavior loaded with the defaults. Warnings would mean a bug in this file. */
export function defaultBehavior(): Behavior {
  const b = new Behavior();
  DEFAULT_ACTIONS.forEach((a) => b.addAction(a));
  DEFAULT_RULES.forEach((r) => b.addRule(r));
  Object.entries(DEFAULT_CONDITIONS).forEach(([k, fn]) => b.addCondition(k, fn));
  return b;
}
