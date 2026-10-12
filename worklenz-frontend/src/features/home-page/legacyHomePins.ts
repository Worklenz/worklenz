// Pins made while Today's Priorities kept them in this browser's localStorage (before they were
// stored on the server). They are uploaded once, then removed. Safe to delete this file, and the
// import in useHomePreferencesSync, once no one is expected to still have such pins.

const LEGACY_PINS_KEY_PREFIX = 'worklenz.homePins';
const legacyKeyFor = (userId: string) => `${LEGACY_PINS_KEY_PREFIX}:${userId}`;

/** Task ids pinned in this browser, oldest first, so importing them in order keeps the newest on top. */
export const readLegacyHomePinIds = (userId: string): string[] => {
  try {
    const stored = localStorage.getItem(legacyKeyFor(userId));
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return [];
    return Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
      .sort((a, b) => a[1] - b[1])
      .map(([taskId]) => taskId);
  } catch {
    return [];
  }
};

export const clearLegacyHomePins = (userId: string): void => {
  try {
    localStorage.removeItem(legacyKeyFor(userId));
  } catch {
    // Storage blocked - nothing to clear.
  }
};
