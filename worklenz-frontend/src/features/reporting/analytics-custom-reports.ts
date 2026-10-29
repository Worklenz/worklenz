import { useCallback, useEffect, useState } from 'react';
import { getJSONFromLocalStorage, saveJSONToLocalStorage } from '@/utils/localStorageFunctions';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';

const STORAGE_KEY = 'worklenz.analyticsCustomReports';

/** User-saved custom report / template (shown under Custom templates). */
export interface AnalyticsCustomReport {
  id: string;
  name: string;
  description?: string;
  /** Builtin report this was saved from, e.g. velocity */
  sourceKind?: string;
  createdAt: string;
  accessedAt?: string;
  creatorName?: string;
  /** Optional saved filter payload */
  filters?: Record<string, unknown>;
}

const readStore = (): AnalyticsCustomReport[] => {
  const raw = getJSONFromLocalStorage(STORAGE_KEY);
  return Array.isArray(raw) ? (raw as AnalyticsCustomReport[]) : [];
};

const writeStore = (reports: AnalyticsCustomReport[]) => {
  saveJSONToLocalStorage(STORAGE_KEY, reports);
};

const notifyLocalUpdate = () => {
  // Same-tab listeners (storage events only fire across tabs).
  window.dispatchEvent(new Event('worklenz-analytics-custom-reports'));
};

/**
 * Merge API velocity templates into the Custom templates list so saves appear
 * on the All reports hub and sidebar (mockup: Custom templates section).
 */
export const syncVelocityTemplatesToCustomReports = (
  templates: AnalyticsReportTemplate[]
): AnalyticsCustomReport[] => {
  const existing = readStore();
  const withoutVelocity = existing.filter(r => r.sourceKind !== 'velocity');
  const fromApi: AnalyticsCustomReport[] = templates.map(tpl => ({
    id: tpl.id,
    name: tpl.name,
    description: 'Velocity',
    sourceKind: 'velocity',
    createdAt: tpl.created_at,
    accessedAt: tpl.updated_at,
    creatorName: tpl.owner_name,
    filters: tpl.filters_json ?? {},
  }));
  const next = [...fromApi, ...withoutVelocity];
  writeStore(next);
  notifyLocalUpdate();
  return next;
};

/**
 * User custom reports for Reporting & Analytics.
 * Hub/sidebar list is local; velocity templates sync from API via
 * syncVelocityTemplatesToCustomReports after save/list/delete.
 */
export const useAnalyticsCustomReports = () => {
  const [reports, setReports] = useState<AnalyticsCustomReport[]>(() => readStore());

  useEffect(() => {
    const refresh = () => setReports(readStore());
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('worklenz-analytics-custom-reports', refresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('worklenz-analytics-custom-reports', refresh);
    };
  }, []);

  const refresh = useCallback(() => {
    setReports(readStore());
  }, []);

  const upsert = useCallback((report: AnalyticsCustomReport) => {
    setReports(prev => {
      const without = prev.filter(r => r.id !== report.id);
      const next = [report, ...without];
      writeStore(next);
      notifyLocalUpdate();
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setReports(prev => {
      const next = prev.filter(r => r.id !== id);
      writeStore(next);
      notifyLocalUpdate();
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
