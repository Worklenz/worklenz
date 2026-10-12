import {
  DEFAULT_HOME_PREFERENCES,
  HomePreferences,
  sanitizeHomePreferences,
} from './homePreferences.slice';

// First-paint cache of the Home preferences, so the page renders the saved layout immediately
// instead of waiting for GET /home/preferences. Keyed by user id so two people sharing a browser
// don't see each other's layout. Never the source of truth: the server copy wins when they differ.

const PREFERENCES_KEY_PREFIX = 'worklenz.homePreferences';

const keyFor = (userId: string) => `${PREFERENCES_KEY_PREFIX}:${userId}`;

export const loadHomePreferences = (userId: string): HomePreferences => {
  try {
    const stored = localStorage.getItem(keyFor(userId));
    return stored ? sanitizeHomePreferences(JSON.parse(stored)) : DEFAULT_HOME_PREFERENCES;
  } catch {
    // Storage blocked or the stored JSON is corrupt — fall back to the defaults.
    return DEFAULT_HOME_PREFERENCES;
  }
};

export const saveHomePreferences = (userId: string, preferences: HomePreferences): void => {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(preferences));
  } catch {
    // Storage full or blocked — preferences just won't survive a reload.
  }
};
