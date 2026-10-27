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
  { id: 'eat', role: 'tool-used' },
  { id: 'celebrate', role: 'success', duration: 2500 },
  { id: 'faint', role: 'error', duration: 4000 },
];

export const DEFAULT_RULES: RuleInput[] = [
  // Free time: tried highest priority first, the first whose chance roll succeeds wins.
  { id: 'sleep-at-night', on: 'idle', if: ['night', 'sleepy'], chance: 0.6, priority: 51, action: 'sleep' },
  { id: 'sleep-when-sleepy', on: 'idle', if: 'sleepy', chance: 0.3, priority: 50, action: 'sleep' },
  { id: 'zoomies', on: 'idle', chance: 0.06, cooldown: 90_000, priority: 40, action: 'zoomies' },
  { id: 'hide', on: 'idle', chance: 0.05, cooldown: 120_000, priority: 30, action: 'hide' },
  { id: 'walk', on: 'idle', chance: 0.55, priority: 10, action: 'walk' },
  { id: 'sit', on: 'idle', chance: 1, priority: 0, action: 'sit' },

  // Events from the host site.
  { id: 'tool-completed', on: 'tool-completed', priority: 60, cooldown: 3000, action: 'eat' },
  { id: 'success', on: 'success', priority: 60, cooldown: 3000, action: 'celebrate' },
  { id: 'error', on: 'error', priority: 70, cooldown: 3000, action: 'faint' },
];

export const DEFAULT_CONDITIONS: Record<string, ConditionFn> = {
  /** Awake for a while since the last nap (or since the pet appeared). */
  sleepy: ({ now, lastDone }) => now - (lastDone.sleep ?? 0) >= SLEEPY_AFTER_MS,
  /** 22:00–06:00 in the visitor's time zone. */
  night: ({ hour }) => hour >= 22 || hour < 6,
};

/** A Behavior loaded with the defaults. Warnings would mean a bug in this file. */
export function defaultBehavior(): Behavior {
  const b = new Behavior();
  DEFAULT_ACTIONS.forEach((a) => b.addAction(a));
  DEFAULT_RULES.forEach((r) => b.addRule(r));
  Object.entries(DEFAULT_CONDITIONS).forEach(([k, fn]) => b.addCondition(k, fn));
  return b;
}
