import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import homePageApi, { useGetHomePreferencesQuery } from '@/api/home-page/home-page.api.service';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import {
  HOME_PREFERENCES_VERSION,
  hydrateHomePreferences,
  resolveInitialAssignedGroup,
  selectHomeTabs,
  setHomeSelections,
  type HomePreferences,
} from '@/features/home-page/homePreferences.slice';
import {
  loadHomePreferences,
  saveHomePreferences,
} from '@/features/home-page/homePreferencesStorage';
import {
  reconcileHomePreferences,
  serializeHomePreferences,
} from '@/features/home-page/homePreferencesSync';
import { clearLegacyHomePins, readLegacyHomePinIds } from '@/features/home-page/legacyHomePins';
import { isHomePriorityTab, resolveActiveTab } from './homeTabs';

/** How long to wait after the last change before saving to the server. */
const SAVE_DEBOUNCE_MS = 500;
/** Matches the server's pin limit; only the newest pins from a legacy import can fit anyway. */
const LEGACY_IMPORT_MAX = 25;

/**
 * Loads the user's Home preferences and writes them back as they change. Returns true once the
 * cached copy is loaded - callers should render nothing until then so the page never flashes the
 * default layout or fires a task request with the wrong tab.
 *
 * The server holds the real copy. localStorage is only a first-paint cache: the page renders from
 * it straight away, then GET /home/preferences reconciles (and wins if it differs). Nothing is sent
 * to the server until that first GET has succeeded, so a stale cache can never overwrite it.
 * Changes are saved to the server after a short pause, and flushed if the page is left sooner.
 *
 * The active tab and the assigned-to-me/by-me toggle live in `homeTasksConfig` (other cards read
 * it), so they are copied in on load and mirrored back into the preferences when they change.
 */
export const useHomePreferencesSync = (): boolean => {
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const userKey = authService.getCurrentSession()?.id ?? 'anonymous';

  const [syncedUserKey, setSyncedUserKey] = useState(userKey);
  const [isServerSynced, setIsServerSynced] = useState(false);

  const prevUserKeyRef = useRef<string>(userKey);
  const hydratedUserKeyRef = useRef<string | null>(null);
  /** The last document known to be on the server, so unchanged preferences are never re-sent. */
  const lastSyncedRef = useRef<string | null>(null);
  const pendingRef = useRef<HomePreferences | null>(null);
  const importedUserRef = useRef<string | null>(null);

  // When userKey changes in the same SPA session, reset query/sync state and refs so
  // preferences from the prior account do not leak or overwrite the new account's storage.
  if (syncedUserKey !== userKey) {
    setSyncedUserKey(userKey);
    setIsServerSynced(false);
  }

  if (prevUserKeyRef.current !== userKey) {
    prevUserKeyRef.current = userKey;
    lastSyncedRef.current = null;
    pendingRef.current = null;
    hydratedUserKeyRef.current = null;
  }

  const { layout, tabs, continueTabs, selections, isHydrated } = useAppSelector(state => state.homePreferencesReducer);
  // The tabs on screen, which include the Customize dialog's live preview.
  const visibleTabsConfig = useAppSelector(selectHomeTabs);
  const homeTasksConfig = useAppSelector(state => state.homePageReducer.homeTasksConfig);

  const configRef = useRef(homeTasksConfig);
  configRef.current = homeTasksConfig;
  // The saved (never previewed) preferences as of the latest render.
  const savedRef = useRef<HomePreferences>({ version: HOME_PREFERENCES_VERSION, layout, tabs, continueTabs, selections });
  savedRef.current = { version: HOME_PREFERENCES_VERSION, layout, tabs, continueTabs, selections };

  /** Puts the table on the tab and assigned group a set of preferences says it should open on. */
  const seedTasksConfig = useCallback(
    (preferences: HomePreferences) => {
      const current_tab = resolveActiveTab(preferences.tabs, preferences.selections.priorityTab);
      // A pinned default wins over the group the table was last on.
      const tasks_group_by = resolveInitialAssignedGroup(preferences.selections);
      const config = configRef.current;
      if (config.current_tab !== current_tab || config.tasks_group_by !== tasks_group_by) {
        dispatch(setHomeTasksConfig({ ...config, current_tab, tasks_group_by }));
      }
    },
    [dispatch]
  );

  // 1. Cached copy: instant, so the page can render.
  useEffect(() => {
    const preferences = loadHomePreferences(userKey);
    dispatch(hydrateHomePreferences(preferences));
    seedTasksConfig(preferences);
    hydratedUserKeyRef.current = userKey;
  }, [dispatch, userKey, seedTasksConfig]);

  // 2. Server copy: reconcile once, after the first successful fetch for this user.
  const {
    data: serverResponse,
    isFetching: isServerFetching,
    isSuccess: isServerLoaded,
  } = useGetHomePreferencesQuery(userKey, { refetchOnMountOrArgChange: true });

  const sendToServer = useCallback(
    (preferences: HomePreferences) => {
      const serialized = serializeHomePreferences(preferences);
      dispatch(homePageApi.endpoints.updateHomePreferences.initiate(preferences, { track: false }))
        .unwrap()
        .then(() => {
          lastSyncedRef.current = serialized;
        })
        .catch(error => {
          // Not worth interrupting the user: the cache keeps the change, and the next change retries.
          console.warn('Failed to save Home preferences:', error);
        });
    },
    [dispatch]
  );

  useEffect(() => {
    // A cached response from an earlier visit is shown while the fresh one loads - wait for the fresh one.
    if (!isHydrated || hydratedUserKeyRef.current !== userKey || isServerSynced || isServerFetching || !isServerLoaded || !serverResponse?.body) return;

    const { preferences, updated_at } = serverResponse.body;
    const decision = reconcileHomePreferences(savedRef.current, preferences, updated_at);

    if (decision.action === 'adopt-server') {
      dispatch(hydrateHomePreferences(decision.preferences));
      seedTasksConfig(decision.preferences);
      lastSyncedRef.current = serializeHomePreferences(decision.preferences);
    } else if (decision.action === 'push-local') {
      sendToServer(savedRef.current);
      lastSyncedRef.current = serializeHomePreferences(savedRef.current);
    } else {
      lastSyncedRef.current = serializeHomePreferences(savedRef.current);
    }
    setIsServerSynced(true);
  }, [dispatch, isHydrated, isServerSynced, isServerFetching, isServerLoaded, serverResponse, seedTasksConfig, sendToServer, userKey]);

  const currentTab = homeTasksConfig.current_tab;
  const assignedGroup = homeTasksConfig.tasks_group_by === 1 ? 1 : 0;
  useEffect(() => {
    if (!isHydrated || hydratedUserKeyRef.current !== userKey || !isHomePriorityTab(currentTab)) return;
    if (currentTab !== selections.priorityTab || assignedGroup !== selections.assignedGroup) {
      dispatch(setHomeSelections({ priorityTab: currentTab, assignedGroup }));
    }
  }, [dispatch, isHydrated, userKey, currentTab, assignedGroup, selections.priorityTab, selections.assignedGroup]);

  // Hiding the active tab in the Customize dialog moves the table to the first tab still shown.
  useEffect(() => {
    if (!isHydrated || hydratedUserKeyRef.current !== userKey || !isHomePriorityTab(currentTab)) return;
    const active = resolveActiveTab(visibleTabsConfig, currentTab);
    if (active !== currentTab) {
      dispatch(setHomeTasksConfig({ ...configRef.current, current_tab: active }));
    }
  }, [dispatch, isHydrated, userKey, visibleTabsConfig, currentTab]);

  // Cache every change locally...
  useEffect(() => {
    if (!isHydrated || hydratedUserKeyRef.current !== userKey) return;
    saveHomePreferences(userKey, { version: HOME_PREFERENCES_VERSION, layout, tabs, continueTabs, selections });
  }, [userKey, isHydrated, layout, tabs, continueTabs, selections]);

  // ...and send it to the server after a pause.
  const flushPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    sendToServer(pending);
  }, [sendToServer]);

  useEffect(() => {
    if (!isHydrated || !isServerSynced || hydratedUserKeyRef.current !== userKey) return;
    const current = savedRef.current;
    if (serializeHomePreferences(current) === lastSyncedRef.current) {
      pendingRef.current = null;
      return;
    }
    pendingRef.current = current;
    const timer = setTimeout(flushPending, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [userKey, isHydrated, isServerSynced, layout, tabs, continueTabs, selections, flushPending]);

  // Leaving the page within the pause must not lose the last change.
  useEffect(() => flushPending, [flushPending]);

  // 3. One-time: upload pins made before pins were stored on the server.
  useEffect(() => {
    if (importedUserRef.current === userKey) return;
    importedUserRef.current = userKey;

    const taskIds = readLegacyHomePinIds(userKey).slice(-LEGACY_IMPORT_MAX);
    if (taskIds.length === 0) {
      clearLegacyHomePins(userKey);
      return;
    }

    // The active session can change while an import request is in flight. Do not let the
    // remainder of one user's legacy pins be sent using the next user's session.
    const isStillCurrentUser = () => (authService.getCurrentSession()?.id ?? 'anonymous') === userKey;

    (async () => {
      for (const taskId of taskIds) {
        if (!isStillCurrentUser()) return;
        const result = await dispatch(homePageApi.endpoints.pinHomeTask.initiate(taskId, { track: false }));
        if (!isStillCurrentUser()) return;
        if ('error' in result) {
          const status = (result.error as { status?: unknown }).status;
          // A task that is gone, no longer visible, or over the limit is simply dropped. A server
          // or network failure means nothing can be imported right now: keep the pins and retry
          // on the next visit rather than losing them.
          if (typeof status !== 'number' || status >= 500) return;
        }
      }
      if (isStillCurrentUser()) clearLegacyHomePins(userKey);
    })();
  }, [authService, dispatch, userKey]);

  return isHydrated && hydratedUserKeyRef.current === userKey;
};
