import React, { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, Spin } from '@/shared/antd-imports';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { evt_reporting_time_in_status } from '@/shared/worklenz-analytics-events';
import { resetTimeInStatus } from '@/features/reporting/timeInStatus/time-in-status-slice';
import { ReportShell, useDefaultLastWeekFilter, useReportDateRange } from './report-shell';
import TimeInStatusToolbar from './time-in-status/time-in-status-toolbar';
import TimeInStatusChartCard from './time-in-status/time-in-status-chart-card';
import TimeInStatusTable from './time-in-status/time-in-status-table';
import TimeInStatusGroupedView from './time-in-status/time-in-status-grouped-view';
import { useTimeInStatusArgs } from './time-in-status/use-time-in-status-args';

const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

export const TimeInStatusReportPage = () => {
  const { t } = useTranslation('reporting-flow');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle(t('tis.title', { defaultValue: 'Time in Status' }));

  const viewMode = useAppSelector(state => state.timeInStatusReducer.viewMode);
  const dateRange = useReportDateRange();
  const isDateFilterReady = useDefaultLastWeekFilter();
  const { flowArgs, listArgs } = useTimeInStatusArgs(dateRange);

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_time_in_status);
    return () => {
      dispatch(resetTimeInStatus());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isDateFilterReady) return null;

  return (
    <ReportShell
      title={t('tis.title', { defaultValue: 'Time in Status' })}
      subtitle={t('tis.subtitle', {
        defaultValue:
          'Analyse how long tasks spend in each workflow status, so you can find where work stalls or ages and unblock it.',
      })}
    >
      <TimeInStatusToolbar />
      <TimeInStatusChartCard flowArgs={flowArgs} />
      {viewMode === 'grouped' ? (
        <TimeInStatusGroupedView listArgs={listArgs} />
      ) : (
        <TimeInStatusTable listArgs={listArgs} />
      )}
      <Suspense fallback={<Flex><Spin size="small" /></Flex>}>
        <TaskDrawer />
      </Suspense>
    </ReportShell>
  );
};

export default TimeInStatusReportPage;
