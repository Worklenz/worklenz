import {
  useCallback,
  useEffect,
  useMemo,
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

  const [state, setState] = useState<AnalyticsFilterFields>(() => {
    return readAnalyticsFilterSession(reportKey, defaults).state;
  });
  const [wasRestored, setWasRestored] = useState(() => {
    return readAnalyticsFilterSession(reportKey, defaults).wasRestored;
  });

  useEffect(() => {
    const restored = readAnalyticsFilterSession(reportKey, defaults);
    setState(restored.state);
    setWasRestored(restored.wasRestored);
  }, [storageScope, reportKey, defaults]);

  useEffect(() => {
    writeAnalyticsFilterSession(reportKey, state);
  }, [reportKey, state]);

  const setDatePreset = useCallback<Dispatch<SetStateAction<AnalyticsDatePreset>>>(
    action => {
      setState(prev => {
        const next = toSetStateAction(action, prev.datePreset);
        return next === prev.datePreset ? prev : { ...prev, datePreset: next };
      });
    },
    []
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
    []
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
    []
  );

  const setSelectedTeamIds = useCallback<Dispatch<SetStateAction<string[]>>>(
    action => {
      setState(prev => {
        const next = toSetStateAction(action, prev.selectedTeamIds);
        return next === prev.selectedTeamIds ? prev : { ...prev, selectedTeamIds: next };
      });
    },
    []
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
    []
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
    []
  );

  const setIncludeDone = useCallback<Dispatch<SetStateAction<boolean>>>(
    action => {
      setState(prev => {
        const next = toSetStateAction(action, prev.includeDone);
        return next === prev.includeDone ? prev : { ...prev, includeDone: next };
      });
    },
    []
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
  if ((state.selectedTeamIds?.length ?? 0) > 0) return true;
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
