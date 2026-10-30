import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import {
  AnalyticsFilterBar,
  ChartTableWrapper,
  InChartEmptyState,
  ReportEmptyState,
  ReportPageShell,
  type AnalyticsDatePreset,
  type AnalyticsExportFormat,
} from '@/components/reporting/analytics';
import { ANALYTICS_BASE_PATH } from '@/lib/reporting/analytics-nav';

interface AnalyticsReportPlaceholderProps {
  titleKey: string;
  titleDefault: string;
}

/**
 * Phase 1 shell for analytics reports ? real chart/data APIs land in later phases.
 * Provides filter bar, export menu, stacked chart + table, and empty state.
 */
export const AnalyticsReportPlaceholder: React.FC<AnalyticsReportPlaceholderProps> = ({
  titleKey,
  titleDefault,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const title = t(titleKey, { defaultValue: titleDefault });
  useDocumentTitle(title);
  const [datePreset, setDatePreset] = useState<AnalyticsDatePreset>('last_30_days');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [includeDone, setIncludeDone] = useState(false);

  const handleExport = (_format: AnalyticsExportFormat) => {
    // Format handlers wired per report in later phases.
  };

  return (
    <ReportPageShell
      title={title}
      onExport={handleExport}
      filters={
        <AnalyticsFilterBar
          projectOptions={[]}
          selectedProjectIds={projectIds}
          onProjectsChange={setProjectIds}
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          includeDone={includeDone}
          onIncludeDoneChange={setIncludeDone}
        />
      }
    >
      <ChartTableWrapper
        chartTitle={title}
        chart={<InChartEmptyState />}
        table={
          <ReportEmptyState
            title={t('placeholderEmptyTitle', { defaultValue: 'Report coming soon' })}
            description={t('placeholderEmptyDescription', {
              defaultValue: 'This analytics report will load data in a later phase.',
            })}
          />
        }
      />
    </ReportPageShell>
  );
};

export default AnalyticsReportPlaceholder;
