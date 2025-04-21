import { Button, Card, Checkbox, Dropdown, Flex, Space, Typography } from 'antd';
import CustomPageHeader from '@/pages/reporting/page-header/custom-page-header';
import { DownOutlined } from '@ant-design/icons';
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

  useDocumentTitle('Reporting - Projects');

  const { total, archived } = useAppSelector(state => state.projectReportsReducer);

  const handleExcelExport = () => {
    if (currentSession?.team_name) {
      reportingExportApiService.exportProjects(currentSession.team_name);
    }
  };

  return (
    <Flex vertical>
      <CustomPageHeader
        title={`${total === 1 ? `${total}  ${t('projectCount')}` : `${total}  ${t('projectCountPlural')}`} `}
        children={
          <Space>
            <Button>
              <Checkbox checked={archived} onChange={() => dispatch(setArchived(!archived))}>
                <Typography.Text>{t('includeArchivedButton')}</Typography.Text>
              </Checkbox>
            </Button>

            <Dropdown
              menu={{ items: [{ key: '1', label: t('excelButton'), onClick: handleExcelExport }] }}
            >
              <Button type="primary" icon={<DownOutlined />} iconPosition="end">
                {t('exportButton')}
              </Button>
            </Dropdown>
          </Space>
        }
      />

      <Card title={<ProjectsReportsFilters />}>
        <ProjectReportsTable />
      </Card>
    </Flex>
  );
};

export default ProjectsReports;
