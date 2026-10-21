import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterOption } from '@/components/common/filters/MultiSelectFilterPill';
import { reportingTimeLogsApiService } from '@/api/reporting/reporting-time-logs.api.service';
import { practicesApiService } from '@/api/settings/practices/practices.api.service';
import { clientsApiService } from '@/api/clients/clients.api.service';
import { ITimeLogMemberOption } from '@/types/reporting/time-logs.types';
import logger from '@/utils/errorLogger';
import {
  IResolvedDateRange,
  NO_CLIENT_FILTER_ID,
  NO_PRACTICE_FILTER_ID,
} from './time-logs-filters';
import { ITimeLogsFilterOptions } from './TimeLogsFilterPanel';

const PRACTICES_PAGE_SIZE = 1000;

const LOADING: ITimeLogsFilterOptions = { options: [], loading: true, failed: false };

/**
 * Loads one filter's options once, when the page opens. A failure leaves the options empty and
 * flagged as failed (the pill says so) — it never blocks the table.
 */
const useLoadedOptions = (
  load: () => Promise<FilterOption[]>,
  description: string
): ITimeLogsFilterOptions => {
  const [state, setState] = useState<ITimeLogsFilterOptions>(LOADING);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(options => {
        if (!cancelled) setState({ options, loading: false, failed: false });
      })
      .catch(error => {
        logger.error(`Error fetching time log ${description} options`, error);
        if (!cancelled) setState({ options: [], loading: false, failed: true });
      });
    return () => {
      cancelled = true;
    };
    // Loaded once on mount. The loaders close over a translation function; a language switch
    // reloads the whole page, so the labels they read cannot go stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
};

/** Project, Client and Practice options: loaded once when the page opens. */
export const useStaticFilterOptions = () => {
  const { t } = useTranslation('time-report');

  const projects = useLoadedOptions(async () => {
    const res = await reportingTimeLogsApiService.getProjects();
    if (!res.done) throw new Error(res.message || 'Failed to load projects');
    return (res.body ?? []).map(p => ({ value: p.id, label: p.name }));
  }, 'project');

  const practices = useLoadedOptions(async () => {
    const res = await practicesApiService.getPractices(1, PRACTICES_PAGE_SIZE, 'name', 'asc', '');
    if (!res.done) throw new Error(res.message || 'Failed to load practices');
    return [
      {
        value: NO_PRACTICE_FILTER_ID,
        label: t('timeLogsNoPractice', { defaultValue: 'No practice' }),
      },
      ...(res.body?.data ?? []).map(p => ({ value: p.id as string, label: p.name as string })),
    ];
  }, 'practice');

  // The team-scoped lookup the Time Entries page already uses for its Client filter.
  const clients = useLoadedOptions(async () => {
    const res = await clientsApiService.getClientsLookup();
    if (!res.done) throw new Error(res.message || 'Failed to load clients');
    return [
      { value: NO_CLIENT_FILTER_ID, label: t('timeLogsNoClient', { defaultValue: 'No client' }) },
      ...(res.body ?? []).map(c => ({ value: c.id as string, label: c.name as string })),
    ];
  }, 'client');

  return { projects, practices, clients };
};

/**
 * Member options for the applied date range: every active member, plus
 * deactivated and removed users who logged time in that range (tagged, and
 * listed after the active ones). Selected members are kept in the list even
 * when a later range no longer contains them, so their checkmark never
 * silently disappears.
 */
export const useMemberFilterOptions = (
  range: IResolvedDateRange | null,
  selectedUserIds: string[]
): ITimeLogsFilterOptions => {
  const { t } = useTranslation('time-report');
  const [fetched, setFetched] = useState<ITimeLogMemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const knownRef = useRef(new Map<string, ITimeLogMemberOption>());
  const latestRequestRef = useRef(0);
  const from = range?.from;
  const to = range?.to;

  useEffect(() => {
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    (async () => {
      try {
        const res = await reportingTimeLogsApiService.getMembers({ date_from: from, date_to: to });
        if (requestId !== latestRequestRef.current) return;
        if (!res.done) throw new Error(res.message || 'Failed to load members');
        const members = res.body ?? [];
        members.forEach(m => knownRef.current.set(m.user_id, m));
        setFetched(members);
        setFailed(false);
      } catch (error) {
        if (requestId !== latestRequestRef.current) return;
        logger.error('Error fetching time log member options', error);
        setFailed(true);
      } finally {
        if (requestId === latestRequestRef.current) setLoading(false);
      }
    })();
  }, [from, to]);

  const options = useMemo<FilterOption[]>(() => {
    const present = new Set(fetched.map(m => m.user_id));
    const retained = selectedUserIds
      .filter(id => !present.has(id))
      .map(id => knownRef.current.get(id))
      .filter((m): m is ITimeLogMemberOption => !!m);

    const labelOf = (m: ITimeLogMemberOption) => {
      const name = m.name || m.email || '';
      if (m.is_removed)
        return `${name} (${t('timeLogsMemberRemoved', { defaultValue: 'Removed' })})`;
      if (!m.is_active)
        return `${name} (${t('timeLogsMemberDeactivated', { defaultValue: 'Deactivated' })})`;
      return name;
    };

    return [...fetched, ...retained].map(m => ({ value: m.user_id, label: labelOf(m) }));
  }, [fetched, selectedUserIds, t]);

  return { options, loading, failed };
};
