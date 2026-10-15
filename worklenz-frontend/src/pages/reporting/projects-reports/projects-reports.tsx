import { Flex, Typography } from '@/shared/antd-imports';
import { useMemo, memo, useEffect } from 'react';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_projects_overview } from '@/shared/worklenz-analytics-events';
import ProjectReportsTable from './components/projects-reports-table/projects-reports-table';
import ProjectsGroupedView from './components/projects-grouped-view/projects-grouped-view';
import ProjectsReportsFilters from './components/projects-reports-filters/project-reports-filters';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import {
  fetchReportingTeams,
  fetchProjectDataForCurrentView,
} from '@/features/reporting/projectReports/project-reports-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';

const ProjectsReports = () => {
  const { t } = useTranslation('reporting-projects');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();

  useDocumentTitle('Reporting - Projects');

  const { archived, viewMode } = useAppSelector(state => state.projectReportsReducer);

  // Fetch data after filters are reset
  useEffect(() => {
    trackMixpanelEvent(evt_reporting_projects_overview);
    dispatch(fetchReportingTeams());
  }, [trackMixpanelEvent, dispatch]);

  // Initial data fetch when component mounts
  useEffect(() => {
    dispatch(fetchProjectDataForCurrentView());
  }, [dispatch]);

  // Fetch data when archived state changes
  useEffect(() => {
    dispatch(fetchProjectDataForCurrentView());
  }, [archived, dispatch]);

  const content = useMemo(() => {
    if (viewMode === 'grouped') {
      return <ProjectsGroupedView />;
    }
    return <ProjectReportsTable />;
  }, [viewMode]);

  return (
    // Fills the reporting layout (viewport - top bar - content padding) so only the table scrolls.
    <Flex vertical gap={16} style={{ height: 'calc(100vh - 52px - 48px)', overflow: 'hidden' }}>
      <Flex vertical>
        <Typography.Title level={3} className="!mb-0 !mt-1">
          {t('pageTitle', { defaultValue: 'Projects Overview' })}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t('pageSubtitle', {
            defaultValue: 'Track status, health, timelines and progress across all your projects.',
          })}
        </Typography.Text>
      </Flex>

      <ProjectsReportsFilters />

      {content}
    </Flex>
  );
};

export default memo(ProjectsReports);
