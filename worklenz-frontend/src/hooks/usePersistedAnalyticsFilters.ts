import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { AnalyticsDatePreset } from '@/components/reporting/analytics';
import {
  readAnalyticsFilterSession,
  resolveAnalyticsFilterReportKey,
  writeAnalyticsFilterSession,
  type AnalyticsPersistedFilterState,
} from '@/lib/reporting/analytics-filter-persistence';
import { getUserSession } from '@/utils/session-helper';

export interface AnalyticsFilterFields {
  datePreset: AnalyticsDatePreset;
  selectedProjectIds: string[];
  selectedMemberIds: string[];
  selectedTeamIds: string[];
  selectedStatusIds: string[];
  selectedHealthIds: string[];
  includeDone: boolean;
}

export const DEFAULT_ANALYTICS_FILTER_FIELDS: AnalyticsFilterFields = {
  datePreset: 'last_30_days',
  selectedProjectIds: [],
  selectedMemberIds: [],
  selectedTeamIds: [],
  selectedStatusIds: [],
  selectedHealthIds: [],
  includeDone: false,
};

interface UsePersistedAnalyticsFiltersOptions {
  reportKind: string;
  customTemplateId?: string;
  /** Partial overrides merged onto DEFAULT_ANALYTICS_FILTER_FIELDS. */
  defaults?: Partial<AnalyticsFilterFields>;
}

const toSetStateAction = <T,>(
  action: SetStateAction<T>,
  current: T
): T => (typeof action === 'function' ? (action as (prev: T) => T)(current) : action);

/**
 * Session-scoped analytics report filters (projects, members, teams, date, etc.).
 * Survives SPA navigation and tab refresh for the current workspace/user.
 */
export const usePersistedAnalyticsFilters = (
  options: UsePersistedAnalyticsFiltersOptions
) => {
  const { reportKind, customTemplateId, defaults: defaultOverrides } = options;

  const defaults = useMemo<AnalyticsFilterFields>(
    () => ({ ...DEFAULT_ANALYTICS_FILTER_FIELDS, ...defaultOverrides }),
    // Callers pass stable partials or inline once; prefer report identity for re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportKind, customTemplateId]
  );

  const session = getUserSession();
  const reportKey = useMemo(
    () => resolveAnalyticsFilterReportKey(reportKind, customTemplateId),
    [reportKind, customTemplateId]
  );
  const storageScope = `${session?.team_id ?? ''}:${session?.id ?? ''}:${reportKey}`;

  const readScope = () => {
    const restored = readAnalyticsFilterSession(reportKey, defaults);
    return { scope: storageScope, ...restored, shouldPersist: restored.wasRestored };
  };
  const scopeRef = useRef({ storageScope, reportKey, defaults });
  scopeRef.current = { storageScope, reportKey, defaults };
  const [stored, setStored] = useState(readScope);
  const current = stored.scope === storageScope ? stored : readScope();
  const { state, wasRestored } = current;

  useEffect(() => {
    if (stored.scope !== storageScope) setStored(current);
  }, [storageScope, stored.scope, current]);

  useEffect(() => {
    if (stored.scope === storageScope && stored.shouldPersist) {
      writeAnalyticsFilterSession(reportKey, stored.state);
    }
  }, [storageScope, reportKey, stored]);

  const updateState = useCallback((action: SetStateAction<AnalyticsFilterFields>, isAutomatic: boolean) => {
    setStored(prev => {
      const { storageScope: scope, reportKey: key, defaults: scopeDefaults } = scopeRef.current;
      const restored = prev.scope === scope ? null : readAnalyticsFilterSession(key, scopeDefaults);
      const base = restored ? { scope, ...restored, shouldPersist: restored.wasRestored } : prev;
      const next = toSetStateAction(action, base.state);
      const shouldPersist = base.shouldPersist || !isAutomatic;
      return next === base.state && shouldPersist === base.shouldPersist
        ? base
        : { ...base, state: next, shouldPersist };
    });
  }, []);
  const setState = useCallback<Dispatch<SetStateAction<AnalyticsFilterFields>>>(
    action => updateState(action, false), [updateState]
  );
  const setAutomaticProjectIds = useCallback<Dispatch<SetStateAction<string[]>>>(action => {
    updateState(prev => {
      const next = toSetStateAction(action, prev.selectedProjectIds);
      return next === prev.selectedProjectIds ? prev : { ...prev, selectedProjectIds: next };
    }, true);
  }, [updateState]);
  const setAutomaticTeamIds = useCallback<Dispatch<SetStateAction<string[]>>>(action => {
    updateState(prev => {
      const next = toSetStateAction(action, prev.selectedTeamIds);
      return next === prev.selectedTeamIds ? prev : { ...prev, selectedTeamIds: next };
    }, true);
  }, [updateState]);

  const setDatePreset = useCallback<Dispatch<SetStateAction<AnalyticsDatePreset>>>(
    action => {
      setState(prev => {
        const next = toSetStateAction(action, prev.datePreset);
        return next === prev.datePreset ? prev : { ...prev, datePreset: next };
      });
    },
    [setState]
  );

  const setSelectedProjectIds = useCallback<Dispatch<SetStateAction<string[]>>>(
    action => {
      setState(prev => {
        const next = toSetStateAction(action, prev.selectedProjectIds);
        return next === prev.selectedProjectIds
          ? prev
          : { ...prev, selectedProjectIds: next };
      });
    },
    [setState]
  );

  const setSelectedMemberIds = useCallback<Dispatch<SetStateAction<string[]>>>(
    action => {
      setState(prev => {
        const next = toSetStateAction(action, prev.selectedMemberIds);
        return next === prev.selectedMemberIds
          ? prev
          : { ...prev, selectedMemberIds: next };
      });
    },
    [setState]
  );

  const setSelectedTeamIds = useCallback<Dispatch<SetStateAction<string[]>>>(
    action => {
      setState(prev => {
        const next = toSetStateAction(action, prev.selectedTeamIds);
        return next === prev.selectedTeamIds ? prev : { ...prev, selectedTeamIds: next };
      });
    },
    [setState]
  );

  const setSelectedStatusIds = useCallback<Dispatch<SetStateAction<string[]>>>(
    action => {
      setState(prev => {
        const next = toSetStateAction(action, prev.selectedStatusIds);
        return next === prev.selectedStatusIds
          ? prev
          : { ...prev, selectedStatusIds: next };
      });
    },
    [setState]
  );

  const setSelectedHealthIds = useCallback<Dispatch<SetStateAction<string[]>>>(
    action => {
      setState(prev => {
        const next = toSetStateAction(action, prev.selectedHealthIds);
        return next === prev.selectedHealthIds
          ? prev
          : { ...prev, selectedHealthIds: next };
      });
    },
    [setState]
  );

  const setIncludeDone = useCallback<Dispatch<SetStateAction<boolean>>>(
    action => {
      setState(prev => {
        const next = toSetStateAction(action, prev.includeDone);
        return next === prev.includeDone ? prev : { ...prev, includeDone: next };
      });
    },
    [setState]
  );

  return {
    datePreset: state.datePreset,
    selectedProjectIds: state.selectedProjectIds,
    selectedMemberIds: state.selectedMemberIds,
    selectedTeamIds: state.selectedTeamIds,
    selectedStatusIds: state.selectedStatusIds,
    selectedHealthIds: state.selectedHealthIds,
    includeDone: state.includeDone,
    setDatePreset,
    setSelectedProjectIds,
    setAutomaticProjectIds,
    setAutomaticTeamIds,
    setSelectedMemberIds,
    setSelectedTeamIds,
    setSelectedStatusIds,
    setSelectedHealthIds,
    setIncludeDone,
    wasRestored,
  };
};

/** True when persisted filters should win over a saved default template. */
export const hasMeaningfulAnalyticsFilters = (
  state: AnalyticsPersistedFilterState,
  defaults: Partial<AnalyticsFilterFields> = DEFAULT_ANALYTICS_FILTER_FIELDS
): boolean => {
  if ((state.selectedProjectIds?.length ?? 0) > 0) return true;
  if ((state.selectedMemberIds?.length ?? 0) > 0) return true;
  const seededTeamId = getUserSession()?.team_id;
  if (state.selectedTeamIds?.some(id => id !== seededTeamId)) return true;
  if ((state.selectedStatusIds?.length ?? 0) > 0) return true;
  if ((state.selectedHealthIds?.length ?? 0) > 0) return true;
  if (state.includeDone) return true;
  if (
    state.datePreset &&
    state.datePreset !== (defaults.datePreset ?? DEFAULT_ANALYTICS_FILTER_FIELDS.datePreset)
  ) {
    return true;
  }
  return false;
};
