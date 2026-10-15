import {
  DEFAULT_HOME_PREFERENCES,
  sanitizeHomePreferences,
  type HomePreferences,
} from './homePreferences.slice';

// Pure decisions behind syncing the Home preferences with the server. The server copy is the source
// of truth; localStorage (homePreferencesStorage.ts) is only a first-paint cache.

/** A stable string for comparing two preferences documents regardless of key order or stray fields. */
export const serializeHomePreferences = (preferences: unknown): string =>
  JSON.stringify(sanitizeHomePreferences(preferences));

export type HomePreferencesReconciliation =
  /** The server has a saved document that differs from what is on screen: show it. */
  | { action: 'adopt-server'; preferences: HomePreferences }
  /** The server has nothing saved but this browser does (from before preferences were stored on the server): upload it. */
  | { action: 'push-local' }
  | { action: 'none' };

/**
 * Compares the cached local preferences with the server's response to GET /home/preferences.
 * `serverUpdatedAt` is null when the user has never saved on the server.
 */
export const reconcileHomePreferences = (
  local: HomePreferences,
  serverPreferences: unknown,
  serverUpdatedAt: string | null
): HomePreferencesReconciliation => {
  if (serverUpdatedAt) {
    const server = sanitizeHomePreferences(serverPreferences);
    return serializeHomePreferences(local) === serializeHomePreferences(server)
      ? { action: 'none' }
      : { action: 'adopt-server', preferences: server };
  }
  return serializeHomePreferences(local) === serializeHomePreferences(DEFAULT_HOME_PREFERENCES)
    ? { action: 'none' }
    : { action: 'push-local' };
};
