import { useCallback, useEffect, useState } from 'react';
import { getJSONFromLocalStorage, saveJSONToLocalStorage } from '@/utils/localStorageFunctions';

const STORAGE_KEY = 'worklenz.analyticsCustomReports';

/** User-saved custom report (from Save as custom / templates). */
export interface AnalyticsCustomReport {
  id: string;
  name: string;
  description?: string;
  /** Builtin report this was saved from, e.g. velocity */
  sourceKind?: string;
  createdAt: string;
  accessedAt?: string;
  creatorName?: string;
  /** Optional saved filter payload for later phases */
  filters?: Record<string, unknown>;
}

const readStore = (): AnalyticsCustomReport[] => {
  const raw = getJSONFromLocalStorage(STORAGE_KEY);
  return Array.isArray(raw) ? (raw as AnalyticsCustomReport[]) : [];
};

const writeStore = (reports: AnalyticsCustomReport[]) => {
  saveJSONToLocalStorage(STORAGE_KEY, reports);
};

/**
 * User custom reports for Reporting & Analytics.
 * Phase 1: localStorage-backed; swap for API (analytics_report_templates) later.
 * Custom reports section/tab only renders when this list is non-empty.
 */
export const useAnalyticsCustomReports = () => {
  const [reports, setReports] = useState<AnalyticsCustomReport[]>(() => readStore());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setReports(readStore());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const refresh = useCallback(() => {
    setReports(readStore());
  }, []);

  const upsert = useCallback((report: AnalyticsCustomReport) => {
    setReports(prev => {
      const without = prev.filter(r => r.id !== report.id);
      const next = [report, ...without];
      writeStore(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setReports(prev => {
      const next = prev.filter(r => r.id !== id);
      writeStore(next);
      return next;
    });
  }, []);

  return {
    customReports: reports,
    hasCustomReports: reports.length > 0,
    upsertCustomReport: upsert,
    removeCustomReport: remove,
    refreshCustomReports: refresh,
  };
};
