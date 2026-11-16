import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadShowWeekendsPreference,
  saveShowWeekendsPreference,
} from './schedulePreferencesStorage';

describe('schedule preferences storage', () => {
  beforeEach(() => localStorage.clear());

  it('retains the show weekends preference for the same user', () => {
    saveShowWeekendsPreference('user-a', true);

    expect(loadShowWeekendsPreference('user-a')).toBe(true);
    expect(loadShowWeekendsPreference('user-b')).toBe(false);
  });

  it('defaults to hidden weekends when no preference has been saved', () => {
    expect(loadShowWeekendsPreference('user-a')).toBe(false);
  });
});
