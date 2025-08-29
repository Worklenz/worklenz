import { Button, Card, Checkbox, Dropdown, Flex, Space, Typography } from '@/shared/antd-imports';
import { useMemo, useCallback, memo, useEffect } from 'react';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_projects_overview } from '@/shared/worklenz-analytics-events';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';
import { DownOutlined } from '@/shared/antd-imports';
import ProjectReportsTable from './projects-reports-table/projects-reports-table';
import ProjectsReportsFilters from './projects-reports-filters/project-reports-filters';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { setArchived } from '@/features/reporting/projectReports/project-reports-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';

const ProjectsReports = () => {
  const { t } = useTranslation('reporting-projects');
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();
  const { trackMixpanelEvent } = useMixpanelTracking();

  useDocumentTitle('Reporting - Projects');

  const { total, archived } = useAppSelector(state => state.projectReportsReducer);

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_projects_overview);
  }, [trackMixpanelEvent]);

  // Memoize the title to prevent recalculation on every render
  const pageTitle = useMemo(() => {
    return `${total === 1 ? `${total}  ${t('projectCount')}` : `${total}  ${t('projectCountPlural')}`} `;
  }, [total, t]);

  // Memoize the Excel export handler to prevent recreation on every render
  const handleExcelExport = useCallback(() => {
    const teamName = currentSession?.team_name || 'Team';
    reportingExportApiService.exportProjects(teamName);
  }, [currentSession?.team_name]);

  // Memoize the archived checkbox handler to prevent recreation on every render
  const handleArchivedChange = useCallback(() => {
    dispatch(setArchived(!archived));
  }, [dispatch, archived]);

  // Memoize the dropdown menu items to prevent recreation on every render
  const dropdownMenuItems = useMemo(
    () => [{ key: '1', label: t('excelButton'), onClick: handleExcelExport }],
    [t, handleExcelExport]
  );

  // Memoize the header children to prevent recreation on every render
  const headerChildren = useMemo(
    () => (
      <Space>
        <Button>
          <Checkbox checked={archived} onChange={handleArchivedChange}>
            <Typography.Text>{t('includeArchivedButton')}</Typography.Text>
          </Checkbox>
        </Button>

        <Dropdown menu={{ items: dropdownMenuItems }}>
          <Button type="primary" icon={<DownOutlined />} iconPosition="end">
            {t('exportButton')}
          </Button>
        </Dropdown>
      </Space>
    ),
    [archived, handleArchivedChange, t, dropdownMenuItems]
  );

  // Memoize the card title to prevent recreation on every render
  const cardTitle = useMemo(() => <ProjectsReportsFilters />, []);

  return (
    <Flex vertical>
      <CustomPageHeader title={pageTitle} children={headerChildren} />

      <Card title={cardTitle}>
        <ProjectReportsTable />
      </Card>
    </Flex>
  );
};

export default memo(ProjectsReports);
