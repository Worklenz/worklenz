import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { analyticsTemplatesApiService } from '@/api/reporting/analytics-templates.api.service';
import { syncTemplatesToCustomReports } from '@/features/reporting/analytics-custom-reports';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';
import type { SaveAnalyticsTemplateValues } from '@/components/reporting/analytics/templates/SaveAnalyticsTemplateModal';

interface UseAnalyticsReportTemplatesOptions {
  reportKind: string;
  /** When opened from /custom/:id */
  customTemplateId?: string;
  /** Apply saved filters onto the page */
  onApply: (template: AnalyticsReportTemplate) => void;
  /** Current filters to persist when saving */
  getFilters: () => Record<string, unknown>;
}

/**
 * Shared save / load / apply flow for analytics report templates
 * (Custom reports hub + My Templates on each report page).
 */
export const useAnalyticsReportTemplates = ({
  reportKind,
  customTemplateId,
  onApply,
  getFilters,
}: UseAnalyticsReportTemplatesOptions) => {
  const { t } = useTranslation('reporting-analytics');
  const [searchParams, setSearchParams] = useSearchParams();
  const isCustomTemplateView = Boolean(customTemplateId);

  const [templates, setTemplates] = useState<AnalyticsReportTemplate[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const appliedDefaultTemplate = useRef(false);
  const appliedQueryTemplate = useRef<string | null>(null);
  const pendingTemplateId = useRef<string | null>(
    customTemplateId ?? searchParams.get('template')
  );
  const onApplyRef = useRef(onApply);
  const getFiltersRef = useRef(getFilters);
  onApplyRef.current = onApply;
  getFiltersRef.current = getFilters;

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;

  const loadTemplates = useCallback(async () => {
    try {
      const res = await analyticsTemplatesApiService.listTemplates(reportKind);
      if (!res.done || !Array.isArray(res.body)) return;

      setTemplates(res.body);

      // Refresh hub/sidebar Custom reports from all kinds only when that list succeeds.
      // Do not overwrite the cache with a single-kind list on failure.
      try {
        const all = await analyticsTemplatesApiService.listTemplates('all');
        if (all.done && Array.isArray(all.body)) {
          syncTemplatesToCustomReports(all.body);
        }
      } catch {
        // preserve cached reports from other kinds
      }

      const targetId = pendingTemplateId.current;
      if (targetId && appliedQueryTemplate.current !== targetId) {
        const fromTarget = res.body.find(tpl => tpl.id === targetId);
        if (fromTarget) {
          onApplyRef.current(fromTarget);
          appliedQueryTemplate.current = targetId;
          pendingTemplateId.current = null;
          appliedDefaultTemplate.current = true;
          if (!isCustomTemplateView && searchParamsRef.current.get('template')) {
            setSearchParamsRef.current(
              prev => {
                const next = new URLSearchParams(prev);
                next.delete('template');
                return next;
              },
              { replace: true }
            );
          }
          return;
        }
      }

      if (!isCustomTemplateView && !appliedDefaultTemplate.current) {
        const defaultTpl = res.body.find(tpl => tpl.is_default);
        if (defaultTpl) onApplyRef.current(defaultTpl);
        appliedDefaultTemplate.current = true;
      }
    } catch {
      // templates optional
    }
  }, [reportKind, isCustomTemplateView]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!customTemplateId) return;
    if (appliedQueryTemplate.current === customTemplateId) return;
    pendingTemplateId.current = customTemplateId;
    appliedDefaultTemplate.current = false;
    void loadTemplates();
  }, [customTemplateId, loadTemplates]);

  const handleSaveTemplate = useCallback(
    async (values: SaveAnalyticsTemplateValues) => {
      setSavingTemplate(true);
      try {
        const res = await analyticsTemplatesApiService.createTemplate({
          name: values.name,
          report_kind: reportKind,
          is_workspace_shared: values.is_workspace_shared,
          is_default: values.is_default,
          filters: getFiltersRef.current(),
        });
        if (res.done) {
          message.success(
            t('templateSavedToCustom', {
              defaultValue: 'Template saved. Find it under Custom reports.',
            })
          );
          setSaveOpen(false);
          void loadTemplates();
        } else {
          message.error(
            res.message || t('templateActionFailed', { defaultValue: 'Action failed' })
          );
        }
      } catch {
        message.error(t('templateActionFailed', { defaultValue: 'Action failed' }));
      } finally {
        setSavingTemplate(false);
      }
    },
    [reportKind, loadTemplates, t]
  );

  return {
    templates,
    saveOpen,
    setSaveOpen,
    savingTemplate,
    isCustomTemplateView,
    loadTemplates,
    handleSaveTemplate,
    applyTemplate: onApply,
  };
};
