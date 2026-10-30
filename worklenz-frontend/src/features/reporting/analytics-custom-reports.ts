import { useCallback, useEffect, useMemo, useState } from 'react';
import { getJSONFromLocalStorage, saveJSONToLocalStorage } from '@/utils/localStorageFunctions';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';
import { flatAnalyticsNavItems } from '@/lib/reporting/analytics-nav';
import { useAuthService } from '@/hooks/useAuth';
import { getUserSession } from '@/utils/session-helper';

const STORAGE_KEY_PREFIX = 'worklenz.analyticsCustomReports';

/** User-saved custom report / template (shown under Custom reports). */
export interface AnalyticsCustomReport {
  id: string;
  name: string;
  description?: string;
  /** Builtin report this was saved from, e.g. velocity, project-health */
  sourceKind?: string;
  createdAt: string;
  accessedAt?: string;
  creatorName?: string;
  /** Optional saved filter payload */
  filters?: Record<string, unknown>;
}

export const getAnalyticsCustomReportsStorageKey = (
  teamId?: string | null,
  userId?: string | null
): string => {
  const team = teamId?.trim() || 'unknown-team';
  const user = userId?.trim() || 'unknown-user';
  return `${STORAGE_KEY_PREFIX}:${team}:${user}`;
};

const readStore = (storageKey: string): AnalyticsCustomReport[] => {
  const raw = getJSONFromLocalStorage(storageKey);
  return Array.isArray(raw) ? (raw as AnalyticsCustomReport[]) : [];
};

const writeStore = (storageKey: string, reports: AnalyticsCustomReport[]) => {
  saveJSONToLocalStorage(storageKey, reports);
};

const notifyLocalUpdate = () => {
  window.dispatchEvent(new Event('worklenz-analytics-custom-reports'));
};

const labelForKind = (kind: string): string => {
  const item = flatAnalyticsNavItems().find(nav => nav.key === kind || nav.path === kind);
  return item?.defaultLabel ?? kind;
};

/**
 * Merge API report templates into the Custom reports list so saves appear
 * on the All reports hub and sidebar for every report kind.
 */
export const syncTemplatesToCustomReports = (
  templates: AnalyticsReportTemplate[],
  storageKey?: string
): AnalyticsCustomReport[] => {
  const session = getUserSession();
  const key =
    storageKey ||
    getAnalyticsCustomReportsStorageKey(session?.team_id, session?.id);

  const fromApi: AnalyticsCustomReport[] = templates.map(tpl => ({
    id: tpl.id,
    name: tpl.name,
    description: labelForKind(tpl.report_kind),
    sourceKind: tpl.report_kind,
    createdAt: tpl.created_at,
    accessedAt: tpl.updated_at,
    creatorName: tpl.owner_name,
    filters: tpl.filters_json ?? {},
  }));
  writeStore(key, fromApi);
  notifyLocalUpdate();
  return fromApi;
};

/** @deprecated Prefer syncTemplatesToCustomReports */
export const syncVelocityTemplatesToCustomReports = syncTemplatesToCustomReports;

/**
 * User custom reports for Reporting & Analytics.
 * Hub/sidebar list syncs from API templates via syncTemplatesToCustomReports.
 */
export const useAnalyticsCustomReports = () => {
  const auth = useAuthService();
  const session = auth.getCurrentSession();
  const storageKey = useMemo(
    () => getAnalyticsCustomReportsStorageKey(session?.team_id, session?.id),
    [session?.team_id, session?.id]
  );

  const [reports, setReports] = useState<AnalyticsCustomReport[]>(() =>
    readStore(storageKey)
  );

  useEffect(() => {
    setReports(readStore(storageKey));
  }, [storageKey]);

  useEffect(() => {
    const refresh = () => setReports(readStore(storageKey));
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('worklenz-analytics-custom-reports', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('worklenz-analytics-custom-reports', refresh);
    };
  }, [storageKey]);

  const refresh = useCallback(() => {
    setReports(readStore(storageKey));
  }, [storageKey]);

  const upsert = useCallback(
    (report: AnalyticsCustomReport) => {
      setReports(prev => {
        const without = prev.filter(r => r.id !== report.id);
        const next = [report, ...without];
        writeStore(storageKey, next);
        notifyLocalUpdate();
        return next;
      });
    },
    [storageKey]
  );

  const remove = useCallback(
    (id: string) => {
      setReports(prev => {
        const next = prev.filter(r => r.id !== id);
        writeStore(storageKey, next);
        notifyLocalUpdate();
        return next;
      });
    },
    [storageKey]
  );

  const syncTemplates = useCallback(
    (templates: AnalyticsReportTemplate[]) =>
      syncTemplatesToCustomReports(templates, storageKey),
    [storageKey]
  );

  return {
    customReports: reports,
    hasCustomReports: reports.length > 0,
    upsertCustomReport: upsert,
    removeCustomReport: remove,
    refreshCustomReports: refresh,
    storageKey,
    syncTemplatesToCustomReports: syncTemplates,
  };
};
