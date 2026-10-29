import { useCallback, useEffect, useState } from 'react';
import { getJSONFromLocalStorage, saveJSONToLocalStorage } from '@/utils/localStorageFunctions';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';
import { flatAnalyticsNavItems } from '@/lib/reporting/analytics-nav';

const STORAGE_KEY = 'worklenz.analyticsCustomReports';

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

const readStore = (): AnalyticsCustomReport[] => {
  const raw = getJSONFromLocalStorage(STORAGE_KEY);
  return Array.isArray(raw) ? (raw as AnalyticsCustomReport[]) : [];
};

const writeStore = (reports: AnalyticsCustomReport[]) => {
  saveJSONToLocalStorage(STORAGE_KEY, reports);
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
  templates: AnalyticsReportTemplate[]
): AnalyticsCustomReport[] => {
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
  writeStore(fromApi);
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
