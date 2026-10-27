import { describe, expect, it } from 'vitest';
import { checkIdle, createIdle, noteActivity } from '../src/core/idle';
import { initialSettings, parseSettings, serializeSettings } from '../src/core/settings';

describe('settings', () => {
  it('round-trips', () => {
    const raw = serializeSettings({ enabled: false, pet: 'cream-cat', x: 0.123456 });
    expect(parseSettings(raw)).toEqual({ enabled: false, pet: 'cream-cat', x: 0.123 });
  });

  it('ignores junk, other versions and bad fields', () => {
    expect(parseSettings(null)).toEqual({});
    expect(parseSettings('not json')).toEqual({});
    expect(parseSettings('[1,2]')).toEqual({});
    expect(parseSettings(JSON.stringify({ v: 2, enabled: true }))).toEqual({});
    expect(parseSettings(JSON.stringify({ v: 1, enabled: 'yes', pet: '../evil', x: 7 }))).toEqual({});
  });

  it('stored choices beat site defaults, but only for pets still offered', () => {
    const defaults = { enabled: true, pet: 'cream-cat' };
    expect(initialSettings(defaults, {}, ['cream-cat'])).toEqual({ enabled: true, pet: 'cream-cat' });
    expect(initialSettings(defaults, { enabled: false, pet: 'dog', x: 0.5 }, ['cream-cat', 'dog']))
      .toEqual({ enabled: false, pet: 'dog', x: 0.5 });
    expect(initialSettings(defaults, { pet: 'gone' }, ['cream-cat']).pet).toBe('cream-cat');
  });
});

describe('visitor idle', () => {
  it('goes idle once after the threshold, and returns on the next input', () => {
    let s = createIdle(0);
    expect(checkIdle(s, 59_999, 60_000).event).toBeNull();
    let r = checkIdle(s, 60_000, 60_000);
    expect(r.event).toBe('visitor-idle');
    s = r.state;
    expect(checkIdle(s, 120_000, 60_000).event).toBeNull(); // only once
    r = noteActivity(s, 130_000);
    expect(r.event).toBe('visitor-return');
    expect(noteActivity(r.state, 130_001).event).toBeNull();
    expect(checkIdle(r.state, 150_000, 60_000).event).toBeNull(); // the clock restarted
  });
});
